import path from 'node:path';
import { Status } from './model';

export interface FileStatus { file: string; status: Status; module?: string }
export interface Summary {
  status: Status;
  counts: Record<Status, number>;
  complete: boolean;
  total: number;
}
export interface FileNode {
  file: string;
  name: string;
  kind: 'file' | 'folder';
  summary: Summary;
  children: FileNode[];
}

export function summarize(statuses: Status[], complete = true): Summary {
  const counts: Summary['counts'] = { pure: 0, io: 0, unknown: 0 };
  for (const status of statuses) counts[status]++;
  // Positive IO evidence survives incomplete scans. Pure requires every file.
  const status = counts.io ? 'io' : !complete || counts.unknown || !statuses.length ? 'unknown' : 'pure';
  return { status, counts, complete, total: statuses.length };
}

export function summaryLabel(summary: Summary): string {
  const labels = (['io', 'unknown', 'pure'] as const)
    .filter(status => summary.counts[status])
    .map(status => `${{ io: 'IO', unknown: '未解析', pure: 'Pure' }[status]} ${summary.counts[status]}`);
  if (!summary.complete) labels.push('走査途中');
  return labels.join(' · ') || '未解析';
}

export function buildFileTree(root: string, files: FileStatus[], truncated = false): FileNode {
  const folder = (file: string): FileNode => ({ file, name: path.basename(file), kind: 'folder', summary: summarize([]), children: [] });
  const tree = folder(path.resolve(root));
  for (const entry of files) {
    const relative = path.relative(tree.file, path.resolve(entry.file));
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) continue;
    const parts = relative.split(path.sep);
    let parent = tree;
    for (const part of parts.slice(0, -1)) {
      let child = parent.children.find(node => node.kind === 'folder' && node.name === part);
      if (!child) { child = folder(path.join(parent.file, part)); parent.children.push(child); }
      parent = child;
    }
    parent.children.push({ file: path.resolve(entry.file), name: parts.at(-1)!, kind: 'file', summary: summarize([entry.status]), children: [] });
  }
  const finish = (node: FileNode): Status[] => {
    if (node.kind === 'file') return [node.summary.status];
    node.children.sort((a, b) => a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.name.localeCompare(b.name));
    const statuses = node.children.flatMap(finish);
    node.summary = summarize(statuses, !truncated);
    return statuses;
  };
  finish(tree);
  return tree;
}

export function indexTree(tree: FileNode, index = new Map<string, FileNode>()): Map<string, FileNode> {
  index.set(tree.file, tree);
  for (const child of tree.children) indexTree(child, index);
  return index;
}
