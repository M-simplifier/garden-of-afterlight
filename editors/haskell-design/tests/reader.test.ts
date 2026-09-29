import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CodeReader, ReadRequest } from '../src/reader';

const repo = path.resolve(__dirname, '../..');
before(() => fs.mkdir(path.join(repo, '.test-output'), { recursive: true }));
async function fixture(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(repo, '.test-output/reader-'));
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }
  return root;
}
async function use<T>(body: (reader: CodeReader) => Promise<T>): Promise<T> {
  const reader = new CodeReader(path.join(repo, 'dist'));
  try { return await body(reader); } finally { reader.dispose(); }
}
const source = `{-# LANGUAGE GADTs, TypeFamilies, PatternSynonyms #-}
module Api where
import Data.Maybe (fromMaybe)
data Box a where
  Box :: { value :: a } -> Box a
newtype Count = Count Int
type family Item a where
  Item (Box a) = a
class Has a where
  get :: a -> Int
  get _ = 712345
instance Has Int where
  get n = n + 612345
-- | A documented operation.
run :: Int -> Int
run 0 = 123456
run n
  | n > 0 = helper n
  | otherwise = 0
  where helper x = x + 234567
shared, sibling :: Int -> Int
shared = (+ 345678)
sibling = (+ 456789)
(%%) :: Int -> Int -> Int
x %% y = x + y
pattern Empty :: Maybe a
pattern Empty = Nothing
untyped n = n + 567890
(left, right) = (777888, 999000)
`;

test('outline keeps data, GADT fields, type families and contracts; hides bodies and optional context', async () => {
  const root = await fixture({ 'Api.hs': source });
  await use(async reader => {
    const page = await reader.read({ command: 'outline', root });
    assert.equal(page.coverage.files, 1); assert.equal(page.issueCount, 0);
    for (const contract of ['data Box a where', 'value :: a', 'newtype Count', 'Item (Box a) = a', 'get :: a -> Int', 'instance Has Int', 'run :: Int -> Int', 'untyped :: ?', 'pattern Empty :: Maybe a', '(%%) ::']) assert.ok(page.text.includes(contract), contract);
    for (const body of ['123456', '234567', '345678', '456789', '567890', '612345', '712345', '777888', '999000', 'pattern Empty =', 'import Data.Maybe', 'A documented operation.']) assert.ok(!page.text.includes(body), body);
    assert.equal(page.next, undefined);
    const detailed = await reader.read({ command: 'outline', root, context: true, docs: true });
    assert.match(detailed.text, /import Data.Maybe/); assert.match(detailed.text, /A documented operation/);
  });
});

test('show returns all clauses, guards and where as one unit without adjacent functions', async () => {
  const root = await fixture({ 'Api.hs': source });
  await use(async reader => {
    const page = await reader.read({ command: 'show', root, module: 'Api', symbol: 'run', docs: true });
    assert.equal(page.matches, 1);
    for (const text of ['run :: Int -> Int', 'run 0 = 123456', '| otherwise = 0', 'where helper x = x + 234567', 'A documented operation']) assert.ok(page.text.includes(text), text);
    assert.doesNotMatch(page.text, /345678|456789|import Data.Maybe/);
    const selected = await reader.read({ command: 'show', root, file: 'Api.hs', symbol: 'shared' });
    assert.match(selected.text, /shared, sibling :: Int -> Int/);
    assert.match(selected.text, /shared = \(\+ 345678\)/); assert.doesNotMatch(selected.text, /sibling =|456789/);
  });
});

test('operators, pattern synonyms and pattern bindings are selectable syntax units', async () => {
  const root = await fixture({ 'Api.hs': source });
  await use(async reader => {
    for (const name of ['%%', '(%%)']) {
      const page = await reader.read({ command: 'show', root, symbol: name });
      assert.equal(page.matches, 1); assert.match(page.text, /\(%%\) ::/); assert.match(page.text, /x %% y = x \+ y/);
    }
    const pattern = await reader.read({ command: 'show', root, symbol: 'Empty' });
    assert.equal(pattern.matches, 1); assert.match(pattern.text, /pattern Empty :: Maybe a\npattern Empty = Nothing/);
    const binding = await reader.read({ command: 'show', root, symbol: 'left' });
    assert.equal(binding.matches, 1); assert.match(binding.text, /\(left, right\) = \(777888, 999000\)/);
  });
});

