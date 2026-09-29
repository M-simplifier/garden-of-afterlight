import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

export const nativeExecutable = (assets: string): string => path.join(assets, process.platform === 'win32' ? 'haskell-design.exe' : 'haskell-design');

// Editor adapters own process lifetime; all interpretation of Haskell lives in
// the native core. No Wasm/TypeScript parser fallback can silently diverge.
export class NativeClient {
  private child?: ChildProcessWithoutNullStreams;
  private sequence = 0;
  private buffer = '';
  private errors = '';
  private disposed = false;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  constructor(readonly assets: string) {}

  private fail(error: Error): void {
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
    this.pending.clear();
    const child = this.child; this.child = undefined;
    child?.kill(); this.buffer = ''; this.errors = '';
  }
  private start(): ChildProcessWithoutNullStreams {
    if (this.disposed) throw new Error('Haskell Design reader has been disposed.');
    if (this.child) return this.child;
    const child = spawn(nativeExecutable(this.assets), ['--serve'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data: string) => { this.errors = (this.errors + data).slice(-12000); });
    child.on('error', error => { if (this.child === child) this.fail(new Error(`Native Haskell reader could not start: ${error.message}. Build/install the package for this operating system.`)); });
    child.on('exit', (code, signal) => { if (this.child === child) this.fail(new Error(`Native Haskell reader exited (${code ?? signal}). ${this.errors}`)); });
    child.stdin.on('error', error => { if (this.child === child) this.fail(error); });
    child.stdout.on('data', (data: string) => {
      if (this.child !== child) return;
      this.buffer += data;
      if (this.buffer.length > 64_000_000) { this.fail(new Error('Native reader response exceeds 64 MB.')); return; }
      let end: number;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        try {
          const message = JSON.parse(line);
          const request = this.pending.get(message.id);
          if (!request) throw new Error('Unknown native reader response id.');
          clearTimeout(request.timer); this.pending.delete(message.id);
          if (typeof message.error === 'string') request.reject(new Error(message.error));
          else if (Object.hasOwn(message, 'result')) request.resolve(message.result);
          else request.reject(new Error('Invalid native reader response.'));
        } catch (error) { this.fail(error as Error); return; }
      }
    });
    return child;
  }
  request<T>(request: object, timeout = 120_000): Promise<T> {
    const child = this.start(), id = ++this.sequence;
    const message = JSON.stringify({ ...request, id }) + '\n';
    if (Buffer.byteLength(message) > 16_000_000) return Promise.reject(new Error('Native reader request exceeds 16 MB.'));
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error('Native Haskell reader timed out.')), timeout);
      this.pending.set(id, { resolve: value => resolve(value as T), reject, timer });
      child.stdin.write(message);
    });
  }
  dispose(): void { this.disposed = true; this.fail(new Error('Haskell Design reader disposed.')); }
}
