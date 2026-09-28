-- Run with the bundled profile; only unsaved buffers are edited.
local root = vim.fs.normalize(vim.fn.fnamemodify(vim.fs.joinpath(vim.fs.dirname(debug.getinfo(1, 'S').source:sub(2)), '..'), ':p')):gsub('/$', '')
local output = root .. '/.runtime/haskell-editor'
vim.fn.mkdir(output, 'p')
local report = { checks = {}, notifications = {} }
-- Never wait for an interactive retry prompt in a headless verification.
vim.lsp.handlers['window/showMessageRequest'] = function(_, message)
  table.insert(report.notifications, { message = vim.inspect(message) })
  return vim.NIL
end
local old_notify = vim.notify
vim.notify = function(msg, level, opts)
  table.insert(report.notifications, {message=tostring(msg), level=level})
  old_notify(msg, level, opts)
end
local function check(name, value)
  table.insert(report.checks, {name=name, passed=not not value})
  vim.fn.writefile({vim.json.encode(report)}, output .. '/neovim-verification.json')
  assert(value, name)
  print('PASS ' .. name)
end
local function norm(s) return vim.fs.normalize(s):lower() end
local hd, client
local function focus_source(file)
  vim.cmd.edit(root .. '/' .. file)
  local buf = vim.fn.bufnr(root .. '/' .. file)
  hd.open()
  hd.source()
  return buf
end
local function find(buf, pattern, word)
  for i, line in ipairs(vim.api.nvim_buf_get_lines(buf, 0, -1, false)) do
    if line:match(pattern) then return {line=i-1, character=assert(line:find(word, 1, true))-1} end
  end
  error('Not found: ' .. pattern .. ' / ' .. word)
end
local function request(buf, method, pos, extra, timeout)
  assert(vim.wait(15000,function()return vim.lsp.buf_is_attached(buf,client.id) end,50),'buffer did not attach')
  local params = vim.tbl_extend('force', {textDocument={uri=vim.uri_from_bufnr(buf)}, position=pos}, extra or {})
  local done, result, request_error = false, nil, nil
  local sent = client:request(method, params, function(err, value) result=value; request_error=err; done=true end, buf)
  assert(sent, 'request not sent: ' .. method)
  assert(vim.wait(timeout or 45000, function() return done end, 50), 'request timeout: ' .. method)
  assert(not request_error, vim.inspect(request_error))
  return result
end
local function invoke(key)
  local map = vim.fn.maparg(key, 'n', false, true)
  assert(type(map.callback)=='function', 'missing mapping ' .. key)
  map.callback()
end
local function design(file)
  focus_source(file)
  hd.open()
  check('design ready ' .. file, vim.wait(15000, function()
    local v = hd.views[vim.api.nvim_get_current_buf()]
    return v and v.model and norm(hd.source_path())==norm(root .. '/' .. file)
  end, 50))
