import { createHash } from 'node:crypto';
import path from 'node:path';
import { Parser, Language, Node as SyntaxNode } from 'web-tree-sitter';
import { Declaration, Design, Evidence, Reference, Verification } from './model';

export const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
let runtime: Promise<void> | undefined;
const structural = new Set(['data_type', 'newtype', 'type_synomym', 'type_family', 'type_instance', 'data_instance', 'deriving_instance', 'fixity', 'role_annotation', 'kind_signature', 'foreign_import', 'foreign_export']);
const comments = new Set(['comment', 'haddock']);
const bindings = new Set(['function', 'bind']);
const children = (n: SyntaxNode): SyntaxNode[] => n.namedChildren.filter((c): c is SyntaxNode => c !== null);

function descendants(node: SyntaxNode, predicate: (n: SyntaxNode) => boolean): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  const stack = [node];
  while (stack.length) {
    const n = stack.pop()!;
    if (predicate(n)) result.push(n);
    stack.push(...children(n).reverse());
  }
  return result;
}
function namesOf(n: SyntaxNode): string[] {
  const names = n.childForFieldName('names');
  const name = n.childForFieldName('name');
  if (names) return children(names).map(c => c.text);
  if (name) return [name.text];
  const pattern = n.childForFieldName('pattern');
  if (pattern) return descendants(pattern, c => c.type === 'variable').map(c => c.text);
  return [];
}
function references(n: SyntaxNode): Reference[] {
  return descendants(n, c => ['name', 'variable', 'constructor', 'operator'].includes(c.type))
    .map(c => ({ name: c.text, line: c.startPosition.row + 1, column: c.startPosition.column }));
}
function stripImplementation(n: SyntaxNode): string {
  if (n.type === 'class' || n.type === 'instance') {
    const body = n.childForFieldName('declarations');
    if (!body) return n.text;
    const kept = children(body).filter(c => c.type === 'signature' || structural.has(c.type) || comments.has(c.type));
    const header = n.text.slice(0, body.startIndex - n.startIndex).replace(/\s*where\s*\{?\s*$/, '').trimEnd();
    return kept.length ? `${header} where\n${kept.map(c => '  ' + c.text.trim().replace(/\n\s*/g, '\n  ')).join('\n')}` : header;
  }
  return n.text;
}

export class Projector {
  private parser?: Parser;
  private starting?: Promise<void>;
  constructor(private readonly assets: string) {}
  private async ready(): Promise<void> {
    this.starting ??= (async () => {
      runtime ??= Parser.init({ locateFile: (file: string) => path.join(this.assets, file) });
      await runtime;
      const language = await Language.load(path.join(this.assets, 'tree-sitter-haskell.wasm'));
      this.parser = new Parser();
      this.parser.setLanguage(language);
    })();
    await this.starting;
  }
  async project(source: string, file: string, verification?: Verification): Promise<Design> {
    await this.ready();
    const sourceHash = hash(source);
    const verified = verification !== undefined && verification.sourceHash === sourceHash && !verification.error;
    const proof = verification?.sourceHash === sourceHash ? verification : undefined;
    const base: Design = { file, module: path.basename(file, path.extname(file)), sourceHash, header: '', imports: [], declarations: [], status: 'unknown', evidence: [], issues: [], verified, verification: proof, text: '' };
    if (source.length > 2_000_000) {
      base.issues.push('2 MBを超えるファイルは解析対象外です。');
      return base;
    }
    const tree = this.parser!.parse(source);
    if (!tree) throw new Error('Haskellの構文解析を開始できませんでした。');
    try {
      const root = tree.rootNode;
      if (root.hasError) base.issues.push('構文エラー、または未対応の構文があります。表示できた宣言のみを載せています。');
      const top = children(root).flatMap(n => ['imports', 'declarations'].includes(n.type) ? children(n) : [n]);
      let docs: string[] = [];
      const signatures = new Map<string, Declaration>();
      const patterns = new Map<string, Declaration>();
      const inferred = new Map(proof?.signatures.map(s => [s.name, s.type]));
      const add = (n: SyntaxNode, kind: string, names: string[], design: string): Declaration => {
        const item: Declaration = { id: `${kind}:${names.join(',')}:${n.startPosition.row}`, kind, names, line: n.startPosition.row + 1, endLine: n.endPosition.row + 1, design: design.trim(), docs: docs.join('\n'), implementation: '', inferred: false, references: references(n) };
        docs = [];
        base.declarations.push(item);
        return item;
      };
      for (const n of top) {
        if (comments.has(n.type)) { docs.push(n.text); continue; }
        if (n.type === 'header') {
          base.header = n.text;
          base.module = n.childForFieldName('module')?.text ?? base.module;
          continue;
        }
        if (n.type === 'pragma') {
          add(n, 'pragma', [], n.text);
          continue;
        }
        if (n.type === 'import') { base.imports.push(n.text); continue; }
        if (n.type === 'signature') {
          const names = namesOf(n);
          const decl = add(n, 'signature', names, n.text);
          names.forEach(name => signatures.set(name, decl));
        } else if (bindings.has(n.type)) {
          const names = namesOf(n);
          if (!names.length) names.push(`binding@${n.startPosition.row + 1}`);
          for (const name of names) {
            let decl = signatures.get(name);
            if (!decl) {
              const type = inferred.get(name);
              decl = add(n, 'signature', [name], `${name} :: ${type ?? '?  -- GHCで型を確認'}`);
              decl.inferred = !!type;
              if (type) for (const token of new Set(type.match(/\b[A-Z][\w']*\b/g))) {
                if (!decl.references.some(r => r.name === token)) decl.references.push({ name: token, line: decl.line, column: 0, inferred: true });
              }
              signatures.set(name, decl);
            } else if (docs.length) { decl.docs += '\n' + docs.join('\n'); docs = []; }
            decl.implementation += (decl.implementation ? '\n' : '') + n.text;
            decl.endLine = Math.max(decl.endLine, n.endPosition.row + 1);
          }
        } else if (structural.has(n.type) || n.type === 'class' || n.type === 'instance') {
          const decl = add(n, n.type, namesOf(n), stripImplementation(n));
          if (['class', 'instance'].includes(n.type)) decl.implementation = n.text;
        } else if (n.type === 'pattern_synonym') {
          const signature = children(n).find(c => c.type === 'signature');
          const equation = children(n).find(c => c.type === 'equation');
          const synonym = (signature ?? equation)?.childForFieldName('synonym');
          const names = synonym ? descendants(synonym, c => ['constructor', 'constructor_operator'].includes(c.type)).map(c => c.text) : [];
          if (!names.length) names.push(`pattern@${n.startPosition.row + 1}`);
          if (signature) {
            const decl = add(n, 'pattern', names, n.text);
            names.forEach(name => patterns.set(name, decl));
          } else {
            const name = names[0]!;
            let decl = patterns.get(name);
            if (!decl) {
              decl = add(n, 'pattern', [name], `pattern ${name} :: ?  -- 型署名なし・定義を開いて確認`);
              patterns.set(name, decl);
              base.issues.push('型署名のないパターンシノニムがあります。元の定義を確認してください。');
            } else if (docs.length) { decl.docs += '\n' + docs.join('\n'); docs = []; }
            decl.implementation += (decl.implementation ? '\n' : '') + n.text;
            decl.endLine = n.endPosition.row + 1;
          }
        } else {
          const decl = add(n, 'unrecognised', [], `-- ${n.startPosition.row + 1}行目: ${n.type}（ソースで確認）`);
          decl.implementation = n.text;
          base.issues.push(`${n.startPosition.row + 1}行目の ${n.type} は設計抽出の対象外です。`);
        }
      }
      // Comments, strings and unused imports never serve as IO evidence.
      const identifiers = top.filter(n => !['header', 'import'].includes(n.type))
        .flatMap(n => descendants(n, c => ['name', 'variable'].includes(c.type)));
      const ioNames = new Set(['IO', 'MonadIO', 'MonadUnliftIO', 'unsafePerformIO', 'unsafeDupablePerformIO', 'unsafeIOToST', 'unsafeInterleaveIO']);
      // Syntax is a provisional hint only. A successful GHC result owns the
      // classification, including names such as a user-defined non-effect IO.
      for (const n of identifiers.filter(n => !verified && ioNames.has(n.text))) {
        base.evidence.push({ name: n.text, line: n.startPosition.row + 1, status: 'io', reason: 'ソースの型・制約・式にIOが現れます。' });
      }
      if (proof) base.evidence.push(...proof.evidence.map(e => {
        const occurrence = identifiers.find(n => n.text === e.name);
        return { ...e, line: occurrence ? occurrence.startPosition.row + 1 : e.line };
      }));
      if (proof?.error) base.issues.push(proof.error);
      base.status = verified ? proof!.status : base.evidence.some(e => e.status === 'io') ? 'io' : 'unknown';
      base.issues = [...new Set(base.issues)];
      base.text = renderDesign(base);
      return base;
    } finally { tree.delete(); }
  }
  dispose(): void { this.parser?.delete(); }
}

export function renderDesign(design: Design): string {
  const chunks = [design.header, design.imports.join('\n'), ...design.declarations.map(d => [d.docs, d.design].filter(Boolean).join('\n'))];
  return chunks.filter(Boolean).join('\n\n') + '\n';
}

export function compareDesigns(before: Design, after: Design): { changed: boolean; implementationChanged: boolean; unresolved: string[] } {
  const unresolved = after.declarations.filter(d => d.design.includes(':: ?')).flatMap(d => d.names);
  return { changed: before.text !== after.text, implementationChanged: before.sourceHash !== after.sourceHash, unresolved };
}
