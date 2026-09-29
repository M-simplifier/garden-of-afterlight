import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { hash, Projector, compareDesigns } from './projector';
import { Design } from './model';
import { isProjectConfig } from './projectConfig';
import { auditScope } from './auditScope';

export const execute = promisify(execFile);
const ignored = new Set(['.git', 'node_modules', 'dist', 'dist-newstyle', '.stack-work', '.cabal', '.ghcup', '.test-output', '.haskell-design']);
const ignoredDirectory = (name: string) => ignored.has(name) || name.startsWith('.') || /^dist-wasm(?:-|$)/.test(name);
export async function listHaskellFiles(root: string, maxFiles = 500): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  let truncated = false;
  let visited = 0;
  const walk = async (dir: string): Promise<void> => {
    if (++visited > 10000) { truncated = true; return; }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a,b) => a.name.localeCompare(b.name))) {
      if (ignoredDirectory(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && /\.hs$/.test(entry.name)) {
        if (files.length >= maxFiles) { truncated = true; return; }
        files.push(file);
      }
      if (truncated) return;
    }
  };
  await walk(root);
  return { files, truncated };
}
export async function fingerprint(root: string, maxFiles = 5000): Promise<string> {
  const { files, truncated } = await listHaskellFiles(root, maxFiles);
  if (truncated) throw new Error('解析対象が上限を超えたため、依存ファイルの変更を確認できません。');
  const parts: string[] = [];
  for (const file of files) parts.push(file, hash(await fs.readFile(file, 'utf8')));
  // A compiler proof depends on project configuration as well as Haskell text.
  for (const file of await listConfigurationFiles(root)) parts.push(file, hash(await fs.readFile(file, 'utf8')));
  return hash(parts.join('\0'));
}
export async function listConfigurationFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  let visited = 0;
  const walk = async (dir: string): Promise<void> => {
    if (++visited > 10000) throw new Error('設定ファイルの探索が上限を超えたため、確認結果を保持できません。');
    for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && !ignoredDirectory(entry.name)) await walk(file);
      else if (isProjectConfig(entry.name)) {
        // Editors cannot reliably watch targets outside the workspace. Never
        // read a linked configuration while omitting it from proof invalidation.
        if (entry.isSymbolicLink()) throw new Error(`設定ファイルのシンボリックリンクは変更を追跡できません。実ファイルを配置してください: ${file}`);
        if (entry.isFile()) files.push(file);
      }
    }
  };
  await walk(root);
  return files;
}
export async function designDiff(projector: Projector, file: string, current: string) {
  const cwd = path.dirname(file);
  const { stdout: rootOutput } = await execute('git', ['rev-parse', '--show-toplevel'], { cwd, timeout: 5000 });
  const root = await fs.realpath(rootOutput.trim());
  const canonicalFile = await fs.realpath(file).catch(() => fs.realpath(path.dirname(file)).then(dir => path.join(dir, path.basename(file))));
  const relative = path.relative(root, canonicalFile).split(path.sep).join('/');
  if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('Gitの作業フォルダ外です。');
  let previous = '';
  let baseline = 'HEAD';
  try {
    await execute('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, timeout: 5000 });
    const tracked = await execute('git', ['ls-tree', '-z', 'HEAD', '--', relative], { cwd: root, timeout: 5000 });
    if (tracked.stdout) previous = (await execute('git', ['show', `HEAD:${relative}`], { cwd: root, timeout: 5000, maxBuffer: 4_000_000 })).stdout;
    else baseline = '新規ファイル';
  } catch (err) {
    // An unborn repository has an empty baseline; other Git failures are real errors.
    const refs = await execute('git', ['show-ref', '--head'], { cwd: root, timeout: 5000 }).catch(e => e.code === 1 ? { stdout: '' } : Promise.reject(e));
    if (refs.stdout.trim()) throw err;
    baseline = '最初のコミット前';
  }
  const before = await projector.project(previous, file);
  const after = await projector.project(current, file);
  return { before, after, baseline, ...compareDesigns(before, after) };
}
export async function relatedTests(root: string, names: string[]): Promise<{ file: string; line: number; text: string }[]> {
  if (!names.length) return [];
  const { files } = await listHaskellFiles(root);
  const results: { file: string; line: number; text: string }[] = [];
  for (const file of files.filter(f => /(?:test|spec|propert)/i.test(path.relative(root, f)))) {
    const text = await fs.readFile(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (names.some(name => line.split(/[^\p{L}\p{N}_']/u).includes(name))) results.push({ file, line: i + 1, text: line.trim() });
    });
  }
  return results.slice(0, 100);
}
export async function findDeclaration(projector: Projector, root: string, name: string, preferred?: Design) {
  const local = preferred?.declarations.find(d => d.names.includes(name));
  if (local) return { file: preferred!.file, line: local.line };
  const { files, truncated } = await auditScope(root);
  if (truncated) throw new Error('定義の探索範囲が上限を超えました。プロジェクトの対象ソースを絞ってください。');
  const matches: { file: string; line: number }[] = [];
  for (const file of files) {
    const design = await projector.project(await fs.readFile(file, 'utf8'), file);
    const declaration = design.declarations.find(d => d.names.includes(name));
    if (declaration) matches.push({ file, line: declaration.line });
  }
  return matches.length === 1 ? matches[0] : undefined;
}
