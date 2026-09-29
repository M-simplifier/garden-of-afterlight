import { createHash } from 'node:crypto';
import { Design, Verification } from './model';
import { NativeClient } from './native';

export const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
export interface SourceSymbol {
  names: string[]; kind: string; line: number; endLine: number;
  owner?: string; signature?: string; source: string;
}
export class Projector {
  private readonly native: NativeClient;
  constructor(assets: string) { this.native = new NativeClient(assets); }
  project(source: string, file: string, verification?: Verification): Promise<Design> {
    return this.native.request({ command: 'project', source, file, verification });
  }
  sourceSymbols(source: string): Promise<SourceSymbol[]> { return this.native.request({ command: 'symbols', source }); }
  dispose(): void { this.native.dispose(); }
}

export function compareDesigns(before: Design, after: Design): { changed: boolean; implementationChanged: boolean; unresolved: string[] } {
  const unresolved = after.declarations.filter(d => d.design.includes(':: ?')).flatMap(d => d.names);
  return { changed: before.text !== after.text, implementationChanged: before.sourceHash !== after.sourceHash, unresolved };
}
