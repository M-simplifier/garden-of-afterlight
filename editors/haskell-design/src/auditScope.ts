import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isProjectConfig, readProjectConfig, ProjectConfig } from './projectConfig';

export const within = (parent: string, file: string): boolean => {
  const rel = path.relative(parent, file);
  return !rel || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
};
const excludedDirectory = (name: string) => name.startsWith('.') || /^(?:node_modules|vendor|third_party|dist(?:-.*)?|build|target|coverage|fixtures)$/.test(name);
export interface AuditScope { files: string[]; configs: string[]; directories: string[]; sourceDirectories: string[]; directoryInputs: Record<string, string>; declaredFiles: string[]; excluded: string[]; truncated: boolean }

function entrySignature(dir: string, entries: import('node:fs').Dirent[], sources: boolean, excluded: string[], declaredFiles: string[] = []): string {
  return JSON.stringify(entries.filter(e => !excluded.some(p => within(p, path.join(dir, e.name))))
    .filter(e => isProjectConfig(e.name) || declaredFiles.includes(path.join(dir, e.name)) || sources && (e.name.endsWith('.hs') || e.isDirectory() && !excludedDirectory(e.name)))
    .map(e => `${e.isDirectory() ? 'd' : e.isFile() ? 'f' : 'other'}:${e.name}`).sort());
}
export async function scopeDirectorySignature(scope: AuditScope, dir: string): Promise<string> {
  return fs.readdir(dir, { withFileTypes: true }).then(entries => entrySignature(dir, entries, scope.sourceDirectories.includes(dir), scope.excluded, scope.declaredFiles), error => {
    if (error.code === 'ENOENT') return 'missing';
    throw error;
  });
}

