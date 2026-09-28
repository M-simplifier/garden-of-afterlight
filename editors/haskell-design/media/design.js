/* All workspace content enters the DOM through text nodes, never innerHTML. */
(() => {
  const api = acquireVsCodeApi();
  const state = api.getState() || { expanded: {}, scroll: 0 };
  const app = document.getElementById('app');
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const send = (type, extra = {}) => api.postMessage({ type, ...extra });
  const button = (label, type, extra, className) => {
    const b = el('button', label, className);
    b.addEventListener('click', () => send(type, extra));
    return b;
  };
  const disclosure = (title, id) => {
    const d = el('details'); d.open = !!state.expanded[id];
    d.append(el('summary', title));
    d.addEventListener('toggle', () => { state.expanded[id] = d.open; api.setState(state); });
    return d;
  };
  const renderCode = decl => {
    const code = el('pre', undefined, 'code');
    for (const token of decl.design.split(/(\b[A-Z][\w']*\b|\b(?:data|newtype|type|class|instance|where|deriving|forall|pattern|module|import)\b)/g)) {
      const ref = decl.references.findIndex(r => r.name === token);
      if (/^[A-Z]/.test(token) && ref >= 0) code.append(button(token, 'definition', { id: decl.id, reference: ref }, 'type-link'));
      else if (/^(data|newtype|type|class|instance|where|deriving|forall|pattern|module|import)$/.test(token)) code.append(el('span', token, 'keyword'));
      else code.append(document.createTextNode(token));
    }
    return code;
  };
  const labels = { pure: 'Pure · IOの使用は見つかりません', io: 'IO · IOに関わる定義あり', unknown: '— 未解析' };
  const kinds = { signature: 'FUNCTION', data_type: 'DATA', newtype: 'NEWTYPE', type_synomym: 'TYPE ALIAS', class: 'CLASS', instance: 'INSTANCE', pragma: 'LANGUAGE' };
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'error') { app.replaceChildren(el('p', message.error, 'notice')); return; }
    if (message.type !== 'model') return;
    const design = message.design;
    const fragment = document.createDocumentFragment();
    const header = el('header');
    header.append(el('div', 'HASKELL DESIGN', 'eyebrow'), el('h1', design.module));
    const meta = el('div', undefined, 'meta');
    meta.append(el('span', design.status === 'unknown' && message.pending ? '解析中…' : labels[design.status], 'badge ' + design.status), el('span', message.path)); header.append(meta);
    const toolbar = el('div', undefined, 'toolbar');
    const diff = button('設計の差分', 'diff'); diff.disabled = !message.trusted;
    toolbar.append(button('ソースを編集', 'source', {}, 'primary'), diff);
    if (!message.automatic || design.verification?.error) { const verify = button('再確認', 'verify'); verify.disabled = !message.trusted; toolbar.append(verify); }
    header.append(toolbar); fragment.append(header);
    if (!design.verified && message.pending) fragment.append(el('p', '型とIOを自動で確認しています…', 'notice'));
    else if (!design.verified && !message.trusted) fragment.append(el('p', 'ワークスペースが信頼されると、型とIOを自動で確認します。', 'notice'));
    if (design.evidence.length) {
      const evidence = disclosure(`IOが見つかった場所 · ${design.evidence.length}件`, 'evidence'); evidence.className = 'evidence';
      for (const e of design.evidence) {
        const b = button(`${e.line}行目 · ${e.name} — ${e.reason}`, 'evidence', { line: e.line });
        b.title = e.type || ''; evidence.append(b);
      }
      fragment.append(evidence);
    }
    for (const issue of design.issues) fragment.append(el('p', issue, 'notice'));
    if (design.header || design.imports.length) {
      const imports = disclosure('モジュールとインポート', 'imports');
      imports.append(el('pre', [design.header, ...design.imports].join('\n'), 'code implementation')); fragment.append(imports);
    }
    let focus;
    for (const decl of design.declarations) {
      const section = el('section', undefined, 'declaration'); section.dataset.id = decl.id;
      if (message.focus && decl.line <= message.focus.line) focus = section;
      section.append(el('div', `${kinds[decl.kind] || decl.kind.toUpperCase()}${decl.inferred ? ' · GHC推論' : ''}`, 'kind'));
      if (decl.docs) section.append(el('p', decl.docs.replace(/^\s*--\s*[|^]?\s?/gm, ''), 'docs'));
      section.append(renderCode(decl));
      const actions = el('div', undefined, 'actions');
      actions.append(button(`${decl.line}行目のソース`, 'declaration', { id: decl.id }));
      if (decl.names.length) actions.append(button('関連するテスト・性質', 'tests', { id: decl.id }));
      section.append(actions);
      if (decl.implementation) {
        const impl = disclosure('実装を表示', decl.id);
        impl.append(el('pre', decl.implementation, 'code implementation')); section.append(impl);
      }
      fragment.append(section);
    }
    if (!design.declarations.length) fragment.append(el('p', '表示できる宣言がありません。', 'empty'));
    fragment.append(el('p', '型名を選ぶと定義へ移動します。IO / Pureは、このファイルでIOの使用が見つかるかを示します。', 'footer'));
    app.replaceChildren(fragment);
    requestAnimationFrame(() => {
      if (message.focus && message.focus.token !== state.focusToken) {
        state.focusToken = message.focus.token;
        if (focus) focus.scrollIntoView({ block: 'start' });
        api.setState(state);
      } else window.scrollTo(0, state.scroll || 0);
    });
  });
  window.addEventListener('scroll', () => { state.scroll = window.scrollY; api.setState(state); }, { passive: true });
  send('ready');
})();
