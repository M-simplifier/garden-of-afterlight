import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Projector, hash } from './projector';
import { createInterface } from 'node:readline';
import { ProjectAudit } from './audit';
import { verify } from './compiler';
import { designDiff, listHaskellFiles, relatedTests, findDeclaration, fingerprint } from './workspace';
import { buildFileTree } from './fileTree';

const projector = new Projector(__dirname);
const audits = new Map<string, ProjectAudit>();
async function handle(request: any): Promise<unknown> {
    const root = path.resolve(request.root ?? process.cwd());
    const file = path.resolve(request.file ?? path.join(root, 'Main.hs'));
    // Neovim uses forward slashes on Windows; Node's discovered paths do not.
    // Normalize overlays/proofs before lookup so dirty IO never appears Pure.
    const sources = Object.fromEntries(Object.entries(request.sources ?? {}).map(([f, value]) => [path.resolve(f), value]));
    const verifications = Object.fromEntries(Object.entries(request.verifications ?? {}).map(([f, value]) => [path.resolve(f), value]));
    const source = request.source ?? (['files', 'related', 'watch', 'dirty', 'refresh-index'].includes(request.command) ? '' : await fs.readFile(file, 'utf8'));
    let output: unknown;
    switch (request.command ?? 'project') {
      case 'watch': {
        let audit = audits.get(root);
        if (audit && audit.options.trusted !== (request.trusted === true)) { audit.dispose(); audits.delete(root); audit = undefined; }
        if (!audit) {
          audit = new ProjectAudit(projector, path.join(__dirname, '..', 'compiler/Main.hs'), {
            root, trusted: request.trusted === true, autoVerify: request.autoVerify !== false,
            ghcPath: request.ghcPath, ghcOptions: request.ghcOptions, cacheDir: request.cacheDir, maxFiles: request.maxFiles,
            dirtySources: sources as Record<string, string>,
          });
          audits.set(root, audit);
          audit.on('change', snapshot => process.stdout.write(JSON.stringify({ event: 'audit', ...snapshot }) + '\n'));
        }
        await audit.refresh(); return audit.snapshot;
      }
      case 'dirty': audits.get(root)?.setDirty(file, request.source); return {};
      case 'refresh-index': await audits.get(root)?.refresh(); return audits.get(root)?.snapshot ?? {};

      case 'project': {
        const indexed = audits.get(root)?.snapshot.designs[file];
        if (indexed && indexed.sourceHash === hash(source)) return indexed;
        const proof = request.verification?.workspaceHash && request.verification.workspaceHash === await fingerprint(root).catch(() => null) ? request.verification : undefined;
        output = await projector.project(source, file, proof ?? indexed?.verification); break;
      }
      case 'verify': {
        if (request.trusted !== true) throw new Error('GHCの実行にはプロジェクトへの信頼が必要です。');
        const proof = await verify(file, source, path.join(__dirname, '..', 'compiler', 'Main.hs'), { root, ghcPath: request.ghcPath, ghcOptions: request.ghcOptions, cacheDir: request.cacheDir });
        output = await projector.project(source, file, proof);
        break;
      }
      case 'diff': output = await designDiff(projector, file, source); break;
      case 'files': {
        const audit = audits.get(root);
        if (audit) return { tree: audit.snapshot.tree, files: Object.values(audit.snapshot.designs).map(d => ({ file: d.file, module: d.module, status: d.status })), truncated: !audit.snapshot.tree.summary.complete };
        const found = await listHaskellFiles(root, request.maxFiles ?? 500);
        const files = [];
        // A disk fingerprint cannot validate any dependent module while a
        // source override is present, even when that module itself is saved.
        const proofs: Record<string, any> = Object.keys(sources).length ? {} : verifications;
        const currentHash = Object.keys(proofs).length ? await fingerprint(root).catch(() => null) : null;
        for (const f of found.files) {
          const proof = proofs[f]?.workspaceHash === currentHash ? proofs[f] : undefined;
          try {
            const design = await projector.project(sources[f] as string ?? await fs.readFile(f, 'utf8'), f, proof);
            files.push({ file: f, module: design.module, status: design.status });
          } catch {
            // One unreadable/oversized file must not hide the rest of the tree
            // or leave a previously Pure parent on screen.
            files.push({ file: f, status: 'unknown' as const });
          }
        }
        output = { files, truncated: found.truncated, tree: buildFileTree(root, files, found.truncated) }; break;
      }
      case 'related': output = await relatedTests(root, request.names ?? []); break;
      case 'definition': output = await findDeclaration(projector, root, request.name, await projector.project(source, file)); break;
      default: throw new Error('未知のコマンドです。');
    }
    return output ?? null;
}
async function main(): Promise<void> {
  if (process.argv.includes('--serve')) {
    const lines = createInterface({ input: process.stdin });
    lines.on('line', line => {
      if (line.length > 4_000_000) return;
      let request: any;
      try { request = JSON.parse(line); } catch { return; }
      void handle(request).then(result => process.stdout.write(JSON.stringify({ id: request.id, result }) + '\n'), error => process.stdout.write(JSON.stringify({ id: request.id, error: String(error.message ?? error) }) + '\n'));
    });
    lines.on('close', () => { for (const audit of audits.values()) audit.dispose(); projector.dispose(); });
    return;
  }
  let input = '';
  for await (const chunk of process.stdin) { input += chunk; if (input.length > 4_000_000) throw new Error('入力が4 MBを超えています。'); }
  try { process.stdout.write(JSON.stringify(await handle(JSON.parse(input)))); }
  finally { projector.dispose(); }
}
main().catch(error => { process.stdout.write(JSON.stringify({ error: String(error.message ?? error) })); process.exitCode = 1; });
