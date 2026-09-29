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
  const platform = JSON.parse(await readFile('dist/native-platform.json', 'utf8'));
  if (platform.platform !== process.platform || platform.arch !== process.arch) throw new Error('Build the native reader on this host before packaging.');
  for (const item of ['cli.cjs', 'read.cjs', 'native-platform.json', 'native-notices.txt', process.platform === 'win32' ? 'haskell-design.exe' : 'haskell-design']) await cp(path.join('dist', item), path.join(output, 'dist', item));
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const archive = `artifacts/haskell-design-neovim-${version}-${platform.platform}-${platform.arch}.tar.gz`;
  execFileSync('tar', ['-czf', path.resolve(archive), '-C', temp, 'haskell-design'], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  console.log(archive);
} finally { await rm(temp, { recursive: true, force: true }); }
