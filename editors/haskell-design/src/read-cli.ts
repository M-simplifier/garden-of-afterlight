import { CodeReader, ReadRequest } from './reader';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    console.log(`Haskell Design reader (saved files, no editor required)
  node dist/read.cjs map --root PATH
  node dist/read.cjs outline --root PATH [--module Garden.Change]
  node dist/read.cjs show --root PATH --module Garden.Change --symbol apply

Filters: --file PATH, --module NAMESPACE, --symbol NAME, --line NUMBER
Scope:   --include DIR (repeatable), --exclude DIR (repeatable), --max-files NUMBER
Output:  --max-chars NUMBER (default 16000), --offset NUMBER --snapshot HASH, --json
Details: --docs, --context (module/import context), --infer --trusted (runs GHC;
         outline with --file or exact --module), --ghc PATH, --cache-dir PATH
The default syntax view needs Node only; GHC is optional. Read the returned NEXT
cursor and warnings before claiming whole-project coverage. No source is modified.`);
    return;
  }
  const request: ReadRequest = { command: args.shift() as ReadRequest['command'], root: process.cwd() };
  let json = false;
  const stringKeys: Record<string, keyof ReadRequest> = { '--root': 'root', '--file': 'file', '--module': 'module', '--symbol': 'symbol', '--snapshot': 'snapshot', '--ghc': 'ghcPath', '--cache-dir': 'cacheDir' };
  const numberKeys: Record<string, keyof ReadRequest> = { '--line': 'line', '--offset': 'offset', '--max-chars': 'maxChars', '--max-files': 'maxFiles' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--json') json = true;
    else if (['--docs', '--context', '--infer', '--trusted'].includes(arg)) Object.assign(request, { [arg.slice(2)]: true });
    else if (stringKeys[arg] || numberKeys[arg] || arg === '--include' || arg === '--exclude') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--include' || arg === '--exclude') {
        const key = arg === '--include' ? 'include' : 'exclude'; (request[key] ??= []).push(value);
      } else Object.assign(request, { [stringKeys[arg] ?? numberKeys[arg]!]: numberKeys[arg] ? Number(value) : value });
    } else throw new Error(`Unknown option: ${arg}`);
  }
  const reader = new CodeReader(__dirname);
  try {
    const page = await reader.read(request);
    process.stdout.write(json ? JSON.stringify(page) + '\n' : page.text);
  } finally { reader.dispose(); }
}
main().catch(error => { console.error(String(error.message ?? error)); process.exitCode = 1; });
