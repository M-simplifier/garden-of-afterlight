import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Projector, hash, compareDesigns } from '../src/projector';
import { verify } from '../src/compiler';
import { execute, designDiff, relatedTests, findDeclaration, fingerprint, listHaskellFiles } from '../src/workspace';
import { projectCompilerOptions } from '../src/projectConfig';

const root = path.resolve(__dirname, '../..');
const projector = new Projector(path.join(root, 'dist'));
let fixture: string;
before(async () => { await fs.mkdir(path.join(root, '.test-output'), { recursive: true }); fixture = await fs.mkdtemp(path.join(root, '.test-output/core-')); });
after(() => projector.dispose());
const project = (source: string) => projector.project(source, '/example/Example.hs');

test('declarations retain records, docs and private signatures while hiding all function clauses', async () => {
  const model = await project(`module Example (T(..), choose) where
-- | 状態の説明
data T = T { name :: String, value :: Int } deriving Show
type Label = String
choose :: Int -> Int
choose 0 = 12
choose n | n > 0 = n
         | otherwise = -n
private x = let detail = x + 2 in detail
`);
  assert.match(model.text, /name :: String/);
  assert.match(model.text, /状態の説明/);
  assert.match(model.text, /choose :: Int -> Int/);
  assert.doesNotMatch(model.text, /choose 0|n > 0|detail =/);
  assert.match(model.text, /private :: \?/);
  assert.equal(model.declarations.filter(d => d.names.includes('choose')).length, 1);
  assert.match(model.declarations.find(d => d.names.includes('choose'))!.implementation, /otherwise/);
  assert.equal(model.status, 'unknown');
});
test('class and instance methods are hidden; associated types remain visible', async () => {
  const m = await project(`{-# LANGUAGE TypeFamilies #-}
module Example where
class C a where
  -- | 意味
  method :: a -> Int
  method _ = 42
  type Associated a
instance C Int where
  method x = x + 1
  type Associated Int = Bool
`);
  assert.match(m.text, /method :: a -> Int/);
  assert.match(m.text, /type Associated Int = Bool/);
  assert.doesNotMatch(m.text, /method _ =|x \+ 1/);
});
test('comments and strings containing IO or unsafe names do not create evidence', async () => {
  const m = await project('module Example where\n-- IO unsafePerformIO\ntext :: String\ntext = "IO unsafePerformIO"\n');
  assert.equal(m.status, 'unknown'); assert.equal(m.evidence.length, 0);
});
test('explicit IO, MonadIO and qualified unsafe operations have evidence', async () => {
  const io = await project('module Example where\naction :: MonadIO m => m ()\naction = pure ()\n');
  assert.equal(io.status, 'io'); assert.equal(io.evidence[0]?.line, 2);
  const unsafe = await project('module Example where\nx = System.IO.Unsafe.unsafePerformIO (pure 1)\n');
  assert.equal(unsafe.status, 'io');
});
test('unused IO imports do not count as IO use', async () => {
  const m = await project('module Example where\nimport Control.Monad.IO.Class (MonadIO)\nimport System.IO.Unsafe (unsafePerformIO)\nvalue :: Int\nvalue = 1\n');
  assert.deepEqual(m.evidence, []);
});
test('syntax errors have no type result and stale GHC results are ignored', async () => {
  const text = 'module Example where\ndata Broken =\n';
  const proof = { sourceHash: hash(text), status: 'pure' as const, signatures: [], evidence: [] };
  const broken = await projector.project(text, 'Example.hs');
  assert.equal(broken.status, 'unknown'); assert.ok(broken.issues.length);
  const stale = await projector.project('module Example where\nf x = x\n', 'Example.hs', proof);
  assert.equal(stale.status, 'unknown'); assert.equal(stale.verified, false);
});
test('GADTs and type-family equations survive projection', async () => {
  const m = await project(`{-# LANGUAGE GADTs, TypeFamilies #-}
module Example where
data Expr a where
  Number :: Int -> Expr Int
  Equal :: Expr Int -> Expr Int -> Expr Bool
type family Result a where
  Result Int = Bool
`);
  assert.match(m.text, /Number :: Int -> Expr Int/); assert.match(m.text, /Result Int = Bool/);
  assert.equal(m.issues.length, 0);
});
test('pattern synonym signatures remain visible and participate in design diffs', async () => {
  const original = '{-# LANGUAGE PatternSynonyms #-}\nmodule Example where\npattern A, B :: Int\npattern A = 1\npattern B = 2\n';
  const before = await project(original);
  assert.match(before.text, /pattern A, B :: Int/);
  assert.doesNotMatch(before.text, /pattern A =|pattern B =|pattern pattern/);
  const declaration = before.declarations.find(d => d.names.includes('A'))!;
  assert.deepEqual(declaration.names, ['A', 'B']);
  assert.match(declaration.implementation, /pattern A = 1\npattern B = 2/);
  assert.ok(compareDesigns(before, await project(original.replace(':: Int', ':: Bool'))).changed);
  assert.equal(compareDesigns(before, await project(original.replace('A = 1', 'A = 3'))).changed, false);
  const unsigned = await project('{-# LANGUAGE PatternSynonyms #-}\nmodule Example where\npattern x :++: y = (x, y)\n');
  assert.match(unsigned.text, /pattern :\+\+: :: \?/);
  assert.deepEqual(compareDesigns(unsigned, unsigned).unresolved, [':++:']);
});
test('implementation-only changes produce no declaration diff but remain reported', async () => {
  const before = await project('module Example where\nf :: Int -> Int\nf n = n + 1\n');
  const after = await project('module Example where\nf :: Int -> Int\nf n = n + 2\n');
  assert.deepEqual(compareDesigns(before, after), { changed: false, implementationChanged: true, unresolved: [] });
  const addedIO = await project('module Example where\nf :: Int -> IO Int\nf n = pure n\n');
  assert.ok(compareDesigns(before, addedIO).changed);
});
test('Git diff uses HEAD and the unsaved buffer, and treats new files as additions', async () => {
  const cwd = path.join(fixture, 'git space'); await fs.mkdir(cwd);
  const git = (args: string[]) => execute('git', args, { cwd });
  await git(['init', '-q']);
  const file = path.join(cwd, 'Example.hs');
  const original = 'module Example where\nf :: Int -> Int\nf n = n + 1\n';
  await fs.writeFile(file, original);
  await git(['add', 'Example.hs']);
  await git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'baseline']);
  const diff = await designDiff(projector, file, original.replace('Int -> Int', 'Int -> IO Int').replace('n + 1', 'pure n'));
  assert.match(diff.before.text, /Int -> Int/); assert.match(diff.after.text, /Int -> IO Int/);
  assert.ok(diff.changed);
  const fresh = await designDiff(projector, path.join(cwd, 'New.hs'), 'module New where\nx = True\n');
  assert.equal(fresh.baseline, '新規ファイル'); assert.equal(fresh.before.declarations.length, 0); assert.deepEqual(fresh.unresolved, ['x']);
});
test('definition and test lookup returns source locations', async () => {
  const examples = path.join(root, 'examples');
  const target = await findDeclaration(projector, examples, 'Order');
  assert.ok(target); assert.ok(target.file.endsWith(path.join('Domain', 'Order.hs'))); assert.equal(target.line, 10);
  const tests = await relatedTests(examples, ['confirm']);
  assert.ok(tests.some(t => t.file.endsWith('OrderSpec.hs')));
});
test('offline definition lookup follows project scope and never chooses an ambiguous type', async () => {
  const game = await fs.mkdtemp(path.join(root, '.test-output/definition-'));
  await fs.mkdir(path.join(game, 'src'));
  await fs.mkdir(path.join(game, 'aaa-example'));
  await fs.writeFile(path.join(game, '.haskell-design.json'), JSON.stringify({ version: 1, audit: { include: ['src'] } }));
  await fs.writeFile(path.join(game, 'aaa-example/Types.hs'), 'module Example.Types where\ndata World = Example\n');
  await fs.writeFile(path.join(game, 'src/Types.hs'), 'module Game.Types where\ndata World = Game\n');
  assert.equal((await findDeclaration(projector, game, 'World'))?.file, path.join(game, 'src/Types.hs'));
  await fs.writeFile(path.join(game, 'src/Other.hs'), 'module Game.Other where\ndata World = Other\n');
  assert.equal(await findDeclaration(projector, game, 'World'), undefined);
  const source = await projector.project('module Current where\ndata World = Unsaved\n', path.join(game, 'src/Current.hs'));
  assert.equal((await findDeclaration(projector, game, 'World', source))?.file, source.file);
});

