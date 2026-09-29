// Compare an already-built 0.5.0 distribution with the current native build.
// Run while no build/editor test is competing for CPU. Never build either tool
// inside the timed region. Fail rather than time materially different outputs.
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import path from 'node:path';

const tool = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {}, includes = [];
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (!['--baseline', '--root', '--include', '--output'].includes(key) || !value) throw new Error('Usage: --baseline PATH/TO/OLD/dist --root PROJECT --include DIR (repeatable) [--output FILE]');
  if (key === '--include') includes.push(value); else options[key.slice(2)] = value;
}
if (!options.baseline || !options.root || !includes.length) throw new Error('Specify baseline, root and explicit include directories for identical source scope.');
const root = path.resolve(options.root), baseline = path.resolve(options.baseline);
const binary = path.join(tool, 'dist', process.platform === 'win32' ? 'haskell-design.exe' : 'haskell-design');
const common = ['--root', root, ...includes.flatMap(dir => ['--include', dir]), '--max-chars', '2000000', '--json'];
const commands = { map: ['map'], outline: ['outline'], show: ['show', '--module', 'Garden.Change', '--symbol', 'apply'] };
const summarize = values => { const sorted = [...values].sort((a,b) => a-b); return { medianMs: (sorted[4] + sorted[5]) / 2, minimumMs: sorted[0], maximumMs: sorted.at(-1), samplesMs: values }; };
const normalize = page => { const result = { ...page }; delete result.snapshot; result.text = page.text.replace(/snapshot [a-f0-9]+/, 'snapshot NORMALIZED'); return result; };
const cold = {}; let map;
for (const [name, command] of Object.entries(commands)) {
  const samples = { node: [], native: [] }; let old, current;
  for (let trial = 0; trial < 12; trial++) for (const kind of trial % 2 ? ['native', 'node'] : ['node', 'native']) {
    const start = performance.now();
    const raw = execFileSync(kind === 'native' ? binary : process.execPath, [...(kind === 'native' ? [] : [path.join(baseline, 'read.cjs')]), ...command, ...common], { encoding: 'utf8', maxBuffer: 8_000_000, windowsHide: true });
    const elapsed = performance.now() - start;
    const page = JSON.parse(raw);
    assert.equal(page.next, undefined, 'Benchmark scope must fit one complete page.');
    if (kind === 'native') current = page; else old = page;
    if (trial >= 2) samples[kind].push(elapsed);
  }
  assert.deepEqual(normalize(current), normalize(old), `${name} output differs`);
  if (name === 'show') assert.equal(current.matches, 1, 'The selected real implementation must exist.');
  if (name === 'map') map = current;
  cold[name] = Object.fromEntries(Object.entries(samples).map(([kind, values]) => [kind, summarize(values)]));
}
const names = [...map.text.matchAll(/^(.+) -> .+ \(\d+ declarations;/gm)].map(m => m[1]);
assert.equal(names.length, map.coverage.files);
const sources = await Promise.all(names.map(async file => ({ file: path.join(root, file), source: await readFile(path.join(root, file), 'utf8') })));
const require = createRequire(import.meta.url);
const old = new (require(path.join(baseline, 'core.cjs')).Projector)(baseline);
const current = new (require(path.join(tool, 'dist/core.cjs')).Projector)(path.join(tool, 'dist'));
const warm = { node: [], native: [] };
try {
  for (const { file, source } of sources) assert.deepEqual(await current.project(source, file), JSON.parse(JSON.stringify(await old.project(source, file))));
  for (let trial = 0; trial < 12; trial++) for (const kind of trial % 2 ? ['native', 'node'] : ['node', 'native']) {
    const projector = kind === 'native' ? current : old;
    const start = performance.now();
    for (const { file, source } of sources) await projector.project(source, file);
    const elapsed = performance.now() - start;
    if (trial >= 2) warm[kind].push(elapsed);
  }
} finally { old.dispose(); current.dispose(); }
const report = { platform: `${process.platform}-${process.arch}`, cpu: cpus()[0]?.model, node: process.version,
  native: JSON.parse(await readFile(path.join(tool, 'dist/native-platform.json'), 'utf8')).compiler,
  coverage: map.coverage, issueFiles: map.issueCount,
  sourceSha256: createHash('sha256').update(sources.map(s => s.source).join('\n')).digest('hex'),
  cold, warm: Object.fromEntries(Object.entries(warm).map(([kind, values]) => [kind, summarize(values)])),
  method: 'Two discarded passes, ten measured passes in alternating order. Cold: process launch through complete JSON output. Warm: 31-file Projector pass; native includes JSON IPC. No GHC inference; filesystem cache is warm. Outputs equal after normalizing only snapshot IDs.' };
if (options.output) await writeFile(options.output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
