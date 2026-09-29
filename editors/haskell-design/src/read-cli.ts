import { spawn } from 'node:child_process';
import { nativeExecutable } from './native';

// Keep old scripts working; new integrations invoke the native executable
// directly and do not need a Node installation.
const child = spawn(nativeExecutable(__dirname), process.argv.slice(2), { windowsHide: true, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
