import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { DesignController, editorType } from '../src/extension';
import type { ProjectAudit } from '../src/audit';

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension<DesignController>('local-tools.haskell-design');
  assert.ok(ext, 'extension must be installed in the development host');
  const api = await ext.activate();
  const folder = vscode.workspace.workspaceFolders![0]!.uri;
  if (process.env.HASKELL_DESIGN_TEST_AUTO) {
    const pure = vscode.Uri.joinPath(folder, 'Domain/Order.hs');
    const io = vscode.Uri.joinPath(folder, 'Application/Checkout.hs');
    const excluded = vscode.Uri.joinPath(folder, 'docs/Excluded.hs');
    const deadline = Date.now() + 60000;
    while ((await api.provideFileDecoration(pure))?.badge !== 'P' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal((await api.provideFileDecoration(pure))?.badge, 'P', 'startup did not automatically verify Pure');
    assert.equal((await api.provideFileDecoration(io))?.badge, 'IO');
    assert.equal((await api.provideFileDecoration(vscode.Uri.joinPath(folder, 'Domain/Dependent.hs')))?.badge, 'P', 'Trustworthy/Foldable module should be Pure');
    assert.equal((await api.provideFileDecoration(folder))?.badge, 'IO');
    assert.equal(await api.provideFileDecoration(excluded), undefined);
    assert.equal(await api.provideFileDecoration(vscode.Uri.joinPath(folder, 'docs')), undefined);
    assert.equal(vscode.workspace.textDocuments.some(d => d.uri.toString() === pure.toString() || d.uri.toString() === io.toString()), false, 'background indexing opened HLS documents');
    await vscode.commands.executeCommand('vscode.open', pure, { preview: false });
    assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputCustom);
    assert.equal((await api.model(pure)).status, 'pure');
    assert.doesNotMatch((await api.model(pure)).text, /confirm order =/);
    await vscode.commands.executeCommand('vscode.open', excluded, { preview: false });
    const limit = Date.now() + 5000;
    while (!(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText) && Date.now() < limit) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText, 'excluded source was intercepted as design');
    const audit = () => (api as unknown as { audits: Map<string, ProjectAudit> }).audits.get(folder.fsPath)!;
    const waitFor = async (condition: () => boolean) => {
      const until = Date.now() + 15000;
      while (!condition() && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 30));
      assert.ok(condition(), 'automatic index did not reach the expected state');
    };
    await waitFor(() => !audit().snapshot.pending);
    // Manual results and the automatic index share the same input lifecycle.
    // Change a closed dependency, keeping the checked target's text unchanged:
    // neither open-document events nor syntax IO hints can mask a stale proof.
    const hintClient = vscode.Uri.joinPath(folder, 'Domain/HintClient.hs');
    const hintAlias = vscode.Uri.joinPath(folder, 'Domain/HintAlias.hs');
    await api.verifyDocument(hintClient);
    assert.equal((await api.model(hintClient)).status, 'pure');
    assert.equal(vscode.workspace.textDocuments.some(d => !d.isClosed && d.uri.toString() === hintAlias.toString()), false);
    const aliasSource = await fs.readFile(hintAlias.fsPath, 'utf8');
    await fs.writeFile(hintAlias.fsPath, aliasSource.replace('Maybe', 'IO'));
    await waitFor(() => !audit().snapshot.pending && audit().snapshot.designs[hintClient.fsPath]?.status === 'io');
    assert.equal((await api.model(hintClient)).status, 'io', 'manual Pure result hid IO introduced by a closed dependency');
    await fs.writeFile(hintAlias.fsPath, aliasSource);
    await waitFor(() => !audit().snapshot.pending && audit().snapshot.designs[hintClient.fsPath]?.status === 'pure');
    let changes = 0; const changed = () => changes++; audit().on('change', changed);
    await fs.mkdir(vscode.Uri.joinPath(folder, 'dist-newstyle/Generated').fsPath, { recursive: true });
    await fs.writeFile(vscode.Uri.joinPath(folder, 'dist-newstyle/Generated/New.hs').fsPath, 'not Haskell');
    await fs.writeFile(vscode.Uri.joinPath(folder, 'docs/New.hs').fsPath, 'not Haskell');
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(changes, 0, 'excluded file creation refreshed the audit');
    audit().off('change', changed);
    const doc = await vscode.workspace.openTextDocument(pure), original = doc.getText();
    const edit = new vscode.WorkspaceEdit();
    edit.insert(pure, doc.positionAt(original.length), '\nprobe :: IO ()\nprobe = pure ()\n');
    await vscode.workspace.applyEdit(edit);
    const previous = audit();
    await vscode.workspace.getConfiguration('haskellDesign', folder).update('maxFiles', 501, vscode.ConfigurationTarget.Workspace);
    await waitFor(() => audit() !== previous && !audit().snapshot.pending);
    assert.equal(audit().snapshot.designs[pure.fsPath]?.status, 'io', 'reset audit omitted an existing unsaved document');
    const dependent = vscode.Uri.joinPath(folder, 'Domain/Dependent.hs');
    assert.notEqual(audit().snapshot.designs[dependent.fsPath]?.status, 'pure', 'reset audit proved a dirty dependency Pure');
    assert.equal(audit().snapshot.stats.checked, 0);
    const revert = new vscode.WorkspaceEdit();
    revert.replace(pure, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), original);
    await vscode.workspace.applyEdit(revert); await doc.save();
    await waitFor(() => !audit().snapshot.pending && audit().snapshot.designs[dependent.fsPath]?.status === 'pure');
    if (process.env.HASKELL_DESIGN_TEST_RESULT) await fs.writeFile(process.env.HASKELL_DESIGN_TEST_RESULT, JSON.stringify({ passed: true, automatic: true }));
    return;
  }
  const uri = vscode.Uri.joinPath(folder, 'Domain/Order.hs');
  const domain = vscode.Uri.joinPath(folder, 'Domain');
  const doc = await vscode.workspace.openTextDocument(uri);
  await api.refresh();
  assert.equal((await api.getChildren()).length, 3);
  const unopened = vscode.Uri.joinPath(folder, 'Application/Checkout.hs');
  assert.equal((await api.provideFileDecoration(unopened))?.badge, 'IO');
  assert.equal(vscode.workspace.textDocuments.some(d => d.uri.toString() === unopened.toString()), false, 'tree/decorations opened an unrelated source document and triggered LSP');
  assert.equal((await api.model(uri)).status, 'unknown');
  // Normal file opening, without invoking the extension's open command.
  await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
  const activeInput = () => vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  assert.ok(activeInput() instanceof vscode.TabInputCustom, 'normal opening must use the design editor');
  assert.equal((activeInput() as vscode.TabInputCustom).viewType, editorType);
  const group = vscode.window.tabGroups.activeTabGroup;
  const tabs = () => vscode.window.tabGroups.all.find(g => g.viewColumn === group.viewColumn)!.tabs;
  const count = () => tabs().filter(t => (t.input instanceof vscode.TabInputCustom || t.input instanceof vscode.TabInputText) && t.input.uri.toString() === uri.toString()).length;
  assert.equal(count(), 1);
  await api.verifyDocument(); // must target a custom editor without activeTextEditor
  let model = await api.model(uri);
  assert.equal(model.status, 'pure', JSON.stringify(model.issues));
  assert.match(model.text, /isDraft :: Order -> Bool/);
  assert.equal((await api.provideFileDecoration(uri))?.badge, 'P');
  assert.equal((await api.provideFileDecoration(domain))?.badge, 'P');
  assert.equal((await api.provideFileDecoration(folder))?.badge, 'IO');
  const domainNode = (await api.getChildren()).find(n => n.name === 'Domain')!;
  assert.match(String(api.getTreeItem(domainNode).description), /Pure 1/);
  assert.equal((await api.getChildren(domainNode))[0]?.name, 'Order.hs');

  const settings = vscode.Uri.joinPath(folder, '.haskell-design.json');
  await fs.writeFile(settings.fsPath, '{"version":1,"ghcOptions":[]}');
  // Finish the creation event before verifying the newly configured source.
  await new Promise(resolve => setTimeout(resolve, 300));
  await api.verifyDocument(uri);
  assert.equal((await api.model(uri)).status, 'pure');
  await fs.writeFile(settings.fsPath, '{"version":1,"ghcOptions":["-XUnsafe"]}');
  const deadline = Date.now() + 10000;
  while ((await api.model(uri)).status === 'pure' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await api.model(uri)).status, 'unknown', 'saved project configuration retained Pure');
  // Finish processing the changed input before requesting a new manual result.
  // An input invalidation arriving during verification must still discard it.
  await (api as unknown as { audits: Map<string, ProjectAudit> }).audits.get(folder.fsPath)!.refresh();
  await api.verifyDocument(uri);
  assert.equal((await api.model(uri)).status, 'pure', 'Safe Haskell policy must not change the IO hint: ' + JSON.stringify(await api.model(uri)));
  const configDoc = await vscode.workspace.openTextDocument(settings);
  const edit = new vscode.WorkspaceEdit(); edit.insert(settings, new vscode.Position(0, 0), ' ');
  await vscode.workspace.applyEdit(edit);
  assert.equal(configDoc.isDirty, true);
  await api.verifyDocument(uri);
  assert.equal((await api.model(uri)).verified, false, 'unsaved project configuration accepted verification');
  const restoreConfig = new vscode.WorkspaceEdit();
  restoreConfig.replace(settings, new vscode.Range(configDoc.positionAt(0), configDoc.positionAt(configDoc.getText().length)), '{"version":1,"ghcOptions":[]}');
  await vscode.workspace.applyEdit(restoreConfig); await configDoc.save();
  await new Promise(resolve => setTimeout(resolve, 300));
  await api.verifyDocument(uri);
  assert.equal((await api.model(uri)).status, 'pure');

  // Inject the same filesystem failure without moving a watched Windows folder.
  const originalReadDir = fs.readdir;
  fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
    if (String(args[0]) === folder.fsPath) throw Object.assign(new Error('EACCES: test traversal failure'), { code: 'EACCES' });
    return originalReadDir(...args);
  }) as typeof fs.readdir;
  try {
    await api.refresh();
    assert.notEqual((await api.provideFileDecoration(domain))?.badge, 'P', 'failed scan retained Pure');
  } finally { fs.readdir = originalReadDir; }
  await api.refresh();

  await vscode.commands.executeCommand('haskellDesign.source');
  assert.ok(activeInput() instanceof vscode.TabInputText);
  assert.equal(vscode.window.tabGroups.activeTabGroup.viewColumn, group.viewColumn);
  assert.equal(count(), 1, 'switching to source must replace the current tab');
  const original = doc.getText();
  await vscode.window.activeTextEditor!.edit(edit => edit.insert(new vscode.Position(doc.lineCount, 0), '\ndebug :: IO ()\ndebug = pure ()\n'));
  assert.equal(doc.isDirty, true);
  await api.open();
  assert.ok(activeInput() instanceof vscode.TabInputCustom);
  assert.equal(vscode.window.tabGroups.activeTabGroup.viewColumn, group.viewColumn);
  assert.equal(count(), 2, 'dirty source tab must remain available to avoid a native revert');
  const fresh = await vscode.workspace.openTextDocument(uri);
  assert.equal(fresh.isDirty, true, 'switching must preserve unsaved changes');
  assert.match(fresh.getText(), /debug = pure/);
  assert.equal(await fs.readFile(uri.fsPath, 'utf8'), original, 'switching must not save implicitly');
  model = await api.model(uri);
  assert.equal(model.status, 'io'); assert.equal(model.verified, false);
  assert.equal((await api.provideFileDecoration(uri))?.badge, 'IO');
  assert.equal((await api.provideFileDecoration(domain))?.badge, 'IO');
  assert.doesNotMatch(model.text, /debug =/);
  await api.diff(uri);
  const diffDocs = vscode.workspace.textDocuments.filter(d => d.uri.scheme === 'haskell-design-diff');
  assert.equal(diffDocs.length, 2);
  assert.ok(diffDocs.some(d => d.getText().includes('debug :: IO ()')));

  await api.open(uri);
  await vscode.commands.executeCommand('haskellDesign.source');
  assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), uri.toString());
  await vscode.commands.executeCommand('undo');
  // The command can resolve before its document change reaches the extension host.
  const undoDeadline = Date.now() + 5000;
  while (doc.getText() !== original && Date.now() < undoDeadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(doc.getText(), original, 'undo must survive round trips through design');
  await api.open();
  assert.equal((await api.model(uri)).status, 'unknown');
  assert.equal(count(), 1, 'clean source tab should close after undo');
  assert.ok(['—', '…'].includes((await api.provideFileDecoration(domain))?.badge ?? ''), 'undo must remain unanalysed or pending until rechecked');

  const checkout = vscode.Uri.joinPath(folder, 'Application/Checkout.hs');
  await vscode.commands.executeCommand('vscode.open', checkout, { viewColumn: vscode.ViewColumn.Beside });
  const otherGroup = vscode.window.tabGroups.activeTabGroup;
  assert.notEqual(otherGroup.viewColumn, group.viewColumn);
  await api.reveal(checkout, 10);
  assert.equal(vscode.window.tabGroups.activeTabGroup.viewColumn, otherGroup.viewColumn);
  assert.ok(tabs().some(t => t.input instanceof vscode.TabInputCustom && t.input.uri.toString() === uri.toString()), 'another group must remain intact');
  await api.open(checkout);
  assert.equal((await api.model(checkout)).status, 'io');
  const resultPath = process.env.HASKELL_DESIGN_TEST_RESULT;
  if (resultPath) await fs.writeFile(resultPath, JSON.stringify({ passed: true, checks: ['default design editor', 'same-group source toggle', 'dirty buffer and undo retention', 'multiple groups', 'folder IO and Pure', 'hierarchical explorer', 'GHC inference', 'explicit Pure badge', 'unsaved IO marker', 'proof invalidation', 'Git design diff'] }, null, 2));
  if (process.env.HASKELL_DESIGN_TEST_LINGER) await new Promise(resolve => setTimeout(resolve, Number(process.env.HASKELL_DESIGN_TEST_LINGER)));
}
