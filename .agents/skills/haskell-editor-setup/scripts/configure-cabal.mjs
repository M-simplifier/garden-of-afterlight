#!/usr/bin/env node
// Project wiring only. Build the project's actual Cabal targets before running this.
import { access, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--apply') options.apply = true;
  else if (args[i] === '--keep-existing') options.keepExisting = true;
  else if (['--project', '--recipe', '--ghc', '--cabal', '--hls', '--builddir'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
  else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
const root = path.resolve(options.project ?? '.');
const local = path.join(root, '.runtime/haskell-editor');
const unix = value => value.replaceAll('\\', '/');
const json = value => JSON.stringify(value, null, 2) + '\n';
const exists = async file => { try { await access(file); return true; } catch { return false; } };
const strings = value => Array.isArray(value) && value.every(v => typeof v === 'string');
function relative(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) throw new Error(`Expected a project-relative path: ${value}`);
  const result = path.relative(root, path.resolve(root, value));
  if (result === '..' || result.startsWith('..' + path.sep) || path.isAbsolute(result)) throw new Error(`Path escapes the project: ${value}`);
  return unix(result) || '.';
}
async function executable(name) {
  for (const dir of /[/\\]/.test(name) ? [''] : (process.env.PATH ?? '').split(path.delimiter)) {
    for (const suffix of process.platform === 'win32' && !path.extname(name) ? ['', '.exe', '.cmd'] : ['']) {
      const candidate = path.resolve(dir, name + suffix);
      if (await exists(candidate)) return realpath(candidate);
    }
  }
  throw new Error(`Executable not found: ${name}`);
}
function run(file, argv) {
  const result = spawnSync(file, argv, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 4_000_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function main() {
  const recipe = JSON.parse(await readFile(path.join(root, relative(options.recipe ?? 'editor-project.json')), 'utf8'));
  if (recipe.version !== 1 || !/^[a-zA-Z0-9-]+$/.test(recipe.package ?? '') || !strings(recipe.ghcOptions) || !recipe.components?.length || (recipe.flags !== undefined && !strings(recipe.flags))) throw new Error('Recipe needs version: 1, package, ghcOptions and components.');
  for (const component of recipe.components) {
    component.path = relative(component.path);
    if (!/^(lib(?::[\w-]+)?|exe:[\w-]+|test:[\w-]+|bench:[\w-]+)$/.test(component.component ?? '') || !strings(component.sourceDirs) || !component.sourceDirs.length || (component.ghcOptions !== undefined && !strings(component.ghcOptions))) throw new Error(`Invalid component: ${component.path}`);
    component.sourceDirs = component.sourceDirs.map(relative);
  }
  await access(path.join(root, relative(recipe.cabalFile)));
  let ghc = await executable(options.ghc ?? 'ghc');
  const version = run(ghc, ['--numeric-version']);
  if (!/^9\.6\./.test(version)) throw new Error(`The analyzer supports GHC 9.6.x; found ${version}. Keep the project's compiler and use declaration view + HLS, or discuss compatibility before changing it.`);
  const installed = path.resolve(run(ghc, ['--print-libdir']), '../bin', process.platform === 'win32' ? 'ghc.exe' : 'ghc');
  if (await exists(installed) && run(installed, ['--numeric-version']) === version) ghc = installed;
  const cabal = await executable(options.cabal ?? 'cabal');
  const hls = await executable(options.hls ?? 'haskell-language-server-wrapper');
  run(hls, ['--version']);
  const builddir = path.join(root, relative(options.builddir ?? 'dist-newstyle'));
  const plan = JSON.parse(await readFile(path.join(builddir, 'cache/plan.json'), 'utf8'));
  if (plan['compiler-id'] !== `ghc-${version}`) throw new Error('Build plan uses a different compiler. Build the actual project with the selected GHC first.');
  const units = new Map(plan['install-plan'].map(unit => [unit.id, unit]));
  const selected = component => {
    const matches = [...units.values()].filter(u => u.style === 'local' && u['pkg-name'] === recipe.package && u['component-name'] === component.component);
    if (matches.length !== 1) throw new Error(`Expected one built ${recipe.package}:${component.component}; found ${matches.length}.`);
    const unit = matches[0];
    if (path.resolve(unit['pkg-src']?.path ?? '') !== root) throw new Error('Build plan belongs to a different project directory. Rebuild here.');
    return unit;
  };
  const dbs = [path.join(run(cabal, ['path', '--store-dir']), `ghc-${version}`, 'package.db'), path.join(builddir, 'packagedb', `ghc-${version}`)];
  const databases = [];
  for (const db of dbs) if (await exists(db)) databases.push('-package-db', unix(db));
  const config = { version: 1, ghcPath: unix(ghc), ghcOptions: ['-hide-all-packages', ...databases, ...recipe.ghcOptions], audit: { include: [...new Set(recipe.components.flatMap(c => c.sourceDirs))], exclude: ['.runtime', unix(path.relative(root, builddir))] }, components: [] };
  for (const component of recipe.components) {
    const sources = new Set(component.sourceDirs);
    const dependencies = new Set();
    const seen = new Set();
    const extra = [...(component.ghcOptions ?? [])];
    // Read same-package libraries as live home modules, not stale compiled interfaces.
    const visit = unit => {
      if (seen.has(unit.id)) return;
      seen.add(unit.id);
      for (const id of unit.depends ?? []) {
        const dependency = units.get(id);
        if (dependency?.style !== 'local') { dependencies.add(id); continue; }
        const mapping = recipe.components.find(c => dependency['pkg-name'] === recipe.package && c.component === dependency['component-name']);
        if (!mapping) throw new Error(`Unmapped local dependency ${id}. Add its library mapping, or configure this project manually.`);
        for (const source of mapping.sourceDirs) sources.add(source);
        extra.push(...(mapping.ghcOptions ?? []));
        visit(dependency);
      }
    };
    const unit = selected(component);
    for (const flag of recipe.flags ?? []) {
      const name = flag.replace(/^[+-]/, '');
      if (unit.flags?.[name] !== !flag.startsWith('-')) throw new Error(`Build flag ${flag} differs from the recipe. Rebuild with the intended flags.`);
    }
    visit(unit);
    config.components.push({ path: component.path, ghcOptions: [...sources].map(dir => `-i${dir}`).concat(extra, [...dependencies].flatMap(id => ['-package-id', id])) });
  }
  // plan.json calls the main library "lib"; Cabal targets need its package name.
  const target = c => `${recipe.package}:${c.component === 'lib' ? `lib:${recipe.package}` : c.component}`;
  const hie = 'cradle:\n  cabal:\n' + recipe.components.map(c => `    - path: ${JSON.stringify('./' + c.path)}\n      component: ${JSON.stringify(target(c))}\n`).join('');
  const project = `-- Local editor compiler; generated by haskell-editor-setup.\nwith-compiler: ${unix(ghc)}\n` + (recipe.flags?.length ? `package ${recipe.package}\n  flags: ${recipe.flags.join(' ')}\n` : '');
  const settings = {
    'haskell.manageHLS': 'PATH', 'haskell.serverExecutablePath': hls,
    'haskell.serverEnvironment': { PATH: [path.dirname(ghc), path.dirname(cabal), process.env.PATH ?? ''].join(path.delimiter) },
    'haskell.sessionLoading': 'singleComponent', 'haskell.checkProject': false, 'haskell.serverExtraArgs': '-j4',
    'haskell.formattingProvider': 'ormolu', 'haskell.plugin.semanticTokens.globalOn': true,
    ...(process.platform === 'win32' ? { 'haskell.plugin.rename.config.crossModule': false } : {}),
    '[haskell]': { 'editor.defaultFormatter': 'haskell.haskell' },
    'haskellDesign.autoVerify': true, 'workbench.editorAssociations': { '*.hs': 'haskellDesign.editor' },
  };
  const outputs = { '.haskell-design.json': json(config), 'hie.yaml': hie, 'cabal.project.local': project,
    '.vscode/settings.json': json(settings), '.vscode/extensions.json': json({ recommendations: ['haskell.haskell'] }) };
  const generated = path.join(local, 'generated');
  for (const [name, source] of Object.entries(outputs)) {
    await mkdir(path.dirname(path.join(generated, name)), { recursive: true });
    await writeFile(path.join(generated, name), source);
  }
  console.log('Generated proposals:', generated);
  if (!options.apply) return;
  const conflicts = [];
  for (const [name, source] of Object.entries(outputs)) {
    if (await exists(path.join(root, name)) && (await readFile(path.join(root, name), 'utf8')).replaceAll('\r\n', '\n') !== source) conflicts.push(name);
  }
  if (conflicts.length && !options.keepExisting) throw new Error(`Existing files differ: ${conflicts.join(', ')}. No project settings changed. Back up and merge the proposals; --apply --keep-existing then preserves them. It does not validate the merge.`);
  for (const [name, source] of Object.entries(outputs)) {
    if (await exists(path.join(root, name))) continue;
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), source, { flag: 'wx' });
  }
  if (conflicts.length) console.log('Preserved existing settings; verify the merged contents:', conflicts.join(', '));
  console.log('Open the project folder in VS Code after installing Haskell Design and haskell.haskell. Verify HLS and the viewer on real sources. Keep host paths and package IDs out of Git.');
}
try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
