import { promises as fs } from 'node:fs';
import path from 'node:path';
import { auditScope, within } from './auditScope';
import { Projector, hash, SourceSymbol } from './projector';
import { Design } from './model';
import { verify } from './compiler';

export interface ReadRequest {
  command: 'map' | 'outline' | 'show'; root: string;
  module?: string; file?: string; symbol?: string; line?: number;
  include?: string[]; exclude?: string[]; docs?: boolean; context?: boolean;
  maxChars?: number; maxFiles?: number; offset?: number; snapshot?: string;
  infer?: boolean; trusted?: boolean; ghcPath?: string; cacheDir?: string;
}
export interface ReadPage {
  schema: 1; command: ReadRequest['command']; snapshot: string; text: string;
  coverage: { files: number; declarations: number; sourceLines: number; sourceChars: number; discoveryTruncated: boolean };
  issueCount: number;
  next?: { offset: number; snapshot: string };
  blocked?: { offset: number; minimumChars: number; hint: string };
  matches?: number;
}
interface Document { file: string; relative: string; source: string; design: Design }
const unix = (value: string) => value.split(path.sep).join('/');
const lineCount = (value: string) => value ? value.replace(/\n$/, '').split('\n').length : 0;
const integer = (name: string, value: number | undefined, fallback: number, minimum: number, maximum: number) => {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result < minimum || result > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  return result;
};

