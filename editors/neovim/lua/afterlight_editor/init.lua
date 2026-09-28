local M = {}

-- Call once for this checkout; existing LSP users may pass hls = false.
function M.setup(opts)
  opts = opts or {}
  assert(vim.fn.has('nvim-0.11') == 1, 'Haskell Design requires Neovim 0.11 or newer')
  local root = assert(opts.root, 'Pass the absolute Afterlight checkout path as root')
  root = vim.fs.normalize(vim.fn.fnamemodify(root, ':p')):gsub('/$', '')
  local settings_path = root .. '/.runtime/haskell-editor/settings.json'
  assert(vim.uv.fs_stat(settings_path), 'Run node editors/setup.mjs configure --apply first')
  local settings = vim.json.decode(table.concat(vim.fn.readfile(settings_path), '\n'))
  local plugin = root .. '/editors/haskell-design'
  assert(vim.uv.fs_stat(plugin .. '/dist/cli.cjs'), 'Run node editors/setup.mjs build first')
  vim.opt.runtimepath:prepend(plugin)
  vim.cmd('runtime plugin/haskell-design.lua')
  require('haskell-design').setup({ root = root, ghc_path = settings.ghc, trusted_roots = { root } })
  if opts.hls == false then return end
  local windows = vim.fn.has('win32') == 1
  local separator = windows and ';' or ':'
  local group = vim.api.nvim_create_augroup('AfterlightEditor', { clear = true })
  vim.api.nvim_create_autocmd('LspAttach', { group = group, callback = function(event)
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if not client or client.name ~= 'afterlight_hls' then return end
    local function map(mode, lhs, rhs, desc)
      vim.keymap.set(mode, lhs, rhs, { buffer = event.buf, desc = desc })
    end
    for key, spec in pairs({
      gd = { vim.lsp.buf.definition, 'Definition' }, K = { vim.lsp.buf.hover, 'Type / documentation' },
      grr = { vim.lsp.buf.references, 'References' }, grt = { vim.lsp.buf.type_definition, 'Type definition' },
      grn = { vim.lsp.buf.rename, 'Rename' }, gra = { vim.lsp.buf.code_action, 'Code actions' },
    }) do map('n', key, spec[1], 'HLS: ' .. spec[2]) end
    map('n', '<leader>f', function() vim.lsp.buf.format({ bufnr = event.buf, async = true }) end, 'HLS: Format')
    map('n', '<leader>e', require('haskell-design').files, 'Haskell Design: Files')
    map('n', '<leader>v', require('haskell-design').open, 'Haskell Design: Types')
    if client:supports_method('textDocument/completion') then
      vim.lsp.completion.enable(true, client.id, event.buf, { autotrigger = true })
      map('i', '<C-Space>', vim.lsp.completion.get, 'HLS: Complete')
    end
  end })
  vim.lsp.config('afterlight_hls', {
    cmd = { settings.hls, '--lsp' }, filetypes = { 'haskell', 'lhaskell', 'cabal' },
    cmd_env = { PATH = table.concat({ settings.ghcBin, settings.cabalBin, vim.env.PATH or '' }, separator) },
    root_dir = function(buf, on_dir)
      local name = vim.fs.normalize(vim.api.nvim_buf_get_name(buf))
      local base = root
      if windows then name, base = name:lower(), base:lower() end
      if name:sub(1, #base + 1) == base .. '/' and not name:find('/web/', #base + 1, true)
        and not name:find('/editors/', #base + 1, true) then on_dir(root) end
    end,
    settings = { haskell = { formattingProvider = 'ormolu', plugin = {
      semanticTokens = { globalOn = true },
      -- Some Windows HLS versions omit cross-module edits; reject partial renames.
      rename = { config = { crossModule = not windows } },
    } } },
  })
  vim.lsp.enable('afterlight_hls')
end

return M
