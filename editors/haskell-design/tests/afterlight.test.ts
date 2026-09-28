import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import type { DesignController } from '../src/extension';

export async function run(): Promise<void> {
  const checks: string[] = [];
  const check = (name: string, value: unknown) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
  const wait = async (predicate: () => Promise<boolean> | boolean, timeout = 120000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(r => setTimeout(r, 100)); }
    return false;
  };
  const folder = vscode.workspace.workspaceFolders![0]!.uri;
  const file = (name: string) => vscode.Uri.joinPath(folder, name);
  const extension = vscode.extensions.getExtension<DesignController>('local-tools.haskell-design');
  const hls = vscode.extensions.getExtension('haskell.haskell');
  check('Haskell Design and official Haskell extension installed', extension && hls);
  await hls!.activate();
  const api = await extension!.activate();
  const doc = await vscode.workspace.openTextDocument(file('src/Garden/Rules.hs'));
  const rules = doc.uri;
  const original = doc.getText();
  const at = original.indexOf('World', original.indexOf('advance ::'));
  const position = doc.positionAt(at);
  await api.reveal(rules, position.line + 1);
  console.log('HLS document:', JSON.stringify({ uri: doc.uri.toString(), language: doc.languageId, position, closed: doc.isClosed }));
  let attempts = 0;
  check('HLS hover resolves actual World type', await wait(async () => {
    const hover = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', rules, position);
    const values = (hover ?? []).flatMap(h => h.contents.map(c => typeof c === 'string' ? c : c.value));
    if (++attempts % 100 === 0) console.log('Waiting for hover:', JSON.stringify({ hover, values }));
    return values.some(value => value.includes('World'));
  }, 240000));
  const definitions = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>('vscode.executeDefinitionProvider', rules, position);
  check('HLS definition points to Types.hs', JSON.stringify(definitions).includes('Types.hs'));
  const refs = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', rules, position);
  check('HLS references span the real project', refs && refs.length > 2);
  const completion = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', rules, position.translate(0, 3));
  check('HLS completion includes World', JSON.stringify(completion).includes('World'));
  const formatting = await vscode.commands.executeCommand<vscode.TextEdit[]>('vscode.executeFormatDocumentProvider', rules, { tabSize: 2, insertSpaces: true });
  check('HLS formatting returns edits without applying them', formatting && formatting.length > 0);
  for (const [name, expected] of [['src/Garden/Change.hs', 'pure'], ['src/Garden/Audio.hs', 'io']]) {
    const uri = file(name!);
    await api.verifyDocument(uri);
    const model = await api.model(uri);
    check(`${name}: GHC-confirmed ${expected}`, model.verified && model.status === expected);
  }
  for (const name of ['src/Garden/Render.hs', 'tools/GardenCheck.hs']) {
    const uri = file(name);
    await api.reveal(uri, 1);
    check(`${name}: HLS loads component`, await wait(async () => {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);
      return !!symbols?.length;
    }));
    check(`${name}: no type errors`, !vscode.languages.getDiagnostics(uri).some(d => d.severity === vscode.DiagnosticSeverity.Error));
  }
  await api.reveal(rules, 1);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(rules, doc.positionAt(original.length), '\neditorProbe :: Int\neditorProbe = "not an Int"\n');
  try {
    await vscode.workspace.applyEdit(edit);
    check('unsaved type error is diagnosed', await wait(() => vscode.languages.getDiagnostics(rules).some(d => d.severity === vscode.DiagnosticSeverity.Error)));
    await api.open(rules);
    check('dirty source opens design', vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom);
    await api.reveal(rules, 1);
    check('dirty source survives design round trip', doc.isDirty && doc.getText().includes('editorProbe'));
    await vscode.commands.executeCommand('undo');
    check('Undo survives design round trip', doc.getText() === original);
    check('diagnostic clears after correction', await wait(() => !vscode.languages.getDiagnostics(rules).some(d => d.severity === vscode.DiagnosticSeverity.Error)));
  } finally {
    if (doc.getText() !== original) {
      const restore = new vscode.WorkspaceEdit();
      restore.replace(rules, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), original);
      await vscode.workspace.applyEdit(restore);
    }
    check('game source on disk unchanged', await fs.readFile(rules.fsPath, 'utf8') === original);
  }
  if (process.env.HASKELL_DESIGN_TEST_RESULT) await fs.writeFile(process.env.HASKELL_DESIGN_TEST_RESULT, JSON.stringify({ passed: true, checks }, null, 2));
}