end
local ok, err = xpcall(function()
  vim.cmd.edit(root .. '/src/Garden/Rules.hs')
  hd = require('haskell-design')
  local src = focus_source('src/Garden/Rules.hs')
  check('HLS attached to actual source', vim.wait(60000, function()
    client=vim.lsp.get_clients({name='afterlight_hls',bufnr=src})[1]
    return client and client.initialized
  end, 100))
  report.client={root=client.config.root_dir, capabilities=client.server_capabilities,server_info=client.server_info}
  local pos = find(src, '^advance ::', 'World')
  local hover = request(src, 'textDocument/hover', pos, nil, 180000)
  report.hover=hover
  check('HLS hover resolves World', type(hover)=='table' and vim.inspect(hover):find('World',1,true))
  hd.source()
  check('source gd mapped to LSP', vim.fn.maparg('gd','n',false,true).desc == 'HLS: Definition')
  local definitions=request(src,'textDocument/definition',pos)
  report.definitions=definitions
  check('LSP definition finds Types.hs', vim.inspect(definitions):find('Types.hs',1,true))
  local refs=request(src,'textDocument/references',pos,{context={includeDeclaration=true}})
  report.reference_count=type(refs)=='table' and #refs or 0
  check('references span the real project',report.reference_count>2)
  local completion=request(src,'textDocument/completion',{line=pos.line,character=pos.character+3},{context={triggerKind=1}})
  local items=completion and (completion.items or completion) or {}
  report.completion_count=#items
  check('completion offers World', vim.inspect(items):find('World',1,true))
  local symbols=request(src,'textDocument/documentSymbol')
  check('document symbols include advance',vim.inspect(symbols):find('advance',1,true))
  local formatted=request(src,'textDocument/formatting',nil,{options={tabSize=2,insertSpaces=true}})
  report.format_edit_count=type(formatted)=='table' and #formatted or 0
  check('Ormolu returns formatting edits', report.format_edit_count>0)
  local renamed=request(src,'textDocument/rename',find(src,'^movement ::','movement'),{newName='movementIdeProbe'})
  report.rename_file_count=type(renamed)=='table' and (renamed.changes and vim.tbl_count(renamed.changes) or #(renamed.documentChanges or {})) or 0
  check('local rename returns an edit without applying it',type(renamed)=='table' and (renamed.changes or renamed.documentChanges))
  if vim.fn.has('win32') == 1 then
  local blocked,block_error=false,nil
  client:request('textDocument/rename',{textDocument={uri=vim.uri_from_bufnr(src)},position=find(src,'^advance ::','advance'),newName='advanceIdeProbe'},function(e) block_error=e;blocked=true end,src)
  check('exported rename is rejected to prevent incomplete edits',vim.wait(30000,function()return blocked end,50) and block_error and block_error.message:find('unsupported',1,true))
  end
  vim.api.nvim_win_set_cursor(0,{pos.line+1,pos.character})
  invoke('gd')
  check('source gd actually navigates',vim.wait(15000,function() return norm(hd.source_path()):find('/garden/types.hs',1,true) end,50))
  design('src/Garden/Rules.hs')
  local dpos=find(0,'^advance ::','World')
  vim.api.nvim_win_set_cursor(0,{dpos.line+1,dpos.character})
  invoke('K')
  check('design K opens real type information',vim.wait(10000,function()
    for _,win in ipairs(vim.api.nvim_list_wins()) do
      if vim.api.nvim_win_get_config(win).relative~='' then
        local text=table.concat(vim.api.nvim_buf_get_lines(vim.api.nvim_win_get_buf(win),0,-1,false),'\n')
        if text:find('World',1,true) then vim.api.nvim_win_close(win,true); return true end
      end
    end
    return false
  end,50))
  invoke('gd')
  check('design gd actually navigates',vim.wait(10000,function() return norm(hd.source_path()):find('/garden/types.hs',1,true) end,50))
  vim.cmd('normal! ' .. string.char(15))
  check('Ctrl-o returns to prior design',norm(hd.source_path()):find('/garden/rules.hs',1,true))
  -- Temporarily introduce a real type error in memory, then restore it unsaved.
  src=focus_source('src/Garden/Rules.hs')
  local saved=vim.api.nvim_buf_get_lines(src,0,-1,false)
  vim.api.nvim_buf_set_lines(src,-1,-1,false,{'','ideDiagnosticProbe :: Int','ideDiagnosticProbe = "not an Int"'})
  vim.api.nvim_exec_autocmds('TextChanged',{buffer=src})
  check('live type error is diagnosed',vim.wait(30000,function()
    for _,d in ipairs(vim.diagnostic.get(src,{severity=vim.diagnostic.severity.ERROR})) do
      if d.message:find('Int',1,true) then report.type_error=d.message; return true end
    end
  end,100))
  local error_diagnostics=vim.diagnostic.get(src,{severity=vim.diagnostic.severity.ERROR})
  local action_range=error_diagnostics[1].user_data.lsp.range
  local actions=request(src,'textDocument/codeAction',nil,{range=action_range,context={diagnostics={error_diagnostics[1].user_data.lsp}}})
  report.code_action_count=type(actions)=='table' and #actions or 0
  check('code actions are offered for the type error',report.code_action_count>0)
  vim.api.nvim_buf_set_lines(src,0,-1,false,saved)
  vim.bo[src].modified=false
  vim.api.nvim_exec_autocmds('TextChanged',{buffer=src})
  check('diagnostic clears after correction',vim.wait(30000,function() return #vim.diagnostic.get(src,{severity=vim.diagnostic.severity.ERROR})==0 end,100))
  local render=focus_source('src/Garden/Render.hs')
  local rh=request(render,'textDocument/hover',find(render,'^renderScene ::','Resources'),nil,90000)
  check('native renderer with CPP loads through HLS',type(rh)=='table' and vim.inspect(rh):find('Resources',1,true))
  report.render_errors=vim.diagnostic.get(render,{severity=vim.diagnostic.severity.ERROR})
  check('native renderer has no type errors',#report.render_errors==0)
  local tool=focus_source('tools/GardenCheck.hs')
  local th=request(tool,'textDocument/documentSymbol',nil,nil,90000)
  check('test component loads through HLS',type(th)=='table' and #th>0)
  check('test component has no type errors',#vim.diagnostic.get(tool,{severity=vim.diagnostic.severity.ERROR})==0)
  local signal=focus_source('src/Garden/Signal.hs')
  local sf=find(signal,'^lightEnvelope ::','SF')
  report.library_hover=request(signal,'textDocument/hover',sf)
  check('dependency type information is available',type(report.library_hover)=='table' and vim.inspect(report.library_hover):find('SF',1,true))
  report.library_definition=request(signal,'textDocument/definition',sf)
  local loc=type(report.library_definition)=='table' and report.library_definition[1]
  report.library_source_available=loc and vim.uv.fs_stat(vim.uri_to_fname(loc.uri or loc.targetUri))~=nil or false
  -- HLS failure must retain project-local navigation.
  design('src/Garden/Rules.hs')
  dpos=find(0,'^advance ::','World'); vim.api.nvim_win_set_cursor(0,{dpos.line+1,dpos.character})
  local real_request=client.request
  client.request=function(self,method,params,callback,buf)
    if method=='textDocument/definition' then vim.schedule(function() callback({message='test rejection'},nil) end); return true,0 end
    return real_request(self,method,params,callback,buf)
  end
  invoke('gd')
  check('design fallback works when HLS rejects a request',vim.wait(10000,function() return norm(hd.source_path()):find('/garden/types.hs',1,true) end,50))
  client.request=real_request
  report.result='PASS'
end,debug.traceback)
if not ok then report.result='FAIL';report.error=err;print(err) end
report.messages=vim.api.nvim_exec2('messages',{output=true}).output
vim.fn.writefile({vim.json.encode(report)},output .. '/neovim-verification.json')
vim.cmd(ok and 'qa!' or 'cquit!')
