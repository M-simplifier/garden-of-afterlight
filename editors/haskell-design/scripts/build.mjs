import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

await mkdir('dist/tests', { recursive: true });
await mkdir('artifacts', { recursive: true });
const entries = { cli: 'src/cli.ts', core: 'src/projector.ts', extension: 'src/extension.ts', 'tests/core.test': 'tests/core.test.ts', 'tests/audit.test': 'tests/audit.test.ts', 'tests/extension.test': 'tests/extension.test.ts', 'tests/afterlight.test': 'tests/afterlight.test.ts' };
await build({ entryPoints: Object.fromEntries(Object.entries(entries).filter(([,file]) => existsSync(file))), bundle: true, platform: 'node', format: 'cjs', target: 'node20', outdir: 'dist', outExtension: { '.js': '.cjs' }, external: ['vscode'], alias: { 'web-tree-sitter': path.resolve('node_modules/web-tree-sitter/tree-sitter.cjs') }, sourcemap: true });
await copyFile('node_modules/web-tree-sitter/tree-sitter.wasm', 'dist/tree-sitter.wasm');
await copyFile('node_modules/tree-sitter-haskell/tree-sitter-haskell.wasm', 'dist/tree-sitter-haskell.wasm');
