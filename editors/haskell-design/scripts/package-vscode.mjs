import { execFileSync } from 'node:child_process';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const platform = JSON.parse(await readFile('dist/native-platform.json', 'utf8'));
if (platform.platform !== process.platform || platform.arch !== process.arch) throw new Error('Rebuild the native executable on this extension host before packaging.');
const target = `${platform.platform}-${platform.arch}`;
const output = `artifacts/haskell-design-${version}-${target}.vsix`;
execFileSync(process.execPath, [path.resolve('node_modules/@vscode/vsce/vsce'), 'package', '--target', target, '--no-dependencies', '--no-rewrite-relative-links', '-o', output], { stdio: 'inherit', windowsHide: true });
// Stable local path used by setup.mjs and integration tests; manifest still
// restricts installation to the host target recorded in the versioned package.
await copyFile(output, 'artifacts/haskell-design.vsix');
