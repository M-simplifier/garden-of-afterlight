local M = {}
local plugin_root = vim.fs.dirname(vim.fs.dirname(vim.fs.dirname(debug.getinfo(1, 'S').source:sub(2))))
local options = { node = 'node', cli = plugin_root .. '/dist/cli.cjs', ghc_path = 'ghc', ghc_options = {}, trusted = false, auto_verify = true, design_first = true, max_files = 500 }
local models, views, trusted_roots, watchers, jobs = {}, {}, {}, {}, {}
local indices, index_nodes, indexing = {}, {}, {}
local on_audit, enter_design, start_index
local rpc_job, rpc_id, rpc_pending, rpc_tail = nil, 0, {}, ''
local epoch, configured = 0, false
local tree_views, source_windows, window_options, analyses = {}, {}, {}, {}
local switching = false
local namespace = vim.api.nvim_create_namespace('haskell-design')
local labels = { pure = 'Pure · IOの使用は見つかりません', io = 'IO', unknown = '— 未解析' }
local notify = function(message, level) vim.notify('Haskell Design: ' .. message, level or vim.log.levels.INFO) end
local valid = vim.api.nvim_buf_is_valid
-- Normalize protocol keys once, without filesystem work for every tree entry.
-- Node uses backslashes on Windows; Neovim/mini.files can use forward slashes.
local function path_key(file)
  local windows = vim.fn.has('win32') == 1 or file:match('^%a:[/\\]') ~= nil or file:sub(1, 2) == '\\\\'
  return vim.fs.normalize(file, { expand_env = false, win = windows })
end
local function is_trusted(root)
  return options.trusted or trusted_roots[path_key(vim.uv.fs_realpath(root) or root)] == true
end
local function source_buffer()
  local b = vim.api.nvim_get_current_buf()
  return views[b] and views[b].source or b
end
local function root_for(buf)
  local root = options.root or vim.fs.root(vim.api.nvim_buf_get_name(buf), { '.haskell-design.json', 'cabal.project', 'stack.yaml', '.git' }) or vim.uv.cwd()
  return path_key(vim.uv.fs_realpath(root) or root)
end
local function source(buf)
  local sep = vim.bo[buf].fileformat == 'dos' and '\r\n' or '\n'
  return table.concat(vim.api.nvim_buf_get_lines(buf, 0, -1, false), sep) .. (vim.bo[buf].endofline and sep or '')
end
local function is_haskell(buf) return valid(buf) and vim.api.nvim_buf_get_name(buf):match('%.hs$') ~= nil end
local input_patterns = { '*.hs', '*.cabal', 'cabal.project*', 'stack.yaml*', 'hie.yaml', '.haskell-design.json' }
local function is_compiler_input(buf)
  if not valid(buf) then return false end
  local name = vim.fs.basename(vim.api.nvim_buf_get_name(buf))
  return is_haskell(buf) or name:match('%.cabal$') or name:match('^cabal%.project') or name:match('^stack%.yaml') or name == 'hie.yaml' or name == '.haskell-design.json'
end
local function request(payload, callback, on_error)
  if not rpc_job then
    rpc_job = vim.fn.jobstart({ options.node, options.cli, '--serve' }, {
      on_stdout = function(_, chunks)
        if not chunks then return end
        rpc_tail = rpc_tail .. table.concat(chunks, '\n')
        while true do
          local at = rpc_tail:find('\n', 1, true)
          if not at then break end
          local line = rpc_tail:sub(1, at - 1); rpc_tail = rpc_tail:sub(at + 1)
          local ok, data = pcall(vim.json.decode, line)
          if ok then
            if data.event == 'audit' then if on_audit then on_audit(data) end
            else
              local pending = rpc_pending[data.id]; rpc_pending[data.id] = nil
              if pending then
                if data.error then notify(data.error, vim.log.levels.ERROR); if pending.on_error then pending.on_error() end
                elseif pending.callback then pending.callback(data.result) end
              end
            end
          end
        end
      end,
      on_exit = function()
        rpc_job = nil; rpc_tail = ''
        for _, pending in pairs(rpc_pending) do if pending.on_error then pending.on_error() end end
        rpc_pending = {}; indexing = {}
      end,
    })
    if rpc_job <= 0 then rpc_job = nil; notify('解析器を起動できません。Node.jsとプラグインの配置を確認してください。', vim.log.levels.ERROR); if on_error then on_error() end; return end
  end
  rpc_id = rpc_id + 1; payload.id = rpc_id
  rpc_pending[rpc_id] = { callback = callback, on_error = on_error }
  vim.fn.chansend(rpc_job, vim.json.encode(payload) .. '\n')
