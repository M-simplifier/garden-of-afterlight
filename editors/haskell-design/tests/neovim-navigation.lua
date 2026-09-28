-- Run from editors/haskell-design after bootstrap:
-- nvim --headless -u NONE -i NONE -l tests/neovim-navigation.lua
local plugin = vim.env.HASKELL_DESIGN_TEST_PLUGIN or vim.uv.cwd()
local work = plugin .. '/.test-output/navigation-' .. vim.fn.getpid()
vim.fn.mkdir(work, 'p')
vim.fn.writefile({ 'module Types where', 'data Choice = A | B' }, work .. '/Types.hs')
vim.fn.writefile({ 'module Use where', 'import Types', 'café :: Choice -> Choice', 'café = id' }, work .. '/Use.hs')
vim.opt.runtimepath:prepend(plugin)
local hd = require('haskell-design')
hd.setup({ root = work, auto_verify = false, design_first = false })
local function wait(fn, message) assert(vim.wait(10000, fn, 20), message) end
local function use()
  vim.cmd.edit(vim.fn.fnameescape(work .. '/Use.hs'))
  hd.open()
  wait(function() local v = hd.views[vim.api.nvim_get_current_buf()]; return v and v.model end, 'design missing')
  for row, line in ipairs(vim.api.nvim_buf_get_lines(0, 0, -1, false)) do
    if line:match('^café ::') then vim.api.nvim_win_set_cursor(0, {row, assert(line:find('Choice', 1, true))-1}); return end
  end
  error('signature missing')
end
local function key(lhs) assert(vim.fn.maparg(lhs, 'n', false, true).callback, lhs)() end
local original_clients = vim.lsp.get_clients
local observed, mode, canceled = nil, 'error', false
local mock = {
  offset_encoding = 'utf-16',
  request = function(self, method, params, callback)
    observed = params
    if mode == 'timeout' then return true, 42 end
    vim.schedule(function()
      if method == 'textDocument/hover' then callback(nil, {contents={kind='markdown',value='```haskell\nChoice\n```'}})
      elseif mode == 'success' then callback(nil, {{uri=vim.uri_from_fname(work .. '/Types.hs'),range={start={line=1,character=5},['end']={line=1,character=11}}}})
      elseif mode == 'empty' then callback(nil, {})
      else callback({message='simulated HLS failure'},nil) end
    end)
    return true, 42
  end,
  cancel_request = function(self, id) canceled = id == 42 end,
}
local function run()
  for _, scenario in ipairs({'success','error','empty','timeout'}) do
    use(); mode=scenario; observed=nil
    vim.lsp.get_clients = function(filter)
      assert(filter.bufnr == hd.views[vim.api.nvim_get_current_buf()].source, 'request used projection as document')
      return {mock}
    end
    key('gd')
    wait(function() return vim.fs.normalize(hd.source_path()) == vim.fs.normalize(work .. '/Types.hs') end, 'gd failed: ' .. scenario)
    assert(observed.position.line==2 and observed.position.character==8, 'incorrect UTF-16 source position: ' .. vim.inspect(observed))
    assert(observed.textDocument.uri==vim.uri_from_fname(work .. '/Use.hs'))
    if scenario=='timeout' then assert(canceled, 'timed-out request not canceled') end
    vim.cmd('normal! ' .. string.char(15))
    assert(vim.fs.normalize(hd.source_path())==vim.fs.normalize(work .. '/Use.hs'), 'jump history lost')
    vim.api.nvim_feedkeys(string.char(9), 'nx', false)
    assert(vim.fs.normalize(hd.source_path())==vim.fs.normalize(work .. '/Types.hs'), 'forward history lost')
  end
  use(); mode='success'; key('K')
  wait(function()
    for _,win in ipairs(vim.api.nvim_list_wins()) do
      if vim.api.nvim_win_get_config(win).relative~='' then
        local text=table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(win),0,-1,false),'\n')
        if text:find('Choice',1,true) then vim.api.nvim_win_close(win,true); return true end
      end
    end
  end, 'hover was not displayed')
  assert(observed.position.character==8, 'hover source mapping differs')
  vim.lsp.get_clients=function() return {} end
  use(); key('gd')
  wait(function() return vim.fs.normalize(hd.source_path())==vim.fs.normalize(work .. '/Types.hs') end, 'offline navigation failed')
end
local ok, err=xpcall(run,debug.traceback)
vim.lsp.get_clients=original_clients
if not ok then print(err); vim.cmd('cquit!') end
print('Haskell Design navigation: LSP success/error/empty/timeout, UTF-16, hover, jump history and offline fallback PASS')
vim.cmd('qa!')