async function checked(name: string, source: string) {
  const file = path.join(fixture, name + '.hs'); await fs.writeFile(file, source);
  const proof = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: fixture, cacheDir: path.join(root, '.test-output/cache') });
  return { proof, model: await projector.project(source, file, proof) };
}
test('GHC finds no IO in a pure module and provides inferred signatures', async () => {
  const { proof, model } = await checked('Pure', 'module Pure where\ndata Choice = A | B deriving Eq\nchoose n = n == (1 :: Int)\n');
  assert.equal(proof.error, undefined); assert.equal(proof.status, 'pure'); assert.equal(model.status, 'pure');
  assert.match(model.text, /choose :: Int -> Bool/); assert.ok(proof.workspaceHash);
});
test('Safe source can use a Trustworthy boundary without forcing it to Safe', async () => {
  await fs.writeFile(path.join(fixture, 'TrustedBridge.hs'), '{-# LANGUAGE Trustworthy #-}\nmodule TrustedBridge (value) where\nvalue :: Int\nvalue = 1\n');
  const checkedSource = await checked('SafeClient', '{-# LANGUAGE Safe #-}\nmodule SafeClient where\nimport TrustedBridge\nanswer :: Int\nanswer = value + 1\n');
  assert.equal(checkedSource.proof.error, undefined); assert.equal(checkedSource.model.status, 'pure');
  const bridge = await checked('TrustedBridge', '{-# LANGUAGE Trustworthy #-}\nmodule TrustedBridge (value) where\nvalue :: Int\nvalue = 1\n');
  assert.equal(bridge.proof.error, undefined); assert.equal(bridge.model.status, 'pure');
  assert.deepEqual(bridge.model.issues, []);
});
test('pure library builders keep their representation abstract while public IO remains visible', async () => {
  const builder = await checked('BuilderClient', '{-# LANGUAGE Safe #-}\nmodule BuilderClient where\nimport Data.ByteString.Builder\nrender :: Int -> Builder\nrender = intDec\n');
  assert.equal(builder.proof.error, undefined); assert.equal(builder.model.status, 'pure');
  const io = await checked('BuilderWriter', 'module BuilderWriter where\nimport Data.ByteString.Builder\nimport System.IO\nwrite :: Handle -> Builder -> IO ()\nwrite = hPutBuilder\n');
  assert.equal(io.proof.error, undefined); assert.equal(io.model.status, 'io');
});
test('external effect class constraints remain visible through aliases', async () => {
  await fs.writeFile(path.join(fixture, 'EffectAlias.hs'), '{-# LANGUAGE ConstraintKinds #-}\nmodule EffectAlias where\nimport Control.Monad.IO.Class (MonadIO)\ntype HasEffects m = MonadIO m\n');
  const client = await checked('EffectClient', '{-# LANGUAGE ConstraintKinds #-}\nmodule EffectClient where\nimport Data.Proxy\nimport EffectAlias\nvalue :: HasEffects m => Proxy m -> Int\nvalue _ = 1\n');
  assert.equal(client.proof.error, undefined); assert.equal(client.model.status, 'io');
  assert.ok(client.proof.evidence.some(e => e.name === 'value' && e.status === 'io'));
});
test('generated instance methods retain IO in Core type applications', async () => {
  await fs.writeFile(path.join(fixture, 'InstanceAlias.hs'), 'module InstanceAlias where\ntype Action = IO ()\n');
  const client = await checked('InstanceClient', 'module InstanceClient where\nimport InstanceAlias\ndata T = T\ninstance Eq T where\n  _ == _ = const True (undefined :: Action)\n');
  assert.equal(client.proof.error, undefined); assert.equal(client.model.status, 'io');
  const defaults = await checked('SourceDefault', 'module SourceDefault where\nimport InstanceAlias\nclass C a where\n  method :: a -> Bool\n  method _ = const True (undefined :: Action)\ndata T = T\ninstance C T\n');
  assert.equal(defaults.proof.error, undefined); assert.equal(defaults.model.status, 'io');
});
test('GHC-generated Generic methods reduce their concrete representation family', async () => {
  const derived = await checked('Derived', '{-# LANGUAGE DeriveGeneric #-}\nmodule Derived where\nimport GHC.Generics (Generic)\ndata Choice = A | B deriving (Eq, Generic)\n');
  assert.equal(derived.proof.error, undefined); assert.equal(derived.model.status, 'pure');
});
test('Safe Haskell policy does not affect IO navigation hints', async () => {
  await fs.writeFile(path.join(fixture, 'UnsafeDependency.hs'), '{-# LANGUAGE Unsafe #-}\nmodule UnsafeDependency where\nvalue :: Int\nvalue = 1\n');
  const client = await checked('UnsafeClient', 'module UnsafeClient where\nimport UnsafeDependency\nanswer :: Int\nanswer = value\n');
  assert.equal(client.proof.error, undefined); assert.equal(client.model.status, 'pure');
  const disabled = await checked('NoInference', '{-# OPTIONS_GHC -fno-safe-infer #-}\nmodule NoInference where\nvalue :: Int\nvalue = 1\n');
  assert.equal(disabled.model.status, 'pure');
});
test('Template Haskell and ANN evaluation are rejected before loading code', async () => {
  const th = await checked('Splices', '{-# LANGUAGE TemplateHaskell #-}\nmodule Splices where\nvalue :: Int\nvalue = 1\n');
  assert.match(th.proof.error!, /Template Haskell/); assert.equal(th.proof.workspaceHash, undefined);
  const annotation = await checked('Annotated', 'module Annotated where\n{-# ANN module (1 :: Int) #-}\nvalue :: Int\nvalue = 1\n');
  assert.match(annotation.proof.error!, /ANN/); assert.equal(annotation.proof.workspaceHash, undefined);
});
test('GHC detects IO hidden behind an imported alias and in constructor fields', async () => {
  await fs.writeFile(path.join(fixture, 'Alias.hs'), 'module Alias where\nimport Control.Monad.Trans.Reader\ntype App = ReaderT () IO\n');
  for (const [name, body] of [['Use', 'work :: App ()\nwork = pure ()'], ['Holder', 'data Box = Box (App ())'], ['AliasOnly', 'type Hidden = App ()']] as const) {
    const { proof, model } = await checked(name, `module ${name} where\nimport Alias\n${body}\n`);
    assert.equal(proof.error, undefined, proof.error); assert.equal(proof.status, 'io', name); assert.equal(model.status, 'io');
  }
});
test('GHC follows IO in closed, open, and associated type-family equations', async () => {
  await fs.writeFile(path.join(fixture, 'FamilyAlias.hs'), 'module FamilyAlias where\ntype App = IO ()\n');
  for (const [name, body] of [
    ['ClosedFamily', 'type family Action a where\n  Action Int = App'],
    ['OpenFamily', 'type family Action a\ntype instance Action Int = App'],
    ['AssociatedFamily', 'class C a where\n  type Action a\n  type Action a = App'],
    ['AssociatedInstance', 'class C a where\n  type Action a\ninstance C Int where\n  type Action Int = App']
  ] as const) {
    const { proof } = await checked(name, `{-# LANGUAGE TypeFamilies #-}\nmodule ${name} where\nimport FamilyAlias\n${body}\n`);
    assert.equal(proof.error, undefined, proof.error); assert.equal(proof.status, 'io', name);
    assert.ok(proof.evidence.some(e => e.name === 'Action' && e.status === 'io'), name);
  }
  const unresolved = await checked('OpenUnresolved', '{-# LANGUAGE TypeFamilies #-}\nmodule OpenUnresolved where\ntype family Action a\n');
  assert.equal(unresolved.proof.error, undefined); assert.equal(unresolved.proof.status, 'pure');
  const closedPure = await checked('ClosedPure', '{-# LANGUAGE TypeFamilies #-}\nmodule ClosedPure where\ntype family Result a where\n  Result Int = Bool\n');
  assert.equal(closedPure.proof.error, undefined); assert.equal(closedPure.proof.status, 'pure');
  await fs.writeFile(path.join(fixture, 'ErasingFamily.hs'), '{-# LANGUAGE TypeFamilies #-}\nmodule ErasingFamily where\ntype family Erase a where\n  Erase a = Int\n');
  const erased = await checked('ErasedEffect', '{-# LANGUAGE TypeFamilies #-}\nmodule ErasedEffect where\nimport FamilyAlias\nimport ErasingFamily\nanswer :: Erase App\nanswer = 1\n');
  assert.equal(erased.proof.error, undefined); assert.equal(erased.model.status, 'io');
});
test('CPP in transitive source dependencies never creates a reusable purity proof', async () => {
  const header = path.join(fixture, 'body.h');
  await fs.writeFile(header, 'hidden :: Int\nhidden = 1\n');
  await fs.writeFile(path.join(fixture, 'Preprocessed.hs'), '{-# LANGUAGE CPP #-}\nmodule Preprocessed where\n#include "body.h"\n');
  const source = 'module UsesPreprocessed where\nimport Preprocessed\nvalue = hidden\n';
  const before = await checked('UsesPreprocessed', source);
  assert.equal(before.model.status, 'unknown'); assert.equal(before.model.verified, false);
  assert.match(before.proof.error!, /CPP/); assert.equal(before.proof.workspaceHash, undefined);
  assert.deepEqual(before.proof.signatures, []);
  await fs.writeFile(header, 'hidden :: IO Int\nhidden = pure 1\n');
  const after = await checked('UsesPreprocessed', source);
  assert.equal(after.model.status, 'unknown'); assert.equal(after.model.verified, false);
  assert.match(after.proof.error!, /CPP/); assert.deepEqual(after.proof.signatures, []);
});
test('both compiler plugin loading paths are rejected before generating reusable proof', async () => {
  const file = path.join(fixture, 'PluginTarget.hs');
  const source = 'module PluginTarget where\nvalue = (1 :: Int)\n';
  await fs.writeFile(file, source);
  for (const plugin of ['-fplugin=UnusedPlugin', `-fplugin-library=${path.join(fixture, 'unused.dylib')};main;UnusedPlugin;[]`]) {
    const proof = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: fixture, cacheDir: path.join(root, '.test-output/cache'), ghcOptions: [plugin, '-fplugin-trustworthy'] });
    assert.equal(proof.status, 'unknown'); assert.match(proof.error!, /入力の変更を追跡できない/);
    assert.equal(proof.workspaceHash, undefined); assert.deepEqual(proof.signatures, []);
  }
  const pragma = await checked('PluginPragma', '{-# OPTIONS_GHC -fplugin=UnusedPlugin -fplugin-trustworthy #-}\nmodule PluginPragma where\nvalue = (1 :: Int)\n');
  assert.equal(pragma.proof.status, 'unknown'); assert.match(pragma.proof.error!, /入力の変更を追跡できない/);
});
test('GHC detects inferred IO in private and dead local bindings', async () => {
  for (const [name, body] of [
    ['Private', 'public :: Int -> Int\npublic = id\nsecret = putStrLn "hidden"'],
    ['Local', 'public :: Int -> Int\npublic n = let unused = print n in n']
  ] as const) {
    const { proof } = await checked(name, `module ${name} (public) where\n${body}\n`);
    assert.equal(proof.error, undefined); assert.equal(proof.status, 'io', name);
  }
});
test('abstract effects add no IO evidence, direct unsafe IO does, and failed analysis stays unavailable', async () => {
  const poly = await checked('Poly', 'module Poly where\nrun :: Monad m => m a -> m a\nrun = id\n');
  assert.equal(poly.proof.status, 'pure');
  const unsafe = await checked('UnsafeCode', 'module UnsafeCode where\nimport System.IO.Unsafe\nx :: Int\nx = unsafePerformIO (pure 1)\n');
  assert.equal(unsafe.model.status, 'io'); assert.notEqual(unsafe.proof.status, 'pure');
  const invalid = await checked('Invalid', 'module Invalid where\nx :: Int\nx = True\n');
  assert.equal(invalid.model.status, 'unknown'); assert.ok(invalid.proof.error);
});
test('Foldable data and abstract effects are Pure until concrete IO is used', async () => {
  const fold = await checked('FoldableData', 'module FoldableData where\ncollect :: Foldable f => f Int -> [Int]\ncollect = foldr (:) []\n');
  assert.equal(fold.proof.error, undefined); assert.equal(fold.model.status, 'pure');
  assert.deepEqual(fold.model.issues, []);
  const caller = await checked('ConcreteCaller', 'module ConcreteCaller where\nimport Poly\nreadName = run getLine\n');
  assert.equal(caller.proof.error, undefined); assert.equal(caller.model.status, 'io');
  assert.match(caller.model.text, /readName :: IO String/);
});
test('unsafe is not a separate effect and dependency implementations are not audited', async () => {
  const coerce = await checked('CastValue', 'module CastValue where\nimport Unsafe.Coerce\ncastValue :: a -> b\ncastValue = unsafeCoerce\n');
  assert.equal(coerce.proof.error, undefined); assert.equal(coerce.model.status, 'pure');
  const client = await checked('HiddenUnsafeClient', 'module HiddenUnsafeClient where\nimport UnsafeCode\nvalue :: Int\nvalue = x\n');
  assert.equal(client.proof.error, undefined); assert.equal(client.model.status, 'pure');
  const unused = await checked('UnusedImports', 'module UnusedImports where\nimport Control.Monad.IO.Class (MonadIO)\nimport System.IO.Unsafe (unsafePerformIO)\nvalue :: Int\nvalue = 1\n');
  assert.equal(unused.proof.error, undefined); assert.equal(unused.model.status, 'pure');
  assert.deepEqual(unused.model.evidence, []);
});
test('GHC types take precedence over spelling-based IO hints', async () => {
  const custom = await checked('CustomIO', '{-# LANGUAGE NoImplicitPrelude #-}\nmodule CustomIO where\ndata IO = LocalValue\nvalue :: IO\nvalue = LocalValue\n');
  assert.equal(custom.proof.error, undefined); assert.equal(custom.model.status, 'pure');
  assert.deepEqual(custom.model.evidence, []);
});
test('unsaved source is rejected by the compiler and missing compiler remains unknown', async () => {
  const file = path.join(fixture, 'Unsaved.hs'); await fs.writeFile(file, 'module Unsaved where\nx = True\n');
  const result = await verify(file, 'module Unsaved where\nx = False\n', path.join(root, 'compiler/Main.hs'), { root: fixture });
  assert.equal(result.status, 'unknown'); assert.match(result.error!, /未保存/);
  const source = await fs.readFile(file, 'utf8');
  const missing = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: fixture, ghcPath: '/no/such/ghc' });
  assert.equal(missing.status, 'unknown'); assert.ok(missing.error);
});
test('deferred errors do not qualify for a pure badge', async () => {
  const result = await checked('Deferred', '{-# OPTIONS_GHC -fdefer-type-errors #-}\nmodule Deferred where\nx :: Int\nx = True\n');
  assert.notEqual(result.model.status, 'pure');
});

