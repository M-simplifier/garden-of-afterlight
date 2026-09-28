import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, cp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
await mkdir('.test-output', { recursive: true });
// macOS Unix sockets have a short path limit; the project may have a long Unicode path.
const temporary = await mkdtemp(path.join(process.platform === 'win32' ? os.tmpdir() : '/tmp', 'hd-vscode-'));
const project = process.env.HASKELL_DESIGN_TEST_PROJECT;
const portable = process.env.HASKELL_DESIGN_TEST_PORTABLE === '1';
if (portable && !project) throw new Error('Portable project tests require HASKELL_DESIGN_TEST_PROJECT.');
const workspace = project ? path.resolve(project) : path.join(temporary, 'workspace');
if (!project) await cp('examples', workspace, { recursive: true });
if (!project && process.env.HASKELL_DESIGN_TEST_AUTO) {
  await mkdir(path.join(workspace, 'docs'));
  await writeFile(path.join(workspace, 'docs/Excluded.hs'), 'module Excluded where\nx = 1\n');
  await writeFile(path.join(workspace, 'Domain/Dependent.hs'), '{-# LANGUAGE Trustworthy #-}\nmodule Domain.Dependent where\nimport Domain.Order\ncopy = isDraft\ncollect :: Foldable f => f Int -> [Int]\ncollect = foldr (:) []\n');
  await writeFile(path.join(workspace, 'Domain/HintAlias.hs'), 'module Domain.HintAlias where\ntype Action = Maybe\n');
  await writeFile(path.join(workspace, 'Domain/HintClient.hs'), 'module Domain.HintClient where\nimport Domain.HintAlias\nvalue :: Action Int\nvalue = pure 1\n');
  await writeFile(path.join(workspace, 'example.cabal'), 'cabal-version: 2.4\nname: example\nversion: 0.1\nlibrary\n  hs-source-dirs:\n    Domain\n    Application\n');
}
let extensionPath = root;
if (process.env.HASKELL_DESIGN_TEST_VSIX) {
  const unpacked = path.join(temporary, 'package');
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:HD_TEST_VSIX, $env:HD_TEST_UNPACK)'], {
      windowsHide: true, env: { ...process.env, HD_TEST_VSIX: path.resolve(process.env.HASKELL_DESIGN_TEST_VSIX), HD_TEST_UNPACK: unpacked },
    });
  } else execFileSync('unzip', ['-q', path.resolve(process.env.HASKELL_DESIGN_TEST_VSIX), '-d', unpacked]);
  extensionPath = path.join(unpacked, 'extension');
}
if (!project) for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Example baseline']]) execFileSync('git', args, { cwd: workspace });
const userData = path.join(temporary, 'profile');
await mkdir(path.join(userData, 'User'), { recursive: true });
await writeFile(path.join(userData, 'User/settings.json'), JSON.stringify({ 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'workbench.startupEditor': 'none', 'security.workspace.trust.enabled': false, 'git.enabled': false, 'haskellDesign.autoVerify': !!project || !!process.env.HASKELL_DESIGN_TEST_AUTO, 'workbench.colorTheme': 'Default Dark Modern', 'window.zoomLevel': 0 }));
const binary = process.env.VSCODE_EXECUTABLE || ['Code', 'Electron']
  .map(name => `/Applications/Visual Studio Code.app/Contents/MacOS/${name}`).find(existsSync);
if (!binary) throw new Error('Set VSCODE_EXECUTABLE to the VS Code application executable.');
const reportName = portable ? 'vscode-portable-result.json' : project ? 'vscode-afterlight-result.json' : process.env.HASKELL_DESIGN_TEST_AUTO ? 'vscode-auto-result.json' : 'vscode-result.json';
const env = { ...process.env, HASKELL_DESIGN_TEST_RESULT: path.join(root, '.test-output', reportName) };
await rm(env.HASKELL_DESIGN_TEST_RESULT, { force: true });
delete env.ELECTRON_RUN_AS_NODE;
const args = [project && !portable ? path.join(workspace, '.runtime/haskell-editor/afterlight.code-workspace') : workspace,
  '--new-window', '--skip-welcome', '--skip-release-notes', ...(!project ? ['--disable-extensions'] : []),
  '--user-data-dir', userData, '--extensions-dir', process.env.VSCODE_TEST_EXTENSIONS ?? path.join(temporary, 'extensions'),
  '--extensionDevelopmentPath', extensionPath, '--extensionTestsPath', path.join(root, portable ? 'dist/tests/portable.test.cjs' : project ? 'dist/tests/afterlight.test.cjs' : 'dist/tests/extension.test.cjs')];
console.log('VS Code integration workspace:', workspace);
const child = spawn(binary, args, { env, stdio: 'inherit', windowsHide: true });
const timer = setTimeout(() => child.kill('SIGTERM'), project ? 600000 : 150000);
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
child.on('exit', async (code, signal) => {
  clearTimeout(timer);
  if (code !== 0) console.error('VS Code test host exited:', code, signal);
  const report = await readFile(env.HASKELL_DESIGN_TEST_RESULT, 'utf8').then(JSON.parse).catch(() => null);
  if (!report?.passed) console.error('No passing test report was produced.');
  process.exitCode = code === 0 && report?.passed ? 0 : 1;
});
