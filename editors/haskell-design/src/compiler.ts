import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execute, fingerprint, listHaskellFiles, listConfigurationFiles } from './workspace';
import { hash } from './projector';
import { Verification } from './model';
import { projectCompilerOptions } from './projectConfig';

export interface CompilerOptions { root: string; ghcPath?: string; ghcOptions?: string[]; cacheDir?: string; timeoutMs?: number }
const building = new Map<string, Promise<string>>();
const helpers = new Map<string, Promise<{ binary: string; libdir: string }>>();

async function helper(sourcePath: string, options: CompilerOptions): Promise<{ binary: string; libdir: string }> {
  const ghc = options.ghcPath ?? 'ghc';
  const run = (args: string[]) => execute(ghc, args, { cwd: options.root, timeout: 15000, maxBuffer: 4_000_000 });
  const version = (await run(['--numeric-version'])).stdout.trim();
  if (!/^9\.6\./.test(version)) throw new Error(`GHC ${version}: この版の確認機能はGHC 9.6.xに対応しています。設計の表示は利用できます。`);
  const libdir = (await run(['--print-libdir'])).stdout.trim();
  const key = hash([version, libdir, await fs.readFile(sourcePath, 'utf8')].join('\0')).slice(0, 20);
  const cache = path.join(options.cacheDir ?? path.join(os.tmpdir(), 'haskell-design-' + process.getuid?.()), key);
  const binary = path.join(cache, process.platform === 'win32' ? 'verify.exe' : 'verify');
  try { await fs.access(binary); } catch {
    let promise = building.get(binary);
    if (!promise) {
      promise = (async () => {
        await fs.mkdir(cache, { recursive: true, mode: 0o700 });
        // Each process compiles in its own directory; rename publishes a complete helper.
        const temp = await fs.mkdtemp(path.join(cache, 'build-'));
        try {
          const target = path.join(temp, path.basename(binary));
          await execute(ghc, ['-package', 'ghc', '-O0', '-outputdir', temp, '-o', target, sourcePath], { cwd: options.root, timeout: 60000, maxBuffer: 4_000_000 });
          await fs.rename(target, binary);
          return binary;
        } finally { await fs.rm(temp, { recursive: true, force: true }); }
      })();
      building.set(binary, promise);
      void promise.finally(() => building.delete(binary)).catch(() => {});
    }
    await promise;
  }
  return { binary, libdir };
}

export async function verify(file: string, source: string, helperSource: string, options: CompilerOptions): Promise<Verification> {
  const result: Verification = { status: 'unknown', sourceHash: hash(source), signatures: [], evidence: [] };
  try {
    if (hash(await fs.readFile(file, 'utf8')) !== result.sourceHash) throw new Error('未保存の変更があります。保存してからGHCで確認してください。');
    const before = await fingerprint(options.root);
    const project = await projectCompilerOptions(options.root, file);
    const { binary, libdir } = await helper(helperSource, { ...options, ghcPath: project.ghcPath ?? options.ghcPath });
    const include = [options.root, ...['src', 'app', 'test', 'tests'].map(p => path.join(options.root, p))].map(p => '-i' + p);
    const args = [libdir, path.resolve(file), ...include, ...project.ghcOptions, ...(options.ghcOptions ?? [])];
    const { stdout } = await execute(binary, args, { cwd: options.root, timeout: options.timeoutMs ?? 30000, maxBuffer: 8_000_000 });
    const data: Verification = JSON.parse(stdout);
    if (!['pure', 'io'].includes(data.status) || !Array.isArray(data.signatures) || !Array.isArray(data.evidence)) throw new Error('GHC解析器の応答が不正です。');
    const files = new Set((await listHaskellFiles(options.root, 5000)).files.map(f => path.resolve(f)));
    const dependencies = (data.dependencies ?? []).map(f => path.resolve(options.root, f));
    if (dependencies.some(f => !files.has(f))) throw new Error('ワークスペースの解析範囲外のソースに依存しています。共通の親フォルダをワークスペースとして開いてください。');
    dependencies.push(...await listConfigurationFiles(options.root));
    if (before !== await fingerprint(options.root) || hash(await fs.readFile(file, 'utf8')) !== result.sourceHash) throw new Error('確認中にソースが変更されました。もう一度確認してください。');
    return { ...result, ...data, dependencies, workspaceHash: before, sourceHash: result.sourceHash, evidence: data.evidence.map(e => ({
      ...e,
      name: /^\$[a-zA-Z]/.test(e.name) ? 'インスタンス・生成された定義' : e.name,
      reason: 'GHCが推論した型・式にIOが現れます。',
    })) };
  } catch (error) {
    const e = error as Error & { stderr?: string; killed?: boolean };
    result.error = (e.killed ? 'GHCの確認がタイムアウトしました。' : e.stderr?.trim() || e.message).slice(0, 12000);
    return result;
  }
}

