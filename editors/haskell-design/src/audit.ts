import { promises as fs, watch, FSWatcher } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { auditScope, AuditScope, scopeDirectorySignature } from './auditScope';
import { projectCompilerOptions, isProjectConfig } from './projectConfig';
import { Projector, hash } from './projector';
import { CompilerOptions, verifyBatch } from './compiler';
import { Design, Verification } from './model';
import { FileNode, buildFileTree } from './fileTree';
import { execute } from './workspace';

export interface AuditSnapshot {
  root: string; tree: FileNode; files: string[]; designs: Record<string, Design>;
  pending: boolean; error?: string;
  stats: { parsed: number; checked: number; reused: number; elapsedMs: number };
}
interface Entry { design: Design; inputs: Record<string, string>; context: string }
interface Cache { version: 2; entries: Record<string, Entry> }
export interface AuditOptions extends CompilerOptions { trusted: boolean; autoVerify?: boolean; maxFiles?: number; dirtySources?: Record<string, string> }

// One owner for the audited scope and its evidence. Consumers never traverse or
// compile from a decoration callback. Disk snapshots and dirty editor overlays
// stay separate, so unsaved contents can never acquire a disk proof.
export class ProjectAudit extends EventEmitter {
  snapshot: AuditSnapshot;
  private entries: Record<string, Entry> = {};
  private watchers = new Map<string, FSWatcher>();
  private failedWatchers = new Set<string>();
  private poll?: ReturnType<typeof setInterval>;
  private stamps = new Map<string, string>();
  private directoryStamps = new Map<string, string>();
  private observedDirectories = new Map<string, string>();
  private polling = false;
  private dirty = new Map<string, string>();
  private generation = 0;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private requested = false;
  private scope?: AuditScope;
  private compilerContext?: Promise<string>;
  private contextInputs?: string;
  private compilerFiles = new Set<string>();
  private compilerHashes = new Map<string, string>();
  private compilerDirectories = new Map<string, string>();
  private loaded = false;
  readonly cacheFile: string;
  constructor(readonly projector: Projector, readonly helperSource: string, readonly options: AuditOptions) {
    super();
    this.dirty = new Map(Object.entries(options.dirtySources ?? {}));
    this.cacheFile = path.join(options.cacheDir ?? path.join(os.homedir(), '.cache/haskell-design'), 'index', hash(options.root) + '.json');
    this.snapshot = { root: options.root, tree: buildFileTree(options.root, []), files: [], designs: {}, pending: true, stats: { parsed: 0, checked: 0, reused: 0, elapsedMs: 0 } };
  }
  private emitSnapshot(designs: Record<string, Design>, pending: boolean, error?: string, inputsChanged = false): void {
    this.snapshot = { ...this.snapshot, files: this.scope?.files ?? [], designs, pending, error,
      tree: buildFileTree(this.options.root, Object.values(designs).map(d => ({ file: d.file, status: d.status })), this.scope?.truncated ?? true) };
    this.emit('change', this.snapshot, inputsChanged);
  }
  private async context(): Promise<string> {
    if (!this.compilerContext) this.compilerContext = (async () => {
      // Rebuild the input set as well as its hashes: removed package records
      // must not remain permanent requirements for every later snapshot.
      this.compilerFiles = new Set(); this.compilerHashes = new Map(); this.compilerDirectories = new Map();
      const configs = this.scope?.configs ?? [];
      const values = await Promise.all(configs.map(async f => [f, hash(await fs.readFile(f, 'utf8'))]));
      const compilers = new Map<string, string[]>();
      for (const file of this.scope?.files ?? []) {
        const p = await projectCompilerOptions(this.options.root, file);
        const ghc = p.ghcPath ?? this.options.ghcPath ?? 'ghc';
        compilers.set(ghc, [...(compilers.get(ghc) ?? []), ...p.ghcOptions, ...(this.options.ghcOptions ?? [])]);
      }
      const toolchains = [];
      if (this.options.trusted) for (const [ghc, args] of compilers) {
        const candidates = ghc.includes(path.sep) ? [path.resolve(this.options.root, ghc)] : (process.env.PATH ?? '').split(path.delimiter).map(p => path.join(p, ghc));
        let executable = ghc;
        for (const candidate of candidates) { const real = await fs.realpath(candidate).catch(() => undefined); if (real) { executable = real; break; } }
        this.compilerFiles.add(executable);
        const executableStamp = await this.stamp(executable);
        const libdir = (await execute(ghc, ['--print-libdir'], { cwd: this.options.root, timeout: 15000 })).stdout.trim();
        const version = (await execute(ghc, ['--numeric-version'], { cwd: this.options.root, timeout: 15000 })).stdout.trim();
        const dbs = [path.join(libdir, 'package.conf.d')];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-package-db' && args[i + 1]) dbs.push(path.resolve(this.options.root, args[++i]!));
          else if (args[i]!.startsWith('-package-db=')) dbs.push(path.resolve(this.options.root, args[i]!.slice(12)));
        }
        for (const name of await fs.readdir(path.join(os.homedir(), '.ghc')).catch(() => [])) if (name.includes(version)) dbs.push(path.join(os.homedir(), '.ghc', name, 'package.conf.d'));
        for (const db of process.env.GHC_PACKAGE_PATH?.split(path.delimiter) ?? []) if (db) dbs.push(db);
        const packages = [];
        for (const db of new Set(dbs)) {
          const listing = await this.packageDirectorySignature(db);
          this.compilerDirectories.set(db, listing);
          const files: string[] = listing === 'missing' ? [] : JSON.parse(listing);
          for (const f of files) { const file = path.join(db, f), digest = hash(await fs.readFile(file, 'utf8')); this.compilerFiles.add(file); this.compilerHashes.set(file, digest); packages.push([file, digest]); }
        }
        const settings = path.join(libdir, 'settings'); this.compilerFiles.add(settings);
        this.compilerHashes.set(settings, hash(await fs.readFile(settings, 'utf8')));
        toolchains.push([ghc, executable, executableStamp, libdir, version, packages, await fs.readFile(settings, 'utf8')]);
      }
      return hash(JSON.stringify([values, toolchains, this.options.ghcPath, this.options.ghcOptions, this.options.trusted, process.env.GHC_ENVIRONMENT, process.env.GHC_PACKAGE_PATH, await fs.readFile(this.helperSource, 'utf8')]));
    })();
    return this.compilerContext;
  }
  setDirty(file: string, source?: string): void {
    if (this.scope && !this.scope.files.includes(file) && !this.scope.configs.includes(file)) return;
    if (source === this.dirty.get(file)) return;
    if (source === undefined) this.dirty.delete(file); else this.dirty.set(file, source);
    this.invalidate(file);
  }
  invalidate(file?: string): void {
    this.generation++;
    if (!file || isProjectConfig(file) || this.compilerFiles.has(file)) this.compilerContext = undefined;
    const designs = { ...this.snapshot.designs };
    for (const [f, design] of Object.entries(designs)) {
      const inputs = this.entries[f]?.inputs;
      if (!file || isProjectConfig(file) || this.compilerFiles.has(file) || f === file || !inputs || file in inputs) {
        designs[f] = { ...design, status: 'unknown', verified: false, verification: undefined };
      }
    }
    this.emitSnapshot(designs, true, undefined, true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.refresh(); }, 120);
  }
  refresh(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) { this.requested = true; return this.running; }
    clearTimeout(this.timer);
    this.running = (async () => {
      do { this.requested = false; await this.scan(); } while (this.requested && !this.stopped);
    })().finally(() => { this.running = undefined; });
    return this.running;
  }
  private async scan(): Promise<void> {
    const generation = this.generation, started = Date.now();
    const stats = { parsed: 0, checked: 0, reused: 0, elapsedMs: 0 };
    const current = () => !this.stopped && generation === this.generation;
    try {
      this.scope = await auditScope(this.options.root, this.options.maxFiles);
      for (const file of this.dirty.keys()) if (!this.scope.files.includes(file) && !this.scope.configs.includes(file)) this.dirty.delete(file);
      if (!this.loaded) {
        this.loaded = true;
        const cache: Cache | undefined = await fs.readFile(this.cacheFile, 'utf8').then(s => JSON.parse(s)).catch(() => undefined);
        if (cache?.version === 2 && cache.entries && typeof cache.entries === 'object') this.entries = cache.entries;
      }
      const sources = new Map<string, string>(), hashes = new Map<string, string>();
      for (const file of this.scope.files) {
        const source = await fs.readFile(file, 'utf8'); sources.set(file, source); hashes.set(file, hash(source));
      }
      for (const f of this.scope.configs) hashes.set(f, hash(await fs.readFile(f, 'utf8')));
      const contextInputs = hash(JSON.stringify([this.scope.files, this.scope.configs.map(f => [f, hashes.get(f)])]));
      if (this.contextInputs !== contextInputs) this.compilerContext = undefined;
      this.contextInputs = contextInputs;
      for (const file of hashes.keys()) this.stamps.set(file, await this.stamp(file));
      await this.recordDirectories();
      this.installWatchers();
      const environment = await this.context().catch(error => 'unavailable:' + String(error));
      for (const file of this.compilerFiles) this.stamps.set(file, await this.stamp(file));
      await this.recordDirectories();
      const context = hash(JSON.stringify([environment, this.scope.files, this.options.autoVerify]));
      const designs: Record<string, Design> = {}, todo: string[] = [];
      const dirtyConfig = [...this.dirty.keys()].some(isProjectConfig);
      const usable = (file: string, entry: Entry | undefined): entry is Entry => !!entry && !dirtyConfig && entry.context === context && entry.design.sourceHash === hashes.get(file) && !this.dirty.has(file)
        && Object.entries(entry.inputs).every(([input, digest]) => !this.dirty.has(input) && hashes.get(input) === digest);
      for (const file of this.scope.files) {
        const old = this.entries[file];
        if (usable(file, old)) { designs[file] = old.design; stats.reused++; continue; }
        const source = this.dirty.get(file) ?? sources.get(file)!;
        designs[file] = await this.projector.project(source, file); stats.parsed++;
        if (!this.dirty.size && this.options.trusted && this.options.autoVerify !== false && !environment.startsWith('unavailable:')) todo.push(file);
        else if (!this.dirty.size) this.entries[file] = { design: designs[file]!, context, inputs: Object.fromEntries(hashes) };
      }
      this.installWatchers();
      if (!current() || !(await this.matches(hashes))) { this.requested = true; return; }
      this.snapshot.stats = stats;
      if (todo.length) this.emitSnapshot(designs, true);
      // A single GHC session loads a component once. Repeated module names
      // (notably executable/test Main) must go into different batches.
      const groups: { key: string; files: string[]; modules: Set<string> }[] = [];
      for (const file of todo) {
        const config = await projectCompilerOptions(this.options.root, file);
        const key = JSON.stringify(config), module = designs[file]!.module;
        let group = groups.find(g => g.key === key && !g.modules.has(module));
        if (!group) { group = { key, files: [], modules: new Set() }; groups.push(group); }
        group.files.push(file); group.modules.add(module);
      }
      for (const group of groups) {
        if (!current()) { this.requested = true; return; }
        const proofs = await verifyBatch(group.files, sources, this.helperSource, this.options).catch(error => new Map(group.files.map(file => [file, { status: 'unknown', sourceHash: hashes.get(file)!, signatures: [], evidence: [], error: String(error) } as Verification])));
        // Watcher delivery is asynchronous; compare the input bytes before
        // publishing evidence, including dependencies that were not targets.
        if (!current() || !(await this.matches(hashes))) { this.requested = true; return; }
        for (const [file, proof] of proofs) {
          const inputs = proof.error ? [...hashes.keys()] : [...new Set([file, ...(proof.dependencies ?? []), ...this.scope.configs])];
          if (inputs.some(f => !hashes.has(f))) { proof.status = 'unknown'; proof.error = '解析範囲外のソース依存があるため確認できません。'; }
          const design = await this.projector.project(sources.get(file)!, file, proof);
          designs[file] = design;
          this.entries[file] = { design, context, inputs: Object.fromEntries(inputs.filter(f => hashes.has(f)).map(f => [f, hashes.get(f)!])) };
          stats.checked++;
        }
        if (current()) this.emitSnapshot({ ...designs }, true);
      }
      if (!current()) { this.requested = true; return; }
      stats.elapsedMs = Date.now() - started;
      this.emitSnapshot(designs, false, this.scope.truncated ? '解析対象が上限を超えています。' : environment.startsWith('unavailable:') ? environment.slice(12) : undefined);
      const entries = Object.fromEntries(this.scope.files.filter(f => this.entries[f]).map(f => [f, this.entries[f]!]));
      await fs.mkdir(path.dirname(this.cacheFile), { recursive: true, mode: 0o700 });
      const temp = this.cacheFile + '.' + process.pid + '.tmp';
      await fs.writeFile(temp, JSON.stringify({ version: 2, entries } satisfies Cache), { mode: 0o600 });
      await fs.rename(temp, this.cacheFile);
    } catch (error) {
      if (current()) this.emitSnapshot({}, false, String(error));
    }
  }
  private async matches(hashes: Map<string, string>): Promise<boolean> {
    for (const [file, digest] of [...hashes, ...this.compilerHashes]) if (await fs.readFile(file, 'utf8').then(hash, () => '') !== digest) { if (this.compilerFiles.has(file)) this.compilerContext = undefined; return false; }
    for (const [dir, signature] of this.directoryInputs()) if (await this.directorySignature(dir) !== signature) { this.compilerContext = undefined; return false; }
    return true;
  }
  private packageDirectorySignature(dir: string): Promise<string> {
    return fs.readdir(dir).then(entries => JSON.stringify(entries.filter(f => f.endsWith('.conf') || f === 'package.cache').sort()), error => {
      if (error.code === 'ENOENT') return 'missing';
      throw error;
    });
  }
  private directoryInputs(): [string, string][] { return [...Object.entries(this.scope?.directoryInputs ?? {}), ...this.compilerDirectories]; }
  private directorySignature(dir: string): Promise<string> {
    return this.compilerDirectories.has(dir) ? this.packageDirectorySignature(dir) : scopeDirectorySignature(this.scope!, dir);
  }
  private async recordDirectories(): Promise<void> {
    for (const [dir, signature] of this.directoryInputs()) {
      this.observedDirectories.set(dir, signature); this.directoryStamps.set(dir, await this.stamp(dir));
    }
  }
  private async checkDirectory(dir: string): Promise<void> {
    const stamp = await this.stamp(dir);
    if (this.stopped || this.directoryStamps.get(dir) === stamp) return;
    this.directoryStamps.set(dir, stamp);
    const signature = await this.directorySignature(dir);
    if (this.stopped || this.observedDirectories.get(dir) === signature) return;
    this.observedDirectories.set(dir, signature);
    this.invalidate();
  }
  private installWatchers(): void {
    const compilerDirs = new Set([...this.compilerFiles].map(f => path.dirname(f)));
    const dirs = new Set([...this.scope!.directories, ...compilerDirs, ...this.compilerDirectories.keys()]);
    for (const [dir, watcher] of this.watchers) if (!dirs.has(dir)) { watcher.close(); this.watchers.delete(dir); }
    for (const dir of dirs) if (!this.watchers.has(dir) && !this.failedWatchers.has(dir)) {
      try {
        const watcher = watch(dir, { persistent: false }, (_event, name) => {
          if (!name) { this.startPolling(); return; }
          const file = path.join(dir, String(name));
          if (this.scope?.directoryInputs[dir] !== undefined || this.compilerDirectories.has(dir)) void this.checkDirectory(dir).catch(() => this.startPolling());
          if (this.scope?.files.includes(file) || this.scope?.configs.includes(file) || this.compilerFiles.has(file)) void this.stamp(file).then(stamp => {
            if (this.stopped || this.stamps.get(file) === stamp) return;
            const previous = this.stamps.get(file); this.stamps.set(file, stamp);
            if (previous === undefined && this.compilerFiles.has(file)) return;
            this.invalidate(compilerDirs.has(dir) ? undefined : file);
          });
        });
        watcher.on('error', () => { watcher.close(); this.watchers.delete(dir); this.failedWatchers.add(dir); this.startPolling(); });
        this.watchers.set(dir, watcher);
      } catch { this.failedWatchers.add(dir); this.startPolling(); }
    }
  }
  private stamp(file: string): Promise<string> {
    return fs.stat(file, { bigint: true }).then(s => `${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`, () => 'missing');
  }
  private startPolling(): void {
    if (this.poll) return;
    // Some hosts exhaust OS watch handles (EMFILE). Fall back to cheap metadata
    // comparisons; do not spin by immediately reinstalling a failed watcher.
    this.poll = setInterval(() => { void (async () => {
      if (this.polling || this.stopped) return;
      this.polling = true;
      try {
        for (const file of [...(this.scope?.files ?? []), ...(this.scope?.configs ?? []), ...this.compilerFiles]) {
          const stamp = await this.stamp(file);
          const before = this.stamps.get(file); this.stamps.set(file, stamp);
          if (before !== undefined && stamp !== before) this.invalidate(file);
        }
        for (const [dir] of this.directoryInputs()) await this.checkDirectory(dir);
      } catch { /* A concurrent rename will be resolved by the next scan/poll. */ }
      finally { this.polling = false; }
    })(); }, 1000);
    this.poll.unref();
  }
  dispose(): void {
    this.stopped = true; this.generation++; clearTimeout(this.timer);
    clearInterval(this.poll);
    for (const watcher of this.watchers.values()) watcher.close(); this.watchers.clear(); this.removeAllListeners();
  }
}
