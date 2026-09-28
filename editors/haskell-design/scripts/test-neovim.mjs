import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

await mkdir('.test-output', { recursive: true });
const suites = ['neovim.lua', 'neovim-paths.lua', 'neovim-navigation.lua', 'neovim-dirty.lua', 'neovim-auto.lua'];
for (const suite of suites) {
  console.log(`Neovim: ${suite}`);
  const result = spawnSync(process.env.NVIM_EXECUTABLE ?? 'nvim', ['--headless', '-u', 'NONE', '-i', 'NONE', '-l', `tests/${suite}`], {
    stdio: 'inherit', timeout: 180000, windowsHide: true,
    env: { ...process.env, XDG_STATE_HOME: path.resolve('.test-output/nvim-state'), XDG_CACHE_HOME: path.resolve('.test-output/nvim-cache') },
  });
  if (result.error || result.status !== 0) { console.error(result.error ?? `${suite} exited ${result.status}`); process.exit(1); }
}