test('expression-bearing pragmas stay hidden and can be requested by source line', async () => {
  const root = await fixture({ 'Rules.hs': 'module Rules where\nf :: Int -> Int\nf x = x\n{-# RULES "example" forall x. f x = x + 654321 #-}\n' });
  await use(async reader => {
    const page = await reader.read({ command: 'outline', root });
    assert.doesNotMatch(page.text, /654321/); assert.match(page.text, /pragma; inspect with show/);
    const exact = await reader.read({ command: 'show', root, file: 'Rules.hs', line: 4 });
    assert.equal(exact.matches, 1); assert.match(exact.text, /x \+ 654321/);
  });
});

test('class and instance methods are ambiguous until selected by file and line', async () => {
  const root = await fixture({ 'Api.hs': source });
  await use(async reader => {
    const page = await reader.read({ command: 'show', root, symbol: 'get' });
    assert.equal(page.matches, 2); assert.match(page.text, /AMBIGUOUS/);
    assert.match(page.text, /class Has a/); assert.match(page.text, /instance Has Int/);
    assert.doesNotMatch(page.text, /712345|612345/);
    const line = source.split('\n').findIndex(text => text.includes('get n =')) + 1;
    const chosen = await reader.read({ command: 'show', root, file: 'Api.hs', line, symbol: 'get' });
    assert.equal(chosen.matches, 1); assert.match(chosen.text, /get n = n \+ 612345/); assert.doesNotMatch(chosen.text, /712345/);
  });
});

test('Cabal CRLF/common/conditional sources include Wasm even if editor verification excludes it', async () => {
  const cabal = `cabal-version: 2.4\nname: demo\nversion: 0.1.0\nflag browser\n  default: False\ncommon shared\n  hs-source-dirs: src\nexecutable native\n  import: shared\n  main-is: Main.hs\n  hs-source-dirs: app\n  if flag(browser)\n    hs-source-dirs: web\n`;
  const root = await fixture({ 'demo.cabal': cabal.replace(/\n/g, '\r\n'), 'src/Api.hs': source,
    'app/Main.hs': 'module Main where\nmain = pure ()\n', 'web/Main.hs': 'module Main where\nmain = pure ()\n',
    'docs/Example.hs': source, 'dist-newstyle/Generated.hs': source, 'src/fixtures/Negative.hs': source,
    '.haskell-design.json': JSON.stringify({ version: 1, audit: { include: ['src'], exclude: ['web'] }, components: [{ path: 'web', unsupportedReason: 'Wasm' }] }),
  });
  await use(async reader => {
    const map = await reader.read({ command: 'map', root });
    assert.equal(map.coverage.files, 3); assert.match(map.text, /app\/Main.hs/); assert.match(map.text, /web\/Main.hs/);
    assert.doesNotMatch(map.text, /Example.hs|Generated.hs|Negative.hs/);
    const ambiguous = await reader.read({ command: 'show', root, module: 'Main', symbol: 'main' });
    assert.equal(ambiguous.matches, 2); assert.doesNotMatch(ambiguous.text, /main =/);
    const explicit = await reader.read({ command: 'map', root, include: ['docs'] });
    assert.equal(explicit.coverage.files, 1); assert.match(explicit.text, /docs\/Example.hs/);
    const limited = await reader.read({ command: 'map', root, maxFiles: 1 });
    assert.equal(limited.coverage.discoveryTruncated, true); assert.match(limited.text, /discovery limit reached/);
  });
});

