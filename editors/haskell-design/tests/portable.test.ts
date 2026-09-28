import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import type { DesignController } from '../src/extension';

export async function run(): Promise<void> {
  const checks: string[] = [];
  const check = (name: string, value: unknown) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
  const wait = async (predicate: () => Promise<boolean> | boolean, timeout = 120000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await predicate()) return true; await new Promise(r => setTimeout(r, 200)); }
    return false;
  };
  const root = vscode.workspace.workspaceFolders![0]!.uri;
  const file = (name: string) => vscode.Uri.joinPath(root, name);
  check('project opened as a folder, without an Afterlight workspace file', !vscode.workspace.workspaceFile);
  check('folder settings select the project HLS', vscode.workspace.getConfiguration('haskell', root).get('manageHLS') === 'PATH');
  const viewer = vscode.extensions.getExtension<DesignController>('local-tools.haskell-design');
  const hls = vscode.extensions.getExtension('haskell.haskell');
  check('packaged viewer and official Haskell extension available', viewer && hls);
  await hls!.activate();
  const api = await viewer!.activate();
  const doc = await vscode.workspace.openTextDocument(file('engine/Lantern/Rules.hs'));
  const original = doc.getText();
  const position = doc.positionAt(original.indexOf('World', original.indexOf('advance ::')));
  await vscode.commands.executeCommand('vscode.open', doc.uri);
  check('opening .hs uses the design editor by default', await wait(() => vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom));
  await api.reveal(doc.uri, position.line + 1);
  check('HLS hover resolves the new game World', await wait(async () => {
    const hover = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', doc.uri, position);
    return (hover ?? []).flatMap(h => h.contents.map(c => typeof c === 'string' ? c : c.value)).some(value => value.includes('World'));
  }, 240000));
  const definitions = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>('vscode.executeDefinitionProvider', doc.uri, position);
  check('definition resolves to this game Types.hs', definitions?.some(d => ('targetUri' in d ? d.targetUri : d.uri).fsPath.endsWith('Types.hs')));
  const refs = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeReferenceProvider', doc.uri, position);
  check('references resolve across library modules', refs && refs.length > 2);
  const completion = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', doc.uri, position.translate(0, 3));
  check('HLS completion contains World', completion?.items.some(i => (typeof i.label === 'string' ? i.label : i.label.label).includes('World')));
  const formatting = await vscode.commands.executeCommand<vscode.TextEdit[]>('vscode.executeFormatDocumentProvider', doc.uri, { tabSize: 2, insertSpaces: true });
  check('HLS formatting is available', Array.isArray(formatting));
  for (const [name, expected] of [['engine/Lantern/Rules.hs', 'pure'], ['desktop/Main.hs', 'io'], ['checks/RulesSpec.hs', 'io']] as const) {
    const uri = file(name);
    await api.verifyDocument(uri);
    const model = await api.model(uri);
    check(`${name}: GHC-confirmed ${expected}`, model.verified && model.status === expected);
    if (expected === 'pure') check('unsigned function shows its inferred type', model.declarations.some(d => d.inferred && d.design.includes('scoreAfter :: Input -> World -> Int')));
    await api.reveal(uri, 1);
    check(`${name}: HLS loads its Cabal component`, await wait(async () => {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);
      return !!symbols?.length;
    }));
    const componentDoc = await vscode.workspace.openTextDocument(uri);
    const advance = componentDoc.positionAt(componentDoc.getText().indexOf('advance'));
    check(`${name}: HLS resolves the rule type in this component`, await wait(async () => {
      const hover = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', uri, advance);
      return (hover ?? []).flatMap(h => h.contents.map(c => typeof c === 'string' ? c : c.value)).some(value => value.includes('World'));
    }));
    check(`${name}: no HLS type errors`, !vscode.languages.getDiagnostics(uri).some(d => d.severity === vscode.DiagnosticSeverity.Error));
  }
  await api.reveal(doc.uri, 1);
  const edit = new vscode.WorkspaceEdit();
  edit.insert(doc.uri, doc.positionAt(original.length), '\neditorProbe :: Int\neditorProbe = "not an Int"\n');
  try {
    await vscode.workspace.applyEdit(edit);
    check('HLS diagnoses an unsaved type error', await wait(() => vscode.languages.getDiagnostics(doc.uri).some(d => d.severity === vscode.DiagnosticSeverity.Error)));
    await api.open(doc.uri);
    check('unsaved source opens in the design editor', vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom);
    await api.reveal(doc.uri, 1);
    check('unsaved edit survives the design round trip', doc.isDirty && doc.getText().includes('editorProbe'));
    await vscode.commands.executeCommand('undo');
    check('Undo restores the original source', doc.getText() === original);
    check('HLS clears the corrected diagnostic', await wait(() => !vscode.languages.getDiagnostics(doc.uri).some(d => d.severity === vscode.DiagnosticSeverity.Error)));
  } finally {
    if (doc.getText() !== original) {
      const restore = new vscode.WorkspaceEdit();
      restore.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), original);
      await vscode.workspace.applyEdit(restore);
    }
    check('game source on disk unchanged', await fs.readFile(doc.uri.fsPath, 'utf8') === original);
  }
  if (process.env.HASKELL_DESIGN_TEST_RESULT) await fs.writeFile(process.env.HASKELL_DESIGN_TEST_RESULT, JSON.stringify({ passed: true, checks }, null, 2));
}
