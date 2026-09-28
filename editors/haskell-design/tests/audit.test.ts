import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { auditScope } from '../src/auditScope';
import { ProjectAudit, AuditSnapshot } from '../src/audit';
import { Projector } from '../src/projector';

const repo = path.resolve(__dirname, '../..');
before(() => fs.mkdir(path.join(repo, '.test-output'), { recursive: true }));
test('automatic audit discovers owned sources, caches GHC evidence, and only rechecks dependencies', async () => {
  const root = await fs.mkdtemp(path.join(repo, '.test-output/audit-'));
  for (const dir of ['src', 'docs', 'dist-newstyle', 'tests/compile']) await fs.mkdir(path.join(root, dir), { recursive: true });
  await fs.writeFile(path.join(root, 'demo.cabal'), 'cabal-version: 2.4\nname: demo\nversion: 0.1\nlibrary\n  hs-source-dirs: src\n  exposed-modules: A, B, C\n');
  await fs.writeFile(path.join(root, 'src/A.hs'), 'module A where\na :: Int\na = 1\n');
  await fs.writeFile(path.join(root, 'src/B.hs'), 'module B where\nimport A\nb = a\n');
  await fs.writeFile(path.join(root, 'src/C.hs'), 'module C where\nc :: Bool\nc = True\n');
  for (const file of ['docs/Example.hs', 'dist-newstyle/Generated.hs', 'tests/compile/Negative.hs']) await fs.writeFile(path.join(root, file), 'this is not valid Haskell');
  const scope = await auditScope(root);
  assert.deepEqual(scope.files.map(f => path.relative(root, f).split(path.sep).join('/')), ['src/A.hs', 'src/B.hs', 'src/C.hs']);
  const projector = new Projector(path.join(repo, 'dist'));
  const options = { root, trusted: true, cacheDir: path.join(repo, '.test-output/automatic-cache'), ghcPath: process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc' };
  let audit = new ProjectAudit(projector, path.join(repo, 'compiler/Main.hs'), options);
  try {
    await audit.refresh();
    assert.equal(audit.snapshot.tree.summary.status, 'pure', JSON.stringify(audit.snapshot.designs));
    assert.equal(audit.snapshot.stats.checked, 3);
    const cold = { ...audit.snapshot.stats };
    audit.dispose();
    audit = new ProjectAudit(projector, path.join(repo, 'compiler/Main.hs'), options);
    await audit.refresh();
    assert.equal(audit.snapshot.tree.summary.status, 'pure');
    assert.equal(audit.snapshot.stats.checked, 0);
    assert.equal(audit.snapshot.stats.parsed, 0);
    assert.equal(audit.snapshot.stats.reused, 3);
    const warm = { ...audit.snapshot.stats };
    // Delayed OS notifications can cause a cached scan after the change scan.
    // Measure the published change scan instead of whichever scan happens last.
    const scans: AuditSnapshot['stats'][] = [];
    const recordScan = (snapshot: AuditSnapshot) => { if (!snapshot.pending) scans.push({ ...snapshot.stats }); };
    audit.on('change', recordScan);
    await fs.writeFile(path.join(root, 'src/A.hs'), 'module A where\na :: IO ()\na = pure ()\n');
    audit.invalidate(path.join(root, 'src/A.hs'));
    assert.notEqual(audit.snapshot.tree.summary.status, 'pure', 'a stale Pure badge survived invalidation');
    await audit.refresh();
    audit.off('change', recordScan);
    assert.equal(audit.snapshot.designs[path.join(root, 'src/A.hs')]?.status, 'io');
    assert.equal(audit.snapshot.designs[path.join(root, 'src/B.hs')]?.status, 'io');
    assert.equal(audit.snapshot.designs[path.join(root, 'src/C.hs')]?.status, 'pure');
    const incremental = scans.find(scan => scan.checked > 0);
    assert.equal(incremental?.checked, 2);
    assert.equal(incremental?.reused, 1);
    assert.ok(scans.every(scan => scan.checked === 0 || scan.checked === 2));
    let events = 0; audit.on('change', () => events++);
    await fs.writeFile(path.join(root, 'dist-newstyle/Generated.hs'), 'still invalid');
    await fs.writeFile(path.join(root, 'docs/Example.hs'), 'still invalid');
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(events, 0, 'excluded files triggered audit work');
    audit.setDirty(path.join(root, 'src/A.hs'), 'module A where\na = False\n');
    await audit.refresh();
    assert.equal(audit.snapshot.designs[path.join(root, 'src/B.hs')]?.verified, false, 'unsaved dependency retained a GHC proof');
    assert.equal(audit.snapshot.designs[path.join(root, 'src/C.hs')]?.status, 'pure', 'unrelated dirty buffer discarded a valid proof');
    assert.equal(audit.snapshot.stats.checked, 0, 'GHC ran against an unsaved overlay');
    audit.setDirty(path.join(root, 'src/A.hs'));
    await audit.refresh();
    assert.equal(audit.snapshot.designs[path.join(root, 'src/B.hs')]?.status, 'io');
    console.log(JSON.stringify({ cold, warm, incremental }));
  } finally { audit.dispose(); projector.dispose(); }
});

const waitFor = async (condition: () => boolean, message: string, timeout = 15000) => {
  const deadline = Date.now() + timeout;
  while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(condition(), message);
};

test('source directory additions/deletions are automatic, including an OS watcher failure', async () => {
  const root = await fs.mkdtemp(path.join(repo, '.test-output/audit-topology-'));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'demo.cabal'), 'name: demo\nlibrary\n  hs-source-dirs: src\n');
  await fs.writeFile(path.join(root, 'src/A.hs'), 'module A where\na :: Int\na = 1\n');
  const projector = new Projector(path.join(repo, 'dist'));
  const audit = new ProjectAudit(projector, path.join(repo, 'compiler/Main.hs'), { root, trusted: true, cacheDir: path.join(repo, '.test-output/automatic-cache'), ghcPath: process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc' });
  try {
    await audit.refresh();
    assert.equal(audit.snapshot.tree.summary.status, 'pure');
    for (const fallback of [false, true]) {
      if (fallback) {
        // Simulate the error delivered by the OS when watch handles run out.
        const internal = audit as unknown as { watchers: Map<string, import('node:fs').FSWatcher> };
        for (const watcher of [...internal.watchers.values()]) watcher.emit('error', new Error('EMFILE'));
      }
      let events = 0; const changed = () => events++; audit.on('change', changed);
      for (const dir of ['docs/New', 'dist-newstyle/New', 'src/dist-newstyle/New']) {
        await fs.mkdir(path.join(root, dir), { recursive: true });
        await fs.writeFile(path.join(root, dir, 'Generated.hs'), 'not Haskell');
      }
      await new Promise(resolve => setTimeout(resolve, 1250));
      assert.equal(events, 0, 'excluded creation triggered index work');
      audit.off('change', changed);
      const dir = path.join(root, 'src/New');
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, 'Action.hs'), 'module New.Action where\naction :: IO ()\naction = pure ()\n');
      await waitFor(() => !audit.snapshot.pending && audit.snapshot.tree.summary.status === 'io', `new source directory was missed (fallback=${fallback})`);
      await fs.rm(dir, { recursive: true });
      await waitFor(() => !audit.snapshot.pending && audit.snapshot.tree.summary.status === 'pure' && audit.snapshot.files.length === 1, `removed directory remained in scope (fallback=${fallback})`);
    }
  } finally { audit.dispose(); projector.dispose(); }
});