end
local function mark(buf, model)
  if not valid(buf) then return end
  vim.api.nvim_buf_clear_namespace(buf, namespace, 0, -1)
  vim.api.nvim_buf_set_extmark(buf, namespace, 0, 0, { virt_text = { { '  ' .. labels[model.status], model.status == 'io' and 'DiagnosticWarn' or 'Comment' } }, virt_text_pos = 'eol' })
end
local render, refresh_trees
local function invalidate_tree(tree, incomplete)
  local function forget(node)
    node.summary.status = 'unknown'; node.summary.counts = { unknown = node.summary.total }
    if incomplete then node.summary.complete = false end
    for _, child in ipairs(node.children) do forget(child) end
  end
  if tree.tree then forget(tree.tree) end
  if tree.render then tree.render() end
end
local function invalidate()
  epoch = epoch + 1
  for buf, model in pairs(models) do
    model.verification = nil
    model.verified = false
    -- Any dependency may have changed, so no compiler-backed badge survives.
    model.status = 'unknown'
    mark(buf, model)
    for viewbuf, view in pairs(views) do if view.source == buf and valid(viewbuf) then render(viewbuf, model) end end
  end
  for out, tree in pairs(tree_views) do
    if valid(out) then
      -- Never leave a stale Pure folder visible during asynchronous refresh.
      invalidate_tree(tree, false)
    end
  end
end
local function watch_dependencies(proof)
  for _, file in ipairs(proof and proof.dependencies or {}) do
    if not watchers[file] then
      local watcher = vim.uv.new_fs_event()
      if watcher then
        local ok = watcher:start(file, {}, vim.schedule_wrap(function()
          invalidate()
          M.refresh()
        end))
        if ok == 0 then watchers[file] = watcher else watcher:close() end
      end
    end
  end
end
local function analyse(buf, verify, callback)
  if not is_haskell(buf) then notify('.hsファイルを開いてください。'); return end
  local current_epoch, tick = epoch, vim.api.nvim_buf_get_changedtick(buf)
  local pending = analyses[buf]
  if pending and pending.epoch == epoch and pending.tick == tick then
    if not verify or pending.verify then return end
  end
  local ticket = { epoch = epoch, tick = tick, verify = verify }
  analyses[buf] = ticket
  local root = root_for(buf)
  local payload = { command = verify and 'verify' or 'project', file = vim.api.nvim_buf_get_name(buf), source = source(buf), root = root, ghcPath = options.ghc_path, ghcOptions = options.ghc_options, cacheDir = options.cache_dir or vim.fn.stdpath('cache') .. '/haskell-design', trusted = is_trusted(root), verification = models[buf] and models[buf].verification }
  request(payload, function(model)
    if analyses[buf] ~= ticket then return end
    analyses[buf] = nil
    if not valid(buf) or current_epoch ~= epoch or tick ~= vim.api.nvim_buf_get_changedtick(buf) then return end
    models[buf] = model
    mark(buf, model)
    if model.verification and options.auto_verify == false then watch_dependencies(model.verification) end
    for viewbuf, view in pairs(views) do if view.source == buf and valid(viewbuf) then render(viewbuf, model) end end
    if refresh_trees then refresh_trees() end
    if callback then callback(model) end
  end, function() if analyses[buf] == ticket then analyses[buf] = nil end end)
end
local function write(buf, lines)
  vim.bo[buf].modifiable = true
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].modified = false
end
local function scratch(name, filetype)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_name(buf, name .. ' [' .. buf .. ']')
  vim.bo[buf].buftype = 'nofile'; vim.bo[buf].bufhidden = 'hide'; vim.bo[buf].swapfile = false
  vim.bo[buf].filetype = filetype or 'haskell'
  return buf
