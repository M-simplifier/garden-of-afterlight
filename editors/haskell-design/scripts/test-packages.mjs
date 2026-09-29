import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';

const tool = process.cwd();
await mkdir('.test-output', { recursive: true });
const temp = await mkdtemp(path.join(tool, '.test-output/package-'));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const platform = JSON.parse(await readFile('dist/native-platform.json', 'utf8'));
const vsix = path.resolve(`artifacts/haskell-design-${version}-${platform.platform}-${platform.arch}.vsix`);
const vsixDir = path.join(temp, 'vsix');
if (process.platform === 'win32') {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:HD_PACKAGE_VSIX, $env:HD_PACKAGE_DEST)'], {
    windowsHide: true, env: { ...process.env, HD_PACKAGE_VSIX: vsix, HD_PACKAGE_DEST: vsixDir },
  });
} else execFileSync('unzip', ['-q', vsix, '-d', vsixDir]);
const nvimDir = path.join(temp, 'neovim'); await mkdir(nvimDir);
execFileSync('tar', ['-xzf', `artifacts/haskell-design-neovim-${version}-${platform.platform}-${platform.arch}.tar.gz`, '-C', nvimDir], { windowsHide: true });
const project = path.join(temp, '別の game');
await cp('../fixtures/portable-game', project, { recursive: true });
const simple = path.join(temp, 'inferred'); await mkdir(simple);
await writeFile(path.join(simple, 'Api.hs'), 'module Api where\nidentity x = x\nmessage = getLine\n');
const report = [];
const env = { ...process.env, PATH: process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32') : '/nonexistent' };
for (const [name, distribution] of [['vsix', path.join(vsixDir, 'extension')], ['neovim', path.join(nvimDir, 'haskell-design')]]) {
  const binary = path.join(distribution, 'dist', process.platform === 'win32' ? 'haskell-design.exe' : 'haskell-design');
  assert.match(await readFile(path.join(distribution, 'dist/native-notices.txt'), 'utf8'), /Tree-sitter/);
  const run = (root, args, environment = env) => JSON.parse(execFileSync(binary, [...args, '--root', root, '--json'], { encoding: 'utf8', env: environment, timeout: 120000 }));
  const outline = run(project, ['outline']);
  assert.equal(outline.coverage.files, 4); assert.equal(outline.issueCount, 0); assert.match(outline.text, /advance :: Input -> World -> World/); assert.doesNotMatch(outline.text, /Map\.delete/);
  const exact = run(project, ['show', '--module', 'Lantern.Rules', '--symbol', 'advance']);
  assert.equal(exact.matches, 1); assert.match(exact.text, /Map\.delete/); assert.doesNotMatch(exact.text, /scoreAfter/);
  const actual = run(path.resolve(tool, '../..'), ['show', '--module', 'Garden.Change', '--symbol', 'apply']);
  assert.equal(actual.matches, 1); assert.match(actual.text, /M\.foldlWithKey'/);
  const inferred = run(simple, ['outline', '--file', 'Api.hs', '--infer', '--trusted', '--ghc', process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc', '--cache-dir', path.join(tool, '.test-output/reader-cache')], process.env);
  assert.equal(inferred.issueCount, 0, inferred.text); assert.match(inferred.text, /message :: IO String/);
  report.push({ distribution: name, relocatedGameFiles: 4, nodeFreeSyntax: true, packagedInference: true, afterlightSelection: true });
}
const profile = path.join(temp, 'package.lua');
await writeFile(profile, `vim.opt.runtimepath:prepend(vim.env.HD_PACKAGE_ROOT)
local hd = require('haskell-design')
hd.setup({root=vim.env.HD_PACKAGE_GAME, auto_verify=false})
vim.cmd.edit(vim.env.HD_PACKAGE_GAME .. '/engine/Lantern/Rules.hs')
hd.open()
assert(vim.wait(15000, function() return table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\\n'):find('advance :: Input') ~= nil end), 'packaged design view')
hd.source()
assert(vim.api.nvim_buf_get_name(0):find('Rules.hs',1,true), 'source round trip')
print('Packaged Neovim native projection and source round trip: PASS')
vim.cmd('qa!')
`);
execFileSync(process.env.NVIM_EXECUTABLE ?? 'nvim', ['--headless', '-u', 'NONE', '-i', 'NONE', '-l', profile], {
  stdio: 'inherit', windowsHide: true, timeout: 30000,
  env: { ...process.env, HD_PACKAGE_ROOT: path.join(nvimDir, 'haskell-design'), HD_PACKAGE_GAME: project },
});
await writeFile('.test-output/package-result.json', JSON.stringify({ passed: true, checks: report, neovimConsumer: true }, null, 2));
console.log(JSON.stringify(report));
