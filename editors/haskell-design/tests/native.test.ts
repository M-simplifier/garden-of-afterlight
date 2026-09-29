import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { Projector } from '../src/projector';
import { nativeExecutable } from '../src/native';

const tool = path.resolve(__dirname, '../..');
const binary = nativeExecutable(path.join(tool, 'dist'));
let root: string;
before(async () => {
  await fs.mkdir(path.join(tool, '.test-output'), { recursive: true });
  root = await fs.mkdtemp(path.join(tool, '.test-output/native-'));
});
async function fixture(name: string, files: Record<string, string>): Promise<string> {
  const dir = path.join(root, name);
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.writeFile(path.join(dir, file), text);
  }
  return dir;
}
const run = (project: string, args: string[], env = process.env) => JSON.parse(execFileSync(binary, [...args, '--root', project, '--json'], { encoding: 'utf8', env, timeout: 120_000 }));

test('native binary reads a relocated Unicode project without Node or GHC on PATH', async () => {
  const dir = await fixture('日本語 space', { 'Api.hs': 'module Api where\nanswer :: Int\nanswer = 42\n' });
  const env = { ...process.env, PATH: process.platform === 'win32' ? path.join(process.env.SystemRoot!, 'System32') : '/nonexistent' };
  const page = run(dir, ['show', '--file', 'Api.hs', '--symbol', 'answer'], env);
  assert.equal(page.matches, 1); assert.match(page.text, /answer = 42/);
});

test('Unicode and CRLF positions retain source slices and UTF-16 reference columns', async () => {
  const source = 'module Unicode where\r\n-- | 🐈 説明\r\ndata Record = Record { label :: String }\r\nvalue :: Int; value = length "😀"; next = value\r\n';
  const reader = new Projector(path.join(tool, 'dist'));
  try {
    const design = await reader.project(source, 'Unicode.hs');
    assert.equal(design.issues.length, 0, design.issues.join('\n'));
    assert.match(design.text, /label :: String/); assert.match(design.text, /🐈 説明/);
    const next = design.declarations.find(d => d.names.includes('next'))!;
    const ref = next.references.find(r => r.name === 'value')!;
    assert.equal(ref.line, 4); assert.equal(ref.column, source.split('\r\n')[3]!.lastIndexOf('value'));
    const symbol = (await reader.sourceSymbols(source)).find(s => s.names.includes('next'))!;
    assert.equal(symbol.source, 'next = value');
  } finally { reader.dispose(); }
});

test('root Cabal package excludes nested tool packages; explicit include remains available', async () => {
  const dir = await fixture('scope', {
    'game.cabal': 'cabal-version: 2.4\nname: game\nversion: 0.1\nlibrary\n  hs-source-dirs: src\n  exposed-modules: Game\n',
    'src/Game.hs': 'module Game where\ngame = True\n',
    'tools/tool.cabal': 'cabal-version: 2.4\nname: tool\nversion: 0.1\nlibrary\n  hs-source-dirs: lib\n  exposed-modules: Tool\n',
    'tools/lib/Tool.hs': 'module Tool where\ntool = False\n',
  });
  const game = run(dir, ['map']); assert.equal(game.coverage.files, 1); assert.doesNotMatch(game.text, /Tool/);
  const explicit = run(dir, ['map', '--include', 'tools/lib']); assert.equal(explicit.coverage.files, 1); assert.match(explicit.text, /Tool/);
  const conditional = await fixture('conditional-default', {
    'demo.cabal': 'cabal-version: 2.4\nname: demo\nversion: 0.1\nflag browser\n  default: False\nexecutable demo\n  main-is: Main.hs\n  if flag(browser)\n    hs-source-dirs: web\n',
    'Main.hs': 'module Main where\nmain = pure ()\n', 'web/Main.hs': 'module Main where\nmain = pure ()\n',
    'Unrelated.hs': 'module Unrelated where\nx = 1\n',
  });
  const branches = run(conditional, ['map']);
  assert.equal(branches.coverage.files, 2); assert.doesNotMatch(branches.text, /Unrelated/);
});

test('malformed Cabal is reported; excludes are applied before the discovery limit', async () => {
  const files: Record<string, string> = { 'bad.cabal': 'this is not a package', 'src/Keep.hs': 'module Keep where\nkeep = 1\n' };
  for (let i = 0; i < 10; i++) files[`aaa/Ignore${i}.hs`] = `module Ignore${i} where\nx = 1\n`;
  const dir = await fixture('invalid-cabal', files);
  const malformed = run(dir, ['map']); assert.ok(malformed.issueCount); assert.match(malformed.text, /Cannot parse Cabal/);
  const excluded = run(dir, ['map', '--include', '.', '--exclude', 'aaa', '--max-files', '1']);
  assert.equal(excluded.coverage.files, 1); assert.equal(excluded.coverage.discoveryTruncated, false); assert.match(excluded.text, /Keep/);
});

test('CLI inference observes component options and rejects unsupported or out-of-scope dependencies', async () => {
  const dir = await fixture('inference', {
    '.haskell-design.json': JSON.stringify({ version: 1, components: [{ path: 'src', ghcOptions: ['-isrc', '-XNoMonomorphismRestriction'] }, { path: 'web', unsupportedReason: 'Separate Wasm toolchain' }] }),
    'src/Api.hs': 'module Api where\nimport Hidden\nidentity x = x\ncopy = hidden\n',
    'src/Hidden.hs': 'module Hidden where\nhidden = True\n',
    'web/Browser.hs': 'module Browser where\nrun = True\n',
  });
  const flags = ['outline', '--infer', '--trusted', '--ghc', process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc', '--cache-dir', path.join(tool, '.test-output/reader-cache')];
  const inferred = run(dir, [...flags, '--file', 'src/Api.hs']);
  assert.equal(inferred.issueCount, 0, inferred.text); assert.match(inferred.text, /copy :: Bool/);
  const browser = run(dir, [...flags, '--file', 'web/Browser.hs']); assert.match(browser.text, /Separate Wasm toolchain/); assert.ok(browser.issueCount);
  await fs.writeFile(path.join(dir, 'src/Hidden.hs'), '{-# LANGUAGE CPP #-}\nmodule Hidden where\nhidden = True\n');
  const cpp = run(dir, [...flags, '--file', 'src/Api.hs']); assert.ok(cpp.issueCount); assert.match(cpp.text, /CPP/); assert.match(cpp.text, /copy :: \?/);
  await fs.mkdir(path.join(dir, 'fixtures'));
  await fs.rename(path.join(dir, 'src/Hidden.hs'), path.join(dir, 'fixtures/Hidden.hs'));
  await fs.writeFile(path.join(dir, 'fixtures/Hidden.hs'), 'module Hidden where\nhidden = True\n');
  await fs.writeFile(path.join(dir, '.haskell-design.json'), JSON.stringify({ version: 1, ghcOptions: ['-ifixtures'] }));
  const outside = run(dir, [...flags, '--file', 'src/Api.hs']); assert.ok(outside.issueCount); assert.match(outside.text, /outside the workspace analysis scope/);
});

test('native server isolates request errors and exits cleanly on EOF', async () => {
  const child = spawn(binary, ['--serve'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; child.stdout.setEncoding('utf8').on('data', data => { output += data; });
  const completed = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  child.stdin.end('{broken\n' + JSON.stringify({ id: 2, command: 'project', file: 'A.hs', source: 'module A where\na :: Int\na = 1\n' }) + '\n');
  assert.equal(await completed, 0);
  const lines = output.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(lines.length, 2); assert.equal(typeof lines[0].error, 'string'); assert.equal(lines[1].result.module, 'A');
});
