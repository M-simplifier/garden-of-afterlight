local repo = vim.fs.normalize(vim.uv.cwd())
local plugin = vim.env.HASKELL_DESIGN_TEST_PLUGIN or repo
local work = repo .. '/.test-output/neovim-auto-' .. vim.fn.getpid()
vim.fn.mkdir(work .. '/src', 'p'); vim.fn.mkdir(work .. '/docs', 'p')
vim.fn.writefile({ 'cabal-version: 2.4', 'name: example', 'version: 0.1', 'library', '  hs-source-dirs: src', '  exposed-modules: Types, Action' }, work .. '/example.cabal')
vim.fn.writefile({ '{-# LANGUAGE Trustworthy #-}', 'module Types where', 'data Choice = LeftChoice | RightChoice', 'choose :: Bool -> Choice', 'choose x = if x then LeftChoice else RightChoice', 'collect :: Foldable f => f Int -> [Int]', 'collect = foldr (:) []' }, work .. '/src/Types.hs')
vim.fn.writefile({ 'module Action where', 'action :: IO ()', 'action = pure ()' }, work .. '/src/Action.hs')
vim.fn.writefile({ 'not Haskell' }, work .. '/docs/Example.hs')
vim.opt.runtimepath:prepend(plugin)
local hd = require('haskell-design')
-- No Haskell buffer is opened and no verification/tree command is invoked.
hd.setup({ root = work, trusted = true, ghc_path = vim.env.HASKELL_DESIGN_TEST_GHC or 'ghc', cache_dir = repo .. '/.test-output/cache' })
assert(vim.wait(60000, function() return hd.indices[work] and not hd.indices[work].pending end, 30), 'project startup did not finish automatically')
assert(hd.file_status(work) == 'io', vim.inspect(hd.indices[work]))
assert(hd.file_status(work .. '/src/Types.hs') == 'pure', 'automatic Pure missing')
assert(hd.file_status(work .. '/docs/Example.hs') == nil, 'excluded file was decorated')
local mini_path = vim.env.HASKELL_DESIGN_TEST_MINI
if mini_path then
vim.opt.runtimepath:prepend(mini_path)
local mini = require('mini.files'); mini.setup()
mini.open(work .. '/src/Types.hs', false)
local seen_pure, seen_io = false, false
local ns = vim.api.nvim_create_namespace('haskell-design-mini-files')
for _, buf in ipairs(vim.api.nvim_list_bufs()) do
  if vim.bo[buf].filetype == 'minifiles' then
    for _, mark in ipairs(vim.api.nvim_buf_get_extmarks(buf, ns, 0, -1, { details = true })) do
      local label = mark[4].virt_text[1][1]
      seen_pure = seen_pure or label == 'Pure'; seen_io = seen_io or label == 'IO'
    end
  end
end
assert(seen_pure and seen_io, 'normal mini.files did not show full Pure and IO badges')
mini.go_in({ close_on_file = true })
else
  vim.cmd.edit(vim.fn.fnameescape(work .. '/src/Types.hs'))
end
assert(vim.wait(15000, function() return hd.views[vim.api.nvim_get_current_buf()] ~= nil end, 20), 'file selected in mini.files did not open as design')
local text = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
assert(text:find('choose ::', 1, true) and not text:find('choose x =', 1, true), 'default view leaked implementation')
assert(hd.source_path() == work .. '/src/Types.hs')
vim.cmd.edit(vim.fn.fnameescape(work .. '/docs/Example.hs'))
vim.wait(250)
assert(not hd.views[vim.api.nvim_get_current_buf()], 'excluded Haskell was intercepted as design')
print('Neovim automatic startup, IO/Pure, default design and excluded file: PASS; mini.files=' .. tostring(mini_path ~= nil))
vim.cmd('qa!')
