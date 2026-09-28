import * as vscode from 'vscode';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Projector, hash } from './projector';
import { badge, Design, Verification, statusLabel, Status } from './model';
import { buildFileTree, FileNode, indexTree, summaryLabel } from './fileTree';
import { verify } from './compiler';
import { isProjectConfig } from './projectConfig';
import { designDiff, findDeclaration, relatedTests } from './workspace';
import { ProjectAudit } from './audit';
import { auditScope } from './auditScope';

const isHaskell = (uri: vscode.Uri) => uri.scheme === 'file' && uri.fsPath.endsWith('.hs');
const isCompilerInput = (uri: vscode.Uri) => uri.scheme === 'file' && (isHaskell(uri) || isProjectConfig(uri.fsPath));
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export const editorType = 'haskellDesign.editor';

export class DesignController implements vscode.Disposable, vscode.FileDecorationProvider, vscode.TreeDataProvider<FileNode>, vscode.CustomTextEditorProvider {
  readonly projector: Projector;
  private epoch = 0;
  private proofEpoch = 0;
  private disposed = false;
  private audits = new Map<string, ProjectAudit>();
  private readonly proofs = new Map<string, Verification>();
  private readonly models = new Map<string, { design: Design; version: number; epoch: number }>();
  private readonly panels = new Map<string, Set<vscode.WebviewPanel>>();
  private readonly locations = new Map<string, { line: number; token: number }>();
  private locationToken = 0;
  private scanToken = 0;
  private treeTask?: { epoch: number; promise: Promise<FileNode[]> };
  private treeIndex = new Map<string, FileNode>();
  private readonly contents = new Map<string, string>();
  private readonly pending = new Map<string, Promise<Design>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private files: vscode.Uri[] = [];
  private readonly decorationChanged = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this.decorationChanged.event;
  private readonly treeChanged = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.treeChanged.event;

