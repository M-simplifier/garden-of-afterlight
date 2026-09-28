#!/usr/bin/env node
// Local, explicit setup. No global editor settings or toolchain defaults are changed.
import { access, readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tool = path.join(root, 'editors/haskell-design');
const local = path.join(root, '.runtime/haskell-editor');
const args = process.argv.slice(2);
const command = args.shift() ?? 'doctor';
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--apply') options.apply = true;
  else if (args[i] === '--keep-existing') options.keepExisting = true;
  else if (['--ghc', '--cabal', '--hls'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
  else throw new Error(`Unknown option: ${args[i]}`);
}
const exists = async file => { try { await access(file, constants.F_OK); return true; } catch { return false; } };
const json = data => JSON.stringify(data, null, 2) + '\n';
const unix = file => file.replaceAll('\\', '/');
const hash = data => createHash('sha256').update(data).digest('hex');
const cabalFile = path.join(root, 'garden-of-afterlight.cabal');
const components = [
  ['src', 'noema-garden'],
  ['tools/GardenMain.hs', 'noema-garden'],
  ['tools/GardenRenderCheck.hs', 'noema-render-check'],
  ['tools/GardenAudio.hs', 'noema-garden-audio'],
  ['tools/GardenCheck.hs', 'noema-garden-check'],
];
async function executable(name) {
  const suffixes = process.platform === 'win32' && !path.extname(name) ? ['', '.exe', '.cmd'] : [''];
  for (const dir of name.includes('/') || name.includes('\\') ? [''] : (process.env.PATH ?? '').split(path.delimiter)) {
    for (const suffix of suffixes) {
      const file = path.resolve(dir, name + suffix);
      if (await exists(file)) return realpath(file);
    }
  }
  throw new Error(`Missing executable: ${name}. See editors/setup.md.`);
}
function run(file, argv, settings = {}) {
  const result = spawnSync(file, argv, { cwd: root, encoding: 'utf8', windowsHide: true,
    timeout: 120000, maxBuffer: 8_000_000, ...settings });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(file)} ${argv.join(' ')} failed (${result.status})\n${result.stderr ?? ''}${result.stdout ?? ''}`);
  return (result.stdout ?? '').trim();
}
async function compiler() {
  let ghc = await executable(options.ghc ?? 'ghc');
  const version = run(ghc, ['--numeric-version']);
  if (version !== '9.6.7') throw new Error(`Afterlight setup expects GHC 9.6.7; found ${version}. Pass --ghc with its full path.`);
  // Prefer the selected installation over a mutable GHCup shim when available.
  const installed = path.resolve(run(ghc, ['--print-libdir']), '../bin', process.platform === 'win32' ? 'ghc.exe' : 'ghc');
  if (await exists(installed) && run(installed, ['--numeric-version']) === version) ghc = installed;
  return { ghc, version, cabal: await executable(options.cabal ?? 'cabal') };
}
async function doctor() {
  const report = { node: process.version, platform: process.platform, root, tools: {} };
  for (const [name, flag] of [['ghc', '--numeric-version'], ['cabal', '--numeric-version'], ['haskell-language-server-wrapper', '--version'], ['nvim', '--version']]) {
    try {
      const file = await executable(options[name === 'haskell-language-server-wrapper' ? 'hls' : name] ?? name);
      report.tools[name] = { path: file, version: run(file, [flag]).split('\n')[0] };
    } catch (e) { report.tools[name] = { error: e.message }; }
  }
  try { report.tools.code = { path: await executable('code') }; } catch { report.tools.code = { error: 'VS Code CLI not found' }; }
  console.log(json(report));
}
async function build() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Building the packages requires Node.js 22 or newer.');
  const npm = await executable(process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const cli = npm.endsWith('.cmd') ? path.join(path.dirname(npm), 'node_modules/npm/bin/npm-cli.js') : npm;
  if (!await exists(cli)) throw new Error('npm-cli.js not found beside npm. Run the npm commands from editors/setup.md directly.');
  for (const argv of [['ci', '--ignore-scripts', '--no-audit', '--no-fund'], ['run', 'package'], ['run', 'package:neovim']]) {
    run(process.execPath, [cli, ...argv], { cwd: tool, stdio: 'inherit', timeout: 600000 });
  }
}
async function prepare() {
  const { ghc, cabal } = await compiler();
  await mkdir(local, { recursive: true });
  run(cabal, ['build', ...new Set(components.map(([, name]) => `exe:${name}`)),
    '--only-dependencies', '-fnative', '-f-web', `--with-compiler=${ghc}`, `--builddir=${path.join(local, 'build')}`],
    { stdio: 'inherit', timeout: 1800000 });
  await writeFile(path.join(local, 'prepared.json'), json({ ghc, cabal, cabalHash: hash(await readFile(cabalFile)) }));
}
async function configure() {
  const { ghc, cabal, version } = await compiler();
  const hls = await executable(options.hls ?? 'haskell-language-server-wrapper');
  const hlsVersion = run(hls, ['--version']).split('\n')[0];
  const prepared = JSON.parse(await readFile(path.join(local, 'prepared.json'), 'utf8').catch(() => { throw new Error('Run prepare first.'); }));
  const cabalHash = hash(await readFile(cabalFile));
  if (prepared.cabalHash !== cabalHash || prepared.ghc !== ghc) throw new Error('Cabal sources/compiler changed. Run prepare again.');
  const plan = JSON.parse(await readFile(path.join(local, 'build/cache/plan.json'), 'utf8'));
  if (plan['compiler-id'] !== `ghc-${version}`) throw new Error('Prepared build plan uses a different compiler.');
  const store = run(cabal, ['path', '--store-dir']);
  const packageDB = path.join(store, `ghc-${version}`, 'package.db');
  if (!await exists(packageDB)) throw new Error(`Cabal package database missing: ${packageDB}`);
  const config = { version: 1, ghcPath: unix(ghc), ghcOptions: ['-XGHC2021', '-hide-all-packages', '-package-db', unix(packageDB)],
    audit: { include: ['src', 'tools'], exclude: ['editors'] }, components: [] };
  for (const [file, name] of components) {
    const component = plan['install-plan'].find(p => p['pkg-name'] === 'garden-of-afterlight' && p['component-name'] === `exe:${name}`);
    if (!component?.depends?.length) throw new Error(`Missing ${name} in prepared build plan.`);
    config.components.push({ path: file, ghcOptions: ['-isrc', '-itools', ...component.depends.flatMap(id => ['-package-id', id])] });
  }
  config.components.push({ path: 'web', unsupportedReason: 'Browser entry uses the separate GHC Wasm toolchain; see web/README.md.' });
  const hie = 'cradle:\n  multi:\n    - path: "./web"\n      config:\n        cradle:\n          none:\n    - path: "./editors"\n      config:\n        cradle:\n          none:\n    - path: "./"\n      config:\n        cradle:\n          cabal:\n' + components.map(([file, name]) => `            - path: "./${file}"\n              component: "garden-of-afterlight:exe:${name}"\n`).join('');
  const project = '-- Generated by editors/setup.mjs; local editor toolchain.\nwith-compiler: ' + unix(ghc) + '\npackage garden-of-afterlight\n  flags: +native -web\n';
  const settings = { root, ghc, cabal, hls, hlsVersion, ghcBin: path.dirname(ghc), cabalBin: path.dirname(cabal), cabalHash };
  const serverPath = [settings.ghcBin, settings.cabalBin, process.env.PATH ?? ''].join(path.delimiter);
  const workspace = { folders: [{ path: root }], extensions: { recommendations: ['haskell.haskell', 'local-tools.haskell-design'] }, settings: {
    'haskell.manageHLS': 'PATH', 'haskell.serverExecutablePath': hls, 'haskell.serverEnvironment': { PATH: serverPath },
    'haskell.sessionLoading': 'singleComponent',
    // The viewer audits the whole project; HLS loads edited files and dependencies.
    'haskell.checkProject': false,
    'haskell.serverExtraArgs': '-j4',
    'haskell.formattingProvider': 'ormolu', 'haskell.plugin.semanticTokens.globalOn': true,
    ...(process.platform === 'win32' ? { 'haskell.plugin.rename.config.crossModule': false } : {}),
    '[haskell]': { 'editor.defaultFormatter': 'haskell.haskell' },
    'haskellDesign.autoVerify': true, 'workbench.editorAssociations': { '*.hs': 'haskellDesign.editor' },
  } };
  const generated = path.join(local, 'generated');
  await mkdir(generated, { recursive: true });
  const outputs = { '.haskell-design.json': json(config), 'hie.yaml': hie, 'cabal.project.local': project };
  for (const [file, source] of Object.entries(outputs)) await writeFile(path.join(generated, file), source);
  console.log('Proposed project settings:', generated);
  if (!options.apply) { console.log('Review these files, then use configure --apply. Existing files are never overwritten.'); return; }
  const conflicts = [];
  for (const [file, source] of Object.entries(outputs)) {
    if (await exists(path.join(root, file)) && (await readFile(path.join(root, file), 'utf8')).replaceAll('\r\n', '\n') !== source) conflicts.push(file);
  }
  if (conflicts.length && !options.keepExisting) throw new Error(`Existing settings differ: ${conflicts.join(', ')}. Compare with generated/ and merge deliberately; no project settings were changed. After merging, --apply --keep-existing preserves them and writes editor launch settings.`);
  if (conflicts.length) console.log('Preserving existing settings (verify their merged contents):', conflicts.join(', '));
  for (const [file, source] of Object.entries(outputs)) if (!await exists(path.join(root, file))) await writeFile(path.join(root, file), source, { flag: 'wx' });
  await writeFile(path.join(local, 'settings.json'), json(settings));
  await writeFile(path.join(local, 'afterlight.code-workspace'), json(workspace));
  console.log('Project configured. Next: verify, then open Neovim or the generated VS Code workspace.');
}
async function verifyProject() {
  const settings = JSON.parse(await readFile(path.join(local, 'settings.json'), 'utf8'));
  if (settings.cabalHash !== hash(await readFile(cabalFile))) throw new Error('Cabal file changed; prepare/configure again.');
  const report = { compiler: run(settings.ghc, ['--numeric-version']), checks: [] };
  const selected = run(settings.cabal, ['exec', '-v0', '--', 'ghc', '--numeric-version']);
  if (selected !== report.compiler) throw new Error(`Cabal selects GHC ${selected}, viewer selects ${report.compiler}. Fix the project configuration.`);
  for (const [file, expected] of [['src/Garden/Change.hs', 'pure'], ['src/Garden/Rules.hs', 'pure'], ['src/Garden/Audio.hs', 'io'], ['tools/GardenCheck.hs', 'io']]) {
    const data = JSON.parse(run(process.execPath, [path.join(tool, 'dist/cli.cjs')], {
      input: json({ command: 'verify', root, file: path.join(root, file), trusted: true, cacheDir: path.join(local, 'cache') }), timeout: 120000 }));
    report.checks.push({ file, expected, status: data.status, verified: data.verified === true, issues: data.issues });
  }
  report.passed = report.checks.every(c => c.status === c.expected && c.verified);
  await writeFile(path.join(local, 'verification.json'), json(report));
  console.log(json(report));
  if (!report.passed) throw new Error('Compiler/viewer verification failed. See .runtime/haskell-editor/verification.json');
  console.log('Compiler/viewer verified. Editor/HLS checks are still required; see editors/setup.md.');
}
try {
  const action = { doctor, build, prepare, configure, verify: verifyProject }[command];
  if (!action) throw new Error('Commands: doctor | build | prepare | configure [--apply] | verify');
  await action();
} catch (error) { console.error(error.message); process.exitCode = 1; }
