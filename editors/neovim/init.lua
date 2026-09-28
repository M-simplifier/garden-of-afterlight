-- Standalone profile: nvim -u editors/neovim/init.lua src/Garden/Rules.hs
local here = vim.fs.dirname(debug.getinfo(1, 'S').source:sub(2))
local root = vim.fs.normalize(vim.fs.joinpath(here, '../..'))
vim.opt.runtimepath:prepend(here)
vim.g.mapleader = ' '
vim.opt.number = true
vim.opt.termguicolors = true
vim.opt.hidden = true
vim.opt.completeopt = { 'menu', 'menuone', 'noselect' }
vim.cmd('filetype plugin indent on')
vim.cmd('syntax enable')
require('afterlight_editor').setup({ root = root })