// The index validates a single immutable source/config snapshot before accepting
// the whole batch. Do not repeatedly fingerprint and reload the project per file.
async function runBatch(files: string[], sources: Map<string, string>, helperSource: string, options: CompilerOptions): Promise<Map<string, Verification>> {
  const result = new Map<string, Verification>();
  if (!files.length) return result;
  const project = await projectCompilerOptions(options.root, files[0]!);
  const ghc = project.ghcPath ?? options.ghcPath ?? 'ghc';
  const key = JSON.stringify([ghc, helperSource, options.cacheDir]);
  let ready = helpers.get(key);
  if (!ready) { ready = helper(helperSource, { ...options, ghcPath: ghc }); helpers.set(key, ready); }
  const { binary, libdir } = await ready;
  const include = [options.root, ...['src', 'app', 'test', 'tests'].map(p => path.join(options.root, p))].map(p => '-i' + p);
  const run = async (batch: string[]): Promise<void> => {
    try {
      const { stdout } = await execute(binary, ['--batch', libdir, ...batch, '--', ...include, ...project.ghcOptions, ...(options.ghcOptions ?? [])], { cwd: options.root, timeout: options.timeoutMs ?? 30000, maxBuffer: 16_000_000 });
      const data: Verification[] = JSON.parse(stdout);
      if (!Array.isArray(data) || data.length !== batch.length) throw new Error('GHC解析器の応答が不正です。');
      for (let i = 0; i < batch.length; i++) {
        const proof = data[i]!, file = batch[i]!;
        if (!['pure', 'io'].includes(proof.status) || !Array.isArray(proof.signatures) || !Array.isArray(proof.evidence)) throw new Error('GHC解析器の応答が不正です。');
        result.set(file, { ...proof, sourceHash: hash(sources.get(file)!), dependencies: proof.dependencies?.map(f => path.resolve(options.root, f)), evidence: proof.evidence.map(e => ({ ...e, name: /^\$[a-zA-Z]/.test(e.name) ? 'インスタンス・生成された定義' : e.name, reason: 'GHCが推論した型・式にIOが現れます。' })) });
      }
    } catch (error) {
      // A broken module must not prevent independent modules being classified.
      if (batch.length > 1) { const middle = Math.ceil(batch.length / 2); await run(batch.slice(0, middle)); await run(batch.slice(middle)); }
      else {
        const e = error as Error & { stderr?: string };
        result.set(batch[0]!, { status: 'unknown', sourceHash: hash(sources.get(batch[0]!)!), signatures: [], evidence: [], error: (e.stderr?.trim() || e.message).slice(0, 12000) });
      }
    }
  };
  await run(files);
  return result;
}

let backgroundCompiler: Promise<void> = Promise.resolve();
export async function verifyBatch(files: string[], sources: Map<string, string>, helperSource: string, options: CompilerOptions): Promise<Map<string, Verification>> {
  const previous = backgroundCompiler;
  let release!: () => void;
  backgroundCompiler = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await runBatch(files, sources, helperSource, options); }
  finally { release(); }
}
