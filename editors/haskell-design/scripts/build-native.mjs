import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp, copyFile, chmod, mkdtemp, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeNotices } from './native-notices.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const native = path.join(root, 'native');
const vendor = path.join(native, 'vendor');
const versions = { runtime: '0.25.10', grammar: '0.23.1', sha256: 'ad5040537537012b16ef6e1210a572b927c7cdc2b99d1ee88d44a7dcdc3ff44c' };
const marker = path.join(vendor, 'sources.json');
const grammar = path.join(root, 'node_modules/tree-sitter-haskell');
const packageInfo = JSON.parse(await readFile(path.join(grammar, 'package.json'), 'utf8'));
if (packageInfo.version !== versions.grammar) throw new Error('Run npm ci --ignore-scripts to restore the pinned Haskell grammar.');
if (!existsSync(marker) || await readFile(marker, 'utf8') !== JSON.stringify(versions)) {
  await mkdir(vendor, { recursive: true });
  const stage = await mkdtemp(path.join(vendor, 'prepare-'));
  try {
    const response = await fetch(`https://codeload.github.com/tree-sitter/tree-sitter/tar.gz/refs/tags/v${versions.runtime}`);
    if (!response.ok) throw new Error(`Tree-sitter download: ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(archive).digest('hex') !== versions.sha256) throw new Error('Tree-sitter archive checksum mismatch.');
    const tar = path.join(stage, 'runtime.tar.gz');
    await writeFile(tar, archive);
    execFileSync('tar', ['-xzf', tar, '-C', stage], { windowsHide: true });
    const source = path.join(stage, `tree-sitter-${versions.runtime}`);
    await mkdir(path.join(vendor, 'tree-sitter'), { recursive: true });
    for (const item of ['lib', 'LICENSE']) await cp(path.join(source, item), path.join(vendor, 'tree-sitter', item), { recursive: true });
    await mkdir(path.join(vendor, 'haskell'), { recursive: true });
    for (const item of ['src', 'LICENSE']) await cp(path.join(grammar, item), path.join(vendor, 'haskell', item), { recursive: true });
    await writeFile(marker, JSON.stringify(versions));
  } finally { await rm(stage, { recursive: true, force: true }); }
}
const ghc = process.env.HASKELL_DESIGN_GHC;
const compiler = ghc ? [`--with-compiler=${ghc}`] : [];
const cabal = process.env.HASKELL_DESIGN_CABAL ?? 'cabal';
execFileSync(cabal, ['build', 'exe:haskell-design', ...compiler], { cwd: native, stdio: 'inherit', windowsHide: true });
const plan = JSON.parse(await readFile(path.join(native, 'dist-newstyle/cache/plan.json'), 'utf8'));
const actualArch = { x86_64: 'x64', aarch64: 'arm64' }[plan.arch];
const actualOS = { windows: 'win32', linux: 'linux', osx: 'darwin' }[plan.os];
if (actualArch !== process.arch || actualOS !== process.platform) throw new Error('The selected native compiler targets a different OS/architecture from this extension host.');
const binary = execFileSync(cabal, ['list-bin', 'exe:haskell-design', ...compiler], { cwd: native, encoding: 'utf8', windowsHide: true }).trim();
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
const destination = path.join(dist, process.platform === 'win32' ? 'haskell-design.exe' : 'haskell-design');
const staged = destination + `.building-${process.pid}`;
try {
  await copyFile(binary, staged);
  await chmod(staged, 0o755);
  const libdir = execFileSync(ghc ?? 'ghc', ['--print-libdir'], { encoding: 'utf8', windowsHide: true }).trim();
  const strip = process.env.HASKELL_DESIGN_STRIP ?? (process.platform === 'win32' ? path.resolve(libdir, '../mingw/bin/llvm-strip.exe') : 'strip');
  execFileSync(strip, [staged], { windowsHide: true });
  const packages = await nativeNotices(root, cabal, plan);
  // Publish a complete executable; never overwrite a running Windows image.
  await rename(staged, destination);
  await writeFile(path.join(dist, 'native-platform.json'), JSON.stringify({ platform: process.platform, arch: process.arch, compiler: plan['compiler-id'], packages, ...versions }) + '\n');
} catch (error) {
  if (['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw new Error('Close editor/test processes using this checkout before rebuilding the native reader. The previous executable has been preserved.', { cause: error });
  throw error;
} finally { await rm(staged, { force: true }); }
console.log(`Native reader: ${destination}`);