test('folder status requires complete nonempty evidence for Pure and propagates IO', async () => {
  const { buildFileTree, summarize, indexTree, summaryLabel } = await import('../src/fileTree');
  assert.equal(summarize([]).status, 'unknown');
  assert.equal(summarize(['pure']).status, 'pure');
  assert.equal(summarize(['pure', 'unknown']).status, 'unknown');
  assert.equal(summarize(['pure'], false).status, 'unknown');
  assert.equal(summarize(['unknown', 'pure', 'io'], false).status, 'io');
  const files = [
    { file: '/work/Domain/Order.hs', status: 'pure' as const },
    { file: '/work/Application/Infrastructure/Db.hs', status: 'io' as const },
    { file: '/work/Application/Use.hs', status: 'unknown' as const },
    { file: '/elsewhere/Other.hs', status: 'io' as const },
  ];
  const tree = buildFileTree('/work', files);
  const index = indexTree(tree);
  assert.equal(index.get(path.resolve('/work/Domain'))?.summary.status, 'pure');
  assert.equal(index.get(path.resolve('/work/Application/Infrastructure'))?.summary.status, 'io');
  assert.equal(index.get(path.resolve('/work/Application'))?.summary.status, 'io');
  assert.equal(tree.summary.status, 'io');
  assert.equal(tree.summary.total, 3);
  assert.equal(summaryLabel(tree.summary), 'IO 1 · 未解析 1 · Pure 1');
  assert.deepEqual(tree, buildFileTree('/work', [...files].reverse()));
  const truncated = indexTree(buildFileTree('/work', files, true));
  assert.equal(truncated.get(path.resolve('/work/Domain'))?.summary.status, 'unknown');
  assert.equal(truncated.get(path.resolve('/work/Application'))?.summary.status, 'io');
  assert.match(summaryLabel(truncated.get(path.resolve('/work/Domain'))!.summary), /走査途中/);
});