export class CodeReader {
  readonly projector: Projector;
  constructor(readonly assets: string) { this.projector = new Projector(assets); }
  dispose(): void { this.projector.dispose(); }
  async read(request: ReadRequest): Promise<ReadPage> {
    if (!['map', 'outline', 'show'].includes(request.command)) throw new Error('Commands: map, outline, show.');
    const root = await fs.realpath(path.resolve(request.root));
    const maxFiles = integer('maxFiles', request.maxFiles, 500, 1, 5000);
    const maxChars = integer('maxChars', request.maxChars, 16000, 1024, 2_000_000);
    const offset = integer('offset', request.offset, 0, 0, 1_000_000);
    if (offset && !request.snapshot) throw new Error('Continuation requires --snapshot from the previous page.');
    if (request.line !== undefined) integer('line', request.line, 1, 1, 10_000_000);
    if (request.infer && (request.command !== 'outline' || !request.trusted || !(request.file || request.module))) throw new Error('Inference runs GHC: use outline with trusted: true and select a file or module. The default overview only parses source.');
    const relative = (value: string) => {
      const file = path.resolve(root, value);
      if (!within(root, file)) throw new Error(`Outside project: ${value}`);
      return unix(path.relative(root, file)) || '.';
    };
    // Compiler audit exclusions (e.g. a Wasm entry) are not reading exclusions.
    // Keep Cabal's source roots across conditional branches, with explicit scope overrides.
    const scope = request.file ? { files: [path.resolve(root, relative(request.file))], truncated: false } : await auditScope(root, maxFiles, {
      version: 1, audit: { include: request.include?.map(relative), exclude: request.exclude?.map(relative) },
    });
    const docs: Document[] = [];
    const issues: { file: string; messages: string[] }[] = [];
    const allInputs: string[] = [];
    let totalBytes = 0;
    for (const file of scope.files) {
      const name = unix(path.relative(root, file));
      if (!within(root, await fs.realpath(file))) throw new Error(`Linked file outside project: ${name}`);
      try {
        const stat = await fs.stat(file);
        if (stat.size > 2_000_000 || (totalBytes += stat.size) > 64_000_000) throw new Error('Source size limit reached (2 MB per file / 64 MB total). Narrow the scope.');
        const source = await fs.readFile(file, 'utf8');
        const design = await this.projector.project(source, file);
        allInputs.push(name, design.sourceHash);
        const matchesModule = !request.module || design.module === request.module || (request.command !== 'show' && !request.infer && design.module.startsWith(request.module + '.'));
        if (matchesModule) docs.push({ file, relative: name, source, design });
      } catch (error) {
        const message = String((error as Error).message);
        issues.push({ file: name, messages: [message] }); allInputs.push(name, 'unreadable:' + message);
      }
    }
    if (request.infer) for (const doc of docs) {
      const proof = await verify(doc.file, doc.source, path.join(this.assets, '../compiler/Main.hs'), { root, ghcPath: request.ghcPath, cacheDir: request.cacheDir });
      doc.design = await this.projector.project(doc.source, doc.file, proof);
    }
    const view = [root, request.command, request.module, request.symbol, request.line, request.docs, request.context, request.infer, scope.truncated];
    const snapshot = hash(allInputs.concat(JSON.stringify(view), ...docs.map(doc => hash(doc.design.text + JSON.stringify(doc.design.issues)))).join('\0')).slice(0, 20);
    if (request.snapshot && request.snapshot !== snapshot) throw new Error('Source snapshot or view options changed. Start again at offset 0; do not combine pages from different snapshots.');
    for (const doc of docs) if (doc.design.issues.length) issues.push({ file: doc.relative, messages: doc.design.issues });
    const coverage = { files: docs.length, declarations: docs.reduce((n, doc) => n + doc.design.declarations.length, 0),
      sourceLines: docs.reduce((n, doc) => n + lineCount(doc.source), 0), sourceChars: docs.reduce((n, doc) => n + doc.source.length, 0), discoveryTruncated: scope.truncated };
    const result: ReadPage = { schema: 1, command: request.command, snapshot, text: '', coverage, issueCount: issues.length };
    const chunks: string[] = [];
    if (request.command === 'show') {
      if (!(request.symbol || request.line)) throw new Error('show requires a symbol or source line. Add module/file when a name is ambiguous.');
      const name = request.symbol?.replace(/^\(([^\s]+)\)$/, '$1');
      const matches: { doc: Document; symbol: SourceSymbol }[] = [];
      for (const doc of docs) for (const symbol of await this.projector.sourceSymbols(doc.source)) {
        if ((!name || symbol.names.includes(name)) && (!request.line || symbol.line === request.line)) matches.push({ doc, symbol });
      }
      result.matches = matches.length;
      if (matches.length !== 1) {
        chunks.push(matches.length ? 'AMBIGUOUS: choose --file, --symbol and/or --line from these candidates; no implementation selected.' : 'NOT FOUND: use map/outline to check the saved source names and scope.');
        chunks.push(...matches.map(({ doc, symbol }) => `${doc.relative}:${symbol.line} ${doc.design.module} ${symbol.names.join(', ')}${symbol.owner ? ' [' + symbol.owner + ']' : ''}`));
      } else {
        const { doc, symbol } = matches[0]!;
        chunks.push(`## ${doc.design.module} | ${doc.relative}:${symbol.line}-${symbol.endLine}${symbol.owner ? '\n-- In ' + symbol.owner : ''}`);
        if (request.context) chunks.push([doc.design.header, ...doc.design.imports].filter(Boolean).join('\n'));
        if (request.docs && !symbol.owner) {
          const declaration = doc.design.declarations.find(d => d.names.some(n => symbol.names.includes(n)));
          if (declaration?.docs) chunks.push(declaration.docs);
        }
        chunks.push([symbol.signature, symbol.source].filter(Boolean).join('\n'));
      }
    } else for (const doc of docs) {
      if (request.command === 'map') chunks.push(`${doc.relative} -> ${doc.design.module} (${doc.design.declarations.length} declarations; ${lineCount(doc.source)} source lines)`);
      else {
        chunks.push(`## ${doc.design.module} | ${doc.relative}\n${doc.design.header}`.trim());
        if (request.context && doc.design.imports.length) chunks.push(doc.design.imports.join('\n'));
        for (const declaration of doc.design.declarations) {
          // RULES/ANN pragmas can themselves contain expressions. They are not types.
          const design = declaration.kind === 'pragma' && !/^\{-#\s*LANGUAGE\b/.test(declaration.design)
            ? '-- pragma; inspect with show --file ' + doc.relative + ' --line ' + declaration.line
            : declaration.design;
          chunks.push([`[${declaration.line}] ${design}`, ...(request.docs && declaration.docs ? [declaration.docs] : [])].join('\n'));
        }
      }
    }
    if (!docs.length && request.command !== 'show') chunks.push('NO MATCHING SOURCE FILES. Check the module/file filter and include paths.');
    for (const issue of issues) chunks.push(`WARNING ${issue.file}: ${issue.messages.map(message => message.length > 800 ? message.slice(0, 800) + ' [diagnostic shortened; inspect this file]' : message).join('\n')}`);
    if (offset > chunks.length) throw new Error('Offset is past the end of this result.');
    // Page only at complete syntax-unit boundaries. A giant definition is never
    // silently chopped into what could look like a complete type or function.
    let heading = `# ${request.command} | snapshot ${snapshot}\n# ${coverage.files} files, ${coverage.declarations} declarations; saved source only; private declarations included.\n` +
      (request.command === 'outline' ? '# Bodies hidden; ? means no type available. Syntax/type contracts do not establish runtime behavior.\n' : '') +
      (scope.truncated ? '# WARNING: file discovery limit reached; narrow scope or raise --max-files.\n' : '') +
      (issues.length ? `# WARNING: ${issues.length} files have parsing/reading/inference issues; diagnostics follow the source entries.\n` : '');
    if (offset && !chunks[offset]?.startsWith('## ')) {
      const context = chunks.slice(0, offset).reverse().find(chunk => chunk.startsWith('## '));
      if (context) heading += context.split('\n')[0] + '\n';
    }
    let body = heading;
    let index = offset;
    const reserve = 360;
    for (; index < chunks.length; index++) {
      const chunk = chunks[index]! + '\n\n';
      if (body.length + chunk.length + reserve > maxChars) break;
      body += chunk;
    }
    if (index < chunks.length) {
      result.next = { offset: index, snapshot };
      if (index === offset) result.blocked = { offset, minimumChars: heading.length + chunks[index]!.length + reserve + 2, hint: 'One complete declaration exceeds the budget. Raise maxChars or request a smaller symbol.' };
      body += `# NEXT --offset ${index} --snapshot ${snapshot}\n`;
      if (result.blocked) body += `# This complete item needs --max-chars ${result.blocked.minimumChars}. Nothing was cut inside it.\n`;
    } else body += '# END\n';
    result.text = body;
    return result;
  }
}
