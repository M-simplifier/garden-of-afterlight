// IO/Pure are navigation hints; unknown means analysis is not available yet.
export type Status = 'pure' | 'io' | 'unknown';
export interface Evidence { name: string; line: number; status: Status; type?: string; reason: string }
export interface Reference { name: string; line: number; column: number; inferred?: boolean }
export interface Declaration {
  id: string;
  names: string[];
  kind: string;
  line: number;
  endLine: number;
  design: string;
  docs: string;
  implementation: string;
  inferred: boolean;
  references: Reference[];
}
export interface Verification {
  status: Status;
  sourceHash: string;
  signatures: { name: string; type: string; line: number }[];
  evidence: Evidence[];
  error?: string;
  workspaceHash?: string;
  dependencies?: string[];
}
export interface Design {
  file: string;
  module: string;
  sourceHash: string;
  header: string;
  imports: string[];
  declarations: Declaration[];
  status: Status;
  evidence: Evidence[];
  issues: string[];
  verified: boolean;
  verification?: Verification;
  text: string;
}
export const badge = (status: Status): string => ({ pure: 'P', io: 'IO', unknown: '—' })[status];
export const statusLabel = (status: Status): string => ({ pure: 'Pure · IOの使用は見つかりません', io: 'IO · IOに関わる定義あり', unknown: '未解析' })[status];
