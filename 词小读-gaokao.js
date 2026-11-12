(() => {
  const source = window.CX_GAOKAO_VOCAB;
  if (!source?.records) return;
  const words = new Map();
  source.records.forEach(([word, level, display]) => {
    const previous = words.get(word);
    if (!previous || level < previous.level) words.set(word, {word, level, display});
  });
  function findWord(value) {
    const key = value.toLocaleLowerCase().trim().replace(/[?？!！。]+$/g, '');
    return words.get(key) || words.get(source.aliases?.[key]);
  }
  function label(record) {
    return ['新高考词汇 · 基础', '新高考词汇 · 必修', '新高考词汇 · 选择性必修'][record.level];
  }
  function markCard(word) {
    const record = findWord(word); if (!record) return;
    const reply = $('#messages').lastElementChild?.querySelector('.reply'); if (!reply) return;
    const old = [...reply.querySelectorAll('small')].find(item => item.textContent === '词库标注：高考词汇');
    const badge = old || el('small'); badge.textContent = label(record); badge.className = 'gaokao-badge level-' + record.level;
    if (!old) reply.querySelector('.word-head')?.after(badge);
    reply.dataset.gaokaoLevel = String(record.level);
  }
  const previousRenderWord = renderWord;
  renderWord = function(word, data, local) { previousRenderWord(word, data, local); markCard(word); };
  const previousSubmit = submit;
  submit = async function(raw) {
    const text = raw.trim(); const record = findWord(text);
    if (currentMode !== 'word' || !record || !/\s|\.|-/.test(record.word)) return previousSubmit(raw);
    if (busy) return; busy = true; const token = requestGeneration;
    add(text, true); $('#input').value = ''; $('#input').style.height = '38px';
    try { await lookup(record.word, token); }
    finally { if (token === requestGeneration) busy = false; scroll(); }
  };
  window.CX_GAOKAO_TEST = {findWord, rowCount: source.records.length, uniqueCount: words.size};
})();