// Cabal defaults hs-source-dirs per component. A default/explicit "." is
// limited to declared modules and entry points, so docs and negative examples
// beside the package never become sources merely because one component omits it.
function cabalSources(text: string, dir: string): { roots: string[]; files: string[] } {
  type Stanza = { kind: string; name: string; fields: Map<string, string[]> };
  const stanzas: Stanza[] = [];
  let current: Stanza | undefined;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.replace(/--.*/, '');
    const header = /^(library|executable|test-suite|benchmark|foreign-library|common)\b\s*(.*?)\s*$/i.exec(line);
    if (header) { current = { kind: header[1]!.toLowerCase(), name: header[2]!, fields: new Map() }; stanzas.push(current); continue; }
    if (/^\S/.test(line)) current = undefined;
    const field = /^([ \t]+)([\w-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (!current || !field) continue;
    const values = [field[3]!];
    while (i + 1 < lines.length) {
      const next = lines[i + 1]!.replace(/--.*/, '');
      if (!next.trim()) { i++; continue; }
      const indent = next.match(/^[ \t]*/)?.[0].length ?? 0;
      if (indent <= field[1]!.length || /^\s*[\w-]+\s*:/.test(next)) break;
      values.push(next); i++;
    }
    const name = field[2]!.toLowerCase();
    current.fields.set(name, [...(current.fields.get(name) ?? []), ...[...values.join(' ').matchAll(/"([^"]+)"|([^\s,]+)/g)].map(m => m[1] ?? m[2]!)]);
  }
  const expanded = (stanza: Stanza, visited = new Set<Stanza>()): Map<string, string[]> => {
    if (visited.has(stanza)) return new Map();
    visited.add(stanza);
    const fields = new Map(stanza.fields);
    for (const name of fields.get('import') ?? []) {
      const common = stanzas.find(s => s.kind === 'common' && s.name === name);
      if (common) for (const [key, values] of expanded(common, visited)) fields.set(key, [...(fields.get(key) ?? []), ...values]);
    }
    return fields;
  };
  const roots = new Set<string>(), files = new Set<string>();
  for (const stanza of stanzas.filter(s => s.kind !== 'common')) {
    const fields = expanded(stanza), generated = new Set(fields.get('autogen-modules') ?? []);
    for (const value of fields.get('hs-source-dirs') ?? ['.']) {
      const source = path.resolve(dir, value);
      if (source !== dir) { roots.add(source); continue; }
      for (const name of [...(fields.get('exposed-modules') ?? []), ...(fields.get('other-modules') ?? []), ...(fields.get('test-module') ?? [])]) {
        if (!generated.has(name) && /^[A-Z][\w'.]*(?:\.[A-Z][\w']*)*$/.test(name)) files.add(path.join(dir, name.replace(/\./g, '/') + '.hs'));
      }
      for (const name of fields.get('main-is') ?? []) if (name.endsWith('.hs')) files.add(path.resolve(dir, name));
    }
  }
  return { roots: [...roots], files: [...files] };
}

// Discover build-owned source roots without reading arbitrary .hs files. Cabal
// fields can continue over lines and occur in conditional/common stanzas.
export async function auditScope(root: string, limit = 500, sourceConfig?: ProjectConfig): Promise<AuditScope> {
  const config = sourceConfig ?? await readProjectConfig(root);
  const excluded = [...(config.audit?.exclude ?? []), ...(config.components ?? []).filter(c => c.unsupportedReason).map(c => c.path)].map(p => path.resolve(root, p));
  const allowed = (file: string) => !excluded.some(p => within(p, file));
  const dirs = new Set<string>([root]), configs: string[] = [], sourceRoots = new Set<string>();
  const directoryInputs: Record<string, string> = {};
  const declaredFiles = new Set<string>();
  let visited = 0, truncated = false, hasBuild = false;
  const discover = async (dir: string): Promise<void> => {
    if (++visited > 10000) { truncated = true; return; }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    directoryInputs[dir] = entrySignature(dir, entries, false, excluded);
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (isProjectConfig(entry.name) || /^\.ghc\.environment\./.test(entry.name)) {
        if (entry.isSymbolicLink()) throw new Error(`リンクされた解析設定は利用できません: ${file}`);
        if (!entry.isFile()) continue;
        configs.push(file);
        dirs.add(dir);
        if (entry.name.endsWith('.cabal')) {
          hasBuild = true;
          const sources = cabalSources(await fs.readFile(file, 'utf8'), dir);
          for (const source of sources.roots) if (within(root, source) && allowed(source)) sourceRoots.add(source);
          for (const source of sources.files) if (within(root, source) && allowed(source)) declaredFiles.add(source);
        }
      } else if (entry.isDirectory() && !excludedDirectory(entry.name) && allowed(file)) await discover(file);
    }
  };
  await discover(root);
  const roots = config.audit?.include?.map(p => path.resolve(root, p)) ?? (hasBuild ? [...sourceRoots] : [root]);
  if (config.audit?.include) declaredFiles.clear();
  const files = new Set<string>(), walked = new Set<string>();
  const collect = async (dir: string): Promise<void> => {
    if (walked.has(dir) || !allowed(dir)) return;
    walked.add(dir); dirs.add(dir);
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { directoryInputs[dir] = 'missing'; return; } throw error; }
    directoryInputs[dir] = entrySignature(dir, entries, true, excluded);
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (!allowed(file)) continue;
      if (entry.isDirectory() && !excludedDirectory(entry.name)) await collect(file);
      else if (entry.isFile() && entry.name.endsWith('.hs')) {
        if (files.size >= limit) { truncated = true; return; }
        files.add(file);
      }
    }
  };
  for (const dir of roots) await collect(dir);
  if (!config.audit?.include) for (const file of declaredFiles) {
    const dir = path.dirname(file); dirs.add(dir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
    directoryInputs[dir] = entries ? entrySignature(dir, entries, walked.has(dir), excluded, [...declaredFiles]) : 'missing';
    if (entries?.some(e => e.isFile() && path.join(dir, e.name) === file)) {
      if (files.size >= limit) truncated = true; else files.add(file);
    }
  }
  // Only owned source directories and configuration parents need watching.
  for (const dir of Object.keys(directoryInputs)) if (!dirs.has(dir)) delete directoryInputs[dir];
  return { files: [...files].sort(), configs: configs.sort(), directories: [...dirs], sourceDirectories: [...walked], directoryInputs, declaredFiles: [...declaredFiles], excluded, truncated };
}
