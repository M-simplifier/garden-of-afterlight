import { promises as fs } from 'node:fs';
import path from 'node:path';

export const projectConfigName = '.haskell-design.json';

export interface ProjectConfig {
  version: 1;
  ghcPath?: string;
  ghcOptions?: string[];
  components?: { path: string; ghcOptions?: string[]; unsupportedReason?: string }[];
  audit?: { include?: string[]; exclude?: string[] };
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === 'string');
const inside = (parent: string, file: string) => { const relative = path.relative(parent, file); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
export const isProjectConfig = (file: string): boolean => path.basename(file) === projectConfigName || /\.cabal$|^cabal\.project(?:\..*)?$|^stack\.yaml(?:\.lock)?$|^hie\.yaml$|^\.ghc\.environment\./.test(path.basename(file));

// Compiler configuration is read only during an explicitly trusted verification.
// Relative GHC paths/options are resolved from the workspace, in both editors.
export async function readProjectConfig(root: string): Promise<ProjectConfig> {
  const configFile = path.join(root, projectConfigName);
  let source: string;
  try { source = await fs.readFile(configFile, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1 }; throw error; }
  const invalid = () => new Error(`${projectConfigName}: version: 1 と文字列の ghcOptions、components の path / ghcOptions を指定してください。`);
  let config: ProjectConfig;
  try { config = JSON.parse(source); } catch { throw invalid(); }
  if (!config || config.version !== 1 || (config.ghcPath !== undefined && typeof config.ghcPath !== 'string') || (config.ghcOptions !== undefined && !strings(config.ghcOptions)) ||
      (config.components !== undefined && (!Array.isArray(config.components) || config.components.some(c => !c || typeof c.path !== 'string' || (c.ghcOptions !== undefined && !strings(c.ghcOptions)) || (c.unsupportedReason !== undefined && typeof c.unsupportedReason !== 'string') || !inside(root, path.resolve(root, c.path)))))) throw invalid();
  if (config.audit && [config.audit.include, config.audit.exclude].some(paths => paths !== undefined && (!strings(paths) || paths.some(p => !inside(root, path.resolve(root, p)))))) throw invalid();
  return config;
}
export async function projectCompilerOptions(root: string, file: string): Promise<{ ghcPath?: string; ghcOptions: string[] }> {
  const config = await readProjectConfig(root);
  const component = config.components?.filter(c => inside(path.resolve(root, c.path), file)).sort((a, b) => path.resolve(root, b.path).length - path.resolve(root, a.path).length)[0];
  if (config.components?.length && !component) throw new Error(`${projectConfigName}: このファイルに対応する解析設定がありません。components に対象のフォルダを追加してください。`);
  if (component?.unsupportedReason) throw new Error(component.unsupportedReason);
  const ghcPath = config.ghcPath?.includes(path.sep) && !path.isAbsolute(config.ghcPath) ? path.resolve(root, config.ghcPath) : config.ghcPath;
  return { ghcPath, ghcOptions: [...(config.ghcOptions ?? []), ...(component?.ghcOptions ?? [])] };
}
