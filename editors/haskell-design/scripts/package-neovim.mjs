import { mkdir, mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

await mkdir('artifacts', { recursive: true });
const temp = await mkdtemp(path.resolve('artifacts/neovim-stage-'));
try {
  const output = path.join(temp, 'haskell-design');
  await mkdir(output);
  for (const item of ['lua', 'plugin', 'compiler', 'examples', 'docs', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) await cp(item, path.join(output, item), { recursive: true });
  await mkdir(path.join(output, 'dist'));
  for (const item of ['cli.cjs', 'tree-sitter.wasm', 'tree-sitter-haskell.wasm']) await cp(path.join('dist', item), path.join(output, 'dist', item));
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  execFileSync('tar', ['-czf', path.resolve(`artifacts/haskell-design-neovim-${version}.tar.gz`), '-C', temp, 'haskell-design'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  console.log(`artifacts/haskell-design-neovim-${version}.tar.gz`);
} finally { await rm(temp, { recursive: true, force: true }); }