test('removing a package record rebuilds the compiler input set instead of retrying forever', async () => {
  const root = await fs.mkdtemp(path.join(repo, '.test-output/audit-package-'));
  const db = path.join(root, '.packages');
  const { execute } = await import('../src/workspace');
  await execute(process.env.HASKELL_DESIGN_TEST_GHC_PKG ?? 'ghc-pkg', ['init', db], { cwd: root });
  await fs.writeFile(path.join(db, 'unused.conf'), 'name: unused\nversion: 0.1\nid: unused-0.1\n');
  await fs.writeFile(path.join(root, 'A.hs'), 'module A where\na :: Int\na = 1\n');
  const projector = new Projector(path.join(repo, 'dist'));
  const audit = new ProjectAudit(projector, path.join(repo, 'compiler/Main.hs'), { root, trusted: true, ghcOptions: ['-package-db', db], cacheDir: path.join(repo, '.test-output/automatic-cache'), ghcPath: process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc' });
  try {
    await audit.refresh(); assert.equal(audit.snapshot.tree.summary.status, 'pure');
    await fs.rm(path.join(db, 'unused.conf'));
    const completed = audit.refresh();
    let done = false; void completed.then(() => { done = true; });
    await waitFor(() => done, 'package deletion left the audit refreshing forever');
    assert.equal(audit.snapshot.tree.summary.status, 'pure');
  } finally { audit.dispose(); projector.dispose(); }
});

test('Cabal defaults are per component and do not recursively include unrelated root examples', async () => {
  const root = await fs.mkdtemp(path.join(repo, '.test-output/audit-cabal-'));
  for (const dir of ['src', 'docs', 'App']) await fs.mkdir(path.join(root, dir));
  await fs.writeFile(path.join(root, 'demo.cabal'), 'name: demo\ncommon defaults\n  other-modules: App.Helper\nlibrary\n  hs-source-dirs: src\n  exposed-modules: A\nexecutable demo\n  import: defaults\n  main-is: Main.hs\n');
  for (const file of ['Main.hs', 'src/A.hs', 'App/Helper.hs', 'docs/Example.hs', 'Unowned.hs']) await fs.writeFile(path.join(root, file), '');
  assert.deepEqual((await auditScope(root)).files.map(f => path.relative(root, f).split(path.sep).join('/')), ['App/Helper.hs', 'Main.hs', 'src/A.hs']);
});
