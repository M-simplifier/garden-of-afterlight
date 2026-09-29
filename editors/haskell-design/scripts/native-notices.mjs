import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Cabal installs the license files declared by each dependency. Boot libraries
// ship with GHC; their versioned upstream notices are retained in native/licenses.
export async function nativeNotices(root, cabal, plan) {
  const store = execFileSync(cabal, ['path', '--store-dir'], { encoding: 'utf8', windowsHide: true }).trim();
  const units = new Map(plan['install-plan'].map(unit => [unit.id, unit]));
  const needed = new Set();
  function visit(id) { if (needed.has(id)) return; needed.add(id); const unit = units.get(id); if (!unit) throw new Error(`Missing dependency ${id}`); for (const dep of unit.depends ?? []) visit(dep); }
  for (const unit of units.values()) if (unit['pkg-name'] === 'haskell-design') visit(unit.id);
  const parts = [];
  async function licenses(dir) {
    if (!existsSync(dir)) return [];
    const files = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await licenses(file));
      else if (/(license|copying|copyright|authors)/i.test(entry.name)) files.push(file);
    }
    return files;
  }
  const packages = [];
  for (const id of [...needed].sort()) {
    const unit = units.get(id), name = unit['pkg-name'], version = unit['pkg-version'];
    if (name === 'haskell-design') continue;
    const label = `${name}-${version}`;
    const local = path.join(root, 'native/licenses', label);
    const files = await licenses(unit.type === 'pre-existing' ? local : path.join(store, plan['compiler-id'], id, 'share/doc'));
    if (!files.length) throw new Error(`License files missing for ${label}. Add its upstream notices to native/licenses/${label} before distributing this build.`);
    packages.push(label);
    for (const file of files) parts.push(`## ${label} / ${path.basename(file)}\n\n${await readFile(file, 'utf8')}`);
  }
  parts.push(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'));
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await writeFile(path.join(root, 'dist/native-notices.txt'), `Haskell Design native executable — bundled dependency notices\nCompiler: ${plan['compiler-id']}\n\n${parts.join('\n\n')}`);
  return packages;
}