  constructor(readonly context: vscode.ExtensionContext) {
    this.projector = new Projector(path.join(context.extensionPath, 'dist'));
    context.subscriptions.push(this,
      vscode.window.registerFileDecorationProvider(this),
      vscode.window.registerTreeDataProvider('haskellDesign.files', this),
      vscode.window.registerCustomEditorProvider(editorType, this, { webviewOptions: { retainContextWhenHidden: true }, supportsMultipleEditorsPerDocument: true }),
      vscode.workspace.registerTextDocumentContentProvider('haskell-design-diff', { provideTextDocumentContent: uri => this.contents.get(uri.toString()) ?? '' }),
      vscode.commands.registerCommand('haskellDesign.open', (uri?: vscode.Uri) => this.open(uri)),
      vscode.commands.registerCommand('haskellDesign.source', async (uri?: vscode.Uri) => { const target = await this.target(uri); if (target) await this.reveal(target, 1); }),
      vscode.commands.registerCommand('haskellDesign.diff', (uri?: vscode.Uri) => this.diff(uri)),
      vscode.commands.registerCommand('haskellDesign.verify', (uri?: vscode.Uri) => this.verifyDocument(uri)),
      vscode.commands.registerCommand('haskellDesign.refresh', () => this.refresh()),
      vscode.workspace.onDidChangeTextDocument(event => {
        if (!isCompilerInput(event.document.uri)) return;
        const doc = event.document;
        const audit = this.audits.get(this.root(doc.uri));
        if (audit?.snapshot.files.length && !audit.snapshot.files.includes(doc.uri.fsPath) && !isProjectConfig(doc.uri.fsPath)) return;
        audit?.setDirty(doc.uri.fsPath, doc.isDirty ? doc.getText() : undefined);
        this.invalidate();
      }),
      vscode.workspace.onDidSaveTextDocument(doc => {
        if (isCompilerInput(doc.uri)) this.audits.get(this.root(doc.uri))?.setDirty(doc.uri.fsPath);
      }),
      vscode.workspace.onDidCloseTextDocument(doc => {
        if (isCompilerInput(doc.uri)) this.audits.get(this.root(doc.uri))?.setDirty(doc.uri.fsPath);
      }),
      vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('haskellDesign')) { this.resetAudits(); void this.refresh(); } }),
      vscode.workspace.onDidGrantWorkspaceTrust(() => { this.resetAudits(); void this.refresh(); }),
      vscode.window.onDidChangeWindowState(state => { if (state.focused) for (const audit of this.audits.values()) void audit.refresh(); }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => { this.invalidate(); void this.refresh(); })
    );
    for (const pattern of ['**/*.{hs,lhs,hsc,cabal,yaml,project}', '**/.haskell-design.json', '**/cabal.project.*', '**/stack.yaml.lock']) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      context.subscriptions.push(watcher,
        watcher.onDidChange(uri => { if (!this.config(uri).get('autoVerify', true)) this.invalidate(); }),
        watcher.onDidCreate(uri => { if (!this.config(uri).get('autoVerify', true)) { this.invalidate(); void this.refresh(); } }),
        watcher.onDidDelete(uri => { if (!this.config(uri).get('autoVerify', true)) { this.invalidate(); void this.refresh(); } })
      );
    }
    void this.refresh();
  }
  private resetAudits(): void { for (const audit of this.audits.values()) audit.dispose(); this.audits.clear(); this.invalidate(); }
  config(uri: vscode.Uri): vscode.WorkspaceConfiguration { return vscode.workspace.getConfiguration('haskellDesign', uri); }
  root(uri: vscode.Uri): string { return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? path.dirname(uri.fsPath); }
  async target(uri?: vscode.Uri): Promise<vscode.Uri | undefined> {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    const active = uri ?? (input instanceof vscode.TabInputCustom || input instanceof vscode.TabInputText ? input.uri : vscode.window.activeTextEditor?.document.uri);
    if (active && isHaskell(active)) return active;
    const selected = await vscode.window.showQuickPick(this.files.map(file => ({ label: vscode.workspace.asRelativePath(file), file })), { placeHolder: '設計を読むHaskellファイル' });
    return selected?.file;
  }
  private report(error: unknown): void { console.error('Haskell Design', error); void vscode.window.showErrorMessage(`Haskell Design: ${error instanceof Error ? error.message : String(error)}`); }
  invalidate(clearProofs = true): void {
    this.epoch++;
    if (clearProofs) { this.proofEpoch++; this.proofs.clear(); }
    this.pending.clear();
    this.treeTask = undefined;
    this.treeIndex.clear();
    this.decorationChanged.fire(undefined);
    this.treeChanged.fire();
    for (const key of this.panels.keys()) {
      clearTimeout(this.timers.get(key));
      this.timers.set(key, setTimeout(() => { this.timers.delete(key); void this.updatePanel(vscode.Uri.parse(key)); }, 180));
    }
  }
  async model(uri: vscode.Uri): Promise<Design> {
    const key = uri.toString();
    // Reading a tree/decorations must not open every file in the editor: that
    // also sends didOpen to HLS for unrelated components and negative fixtures.
    const openDocument = () => vscode.workspace.textDocuments.find(doc => !doc.isClosed && doc.uri.toString() === key);
    const document = openDocument();
    const epoch = this.epoch, version = document?.version ?? -1;
    const cached = this.models.get(key);
    if (cached && cached.version === version && cached.epoch === epoch) return cached.design;
    const token = `${key}:${version}:${epoch}`;
    const existing = this.pending.get(token);
    if (existing) return existing;
    const task = (async () => {
      const source = document?.getText() ?? Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      const indexed = this.audits.get(this.root(uri))?.snapshot.designs[uri.fsPath];
      const design = indexed && indexed.sourceHash === hash(source) && !this.proofs.has(key) && (indexed.status !== 'unknown' || !this.audits.get(this.root(uri))?.snapshot.pending)
        ? indexed : await this.projector.project(source, uri.fsPath, this.proofs.get(key) ?? indexed?.verification);
      if (epoch === this.epoch && (openDocument()?.version ?? -1) === version) this.models.set(key, { design, version, epoch });
      return design;
    })().finally(() => this.pending.delete(token));
    this.pending.set(token, task);
    return task;
  }
  async open(uri?: vscode.Uri, line?: number): Promise<void> {
    const target = await this.target(uri);
    if (!target) return;
    if (line) this.locations.set(target.toString(), { line, token: ++this.locationToken });
    await this.switchEditor(target, editorType);
    await this.updatePanel(target);
  }
  private async switchEditor(uri: vscode.Uri, viewType: string, selection?: vscode.Range): Promise<void> {
    const group = vscode.window.tabGroups.activeTabGroup;
    await vscode.commands.executeCommand('vscode.openWith', uri, viewType, { viewColumn: group.viewColumn, preview: false, selection });
    if (viewType === editorType) await this.updatePanel(uri);
    const current = vscode.window.tabGroups.all.find(candidate => candidate.viewColumn === group.viewColumn);
    const alternate = current?.tabs.find(tab => {
      const input = tab.input;
      return (input instanceof vscode.TabInputText || input instanceof vscode.TabInputCustom)
        && input.uri.toString() === uri.toString()
        && (input instanceof vscode.TabInputCustom ? input.viewType : 'default') !== viewType;
    });
    const doc = await vscode.workspace.openTextDocument(uri);
    // VS Code may revert the shared document when closing a dirty alternate
    // editor. Keep both tabs in the same group until the document is saved.
    if (alternate && !doc.isDirty && current === vscode.window.tabGroups.activeTabGroup) await vscode.window.tabGroups.close(alternate, true);
  }
  async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    const target = document.uri, key = target.toString();
    const scope = target.scheme === 'file' ? await auditScope(this.root(target), this.config(target).get('maxFiles', 500)) : undefined;
    if (!scope?.files.includes(target.fsPath)) {
      void vscode.commands.executeCommand('vscode.openWith', target, 'default', { viewColumn: panel.viewColumn, preview: false }).then(() => panel.dispose());
      return;
    }
    const panels = this.panels.get(key) ?? new Set<vscode.WebviewPanel>();
    panels.add(panel); this.panels.set(key, panels);
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    panel.webview.html = this.html(panel.webview);
    panel.onDidDispose(() => { panels.delete(panel); if (!panels.size) { this.panels.delete(key); clearTimeout(this.timers.get(key)); this.timers.delete(key); } });
    panel.webview.onDidReceiveMessage(message => { void this.message(target, message).catch(error => this.report(error)); });
    // Resolving must finish before the webview can acknowledge messages.
    void this.updatePanel(target);
  }
  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(18).toString('base64');
    const media = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', file)).toString();
    return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${escape(media('design.css'))}"><title>Haskell Design</title></head><body><main id="app"><p>設計を読み込んでいます…</p></main><script nonce="${nonce}" src="${escape(media('design.js'))}"></script></body></html>`;
  }
  async updatePanel(uri: vscode.Uri): Promise<void> {
    const epoch = this.epoch;
    try {
      const design = await this.model(uri);
      if (this.disposed || epoch !== this.epoch) return;
      for (const panel of this.panels.get(uri.toString()) ?? []) await panel.webview.postMessage({ type: 'model', design, path: vscode.workspace.asRelativePath(uri), trusted: vscode.workspace.isTrusted, automatic: this.config(uri).get('autoVerify', true), pending: this.audits.get(this.root(uri))?.snapshot.pending ?? false, focus: this.locations.get(uri.toString()) });
      this.decorationChanged.fire(uri);
      this.treeChanged.fire();
    } catch (error) { for (const panel of this.panels.get(uri.toString()) ?? []) await panel.webview.postMessage({ type: 'error', error: String(error) }); }
  }
  private async message(uri: vscode.Uri, message: unknown): Promise<void> {
    if (!message || typeof message !== 'object') return;
    const m = message as { type?: string; id?: string; reference?: number; line?: number };
    if (m.type === 'ready') return this.updatePanel(uri);
    if (m.type === 'verify') return this.verifyDocument(uri);
    if (m.type === 'diff') return this.diff(uri);
    if (m.type === 'source') return this.reveal(uri, 1);
    const model = await this.model(uri);
    const decl = model.declarations.find(d => d.id === m.id);
    if (m.type === 'evidence' && Number.isInteger(m.line) && model.evidence.some(e => e.line === m.line)) return this.reveal(uri, m.line!);
    if (!decl) return;
    if (m.type === 'declaration') return this.reveal(uri, decl.line);
    if (m.type === 'tests') {
      const hits = await relatedTests(this.root(uri), decl.names);
      if (!hits.length) { void vscode.window.showInformationMessage('参照するテスト・性質の候補は見つかりませんでした。'); return; }
      const pick = await vscode.window.showQuickPick(hits.map(h => ({ label: `${path.relative(this.root(uri), h.file)}:${h.line}`, description: h.text, hit: h })), { placeHolder: '名前を参照するテスト・性質の候補' });
      if (pick) await this.reveal(vscode.Uri.file(pick.hit.file), pick.hit.line);
    }
    if (m.type === 'definition' && Number.isInteger(m.reference)) {
      const ref = decl.references[m.reference!];
      if (!ref) return;
      const found = ref.inferred ? [] : await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>('vscode.executeDefinitionProvider', uri, new vscode.Position(ref.line - 1, ref.column));
      const location = found?.[0];
      if (location) {
        const destination = 'targetUri' in location ? location.targetUri : location.uri;
        const range = 'targetUri' in location ? (location.targetSelectionRange ?? location.targetRange) : location.range;
        if (isHaskell(destination)) await this.open(destination, range.start.line + 1);
        else await this.reveal(destination, range.start.line + 1);
        return;
      }
      const fallback = await findDeclaration(this.projector, this.root(uri), ref.name, model);
      if (fallback) await this.open(vscode.Uri.file(fallback.file), fallback.line);
      else void vscode.window.showInformationMessage(`${ref.name}: 定義が見つかりません。依存ライブラリへの移動にはHaskell Language Serverを利用できます。`);
    }
  }
  async reveal(uri: vscode.Uri, line: number): Promise<void> {
    const doc = await vscode.workspace.openTextDocument(uri);
    const position = new vscode.Position(Math.max(0, Math.min(line - 1, doc.lineCount - 1)), 0);
    const selection = new vscode.Range(position, position);
    await this.switchEditor(uri, 'default', selection);
    const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Active, selection });
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
  async verifyDocument(uri?: vscode.Uri): Promise<void> {
    const target = await this.target(uri);
    if (!target) return;
    if (!vscode.workspace.isTrusted) { void vscode.window.showWarningMessage('GHCの確認は、VS Codeで信頼したワークスペースで利用できます。'); return; }
    const root = this.root(target);
    if (vscode.workspace.textDocuments.some(d => d.isDirty && isCompilerInput(d.uri) && this.root(d.uri) === root)) { void vscode.window.showWarningMessage('依存するコードとプロジェクト設定を保存してから確認してください。'); return; }
    // Index publications redraw the UI without changing compiler inputs. They
    // must not discard a concurrent manual result. verify() separately checks
    // disk fingerprints; edits/configuration changes invalidate proofEpoch.
    const epoch = this.proofEpoch;
    const doc = await vscode.workspace.openTextDocument(target);
    const source = doc.getText(), version = doc.version;
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Haskell Design: GHCで型とIOを確認しています' }, async () => {
      const config = this.config(target);
      const proof = await verify(target.fsPath, source, path.join(this.context.extensionPath, 'compiler', 'Main.hs'), { root, ghcPath: config.get('ghcPath', 'ghc'), ghcOptions: config.get('ghcOptions', []), cacheDir: path.join(this.context.globalStorageUri.fsPath, 'compiler') });
      if (epoch !== this.proofEpoch || doc.version !== version) { void vscode.window.showInformationMessage('確認中に変更がありました。結果を破棄しました。'); return; }
      this.proofs.set(target.toString(), proof);
      this.invalidate(false);
      await this.updatePanel(target);
      if (proof.error) void vscode.window.showWarningMessage('GHCで確認できませんでした。設計ビューに理由を表示しています。');
    });
  }
  async diff(uri?: vscode.Uri): Promise<void> {
    const target = await this.target(uri);
    if (!target) return;
    if (!vscode.workspace.isTrusted) { void vscode.window.showWarningMessage('Gitとの差分は信頼したワークスペースで利用できます。'); return; }
    try {
      const doc = await vscode.workspace.openTextDocument(target);
      const result = await designDiff(this.projector, target.fsPath, doc.getText());
      const id = randomBytes(8).toString('hex');
      const left = vscode.Uri.from({ scheme: 'haskell-design-diff', path: `/${id}/before/${path.basename(target.fsPath)}.design` });
      const right = vscode.Uri.from({ scheme: 'haskell-design-diff', path: `/${id}/after/${path.basename(target.fsPath)}.design` });
      this.contents.set(left.toString(), result.before.text);
      this.contents.set(right.toString(), result.after.text);
      for (const uri of [left, right]) await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(uri), 'haskell');
      await vscode.commands.executeCommand('vscode.diff', left, right, `設計の差分 · ${result.baseline} ↔ 現在 · ${path.basename(target.fsPath)}`);
      const notes = [];
      if (!result.changed) notes.push(result.implementationChanged ? '宣言の差分はありません。実装には変更があります。' : '宣言・実装ともに変更はありません。');
      if (result.unresolved.length) notes.push(`型署名のない ${result.unresolved.join(', ')} は型の変化を比較できません。`);
      if (notes.length) void vscode.window.showInformationMessage(notes.join(' '));
    } catch (error) { this.report(error); }
  }
  async refresh(): Promise<void> {
    const ticket = ++this.scanToken;
    try {
      const folders = (vscode.workspace.workspaceFolders ?? []).filter(f => f.uri.scheme === 'file');
      for (const [root, audit] of this.audits) if (!folders.some(f => f.uri.fsPath === root)) { audit.dispose(); this.audits.delete(root); }
      for (const folder of folders) {
        const root = folder.uri.fsPath;
        let audit = this.audits.get(root);
        if (!audit) {
          const config = this.config(folder.uri);
          audit = new ProjectAudit(this.projector, path.join(this.context.extensionPath, 'compiler/Main.hs'), {
            root, trusted: vscode.workspace.isTrusted, autoVerify: config.get('autoVerify', true),
            ghcPath: config.get('ghcPath', 'ghc'), ghcOptions: config.get('ghcOptions', []),
            cacheDir: path.join(this.context.globalStorageUri.fsPath, 'compiler'), maxFiles: config.get('maxFiles', 500),
            dirtySources: Object.fromEntries(vscode.workspace.textDocuments.filter(d => d.isDirty && isCompilerInput(d.uri) && this.root(d.uri) === root).map(d => [d.uri.fsPath, d.getText()])),
          });
          this.audits.set(root, audit);
          audit.on('change', (_snapshot, inputsChanged: boolean) => {
            this.files = [...this.audits.values()].flatMap(a => a.snapshot.files.map(f => vscode.Uri.file(f)));
            this.invalidate(inputsChanged);
          });
        }
        await audit.refresh();
      }
      if (ticket !== this.scanToken || this.disposed) return;
      this.invalidate(false);
    } catch (error) { if (ticket === this.scanToken && !this.disposed) { this.invalidate(); this.report(error); } }
  }
  private async fileTrees(): Promise<FileNode[]> {
    if (this.treeTask?.epoch === this.epoch) return this.treeTask.promise;
    const epoch = this.epoch;
    const promise = (async () => {
      const trees: FileNode[] = [];
      for (const audit of this.audits.values()) {
        const snapshot = audit.snapshot;
        const statuses = Object.values(snapshot.designs).map(d => ({ file: d.file, status: d.status }));
        for (const entry of statuses) {
          const uri = vscode.Uri.file(entry.file);
          const dirty = vscode.workspace.textDocuments.some(d => d.uri.toString() === uri.toString() && d.isDirty);
          if (dirty || this.proofs.has(uri.toString())) entry.status = (await this.model(uri)).status;
        }
        trees.push(buildFileTree(snapshot.root, statuses, !snapshot.tree.summary.complete));
      }
      if (epoch !== this.epoch) return [];
      const index = new Map<string, FileNode>();
      for (const tree of trees) indexTree(tree, index);
      this.treeIndex = index;
      return trees;
    })();
    this.treeTask = { epoch, promise }; return promise;
  }
  async getChildren(node?: FileNode): Promise<FileNode[]> {
    const trees = await this.fileTrees();
    if (node) return this.treeIndex.get(node.file)?.children ?? [];
    return trees.length === 1 ? trees[0]!.children : trees;
  }
  getTreeItem(node: FileNode): vscode.TreeItem {
    const uri = vscode.Uri.file(node.file);
    const item = new vscode.TreeItem(node.name, node.kind === 'folder' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    item.resourceUri = uri;
    if (node.kind === 'file') item.command = { command: 'haskellDesign.open', title: '設計を開く', arguments: [uri] };
    item.description = node.kind === 'folder' ? summaryLabel(node.summary) : ({ pure: 'Pure', io: 'IO', unknown: '未解析' })[node.summary.status];
    item.tooltip = node.kind === 'folder' ? `このフォルダ内のHaskell ${node.summary.total}件: ${summaryLabel(node.summary)}` : statusLabel(node.summary.status);
    return item;
  }
  async provideFileDecoration(uri: vscode.Uri): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file') return;
    try {
      const epoch = this.epoch;
      let status: Status, tooltip: string;
      await this.fileTrees();
      const node = this.treeIndex.get(uri.fsPath);
      if (!node || (!node.summary.total && node.summary.complete)) return;
      status = node.summary.status;
      const pending = [...this.audits.values()].some(a => a.snapshot.pending && a.snapshot.files.some(file => file === uri.fsPath || file.startsWith(uri.fsPath + path.sep)));
      tooltip = node.kind === 'folder' ? `フォルダ内のHaskell: ${summaryLabel(node.summary)}` : pending && status === 'unknown' ? '解析中' : statusLabel(status);
      if (epoch !== this.epoch) { status = 'unknown'; tooltip = statusLabel(status); }
      return { badge: status === 'unknown' && pending ? '…' : badge(status), tooltip: `Haskell Design: ${tooltip}`, color: new vscode.ThemeColor(status === 'io' ? 'charts.orange' : status === 'pure' ? 'charts.green' : 'descriptionForeground'), propagate: false };
    } catch { return { badge: '—', tooltip: 'Haskell Design: 読み込み・解析ができませんでした' }; }
  }
  dispose(): void {
    this.disposed = true;
    for (const audit of this.audits.values()) audit.dispose(); this.audits.clear();
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const panels of this.panels.values()) for (const panel of panels) panel.dispose();
    this.projector.dispose(); this.decorationChanged.dispose(); this.treeChanged.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): DesignController { return new DesignController(context); }