end
render = function(buf, model)
  local view = views[buf]
  local lines, mapping = {}, {}
  local function append(text, decl)
    for _, line in ipairs(vim.split(text, '\n', { plain = true })) do
      table.insert(lines, line)
      if decl then mapping[#lines] = decl end
    end
  end
  local indexed = indices[root_for(view.source)]
  local label = model.status == 'unknown' and indexed and indexed.pending and '解析中…' or labels[model.status]
  append('-- HASKELL DESIGN  ·  ' .. model.module .. '  [' .. label .. ']')
  append('-- <CR>/s: ソースを編集   f: フォルダ   za: 実装を開閉   gd: 定義   K: 型・説明   grr: 参照   t: テスト   v: 再確認   d: 差分   e: IOの根拠')
  append('')
  for _, issue in ipairs(model.issues or {}) do append('-- ' .. issue:gsub('\n', '\n-- ')) end
  append(model.header)
  for _, import in ipairs(model.imports) do append(import) end
  append('')
  for _, decl in ipairs(model.declarations) do
    if decl.docs ~= '' then append(decl.docs, decl) end
    append(decl.design, decl)
    if decl.inferred then append('-- ↑ GHC推論型', decl) end
    if view.expanded[decl.id] and decl.implementation ~= '' then append(decl.implementation, decl) end
    append('')
  end
  local win = vim.fn.bufwinid(buf)
  local cursor = win ~= -1 and vim.api.nvim_win_get_cursor(win) or nil
  write(buf, lines); view.mapping = mapping; view.model = model
  if cursor then
    if view.focus_line then
      local row = 1
      for i = 1, #lines do if mapping[i] and mapping[i].line <= view.focus_line then row = i end end
      cursor = { row, 0 }; view.focus_line = nil
    end
    pcall(vim.api.nvim_win_set_cursor, win, { math.min(cursor[1], #lines), cursor[2] })
  end
end
local function selected()
  local view = views[vim.api.nvim_get_current_buf()]
  if not view then return end
  return view, view.mapping[vim.api.nvim_win_get_cursor(0)[1]]
end
local display_options = { 'wrap', 'number', 'relativenumber', 'signcolumn' }
local function restore_window(win)
  local saved = window_options[win]
  if saved and vim.api.nvim_win_is_valid(win) then
    for key, value in pairs(saved) do vim.wo[win][key] = value end
  end
  window_options[win] = nil
end
local function show_buffer(buf, design)
  local win = vim.api.nvim_get_current_win()
  switching = true
  -- :hide preserves dirty source buffers even when 'hidden' is off.
  local ok, err = pcall(vim.cmd, 'keepjumps hide buffer ' .. buf)
  switching = false
  if not ok then error(err) end
  if design then
    if not window_options[win] then
      local saved = {}; for _, key in ipairs(display_options) do saved[key] = vim.wo[win][key] end
      window_options[win] = saved
    end
    vim.wo[win].wrap = false; vim.wo[win].number = false; vim.wo[win].relativenumber = false; vim.wo[win].signcolumn = 'no'
  else restore_window(win) end
end
local function reveal(file, line, as_design)
  local buf = vim.fn.bufadd(file); vim.fn.bufload(buf)
  source_windows[vim.api.nvim_get_current_win()] = buf
  show_buffer(buf, false)
  vim.api.nvim_win_set_cursor(0, { math.max(1, math.min(line, vim.api.nvim_buf_line_count(buf))), 0 })
  vim.cmd('normal! zz')
  if as_design then M.open(line) end
end
function M.source()
  local view, decl = selected()
  if view then reveal(vim.api.nvim_buf_get_name(view.source), decl and decl.line or view.source_line or 1) end
end
-- A design buffer is a projection, never an LSP document. Resolve requests
-- against the real source buffer, including names with inferred signatures.
local function source_position(view, decl, name, encoding)
  if not decl then return end
  local lines = vim.api.nvim_buf_get_lines(view.source, 0, -1, false)
  for _, ref in ipairs(decl.references) do
    if ref.name == name and not ref.inferred then
      local text = lines[ref.line] or ''
      -- web-tree-sitter reports UTF-16 columns; LSP negotiates its encoding.
      local byte = vim.str_byteindex(text, 'utf-16', ref.column, false)
      return { line = ref.line - 1, character = vim.str_utfindex(text, encoding, byte, false) }
    end
  end
  for row = decl.line, math.min(decl.endLine, #lines) do
    local col = lines[row]:find('%f[%w_\128-\255]' .. vim.pesc(name) .. '%f[^%w_\128-\255]')
    if col then return { line = row - 1, character = vim.str_utfindex(lines[row], encoding, col - 1, false) } end
  end
end
local function source_action(action)
  local view, decl = selected()
  if not view or not decl then return end
  local position = source_position(view, decl, vim.fn.expand('<cword>'), 'utf-8')
  reveal(vim.api.nvim_buf_get_name(view.source), position and position.line + 1 or decl.line)
  if position then vim.api.nvim_win_set_cursor(0, { position.line + 1, position.character }) end
  action()
end
function M.open(line)
  if not configured then M.setup() end
  local buf = source_buffer()
  if not is_haskell(buf) then notify('.hsファイルを開いてください。'); return end
  local indexed = indices[root_for(buf)]
  if indexed and not index_nodes[path_key(vim.api.nvim_buf_get_name(buf))] then return end
  source_windows[vim.api.nvim_get_current_win()] = nil
  local source_line = views[vim.api.nvim_get_current_buf()] and 1 or vim.api.nvim_win_get_cursor(0)[1]
  local out
  for viewbuf, view in pairs(views) do if view.source == buf and valid(viewbuf) then out = viewbuf; break end end
  if not out then
    out = scratch('Haskell Design: ' .. vim.fn.fnamemodify(vim.api.nvim_buf_get_name(buf), ':t'))
    views[out] = { source = buf, source_line = source_line, expanded = {}, mapping = {} }
    write(out, { '-- HASKELL DESIGN · 読み込んでいます…', '-- s: ソースを編集' })
    local bind = function(key, fn) vim.keymap.set('n', key, fn, { buffer = out, silent = true }) end
    bind('<CR>', M.source); bind('s', M.source); bind('q', M.source); bind('f', M.files)
    bind('za', function() local view, decl = selected(); if decl then view.expanded[decl.id] = not view.expanded[decl.id]; render(out, view.model) end end)
    bind('gd', function()
      local view, decl = selected(); if not decl then return end
      local name = vim.fn.expand('<cword>')
      local origin = vim.api.nvim_get_current_win()
      local function jump(file, target_line)
        if vim.api.nvim_get_current_win() == origin and vim.api.nvim_get_current_buf() == out then
          vim.cmd("normal! m'")
          reveal(file, target_line, true)
        end
      end
      local function fallback()
        request({ command = 'definition', root = root_for(view.source), file = view.model.file, source = source(view.source), name = name }, function(result)
          if result and result ~= vim.NIL then jump(result.file, result.line) else notify('定義の移動先がありません。外部ライブラリはHLSが型情報だけを返す場合があります。') end
        end)
      end
      local client = vim.lsp.get_clients({ bufnr = view.source, method = 'textDocument/definition' })[1]
      local position = client and source_position(view, decl, name, client.offset_encoding)
      if not position then fallback(); return end
      local done, request_id = false, nil
      local function finish(err, result)
        if done then return end
        done = true
        local location = type(result) == 'table' and (result[1] or (result.uri and result))
        local range = location and (location.targetSelectionRange or location.range)
        if not err and range then jump(vim.uri_to_fname(location.targetUri or location.uri), range.start.line + 1)
        else fallback() end
      end
      local sent
      sent, request_id = client:request('textDocument/definition', {
        textDocument = { uri = vim.uri_from_bufnr(view.source) }, position = position,
      }, function(err, result) vim.schedule(function() finish(err, result) end) end, view.source)
      if not sent then finish(true); return end
      vim.defer_fn(function()
        if not done then client:cancel_request(request_id); finish(true) end
      end, 3000)
    end)
    bind('K', function()
      local view, decl = selected()
      if not decl then return end
      local client = vim.lsp.get_clients({ bufnr = view.source, method = 'textDocument/hover' })[1]
      local position = client and source_position(view, decl, vim.fn.expand('<cword>'), client.offset_encoding)
      if not position then notify('型の詳細表示には、ソースに接続したHLSが必要です。'); return end
      client:request('textDocument/hover', {
        textDocument = { uri = vim.uri_from_bufnr(view.source) }, position = position,
      }, function(err, result)
        vim.schedule(function()
          if vim.api.nvim_get_current_buf() ~= out then return end
          if err or not result or result == vim.NIL or not result.contents then notify('型情報の準備中、または対象がありません。'); return end
          local lines = vim.lsp.util.convert_input_to_markdown_lines(result.contents)
          vim.lsp.util.open_floating_preview(lines, 'markdown', { border = 'rounded', focus_id = 'haskell-design-hover' })
        end)
      end, view.source)
    end)
    bind('grr', function() source_action(vim.lsp.buf.references) end)
    bind('grt', function() source_action(vim.lsp.buf.type_definition) end)
    bind('grn', function() source_action(vim.lsp.buf.rename) end)
    bind('gra', function() source_action(vim.lsp.buf.code_action) end)
    bind('t', M.tests); bind('v', M.verify); bind('d', M.diff); bind('e', M.evidence); bind('r', M.refresh)
    vim.api.nvim_create_autocmd('BufWipeout', { buffer = out, once = true, callback = function() views[out] = nil end })
  end
  views[out].focus_line = line
  show_buffer(out, true)
  local indexed = indices[root_for(buf)]
  local cached = indexed and indexed.designs[path_key(vim.api.nvim_buf_get_name(buf))]
  if cached and cached.sourceHash == vim.fn.sha256(source(buf)) then models[buf] = cached end
  if models[buf] then render(out, models[buf]) end
  analyse(buf, false)
end
function M.verify()
  local buf = source_buffer()
  if not is_haskell(buf) then notify('.hsファイルを開いてください。'); return end
  for _, b in ipairs(vim.api.nvim_list_bufs()) do
    if is_compiler_input(b) and vim.bo[b].modified and root_for(b) == root_for(buf) then notify('コードとプロジェクト設定をすべて保存してから確認してください。'); return end
  end
  local root = root_for(buf)
  if not is_trusted(root) then
    if vim.fn.confirm('GHCをこのプロジェクトで実行します。コンパイラ設定やプラグインを信頼しますか？\n' .. root, '&実行\n&中止', 2) ~= 1 then return end
    trusted_roots[path_key(vim.uv.fs_realpath(root) or root)] = true
    if options.auto_verify then indexing[root] = nil; start_index(root); return end
  end
  notify('GHCで型とIOを確認しています…')
  analyse(buf, true, function(model)
    notify(model.verification and model.verification.error or labels[model.status], model.verification and model.verification.error and vim.log.levels.WARN or vim.log.levels.INFO)
  end)
end
function M.diff()
  local buf = source_buffer()
  if not is_haskell(buf) then notify('.hsファイルを開いてください。'); return end
  local file = vim.api.nvim_buf_get_name(buf)
  request({ command = 'diff', root = root_for(buf), file = file, source = source(buf) }, function(result)
    vim.cmd('tabnew')
    local left = scratch('設計: ' .. result.baseline)
    vim.b[left].haskell_design_source_path = file
    vim.api.nvim_win_set_buf(0, left); write(left, vim.split(result.before.text, '\n', { plain = true })); vim.cmd('diffthis')
    vim.cmd('rightbelow vsplit')
    local right = scratch('設計: 現在')
    vim.b[right].haskell_design_source_path = file
    vim.api.nvim_win_set_buf(0, right); write(right, vim.split(result.after.text, '\n', { plain = true })); vim.cmd('diffthis')
    if not result.changed then notify(result.implementationChanged and '宣言の差分はありません。実装には変更があります。' or '変更はありません。') end
    if #result.unresolved > 0 then notify('型署名のない定義は、型の変化を比較できません: ' .. table.concat(result.unresolved, ', '), vim.log.levels.WARN) end
  end)
end
function M.tests()
  local view, decl = selected(); if not decl then return end
  request({ command = 'related', root = root_for(view.source), names = decl.names }, function(hits)
    local items = {}
    for _, hit in ipairs(hits) do table.insert(items, { filename = hit.file, lnum = hit.line, text = hit.text }) end
    if #items == 0 then notify('参照するテスト・性質の候補は見つかりませんでした。'); return end
    vim.fn.setqflist({}, ' ', { title = 'Haskell Design: テスト・性質の候補', items = items }); vim.cmd('copen')
  end)
end
function M.evidence()
  local view = views[vim.api.nvim_get_current_buf()]
  local model = view and view.model or models[source_buffer()]
  if not model then return end
  local items = {}
  for _, evidence in ipairs(model.evidence) do table.insert(items, { filename = model.file, lnum = evidence.line, text = evidence.name .. ': ' .. evidence.reason .. (evidence.type and ' · ' .. evidence.type or '') }) end
  if #items == 0 then notify(labels[model.status]); return end
  vim.fn.setqflist({}, ' ', { title = 'Haskell Design: IOが見つかった場所', items = items }); vim.cmd('copen')
end
local short_labels = { pure = 'Pure', io = 'IO', unknown = '—' }
local function summary_label(summary)
  local parts = {}
  for _, status in ipairs({ 'io', 'unknown', 'pure' }) do
    local count = summary.counts[status] or 0
    if count > 0 then table.insert(parts, (status == 'unknown' and '未解析' or short_labels[status]) .. ' ' .. count) end
  end
  if not summary.complete then table.insert(parts, '走査途中') end
  return table.concat(parts, ' · ')
end
local function refresh_tree(out)
  local tree = tree_views[out]
  if not tree or not valid(out) then return end
  tree.ticket = (tree.ticket or 0) + 1
  local ticket, current_epoch = tree.ticket, epoch
  local proofs, sources = {}, {}
  for _, model in pairs(models) do if model.verification then proofs[model.file] = model.verification end end
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if is_haskell(buf) and vim.api.nvim_buf_is_loaded(buf) and vim.bo[buf].modified then sources[vim.api.nvim_buf_get_name(buf)] = source(buf) end
  end
  request({ command = 'files', root = tree.root, maxFiles = options.max_files, verifications = proofs, sources = sources }, function(result)
    if not valid(out) or tree.ticket ~= ticket or current_epoch ~= epoch then return end
    tree.tree = result.tree; tree.render()
  end, function()
    if not valid(out) or tree.ticket ~= ticket or current_epoch ~= epoch then return end
    tree.error = 'フォルダを読み込めません。r で再試行できます。'
    invalidate_tree(tree, true)
  end)
end
refresh_trees = function()
  for out in pairs(tree_views) do if valid(out) and vim.fn.bufwinid(out) ~= -1 then refresh_tree(out) end end
end
function M.files()
  local origin = vim.api.nvim_get_current_buf()
  local win = vim.api.nvim_get_current_win()
  local root = tree_views[origin] and tree_views[origin].root or root_for(source_buffer())
  local out
  for b, tree in pairs(tree_views) do if valid(b) and tree.root == root then out = b; break end end
  if not out then
    out = scratch('Haskell Design: フォルダ', '')
    local tree = { root = root, origins = {}, expanded = { [root] = true }, mapping = {} }
    tree_views[out] = tree
    tree.render = function()
      local lines = { 'HASKELL DESIGN  ·  フォルダ内のHaskell', '<CR>/za: 開く・開閉   r: 更新   q: 戻る', '' }
      tree.mapping = {}
      local function append(node, depth)
        local folder = node.kind == 'folder'
        local prefix = folder and (tree.expanded[path_key(node.file)] and '▾ ' or '▸ ') or '  '
        table.insert(lines, string.rep('  ', depth) .. prefix .. node.name .. (folder and '/' or '') .. '  [' .. (folder and summary_label(node.summary) or short_labels[node.summary.status]) .. ']')
        tree.mapping[#lines] = node
        if folder and tree.expanded[path_key(node.file)] then for _, child in ipairs(node.children) do append(child, depth + 1) end end
      end
      if tree.tree then append(tree.tree, 0) else table.insert(lines, tree.error or '読み込んでいます…') end
      local win = vim.fn.bufwinid(out)
      local cursor = win ~= -1 and vim.api.nvim_win_get_cursor(win) or nil
      write(out, lines)
      if cursor then pcall(vim.api.nvim_win_set_cursor, win, { math.min(cursor[1], #lines), cursor[2] }) end
    end
    local function enter()
      local node = tree.mapping[vim.api.nvim_win_get_cursor(0)[1]]
      if not node then return end
      if node.kind == 'folder' then tree.expanded[path_key(node.file)] = not tree.expanded[path_key(node.file)]; tree.render()
      else reveal(node.file, 1, true) end
    end
    vim.keymap.set('n', '<CR>', enter, { buffer = out, silent = true })
    vim.keymap.set('n', 'za', enter, { buffer = out, silent = true })
    vim.keymap.set('n', 'r', M.refresh, { buffer = out, silent = true })
    vim.keymap.set('n', 'q', function()
      local previous = tree.origins[vim.api.nvim_get_current_win()]
      -- A native split copies the window's alternate buffer, not our origins.
      if not previous or not valid(previous) then previous = vim.fn.bufnr('#') end
      if previous > 0 and previous ~= out and valid(previous) then show_buffer(previous, views[previous] ~= nil) end
    end, { buffer = out, silent = true })
    vim.api.nvim_create_autocmd('BufWipeout', { buffer = out, once = true, callback = function() tree_views[out] = nil end })
  end
  if origin ~= out then tree_views[out].origins[win] = origin end
  tree_views[out].render(); show_buffer(out, true); refresh_tree(out)
end
function M.refresh()
  local seen = {}
  for out, view in pairs(views) do if valid(out) and vim.fn.bufwinid(out) ~= -1 and valid(view.source) and not seen[view.source] then seen[view.source] = true; analyse(view.source, false) end end
  local buf = source_buffer()
  if is_haskell(buf) and not seen[buf] then analyse(buf, false) end
  refresh_trees()
end
function M.status(buf) return models[buf or source_buffer()] and labels[models[buf or source_buffer()].status] or '— 未解析' end
-- File explorers and other path-based integrations must resolve the projection
-- to its source; the scratch buffer name is a title, not a filesystem path.
function M.source_path(buf)
  buf = buf or vim.api.nvim_get_current_buf()
  if views[buf] and valid(views[buf].source) then return vim.api.nvim_buf_get_name(views[buf].source) end
  if valid(buf) and vim.b[buf].haskell_design_source_path then return vim.b[buf].haskell_design_source_path end
  local tree = tree_views[buf]
  if tree then
    local node = buf == vim.api.nvim_get_current_buf() and tree.mapping[vim.api.nvim_win_get_cursor(0)[1]] or nil
    return node and node.file or tree.root
  end
  return valid(buf) and vim.api.nvim_buf_get_name(buf) or ''
end
local mini_namespace = vim.api.nvim_create_namespace('haskell-design-mini-files')
local function decorate_mini(buf)
  if not valid(buf) or vim.bo[buf].filetype ~= 'minifiles' then return end
  local mini = package.loaded['mini.files']
  if not mini then return end
  vim.api.nvim_buf_clear_namespace(buf, mini_namespace, 0, -1)
  for row = 1, vim.api.nvim_buf_line_count(buf) do
    local entry = mini.get_fs_entry(buf, row)
    local node = entry and index_nodes[path_key(entry.path)]
    if node and node.summary.total > 0 then
      local status = node.summary.status
      local label = status == 'unknown' and node.pending and '…' or ({ pure = 'Pure', io = 'IO', unknown = '—' })[status]
      vim.api.nvim_buf_set_extmark(buf, mini_namespace, row - 1, 0, { virt_text = { { label, status == 'pure' and 'DiagnosticOk' or status == 'io' and 'DiagnosticWarn' or 'Comment' } }, virt_text_pos = 'right_align' })
    end
  end
end
start_index = function(root)
  if options.auto_verify == false or indexing[root] then return end
  indexing[root] = true
  local sources = {}
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_loaded(buf) and vim.bo[buf].modified and is_compiler_input(buf) and root_for(buf) == root then sources[vim.api.nvim_buf_get_name(buf)] = source(buf) end
  end
  request({ command = 'watch', root = root, trusted = is_trusted(root), autoVerify = true,
    ghcPath = options.ghc_path, ghcOptions = options.ghc_options, maxFiles = options.max_files,
    sources = sources,
    cacheDir = options.cache_dir or vim.fn.stdpath('cache') .. '/haskell-design' }, function() end,
    function() indexing[root] = nil end)
end
on_audit = function(snapshot)
  snapshot.root = path_key(snapshot.root)
  local designs = {}
  for file, design in pairs(snapshot.designs) do designs[path_key(file)] = design end
  snapshot.designs = designs
  indices[snapshot.root] = snapshot
  index_nodes = {}
  local function collect(node, pending) node.pending = pending; index_nodes[path_key(node.file)] = node; for _, child in ipairs(node.children) do collect(child, pending) end end
  for _, indexed in pairs(indices) do collect(indexed.tree, indexed.pending) end
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if valid(buf) and vim.api.nvim_buf_is_loaded(buf) then
      local design = snapshot.designs[path_key(vim.api.nvim_buf_get_name(buf))]
      if design and design.sourceHash == vim.fn.sha256(source(buf)) then
        models[buf] = design; mark(buf, design)
        for out, view in pairs(views) do if view.source == buf and valid(out) then render(out, design) end end
      end
      decorate_mini(buf)
    end
  end
  for out, tree in pairs(tree_views) do if tree.root == snapshot.root and valid(out) then tree.tree = snapshot.tree; tree.render() end end
  if enter_design then enter_design() end
end
function M.file_status(file)
  local node = index_nodes[path_key(file)]
  return node and node.summary.total > 0 and node.summary.status or nil
end
M.indices = indices
function M.setup(opts)
  options = vim.tbl_deep_extend('force', options, opts or {})
  if configured then if opts then invalidate() end; return end
  configured = true
  for _, root in ipairs(options.trusted_roots or {}) do trusted_roots[path_key(vim.uv.fs_realpath(root) or root)] = true end
  local group = vim.api.nvim_create_augroup('HaskellDesign', { clear = true })
  vim.api.nvim_create_autocmd({ 'TextChanged', 'TextChangedI' }, { group = group, pattern = input_patterns, callback = function()
    local b = source_buffer()
    if options.auto_verify and is_haskell(b) and indices[root_for(b)] and not index_nodes[path_key(vim.api.nvim_buf_get_name(b))] then return end
    if options.auto_verify then request({ command = 'dirty', root = root_for(b), file = vim.api.nvim_buf_get_name(b), source = vim.bo[b].modified and source(b) or nil }, function() end) end
    invalidate(); local ticket = epoch
    vim.defer_fn(function() if ticket == epoch then M.refresh() end end, 180)
  end })
  vim.api.nvim_create_autocmd('BufWritePost', { group = group, pattern = input_patterns, callback = function()
    invalidate(); M.refresh()
    local b = source_buffer()
    if options.auto_verify then request({ command = 'dirty', root = root_for(b), file = vim.api.nvim_buf_get_name(b) }, function() end) end
  end })
  local function enter()
    if switching then return end
    local win, buf = vim.api.nvim_get_current_win(), vim.api.nvim_get_current_buf()
    if not views[buf] and not tree_views[buf] then restore_window(win) end
    if source_windows[win] ~= buf then source_windows[win] = nil end
    start_index(root_for(buf))
    if options.auto_verify and (not indices[root_for(buf)] or not index_nodes[path_key(vim.api.nvim_buf_get_name(buf))]) then return end
    if not options.design_first or not is_haskell(buf) or vim.wo[win].diff or source_windows[win] == buf then return end
    vim.schedule(function()
      if vim.api.nvim_win_is_valid(win) and vim.api.nvim_get_current_win() == win and vim.api.nvim_get_current_buf() == buf and not vim.wo[win].diff and source_windows[win] ~= buf then M.open() end
    end)
  end
  enter_design = enter
  vim.api.nvim_create_autocmd({ 'BufEnter', 'BufWinEnter' }, { group = group, callback = enter })
  vim.api.nvim_create_autocmd({ 'BufUnload', 'BufWipeout' }, { group = group, callback = function(event)
    -- :bdelete! and :bunload! discard changes without wiping the buffer id.
    -- Hiding a still-loaded buffer must keep its unsaved overlay instead.
    if options.auto_verify and is_compiler_input(event.buf) then request({ command = 'dirty', root = root_for(event.buf), file = vim.api.nvim_buf_get_name(event.buf) }, function() end) end
    models[event.buf] = nil; analyses[event.buf] = nil
    for out, view in pairs(views) do if view.source == event.buf and valid(out) then vim.api.nvim_buf_delete(out, { force = true }) end end
  end })
  -- Lazy-loading by FileType happens after BufEnter on the first file.
  vim.schedule(enter)
  vim.api.nvim_create_autocmd('User', { group = group, pattern = { 'MiniFilesBufferCreate', 'MiniFilesBufferUpdate' }, callback = function(event) decorate_mini(event.data.buf_id) end })
  vim.api.nvim_create_autocmd('DirChanged', { group = group, callback = function() start_index(root_for(source_buffer())) end })
  vim.api.nvim_create_autocmd('FocusGained', { group = group, callback = function()
    if options.auto_verify then for root in pairs(indexing) do request({ command = 'refresh-index', root = root }, function() end) end else M.refresh() end
  end })
  vim.api.nvim_create_autocmd('VimLeavePre', { group = group, callback = function()
    for watcher in pairs(watchers) do watchers[watcher]:stop(); watchers[watcher]:close() end
    if rpc_job then vim.fn.chanclose(rpc_job, 'stdin') end
    for job in pairs(jobs) do job:kill(15) end
  end })
end
-- Exposed state is useful for statuslines and deterministic editor integration tests.
M.models, M.views, M.tree_views = models, views, tree_views
return M