test('CLI tree uses unsaved source and keeps failed files unknown without hiding siblings', async () => {
  const workspace = path.join(fixture, 'tree');
  await fs.mkdir(workspace);
  const file = path.join(workspace, 'Example.hs');
  await fs.writeFile(file, 'module Example where\nx = True\n');
  await fs.writeFile(path.join(workspace, 'Large.hs'), '-- ' + 'x'.repeat(2_000_001));
  const result = JSON.parse(execFileSync(process.execPath, [path.join(root, 'dist/cli.cjs')], {
    input: JSON.stringify({ command: 'files', root: workspace, sources: { [file.split(path.sep).join('/')]: 'module Example where\nx :: IO ()\nx = pure ()\n' } }), encoding: 'utf8',
  }));
  assert.equal(result.files.length, 2);
  assert.equal(result.tree.summary.status, 'io');
  assert.deepEqual(result.tree.summary.counts, { pure: 0, io: 1, unknown: 1 });
  assert.equal(result.tree.children.find((f: { name: string }) => f.name === 'Large.hs').summary.status, 'unknown');
});

test('an unsaved dependency invalidates disk proofs for every folder in the CLI tree', async () => {
  const workspace = path.join(fixture, 'tree-proof');
  await fs.mkdir(path.join(workspace, 'Domain'), { recursive: true });
  const dependency = path.join(workspace, 'Alias.hs');
  const file = path.join(workspace, 'Domain', 'Use.hs');
  await fs.writeFile(dependency, 'module Alias where\ntype Effect = Maybe\n');
  const source = 'module Domain.Use where\nimport Alias\nvalue :: Effect Int\nvalue = Just 1\n';
  await fs.writeFile(file, source);
  const proof = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: workspace, cacheDir: path.join(root, '.test-output/cache') });
  assert.equal(proof.status, 'pure', proof.error);
  const call = (sources: Record<string, string>) => JSON.parse(execFileSync(process.execPath, [path.join(root, 'dist/cli.cjs')], {
    input: JSON.stringify({ command: 'files', root: workspace, verifications: { [file]: proof }, sources }), encoding: 'utf8',
  }));
  const domain = (result: any) => result.tree.children.find((node: any) => node.name === 'Domain');
  assert.equal(domain(call({})).summary.status, 'pure');
  const changed = call({ [dependency]: 'module Alias where\ntype Effect = IO\n' });
  assert.equal(domain(changed).summary.status, 'unknown');
  assert.equal(changed.tree.summary.status, 'io');
});