test('paging keeps complete declarations, restores module context and refuses stale cursors', async () => {
  const root = await fixture({ 'Many.hs': 'module Many where\n' + Array.from({ length: 60 }, (_, i) => `function${i} :: Int -> Int\nfunction${i} x = x + ${i}\n`).join('') });
  await use(async reader => {
    const request: ReadRequest = { command: 'outline', root, maxChars: 1100 };
    const pages: string[] = []; let offset = 0, snapshot: string | undefined;
    do {
      const page = await reader.read({ ...request, offset, snapshot });
      assert.ok(page.text.length <= request.maxChars!); assert.equal(page.blocked, undefined);
      assert.match(page.text, /## Many \| Many.hs/); assert.doesNotMatch(page.text, / x = x/);
      pages.push(page.text); snapshot = page.snapshot;
      if (!page.next) break;
      assert.ok(page.next.offset > offset); offset = page.next.offset;
    } while (pages.length < 30);
    assert.ok(pages.length > 1); assert.match(pages.at(-1)!, /# END/);
    for (let i = 0; i < 60; i++) assert.equal(pages.join('').split(`function${i} ::`).length - 1, 1);
    await assert.rejects(reader.read({ ...request, offset, snapshot, context: true }), /snapshot or view options changed/);
    await assert.rejects(reader.read({ ...request, offset }), /Continuation requires/);
    await fs.appendFile(path.join(root, 'Many.hs'), '\nnewName = False\n');
    await assert.rejects(reader.read({ ...request, offset, snapshot }), /snapshot or view options changed/);
  });
});

test('a giant declaration is never silently cut to fit the output budget', async () => {
  const root = await fixture({ 'Large.hs': 'module Large where\ndata Large = Large\n  { ' + Array.from({ length: 140 }, (_, i) => `field${i} :: Int`).join('\n  , ') + '\n  }\n' });
  await use(async reader => {
    const first = await reader.read({ command: 'outline', root, maxChars: 1100 });
    assert.ok(first.next); assert.doesNotMatch(first.text, /field0/);
    const blocked = await reader.read({ command: 'outline', root, maxChars: 1100, ...first.next });
    assert.ok(blocked.blocked); assert.ok(blocked.text.length <= 1100); assert.doesNotMatch(blocked.text, /field0/);
    const enough = await reader.read({ command: 'outline', root, maxChars: blocked.blocked.minimumChars, ...blocked.next });
    assert.match(enough.text, /field0 :: Int/); assert.match(enough.text, /field139 :: Int/); assert.equal(enough.next, undefined);
  });
});

test('warnings and missing matches remain visible; source limits and paths fail clearly', async () => {
  const root = await fixture({ 'Bad.hs': 'module Bad where\ndata = \n', 'Huge.hs': '--' + 'x'.repeat(2_000_001) });
  await use(async reader => {
    const page = await reader.read({ command: 'outline', root });
    assert.equal(page.issueCount, 2); assert.match(page.text, /Source size limit/); assert.match(page.text, /WARNING Bad.hs/);
    const missing = await reader.read({ command: 'show', root, symbol: 'noSuchSymbol' });
    assert.equal(missing.matches, 0); assert.match(missing.text, /NOT FOUND/);
    await assert.rejects(reader.read({ command: 'map', root, file: '../Outside.hs' }), /Outside project/);
    await assert.rejects(reader.read({ command: 'map', root, include: ['../outside'] }), /Outside project/);
    await assert.rejects(reader.read({ command: 'map', root, maxChars: 0 }), /maxChars/);
    await assert.rejects(reader.read({ command: 'outline', root, infer: true }), /Inference runs GHC/);
    await assert.rejects(reader.read({ command: 'outline', root, infer: true, trusted: true }), /select a file or module/);
  });
});

test('inference is an explicit trusted, targeted addition; default needs no compiler', async () => {
  const root = await fixture({ 'Infer.hs': 'module Infer where\nidentity x = x\nmessage = getLine\n' });
  await use(async reader => {
    const request: ReadRequest = { command: 'outline', root, file: 'Infer.hs' };
    const syntax = await reader.read({ ...request, ghcPath: 'nonexistent-compiler' });
    assert.match(syntax.text, /identity :: \?/); assert.match(syntax.text, /message :: \?/);
    const inferred = await reader.read({ ...request, infer: true, trusted: true, ghcPath: process.env.HASKELL_DESIGN_TEST_GHC ?? 'ghc', cacheDir: path.join(repo, '.test-output/reader-cache') });
    assert.equal(inferred.issueCount, 0, inferred.text);
    assert.match(inferred.text, /identity :: forall \{(\w+)\}\. \1 -> \1/); assert.match(inferred.text, /message :: IO String/);
    assert.doesNotMatch(inferred.text, /identity x =|message =/);
  });
});

test('CLI returns bounded JSON and useful error exit status without an editor', async () => {
  const root = await fixture({ 'Api.hs': source });
  const cli = path.join(repo, 'dist/read.cjs');
  const output = JSON.parse(execFileSync(process.execPath, [cli, 'show', '--root', root, '--symbol', 'run', '--json'], { encoding: 'utf8' }));
  assert.equal(output.matches, 1); assert.match(output.text, /run 0 = 123456/);
  assert.throws(() => execFileSync(process.execPath, [cli, 'map', '--root', root, '--max-chars', 'nonsense'], { encoding: 'utf8', stdio: 'pipe' }), /maxChars/);
});
