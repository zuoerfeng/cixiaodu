(() => {
  const volumes = ["必修第一册", "必修第二册", "必修第三册", "选择性必修第一册", "选择性必修第二册", "选择性必修第三册", "选择性必修第四册"];
  const textbookBooks = (window.CX_TEXTBOOKS || []).flatMap(textbook => textbook.units.flatMap(unit => unit.readings.map((reading,readingIndex) => ({
    ...reading, ...(window.CX_TEXTBOOK_AUDIO?.[textbook.id + '|' + unit.number + '|' + readingIndex] || {}),
    builtIn: true,
    volume: textbook.volume,
    edition: textbook.edition,
    unit: unit.number === 'Welcome Unit' ? 'Welcome Unit' : 'Unit ' + unit.number + ' · ' + unit.title,
    unitNumber: unit.number,
    vocabIndex: unit.vocabIndex,
    textbookId: textbook.id,
  }))));
  let followPreference = false, gapPreference = 5;
  let activeTextbookAudio = null;
  const stopWithoutTextbookAudio = stop;
  stop = function() {
    if (activeTextbookAudio) { activeTextbookAudio.pause(); activeTextbookAudio.currentTime = 0; activeTextbookAudio = null; }
    stopWithoutTextbookAudio();
  };
  try { const settings = JSON.parse(localStorage.getItem('cx-follow-settings') || '{}'); followPreference = settings.follow === true; if ([3,5,8,12,20].includes(settings.gap)) gapPreference = settings.gap; } catch {}
  function saveFollowSettings(follow, gap) { followPreference = follow; gapPreference = gap; try { localStorage.setItem('cx-follow-settings', JSON.stringify({follow, gap})); } catch {} }
  let metadata = {};
  try { metadata = JSON.parse(localStorage.getItem('cx-reading-metadata') || '{}'); } catch {}
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {};
  let textCorrections = {};
  try { textCorrections = JSON.parse(localStorage.getItem('cx-textbook-corrections') || '{}'); } catch {}
  if (!textCorrections || typeof textCorrections !== 'object' || Array.isArray(textCorrections)) textCorrections = {};
  const library = el('dialog', undefined, 'reading-library');
  document.body.append(library);
  const importer = el('dialog', undefined, 'reading-library');
  document.body.append(importer);
  function dialogHead(dialog, title) {
    const head = el('div', undefined, 'reading-library-head');
    const close = button('×', () => dialog.close());
    close.title = '关闭'; close.setAttribute('aria-label', '关闭');
    head.append(el('h2', title), close);
    return head;
  }
  function volumeSelect(includeAll = false) {
    const select = el('select');
    const values = includeAll ? ['全部课文', ...volumes, '其他课文'] : [...volumes, '其他课文'];
    values.forEach(value => { const option = el('option', value); option.value = value; select.append(option); });
    return select;
  }
  function openLibrary() {
    library.replaceChildren(dialogHead(library, '选择课文'));
    const label = el('label', '人教版 · 册别');
    const select = volumeSelect(true); select.id = 'reading-volume-filter'; label.htmlFor = select.id;
    const list = el('div', undefined, 'reading-book-list');
    function draw() {
      list.replaceChildren();
      const builtIns = textbookBooks.filter(book => select.value === '全部课文' || book.volume === select.value);
      let lastUnit = '';
      builtIns.forEach(book => {
        const unitKey = book.volume + '|' + book.unit;
        if (unitKey !== lastUnit) {
          const heading = select.value === '全部课文' ? book.volume + ' · ' + book.unit : book.unit;
          const group = el('div', heading, 'reading-unit-heading');
          list.append(group); lastUnit = unitKey;
        }
        const row = el('div', undefined, 'reading-book-row reading-built-in');
        const info = el('div');
        info.append(el('strong', book.title), el('small', book.type));
        row.append(info, button('打开', () => { library.close(); openBook(book); }));
        list.append(row);
      });
      const items = books.filter(book => select.value === '全部课文' || (metadata[book.title]?.volume || '其他课文') === select.value);
      items.forEach(book => {
        const row = el('div', undefined, 'reading-book-row');
        const info = el('div'); const meta = metadata[book.title];
        info.append(el('strong', book.title), el('small', [meta?.volume || '其他课文', meta?.unit].filter(Boolean).join(' · ')));
        row.append(info, button('打开', () => { library.close(); openBook(book); }));
        list.append(row);
      });
      if (['全部课文', '选择性必修第一册'].includes(select.value) && !books.some(book => metadata[book.title]?.unit === 'Unit 5 · Working the Land')) {
        const row = el('div', undefined, 'reading-book-row'); const info = el('div');
        info.append(el('strong', 'Unit 5 · Working the Land'), el('small', '选择性必修第一册 · 待导入课文正文'));
        row.append(info, button('导入正文', () => { library.close(); openImport('', 'Working the Land', '选择性必修第一册', 'Unit 5 · Working the Land'); }));
        list.append(row);
      }
      if (!list.children.length) list.append(el('p', '这册还没有导入课文。', 'muted'));
    }
    select.onchange = draw; draw();
    const actions = el('div', undefined, 'reading-dialog-actions');
    actions.append(button('导入课文', () => { library.close(); openImport(); }));
    library.append(label, select, list, actions); library.showModal();
  }
  function normalizeText(text) { return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim(); }
  function escapePattern(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function coreTerms(book, text) {
    if (!book?.textbookId) return [];
    const textbook = (window.CX_PEP_VOCAB || []).find(item => item.id === book.textbookId);
    const index = Number.isInteger(book.vocabIndex) ? book.vocabIndex : Number(book.unitNumber) - 1;
    const words = textbook?.units?.[index]?.words || [];
    const seen = new Set();
    return words.map(([term, meaning]) => ({term, meaning})).filter(item => {
      const key = item.term.toLocaleLowerCase();
      if (!key || seen.has(key) || !new RegExp('\\b' + escapePattern(item.term) + '\\b', 'i').test(text)) return false;
      seen.add(key); return true;
    }).sort((a, b) => b.term.length - a.term.length);
  }
  function highlightCoreWords(target, sentence, terms) {
    if (!terms.length) { target.textContent = sentence; return; }
    const byWord = new Map(terms.map(item => [item.term.toLocaleLowerCase(), item]));
    const pattern = new RegExp('\\b(' + terms.map(item => escapePattern(item.term)).join('|') + ')\\b', 'gi');
    let cursor = 0, match;
    while ((match = pattern.exec(sentence))) {
      if (match.index > cursor) target.append(document.createTextNode(sentence.slice(cursor, match.index)));
      const item = byWord.get(match[0].toLocaleLowerCase());
      const mark = el('mark', match[0], 'reading-core-word');
      mark.title = item.term + ' · ' + item.meaning;
      target.append(mark); cursor = match.index + match[0].length;
    }
    if (cursor < sentence.length) target.append(document.createTextNode(sentence.slice(cursor)));
  }
  function validateText(text) {
    if (!text || !/[A-Za-z]/.test(text)) return '请添加含英文的课文正文。';
    if (text.length > 20000) return '正文请控制在 20,000 字符以内，长文本可以分篇导入。';
    return '';
  }
  function openImport(text = '', title = '', volume = '其他课文', unit = '') {
    importer.replaceChildren(dialogHead(importer, '导入课文'));
    const titleLabel = el('label', '课文标题'); const titleInput = el('input');
    titleInput.id = 'reading-import-title'; titleLabel.htmlFor = titleInput.id;
    titleInput.value = title; titleInput.maxLength = 100; titleInput.placeholder = '课文标题';
    const volumeLabel = el('label', '册别'); const select = volumeSelect(); select.value = volume;
    select.id = 'reading-import-volume'; volumeLabel.htmlFor = select.id;
    const unitLabel = el('label', '单元（可选）'); const unitInput = el('input');
    unitInput.id = 'reading-import-unit'; unitLabel.htmlFor = unitInput.id; unitInput.value = unit; unitInput.maxLength = 100;
    const area = el('textarea'); area.value = text; area.maxLength = 20000;
    area.placeholder = '粘贴英文课文正文…'; area.setAttribute('aria-label', '英文课文正文');
    const error = el('div', '', 'reading-import-error'); error.setAttribute('role', 'alert');
    const actions = el('div', undefined, 'reading-dialog-actions');
    actions.append(button('上传 TXT', () => uploadText((content, filename) => { area.value = content; if (!titleInput.value) titleInput.value = filename; }, message => { error.textContent = message; })));
    const save = button('保存并打开', () => {
      const content = normalizeText(area.value); const name = titleInput.value.trim();
      error.textContent = !name ? '请填写课文标题。' : validateText(content);
      if (error.textContent) return;
      const previous = books.find(book => book.title === name);
      if (previous && previous.text !== content && !window.confirm('已有同名课文，是否覆盖正文？')) return;
      const next = books.filter(book => book.title !== name).concat({title: name, text: content});
      const nextMeta = {...metadata, [name]: {volume: select.value, unit: unitInput.value.trim()}};
      try {
        const oldBooks = localStorage.getItem('cx-books');
        localStorage.setItem('cx-books', JSON.stringify(next));
        try { localStorage.setItem('cx-reading-metadata', JSON.stringify(nextMeta)); }
        catch (failure) { if (oldBooks === null) localStorage.removeItem('cx-books'); else localStorage.setItem('cx-books', oldBooks); throw failure; }
        books = next; metadata = nextMeta;
      } catch { error.textContent = '浏览器存储空间不足，未能保存课文。'; return; }
      refreshBooks(); importer.close(); openBook({title: name, text: content});
    });
    save.className = 'reading-primary'; actions.append(save);
    importer.append(titleLabel, titleInput, volumeLabel, select, unitLabel, unitInput, area, error, actions);
    importer.showModal();
  }
  function uploadText(onLoaded, onError = message => window.alert(message)) {
    const input = el('input'); input.type = 'file'; input.accept = '.txt,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      if (!/\.txt$/i.test(file.name)) { onError('请选择 TXT 文本文件。'); return; }
      if (file.size > 1024 * 1024) { onError('文件请小于 1 MB。'); return; }
      try {
        const bytes = await file.arrayBuffer(); let text;
        try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
        catch { text = new TextDecoder('gb18030', {fatal: true}).decode(bytes); }
        text = normalizeText(text); const error = validateText(text);
        if (error) { onError(error); return; }
        onLoaded(text, file.name.replace(/\.txt$/i, ''));
      } catch { onError('文件读取失败，请另存为 UTF-8 文本后重试。'); }
    };
    input.click();
  }
  function openBook(book) {
    if (currentMode !== 'reading') setMode('reading');
    add(book.title, true); renderPassage(book.text, book.title, book);
  }
  const composerTools = el('div', undefined, 'reading-composer-tools');
  const chooseCourse = button('', openLibrary); chooseCourse.append(el('span', '▤'), el('span', '选择课文'));
  const uploadCourse = button('', () => uploadText((text, title) => openImport(text, title))); uploadCourse.append(el('span', '↑'), el('span', '上传文本'));
  composerTools.append(chooseCourse, uploadCourse);
  document.querySelector('#form')?.before(composerTools);
  composerTools.hidden = currentMode !== 'reading';
  const previousApplyReadingMode = applyConversationMode;
  applyConversationMode = function(mode) { previousApplyReadingMode(mode); composerTools.hidden = currentMode !== 'reading'; if (currentMode !== 'reading') document.body.classList.remove('reading-home-active'); };
  function renderReadingHome() {
    document.body.classList.add('reading-home-active');
    const home = el('section', undefined, 'reading-home');
    const heading = el('div', undefined, 'reading-home-heading');
    const headingText = el('div'); headingText.append(el('small','词小读 · 课文晨读'),el('h2','今天读哪一篇？'),el('p','选择教材和单元，打开课文后即可朗读或逐句跟读。'));
    const upload = button('↑ 上传文本', () => openImport()); upload.title = '上传 TXT 课文';
    heading.append(headingText, upload);
    const controls = el('div', undefined, 'reading-home-controls');
    const volume = volumeSelect(); volume.value = volumes[0]; volume.setAttribute('aria-label','选择教材册别');
    const count = el('span','', 'reading-home-count');
    const mine = button('▤ 我的课文', openLibrary); mine.title = '查看已保存和全部内置课文';
    controls.append(volume,count,mine);
    const list = el('div', undefined, 'reading-home-list');
    function openFromHome(book) {
      $('#messages').replaceChildren(); document.body.classList.remove('reading-home-active');
      renderPassage(book.text, book.title, book);
    }
    function draw() {
      list.replaceChildren(); const selected = textbookBooks.filter(book => book.volume === volume.value);
      count.textContent = selected.length + ' 篇课文'; let lastUnit = '', group;
      selected.forEach(book => {
        if (book.unit !== lastUnit) {
          group = el('section', undefined, 'reading-home-unit');
          group.append(el('h3',book.unit)); list.append(group); lastUnit = book.unit;
        }
        const row = button('', () => openFromHome(book)); row.className = 'reading-home-row';
        const info = el('span'); info.append(el('strong',book.title),el('small',book.type));
        const action = el('span','▶','reading-home-open'); action.setAttribute('aria-hidden','true');
        row.append(info,action); row.setAttribute('aria-label','打开课文：' + book.title); group.append(row);
      });
    }
    volume.onchange = draw; draw(); home.append(heading,controls,list);
    $('#messages').replaceChildren(home); scroll();
  }
  const previousPolish = polishWelcome;
  polishWelcome = function() {
    previousPolish();
    if (currentMode === 'reading') renderReadingHome();
  };
  function textbookPageViewer(bookDetails) {
    const pages = [...new Set(bookDetails?.pages || [])];
    if (!bookDetails?.textbookId || !pages.length) return null;
    let index = 0;
    const viewer = el('aside', undefined, 'textbook-page-viewer');
    const image = el('img'); image.className = 'textbook-page-image'; image.loading = 'lazy';
    const error = el('p','课本页面暂时无法显示。','textbook-page-error'); error.hidden = true;
    const toolbar = el('div',undefined,'textbook-page-toolbar');
    const previous = button('‹',() => { if (index > 0) { index--; draw(); } }); previous.title = '上一页'; previous.setAttribute('aria-label','上一页课本画面');
    const status = el('span');
    const next = button('›',() => { if (index < pages.length - 1) { index++; draw(); } }); next.title = '下一页'; next.setAttribute('aria-label','下一页课本画面');
    function draw() {
      const page = pages[index]; image.hidden = false; error.hidden = true;
      image.src = 'textbook-pages/' + bookDetails.textbookId + '/p-' + String(page).padStart(3,'0') + '.jpg';
      image.alt = bookDetails.volume + ' · ' + bookDetails.unit + ' · 课本第 ' + page + ' 页';
      status.textContent = '课本原页 ' + (index + 1) + ' / ' + pages.length;
      previous.disabled = index === 0; next.disabled = index === pages.length - 1;
    }
    image.onerror = () => { image.hidden = true; error.hidden = false; };
    toolbar.append(previous,status,next); viewer.append(image,error,toolbar); draw(); return viewer;
  }
  function textbookAudioPlayer(bookDetails) {
    if (!bookDetails?.audio) return null;
    const player = el('section',undefined,'textbook-audio-player');
    const label = el('div',undefined,'textbook-audio-label');
    label.append(el('span','♪','textbook-audio-icon'),el('div',bookDetails.audioLabel || '教材原声'));
    label.lastElementChild.append(el('small','课文配套录音'));
    const audio = el('audio'); audio.className = 'textbook-audio'; audio.controls = true; audio.preload = 'metadata'; audio.src = bookDetails.audio;
    audio.setAttribute('aria-label',(bookDetails.audioLabel || bookDetails.title) + ' 教材原声');
    audio.onplay = () => {
      if (activeTextbookAudio && activeTextbookAudio !== audio) activeTextbookAudio.pause();
      stopWithoutTextbookAudio(); activeTextbookAudio = audio;
    };
    audio.onended = () => { if (activeTextbookAudio === audio) activeTextbookAudio = null; };
    audio.onerror = () => { player.classList.add('audio-error'); label.lastElementChild.lastElementChild.textContent = '音频文件无法播放'; };
    player.append(label,audio); player.audioElement = audio; return player;
  }
  renderPassage = function(raw, givenTitle, bookDetails) {
    document.body.classList.remove('reading-home-active');
    const correctionKey = bookDetails?.builtIn ? bookDetails.textbookId + '|' + bookDetails.unitNumber + '|' + bookDetails.title : '';
    const sourceText = normalizeText(bookDetails?.text || raw);
    const text = normalizeText(correctionKey && textCorrections[correctionKey] ? textCorrections[correctionKey] : raw); const error = validateText(text);
    if (error) { say(error); return; }
    lastText = text; lastWord = ''; lastData = null;
    const saved = books.find(book => book.text === text);
    const title = givenTitle || saved?.title || (text === normalizeText(sample) ? '英语伴读示例' : '课文晨读');
    const body = say(''); body.classList.add('passage-reader');
    body.dataset.kind = 'passage'; body.dataset.passage = text;
    const head = el('div', undefined, 'passage-heading'); const info = el('div');
    const parts = sentences(text);
    const terms = coreTerms(bookDetails, text);
    if (bookDetails?.builtIn) info.append(el('div', bookDetails.unit + ' · ' + bookDetails.type, 'passage-kicker'));
    info.append(el('h3', title), el('small', parts.length + ' 句 · ' + (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length + ' 词'));
    if (terms.length) info.append(el('div', '● 核心词汇 ' + terms.length + ' 个' + (correctionKey && textCorrections[correctionKey] ? ' · 已校对' : ''), 'reading-core-legend'));
    const save = button('保存', () => openImport(text, ['课文晨读','课文朗读'].includes(title) ? '' : title));
    save.title = '保存这篇课文'; head.append(info);
    if (bookDetails?.builtIn) { const actions = el('div',undefined,'passage-heading-actions'); const edit = button('✎',openTextEditor); edit.className = 'reading-edit'; edit.title = '校对课文文本'; edit.setAttribute('aria-label','编辑并校对课文文本'); const back = button('‹', renderReadingHome); back.className = 'reading-back'; back.title = '返回课文目录'; back.setAttribute('aria-label','返回课文晨读目录'); actions.append(edit,back); head.append(actions); }
    else head.append(save); body.append(head);
    const article = el('div', undefined, 'passage-text'); const rows = []; let selected = 0;
    // Segment each paragraph separately; the playback text uses the identical sentence list.
    const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
    const segments = paragraphs.map(paragraph => sentences(paragraph));
    const playbackText = segments.flat().join(' ');
    segments.forEach(group => {
      const paragraph = el('p');
      group.forEach(sentence => {
        const index = rows.length;
        const row = button('', () => { selected = index; play(true); });
        row.className = 'sentence'; row.title = '朗读这一句'; row.setAttribute('aria-label', '朗读第 ' + (index + 1) + ' 句：' + sentence);
        highlightCoreWords(row, sentence, terms);
        rows.push(row); paragraph.append(row, document.createTextNode(' '));
      }); article.append(paragraph);
    });
    const audioPlayer = textbookAudioPlayer(bookDetails); const textbookAudio = audioPlayer?.audioElement || null; if (audioPlayer) body.append(audioPlayer);
    const content = el('div',undefined,'reading-content'); const pageViewer = textbookPageViewer(bookDetails); const textPane = el('div',undefined,'reading-text-pane'); textPane.append(article);
    if (pageViewer) content.append(pageViewer); content.append(textPane); body.append(content);
    function refreshCorrectedText() {
      const message = body.parentElement; message?.remove();
      renderPassage(sourceText,title,bookDetails);
    }
    function openTextEditor() {
      stop(); if (textPane.querySelector?.('.reading-text-editor')) return;
      article.hidden = true; const editor = el('section',undefined,'reading-text-editor');
      const label = el('div',undefined,'reading-editor-heading'); label.append(el('strong','校对课文文本'),el('small','修改会保存在当前浏览器'));
      const area = el('textarea'); area.value = text; area.setAttribute('aria-label','编辑课文文本');
      const editError = el('div','', 'reading-editor-error'); editError.setAttribute('role','alert');
      const actions = el('div',undefined,'reading-editor-actions');
      const cancel = button('取消',() => { editor.remove(); article.hidden = false; });
      const restore = button('恢复原文',() => { if (!window.confirm('恢复教材提取文本并放弃当前修改？')) return; delete textCorrections[correctionKey]; try { localStorage.setItem('cx-textbook-corrections',JSON.stringify(textCorrections)); } catch {} refreshCorrectedText(); });
      const saveEdit = button('保存修改',() => { const corrected=normalizeText(area.value); editError.textContent=validateText(corrected); if(editError.textContent)return; textCorrections={...textCorrections,[correctionKey]:corrected}; try { localStorage.setItem('cx-textbook-corrections',JSON.stringify(textCorrections)); } catch { editError.textContent='浏览器存储空间不足，未能保存修改。'; return; } refreshCorrectedText(); }); saveEdit.className='reading-editor-save';
      actions.append(cancel,restore,saveEdit); editor.append(label,area,editError,actions); textPane.append(editor); area.focus?.();
    }
    const toolbar = el('div', undefined, 'reading-player');
    let playbackState = 'stopped';
    const practice = el('div', undefined, 'reading-practice');
    const followLabel = el('label', undefined, 'reading-follow-toggle');
    const follow = el('input'); follow.type = 'checkbox'; follow.checked = followPreference;
    followLabel.append(follow, document.createTextNode('逐句跟读'));
    const gap = el('select'); gap.setAttribute('aria-label', '每句跟读时间');
    [3,5,8,12,20].forEach(seconds => { const option = el('option', seconds + ' 秒'); option.value = String(seconds); gap.append(option); });
    gap.value = String(gapPreference); gap.disabled = !follow.checked;
    const practiceState = el('span', '', 'reading-practice-state'); practiceState.setAttribute('role', 'status');
    practice.append(followLabel, gap, practiceState); body.append(practice);
    const progress = el('span', textbookAudio ? '教材原声' : '第 1 / ' + rows.length + ' 句', 'reading-progress'); progress.setAttribute('role', 'status');
    function icon(symbol, label, handler, primary = false) {
      const control = button(symbol, handler); control.className = 'reading-icon' + (primary ? ' reading-play' : '');
      control.title = label; control.setAttribute('aria-label', label); return control;
    }
    const playButton = icon('▶', '播放 / 暂停', () => {
      if (textbookAudio && !follow.checked) {
        if (!textbookAudio.paused && !textbookAudio.ended) { textbookAudio.pause(); playButton.textContent = '▶'; practiceState.textContent = '教材原声已暂停'; }
        else play();
        return;
      }
      if (utterance && rows.some(row => row.classList.contains('active'))) { togglePause(); playButton.textContent = paused ? '▶' : 'Ⅱ'; }
      else play();
    }, true);
    const speed = el('select'); speed.setAttribute('aria-label', '朗读语速');
    [0.7, 0.9, 1, 1.2].forEach(rate => { const option = el('option', rate + '×'); option.value = String(rate); speed.append(option); });
    speed.value = [...speed.options].some(option => option.value === $('#rate').value) ? $('#rate').value : '0.9';
    function formatAudioTime(seconds) { if (!Number.isFinite(seconds)) return '--:--'; const value=Math.max(0,Math.floor(seconds)); return Math.floor(value/60)+':'+String(value%60).padStart(2,'0'); }
    function play(only = false, restart = false) {
      $('#rate').value = speed.value;
      if (textbookAudio && !only && !follow.checked) {
        if (restart) textbookAudio.currentTime = 0;
        textbookAudio.playbackRate = Number(speed.value); practiceState.textContent = '教材原声播放中'; playbackState = 'recording';
        const started = textbookAudio.play(); if (started?.catch) started.catch(() => { practiceState.textContent = '教材原声播放失败'; playButton.textContent = '▶'; });
        return;
      }
      playbackState = 'speaking'; practiceState.textContent = '';
      speak(playbackText, rows, selected, only, {follow: follow.checked, gap: Number(gap.value) * 1000, parts: segments.flat(), onState: ({state, index, remaining}) => {
        playbackState = state; selected = index;
        practiceState.textContent = state === 'waiting' ? '轮到你读 · ' + Math.ceil(remaining / 1000) + ' 秒' : state === 'paused' ? '已暂停' : state === 'complete' ? '跟读完成' : '';
        playButton.textContent = ['speaking','waiting'].includes(state) ? 'Ⅱ' : '▶';
        progress.textContent = '第 ' + (selected + 1) + ' / ' + rows.length + ' 句';
      }});
      playButton.textContent = utterance && !paused ? 'Ⅱ' : '▶';
    }
    if (textbookAudio) {
      const originalOnPlay = textbookAudio.onplay, originalOnEnded = textbookAudio.onended;
      textbookAudio.onplay = () => { originalOnPlay?.(); playbackState = 'recording'; playButton.textContent = 'Ⅱ'; practiceState.textContent = '教材原声播放中'; };
      textbookAudio.onpause = () => { if (!textbookAudio.ended) { playButton.textContent = '▶'; if (playbackState === 'recording') practiceState.textContent = '教材原声已暂停'; } };
      textbookAudio.onended = () => { originalOnEnded?.(); playbackState = 'complete'; playButton.textContent = '▶'; practiceState.textContent = '教材原声播放完成'; };
      textbookAudio.ontimeupdate = () => { progress.textContent = '原声 ' + formatAudioTime(textbookAudio.currentTime) + ' / ' + formatAudioTime(textbookAudio.duration); };
    }
    function changePractice() {
      gap.disabled = !follow.checked; saveFollowSettings(follow.checked, Number(gap.value));
      if (rows.some(row => row.classList.contains('active')) || (textbookAudio && !textbookAudio.paused)) { stop(); practiceState.textContent = ''; playbackState = 'stopped'; }
    }
    follow.onchange = changePractice; gap.onchange = changePractice;
    speed.onchange = () => { $('#rate').value = speed.value; if (textbookAudio && !textbookAudio.paused) textbookAudio.playbackRate = Number(speed.value); else if (utterance && rows.some(row => row.classList.contains('active'))) play(); };
    toolbar.append(icon('‹', '上一句', () => { selected = Math.max(0, selected - 1); play(true); }), playButton,
      icon('›', '下一句', () => { selected = Math.min(rows.length - 1, selected + 1); play(true); }),
      icon('↺', '从头朗读', () => { selected = 0; play(false,true); }), speed, progress);
    body.append(toolbar);
    body.readingControls = {
      follow(seconds) { follow.checked = true; if ([3,5,8,12,20].includes(seconds)) gap.value = String(seconds); changePractice(); play(); },
      play,
      pause() { if (textbookAudio && !textbookAudio.paused) textbookAudio.pause(); else if (!paused && rows.some(row => row.classList.contains('active'))) playButton.onclick(); },
      resume() { if (textbookAudio?.paused && playbackState === 'recording') play(); else if (paused && rows.some(row => row.classList.contains('active'))) playButton.onclick(); },
      setRate(rate) { speed.value = String(rate); play(); },
    };
    body.updateReadingPlayer = () => {
      const active = rows.findIndex(row => row.classList.contains('active'));
      if (active >= 0) selected = active;
      if (!textbookAudio || follow.checked) progress.textContent = '第 ' + (selected + 1) + ' / ' + rows.length + ' 句';
      if (textbookAudio && !follow.checked) { playButton.textContent = textbookAudio.paused ? '▶' : 'Ⅱ'; return; }
      if (active < 0 || !utterance || paused || playbackState === 'paused') playButton.textContent = '▶';
    };
    scroll();
  };
  new MutationObserver(() => document.querySelectorAll('.passage-reader').forEach(reader => reader.updateReadingPlayer?.()))
    .observe($('#messages'), {subtree: true, attributes: true, attributeFilter: ['class']});
  const previousSubmit = submit;
  submit = async function(raw) {
    const text = raw.trim(); if (currentMode !== 'reading') return previousSubmit(raw);
    if (!text || busy) return;
    if (/^(逐句跟读|一句一句读|开始跟读|跟读模式)(?:[，,\s]*(?:每句|中间|停|间隔)*\s*\d+\s*秒)?[。！!\s]*$/.test(text)) {
      const reader = [...document.querySelectorAll('.passage-reader')].at(-1);
      if (!reader) { say('先发来一段英文课文。'); return; }
      const seconds = Number(text.match(/(\d+)\s*秒/)?.[1]); reader.readingControls.follow(seconds); $('#input').value = ''; return;
    }
    if (/^(选择课文|课文目录)$/.test(text)) { openLibrary(); return; }
    if (/^(上传|导入)(文本|课文)?$/.test(text)) { openImport(); return; }
    const book = books.find(book => text === book.title || text === '朗读 ' + book.title || text === '朗读课文：' + book.title);
    if (book) { openBook(book); $('#input').value = ''; return; }
    if (/^(?:unit\s*5\s*[·:]?\s*)?working\s+the\s+land$/i.test(text) || /^朗读\s+working\s+the\s+land$/i.test(text)) {
      openImport('', 'Working the Land', '选择性必修第一册', 'Unit 5 · Working the Land'); return;
    }
    if (/^(慢一点|慢点|再读一遍|再读|再来一遍|重读|快一点|暂停|继续|继续朗读|停止)[。！!\s]*$/.test(text)) {
      const readers = [...document.querySelectorAll('.passage-reader')];
      const reader = readers.find(item => item.querySelector('.sentence.active')) || readers.at(-1);
      if (!reader) { say('先发来一段英文课文。'); return; }
      if (/停止/.test(text)) stop();
      else if (/暂停/.test(text)) reader.readingControls.pause();
      else if (/继续/.test(text)) reader.readingControls.resume();
      else if (/慢/.test(text)) reader.readingControls.setRate(0.7);
      else if (/快/.test(text)) reader.readingControls.setRate(1.2);
      else reader.readingControls.play();
      $('#input').value = ''; return;
    }
    add(text, true); $('#input').value = ''; $('#input').style.height = '38px';
    const content = normalizeText(text.replace(/^(?:朗读课文|朗读|读一下)\s*[:：]?\s*/, ''));
    if (/[A-Za-z]/.test(content)) renderPassage(content);
    else say('请粘贴英文正文，或选择一篇已保存的课文。');
  };
  const courseButton = document.querySelector('header button:last-child');
  if (courseButton?.textContent.includes('课文')) {
    courseButton.remove();
  }
  document.querySelectorAll('.reply[data-kind="passage"]').forEach(reply => {
    // Upgrade restored passage replies without appending new history messages.
    const message = reply.parentElement; const text = reply.dataset.passage;
    if (!text) return;
    renderPassage(text); const replacement = $('#messages').lastElementChild;
    message.replaceWith(replacement);
  });
  polishWelcome();
})();