test('shared project configuration selects components and expires proofs after settings change', async () => {
  const cwd = path.join(fixture, 'configured');
  await fs.mkdir(path.join(cwd, 'core/src'), { recursive: true });
  await fs.mkdir(path.join(cwd, 'server'), { recursive: true });
  const file = path.join(cwd, 'core/src/Configured.hs');
  const source = 'module Configured where\nimport Data.Text (Text)\nvalue :: Text\nvalue = "configured"\n';
  await fs.writeFile(file, source);
  const config = { version: 1, ghcOptions: ['-XOverloadedStrings'], components: [
    { path: 'core', ghcOptions: ['-icore/src'] },
    { path: 'server', ghcOptions: ['-iserver/src'] },
    { path: 'ui', unsupportedReason: 'WASM component' }
  ] };
  const settings = path.join(cwd, '.haskell-design.json');
  await fs.writeFile(settings, JSON.stringify(config));
  assert.deepEqual((await projectCompilerOptions(cwd, file)).ghcOptions, ['-XOverloadedStrings', '-icore/src']);
  await assert.rejects(projectCompilerOptions(cwd, path.join(cwd, 'ui/Main.hs')), /WASM component/);
  await assert.rejects(projectCompilerOptions(cwd, path.join(cwd, 'core-other/Main.hs')), /対応する解析設定/);
  const proof = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: cwd });
  assert.equal(proof.error, undefined); assert.equal(proof.status, 'pure'); assert.ok(proof.dependencies?.includes(settings));
  await fs.writeFile(settings, JSON.stringify({ ...config, ghcOptions: [] }));
  assert.notEqual(await fingerprint(cwd), proof.workspaceHash);
  const failed = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: cwd });
  assert.equal(failed.status, 'unknown'); assert.ok(failed.error);
  await fs.writeFile(settings, JSON.stringify({ ...config, components: [{ path: '../outside', ghcOptions: [] }] }));
  await assert.rejects(projectCompilerOptions(cwd, file), /version/);
  await fs.writeFile(settings, '{invalid');
  await assert.rejects(projectCompilerOptions(cwd, file), /version/);
});

