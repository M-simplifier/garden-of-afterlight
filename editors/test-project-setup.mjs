// Real Cabal + GHC checks in a new project, using only copied public skills.
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const distribution = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(distribution, '.runtime/editor-portability');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), 'haskell-game-'));
const root = path.join(temporary, 'lantern courier');
await cp(path.join(distribution, 'editors/fixtures/portable-game'), root, { recursive: true });
for (const name of ['fp-gamedev', 'haskell-excellence', 'haskell-editor-setup']) {
  await cp(path.join(distribution, '.agents/skills', name), path.join(root, '.agents/skills', name), { recursive: true });
}
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const run = (file, args, expected = 0, input) => {
  const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 8_000_000, input });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, result.stderr + result.stdout);
  return result.stdout;
};
const ghc = process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc';
const cabal = process.env.HASKELL_DESIGN_TEST_CABAL ?? 'cabal';
const hls = process.env.HASKELL_DESIGN_TEST_HLS ?? 'haskell-language-server-wrapper';
run('git', ['init', '-q']);
run(cabal, ['build', 'all', '--enable-tests', `--with-compiler=${ghc}`]);
check('independent library, executable and tests build', true);
run(cabal, ['test', 'rules', `--with-compiler=${ghc}`]);
check('the game rule tests pass', true);
// Cabal test can change the selected plan: restore the complete target selection.
run(cabal, ['build', 'all', '--enable-tests', `--with-compiler=${ghc}`]);
const setup = ['.agents/skills/haskell-editor-setup/scripts/configure-cabal.mjs', '--ghc', ghc, '--cabal', cabal, '--hls', hls];
run(process.execPath, setup);
const exists = async file => { try { await access(path.join(root, file)); return true; } catch { return false; } };
check('proposal mode leaves target settings absent', !await exists('.haskell-design.json') && !await exists('.vscode/settings.json'));
await mkdir(path.join(root, '.vscode'));
const previous = '// Keep my font\n{ "editor.fontSize": 17 }\n';
await writeFile(path.join(root, '.vscode/settings.json'), previous);
run(process.execPath, [...setup, '--apply'], 1);
check('a settings conflict prevents all target writes', !await exists('.haskell-design.json') && !await exists('hie.yaml') && !await exists('cabal.project.local'));
check('existing JSONC remains byte-for-byte unchanged', await readFile(path.join(root, '.vscode/settings.json'), 'utf8') === previous);
const merged = JSON.parse(await readFile(path.join(root, '.runtime/haskell-editor/generated/.vscode/settings.json'), 'utf8'));
merged['editor.fontSize'] = 17;
await writeFile(path.join(root, '.vscode/settings.json'), '// Keep my font\n' + JSON.stringify(merged, null, 2) + '\n');
run(process.execPath, [...setup, '--apply', '--keep-existing']);
check('merged folder settings retain the user preference', (await readFile(path.join(root, '.vscode/settings.json'), 'utf8')).includes('"editor.fontSize": 17'));
const config = JSON.parse(await readFile(path.join(root, '.haskell-design.json'), 'utf8'));
check('host analyzes the local library as current source', config.components.find(c => c.path === 'desktop').ghcOptions.includes('-iengine'));
check('configuration has no Afterlight package or module names', !/Garden\/|garden-of-afterlight|noema-garden/.test(JSON.stringify(config.components)));
const cli = path.join(distribution, 'editors/haskell-design/dist/cli.cjs');
const verify = file => JSON.parse(run(process.execPath, [cli], 0, JSON.stringify({ command: 'verify', root, file: path.join(root, file), trusted: true, cacheDir: path.join(root, '.runtime/cache') })));
for (const [file, expected] of [['engine/Lantern/Rules.hs', 'pure'], ['desktop/Main.hs', 'io'], ['checks/RulesSpec.hs', 'io']]) {
  const model = verify(file);
  check(`${file}: verified ${expected}`, model.verified && model.status === expected);
  if (expected === 'pure') check('inferred signature is available', model.declarations.some(d => d.inferred && d.design.includes('scoreAfter :: Input -> World -> Int')));
}
const types = path.join(root, 'engine/Lantern/Types.hs');
const original = await readFile(types, 'utf8');
try {
  await writeFile(types, original.replace('position :: Int', 'position :: Bool'));
  const model = verify('desktop/Main.hs');
  check('a changed library invalidates the host instead of using a stale compiled interface', !model.verified && model.issues.some(issue => issue.includes('Types.hs') && issue.includes('Bool')));
} finally { await writeFile(types, original); }
check('host verification recovers after the library is restored', verify('desktop/Main.hs').verified);
const report = { passed: true, project: root, compiler: run(ghc, ['--numeric-version']).trim(), checks };
await writeFile(path.join(output, 'setup-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log('VS Code test project:', root);
