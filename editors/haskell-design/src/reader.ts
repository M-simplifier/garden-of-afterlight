import { NativeClient } from './native';

export interface ReadRequest {
  command: 'map' | 'outline' | 'show'; root: string;
  module?: string; file?: string; symbol?: string; line?: number;
  include?: string[]; exclude?: string[]; docs?: boolean; context?: boolean;
  maxChars?: number; maxFiles?: number; offset?: number; snapshot?: string;
  infer?: boolean; trusted?: boolean; ghcPath?: string; cacheDir?: string;
}
export interface ReadPage {
  schema: 1; command: ReadRequest['command']; snapshot: string; text: string;
  coverage: { files: number; declarations: number; sourceLines: number; sourceChars: number; discoveryTruncated: boolean };
  issueCount: number;
  next?: { offset: number; snapshot: string };
  blocked?: { offset: number; minimumChars: number; hint: string };
  matches?: number;
}

// Compatibility API for existing integrations. Scope, projection, selection and
// paging all execute in the same Haskell library as the standalone binary.
export class CodeReader {
  private readonly native: NativeClient;
  constructor(readonly assets: string) { this.native = new NativeClient(assets); }
  dispose(): void { this.native.dispose(); }
  read(request: ReadRequest): Promise<ReadPage> { return this.native.request({ command: 'read', request }); }
}
