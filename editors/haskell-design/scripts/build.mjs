import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import './build-native.mjs';

await mkdir('dist/tests', { recursive: true });
await mkdir('artifacts', { recursive: true });
const entries = { cli: 'src/cli.ts', core: 'src/projector.ts', extension: 'src/extension.ts', 'tests/core.test': 'tests/core.test.ts', 'tests/audit.test': 'tests/audit.test.ts', 'tests/extension.test': 'tests/extension.test.ts', 'tests/afterlight.test': 'tests/afterlight.test.ts' };
entries['tests/portable.test'] = 'tests/portable.test.ts';
entries.read = 'src/read-cli.ts';
entries['tests/reader.test'] = 'tests/reader.test.ts';
entries['tests/native.test'] = 'tests/native.test.ts';
await build({ entryPoints: Object.fromEntries(Object.entries(entries).filter(([,file]) => existsSync(file))), bundle: true, platform: 'node', format: 'cjs', target: 'node20', outdir: 'dist', outExtension: { '.js': '.cjs' }, external: ['vscode'], sourcemap: true });
// Remove old parser assets when updating an existing checkout.
for (const name of ['tree-sitter.wasm', 'tree-sitter-haskell.wasm']) await rm(`dist/${name}`, { force: true });
