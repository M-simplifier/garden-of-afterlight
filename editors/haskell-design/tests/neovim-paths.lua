-- Exercise Windows-shaped protocol paths even on a Unix test host. This is a
-- protocol/consumer regression test, not a claim of native Windows coverage.
local repo = vim.uv.cwd()
local temporary = vim.fn.tempname() .. '-haskell-paths'
vim.fn.mkdir(temporary, 'p')
vim.fn.writefile(vim.split([[
const readline = require('node:readline');
const root = 'C:\\Example';
const pure = root + '\\Pure.hs';
const io = root + '\\Action.hs';
const summary = status => ({status, total: 1, complete: true, counts: {[status]: 1}});
const node = (file, status, children = []) => ({file, name: file.split('\\').at(-1), kind: children.length ? 'folder' : 'file', summary: summary(status), children});
const tree = node(root, 'io', [node(pure, 'pure'), node(io, 'io')]);
readline.createInterface({input: process.stdin}).on('line', line => {
  const request = JSON.parse(line);
  if (request.command === 'watch') console.log(JSON.stringify({event: 'audit',
    root, pending: false, files: [pure, io],
    tree,
    designs: {[pure]: {status: 'pure'}, [io]: {status: 'io'}}
  }));
  console.log(JSON.stringify({id: request.id, result: request.command === 'files' ? {tree} : {}}));
});
]], '\n'), temporary .. '/server.cjs')
vim.opt.runtimepath:prepend(repo)
vim.bo.filetype = 'minifiles'
vim.api.nvim_buf_set_lines(0, 0, -1, false, { 'Pure.hs', 'Action.hs' })
local entries = { 'C://Example/Pure.hs', 'c:/Example/Action.hs' }
package.loaded['mini.files'] = { get_fs_entry = function(_, row) return { path = entries[row] } end }
local hd = require('haskell-design')
hd.setup({ root = 'c:/Example', cli = temporary .. '/server.cjs' })
assert(vim.wait(10000, function() return hd.indices['C:/Example'] ~= nil end, 20), 'Windows snapshot root did not match Neovim root')
assert(hd.indices['C:/Example'].designs['C:/Example/Pure.hs'].status == 'pure', 'design cache keys differ')
assert(hd.file_status('C://Example/Pure.hs') == 'pure')
assert(hd.file_status('c:\\Example\\Action.hs') == 'io')
local namespace = vim.api.nvim_create_namespace('haskell-design-mini-files')
local marks = vim.api.nvim_buf_get_extmarks(0, namespace, 0, -1, { details = true })
assert(#marks == 2, 'Windows path separators lost mini.files decorations')
assert(marks[1][4].virt_text[1][1] == 'Pure')
assert(marks[2][4].virt_text[1][1] == 'IO')
hd.files()
local folder = vim.api.nvim_get_current_buf()
assert(vim.wait(10000, function() return hd.tree_views[folder].tree ~= nil end, 20), 'folder snapshot missing')
local function folder_text() return table.concat(vim.api.nvim_buf_get_lines(folder, 0, -1, false), '\n') end
assert(folder_text():find('Pure.hs', 1, true), 'Windows folder root did not start expanded')
vim.api.nvim_win_set_cursor(0, { 4, 0 })
local toggle = vim.fn.maparg('za', 'n', false, true).callback
assert(toggle)
toggle(); assert(not folder_text():find('Pure.hs', 1, true), 'root did not collapse')
toggle(); assert(folder_text():find('Pure.hs', 1, true), 'root did not re-expand')
print('Neovim Windows-shaped roots, design keys, mini.files and folder expansion: PASS')
vim.cmd('qa!')