test('WASM build outputs are excluded and Cabal configuration changes invalidate proofs', async () => {
  const cwd = path.join(fixture, 'workspace-inputs');
  for (const dir of ['core', 'dist-wasm-release/src/miso', 'dist-domain']) await fs.mkdir(path.join(cwd, dir), { recursive: true });
  await fs.writeFile(path.join(cwd, 'core/Pure.hs'), 'module Pure where\nx = True\n');
  await fs.writeFile(path.join(cwd, 'dist-wasm-release/src/miso/Generated.hs'), 'module Generated where\nx = print 1\n');
  await fs.writeFile(path.join(cwd, 'dist-domain/Real.hs'), 'module Real where\nx = print 1\n');
  assert.deepEqual((await listHaskellFiles(cwd)).files.map(f => path.relative(cwd, f).split(path.sep).join('/')), ['core/Pure.hs', 'dist-domain/Real.hs']);
  const before = await fingerprint(cwd);
  await fs.writeFile(path.join(cwd, 'cabal.project.freeze'), 'constraints: base ==4.18.3.0\n');
  assert.notEqual(await fingerprint(cwd), before);
});

test('linked compiler settings cannot issue or preserve a purity proof', async t => {
  const cwd = path.join(fixture, 'linked-settings');
  await fs.mkdir(cwd);
  const file = path.join(cwd, 'Pure.hs');
  const source = 'module Pure where\nvalue :: Int\nvalue = 1\n';
  await fs.writeFile(file, source);
  await fs.writeFile(path.join(cwd, 'settings.json'), '{"version":1,"ghcOptions":[]}');
  try {
    const original = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: cwd });
    assert.equal(original.status, 'pure');
    for (const name of ['.haskell-design.json', 'cabal.project']) {
      const link = path.join(cwd, name);
      try { await fs.symlink('settings.json', link); } catch (error) {
        if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('Windows account cannot create file symlinks'); return; }
        throw error;
      }
      await assert.rejects(fingerprint(cwd), /シンボリックリンク/);
      const proof = await verify(file, source, path.join(root, 'compiler/Main.hs'), { root: cwd });
      assert.equal(proof.status, 'unknown'); assert.equal(proof.workspaceHash, undefined);
      assert.match(proof.error!, /シンボリックリンク/);
      await fs.unlink(link);
    }
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
});
