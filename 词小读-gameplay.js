(() => {
  function vocabularyPool(unit) {
    const books = Array.isArray(window.CX_PEP_VOCAB) ? window.CX_PEP_VOCAB : [];
    const sourceWords = unit?.words || books.flatMap(book => book.units.flatMap(item => item.words));
    const entries = sourceWords.map(([word, meaning]) => ({word: word.trim(), meaning: meaning.trim()}))
      .filter(item => /^[A-Za-z][A-Za-z .'-]{1,30}$/.test(item.word) && /[\u4e00-\u9fff]/.test(item.meaning));
    const unique = [], english = new Set(), chinese = new Set();
    for (const item of entries) {
      const word = item.word.toLocaleLowerCase();
      const meaning = item.meaning.replace(/^[a-z.\s]+/i,'').split(/[；;,，]/)[0].trim();
      if (!meaning || meaning.length > 18 || english.has(word) || chinese.has(meaning)) continue;
      english.add(word); chinese.add(meaning); unique.push({word: item.word, meaning});
    }
    return unique;
  }
  const picturePool = [
    ['drought','干旱',5580,'nature','dry','The long drought left the ground dry and cracked.','土地龟裂、植物干枯，表示长期缺雨造成的干旱。'],
    ['flood','洪水',4669,'nature','flood','The flood covered roads and houses.','大片水淹没了房屋，表示洪水。'],
    ['earthquake','地震',4755,'nature','quake','Several buildings were damaged in the earthquake.','地面开裂、楼房倾斜，表示地震。'],
    ['volcano','火山',6247,'nature','volcano','Smoke rose from the volcano.','山口冒烟、熔岩流出，表示火山。'],
    ['erosion','侵蚀',37717,'nature','erosion','Wind erosion slowly wears away the rocks.','风把岩石表面的碎屑带走，表示侵蚀。'],
    ['pollution','污染',7066,'nature','pollution','Water pollution threatens fish in the river.','污物进入河流、鱼类受害，表示水污染。'],
    ['fossil','化石',26102,'science','fossil','The fossil was found inside a rock.','岩石中保存着古生物遗迹，表示化石。'],
    ['astronaut','宇航员',4569,'science','space','The astronaut prepared for a mission in space.','人物穿着航天服、旁边有飞行器，表示宇航员。'],
    ['oxygen','氧气',10317,'science','oxygen','The patient needed oxygen to breathe.','气瓶上标有 O₂，表示氧气。'],
    ['experiment','实验',8119,'science','lab','The students mixed liquids during the experiment.','试管里的液体被混合，表示开展实验。'],
    ['investigate','调查；研究',39288,'science','lab','Scientists investigate samples under a microscope.','研究者用显微镜检查样本，表示调查研究。'],
    ['agriculture','农业',38079,'action','farming','Agriculture provides food for people.','田地里种植着农作物，表示农业。'],
    ['harvest','收获；采收',7227,'action','farming','Farmers harvest the fruit when it is ripe.','人物把成熟水果摘下放入篮子，表示采收。'],
    ['recycle','回收利用',27210,'action','recycling','We recycle glass bottles instead of throwing them away.','玻璃瓶被投入专用回收容器，表示回收利用。'],
    ['rescue','营救',9046,'action','rescue','They used a lifebuoy to rescue the swimmer.','救生圈被递给水中的人，表示营救。'],
    ['donate','捐赠',35319,'action','donation','Healthy adults can donate blood to help others.','人物正在献血，表示捐赠血液。'],
    ['explore','探索',37601,'action','exploration','The children explore the tall grass to see what lives there.','人物拨开高草寻找其中的事物，表示探索。'],
    ['hesitate','犹豫',11696,'action','hesitation','Do not hesitate to ask for help.','人物面对两个不同方向，不知如何选择，表示犹豫。'],
  ].map(([word,meaning,id,theme,conflict,context,explanation]) => ({word,meaning,id,theme,conflict,context,explanation}));
  function exampleForWord(word) {
    const pair = window.CX_EXAMPLES?.matches?.[word.toLocaleLowerCase()]?.[0];
    const sentence = pair ? window.CX_EXAMPLES.sentences?.[pair[0]] : null;
    return sentence ? {english: sentence[0], chinese: sentence[1]} : null;
  }
  function unitPicturePool(unit) {
    const usedWords = new Set(), usedImages = new Set(), result = [];
    for (const item of vocabularyPool(unit)) {
      const ids = window.ARASAAC_PICTOGRAMS?.[item.word.toLocaleLowerCase()] || [];
      const id = ids.find(candidate => !usedImages.has(candidate));
      const key = item.word.toLocaleLowerCase();
      const example = exampleForWord(item.word);
      if (!id || !example || usedWords.has(key)) continue;
      usedWords.add(key); usedImages.add(id);
      result.push({...item, id, example, conflict: String(id), context: '本题词汇来自本单元 Vocabulary。', explanation: '这张图对应 ' + item.word + '（' + item.meaning + '）。'});
    }
    return result;
  }
  const allPicturePool = (() => {
    const items = (window.CX_PEP_VOCAB || []).flatMap(book => book.units.flatMap(unitPicturePool));
    const seen = new Set();
    return [...items, ...picturePool].filter(item => {
      const key = item.word.toLocaleLowerCase() + '|' + item.id;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  })();
  const timers = new Set();
  function cancelGames() { timers.forEach(clearTimeout); timers.clear(); document.body.classList.remove('game-session-active'); }
  const previousNewChat = newChat;
  newChat = function() { cancelGames(); previousNewChat(); };
  const previousReset = resetConversationState;
  resetConversationState = function() { cancelGames(); previousReset(); };
  window.addEventListener('pagehide', cancelGames);
  function later(callback, delay, body) {
    const token = requestGeneration;
    const id = setTimeout(() => { timers.delete(id); if (token === requestGeneration && body.isConnected && currentMode === 'games') callback(); }, delay);
    timers.add(id);
  }
  const gameButton = document.querySelector('.feature-nav button[data-mode="games"]');
  const submenu = el('div', undefined, 'game-submenu'); submenu.id = 'game-submenu'; submenu.hidden = true;
  const imageMenu = button('看图选词', () => launch('picture'));
  const matchMenu = button('单词消消乐', () => launch('match'));
  imageMenu.dataset.game = 'picture'; matchMenu.dataset.game = 'match'; submenu.append(imageMenu, matchMenu);
  const previousApplyMode = applyConversationMode;
  applyConversationMode = function(mode) {
    previousApplyMode(mode);
    if (mode !== 'games') {
      submenu.hidden = true;
      gameButton.setAttribute('aria-expanded','false');
      chevron.textContent = '›';
      submenu.querySelectorAll('button').forEach(item => {item.classList.remove('active');item.setAttribute('aria-pressed','false');});
    }
  };
  const previousAdd = add;
  add = function(text, user = false) {
    const reply = previousAdd(text, user);
    if (typeof restoringConversation !== 'undefined' && restoringConversation && !user && ['单词消消乐','单词连连看'].includes(text)) {
      reply.append(button('重新开始', () => launch('match')));
    }
    return reply;
  };
  gameButton.after(submenu);
  const chevron = el('span','›','game-menu-chevron'); gameButton.append(chevron);
  gameButton.setAttribute('aria-controls', submenu.id); gameButton.setAttribute('aria-expanded', 'false');
  gameButton.onclick = () => { submenu.hidden = !submenu.hidden; gameButton.setAttribute('aria-expanded', String(!submenu.hidden)); chevron.textContent = submenu.hidden ? '›' : '⌄'; };
  function activate(type) {
    submenu.hidden = false; gameButton.setAttribute('aria-expanded', 'true'); chevron.textContent = '⌄';
    submenu.querySelectorAll('button').forEach(item => { const selected = item.dataset.game === type; item.classList.toggle('active', selected); item.setAttribute('aria-pressed', String(selected)); });
  }
  function launch(type) {
    newChat(); applyConversationMode('games'); activate(type);
    document.querySelector('.welcome')?.remove();
    $('#messages').replaceChildren();
    add(type === 'picture' ? '看图选词' : type === 'match' ? '单词消消乐' : '单词 PK', true);
    document.body.classList.add('game-session-active');
    if (type === 'picture') startPictureQuiz(); else if (type === 'match') startWordMatch(); else window.startWordPk?.();
  }
  showGames = function() { submenu.hidden = false; gameButton.setAttribute('aria-expanded','true'); chevron.textContent = '⌄'; };
  window.CX_GAME_SUBMENU = submenu;
  window.CX_GAME_LAUNCH = launch;
  window.CX_GAME_ACTIVATE = activate;
  function showUnitConfig(type, startGame) {
    activate(type);
    const body = say(''); body.classList.add('game-board','unit-game-config'); body.dataset.kind = type === 'picture' ? 'quiz' : 'match';
    body.dataset.originalText = type === 'picture' ? '看图选词' : '单词消消乐';
    const head = el('div',undefined,'game-heading'); head.append(el('strong',type === 'picture' ? '看图选词' : '单词消消乐'),el('small','按单元 Vocabulary 出题'));
    const fields = el('div',undefined,'unit-game-fields');
    const book = el('select'); book.setAttribute('aria-label','选择册别');
    const unit = el('select'); unit.setAttribute('aria-label','选择单元');
    (window.CX_PEP_VOCAB || []).forEach((item,index) => { const option=el('option',item.title); option.value=String(index); book.append(option); });
    function drawUnits() {
      unit.replaceChildren(); const selected = window.CX_PEP_VOCAB[Number(book.value)];
      selected.units.forEach((item,index) => { const option=el('option',item.title); option.value=String(index); unit.append(option); });
      updateNote();
    }
    const note = el('p','', 'unit-game-note');
    function updateNote() {
      const selected = window.CX_PEP_VOCAB?.[Number(book.value)]?.units?.[Number(unit.value)]; if (!selected) return;
      const count = type === 'picture' ? unitPicturePool(selected).length : vocabularyPool(selected).length;
      note.textContent = type === 'picture' ? '本单元有 ' + count + ' 个可出题配图词；干扰图可来自其他单元。' : '本单元有 ' + count + ' 个可用配对词。';
    }
    book.onchange = drawUnits; unit.onchange = updateNote; drawUnits();
    [['册别',book],['单元',unit]].forEach(([label,control]) => {const field=el('label',undefined,'unit-game-field');field.append(el('span',label),control);fields.append(field);});
    const start = button('开始游戏',() => {
      const selectedBook = window.CX_PEP_VOCAB[Number(book.value)]; const selectedUnit = selectedBook.units[Number(unit.value)];
      startGame({body,book:selectedBook,unit:selectedUnit});
    }); start.className='unit-game-start'; body.append(head,fields,note,start); scroll();
  }
  startPictureQuiz = function(selection) {
    if (currentMode !== 'games') { launch('picture'); return; }
    if (!selection) { showUnitConfig('picture', startPictureQuiz); return; }
    activate('picture'); const {body,book,unit} = selection; const targets = unitPicturePool(unit);
    if (targets.length < 4) { body.append(el('p','这个单元暂时没有足够的本地配图词。','unit-game-error')); return; }
    let round = 0, correct = 0, mistakes = 0, locked = false, deck = shuffleGame(targets), lastTarget = '';
    function draw() {
      body.replaceChildren(); locked = false; round++;
      if (!deck.length) { deck = shuffleGame(targets); if (deck.at(-1).word === lastTarget) deck.reverse(); }
      const target = deck.pop(); lastTarget = target.word;
      const distractors = [], usedImages = new Set([String(target.id)]);
      for (const item of shuffleGame(allPicturePool)) {
        const imageId = String(item.id);
        if (item.word === target.word || usedImages.has(imageId)) continue;
        usedImages.add(imageId); distractors.push(item);
        if (distractors.length === 3) break;
      }
      const choices = shuffleGame([target, ...distractors]);
      const heading = el('div', undefined, 'game-heading');
      heading.append(el('strong',unit.title), el('small','第 ' + round + ' 题 · 答对 ' + correct + ' · 错选 ' + mistakes));
      const question = el('div', undefined, 'picture-question');
      const audio = button('♪', () => speak(target.word)); audio.title = '听单词发音'; audio.setAttribute('aria-label','听 ' + target.word + ' 的发音');
      question.append(el('h3',target.word), audio);
      const context = el('p',book.title + ' · ' + target.context,'picture-context');
      const grid = el('div', undefined, 'quiz-grid');
      const feedback = el('div', '', 'quiz-feedback'); feedback.setAttribute('role','status');
      let broken = false;
      choices.forEach((item,index) => {
        const choice = button('', () => {
          if (locked || choice.disabled || broken) return;
          if (item.word === target.word) {
            locked = true; correct++; choice.classList.add('correct'); grid.querySelectorAll('button').forEach(button => { button.disabled = true; });
            feedback.className = 'quiz-feedback feedback-correct'; feedback.textContent = '答对了！' + target.word + '：' + target.meaning + '。' + target.explanation;
            later(draw, 2000, body);
          } else {
            mistakes++; choice.disabled = true; choice.classList.add('wrong');
            heading.lastElementChild.textContent = '第 ' + round + ' 题 · 答对 ' + correct + ' · 错选 ' + mistakes;
            feedback.className = 'quiz-feedback feedback-wrong';
            feedback.textContent = item.explanation + '题目词是 ' + target.word + '（' + target.meaning + '），再选一次。';
          }
        });
        choice.className = 'quiz-option'; choice.setAttribute('aria-label','图片选项 ' + (index + 1));
        choice.dataset.word = item.word;
        const image = el('img'); image.src = 'arasaac-audit/images/' + item.id + '.png'; image.alt = '图片选项 ' + (index + 1);
        image.onerror = () => { if (broken) return; broken = true; locked = true; grid.querySelectorAll('button').forEach(button => {button.disabled = true;}); feedback.textContent = '这题的本地图片缺失，请检查文件夹。'; feedback.append(button('跳过这题',draw)); };
        choice.append(image,el('span',String(index + 1))); grid.append(choice);
      });
      const example = el('div',undefined,'picture-example');
      const exampleLine = el('div',undefined,'picture-example-line');
      const exampleAudio = button('▶',() => speak(target.example.english)); exampleAudio.title = '朗读例句'; exampleAudio.setAttribute('aria-label','朗读例句：' + target.example.english);
      exampleLine.append(el('span','例句','picture-example-label'),el('p',target.example.english),exampleAudio);
      example.append(exampleLine,el('p',target.example.chinese,'picture-example-translation'));
      body.append(heading,question,grid,feedback,example,context); scroll();
    }
    draw();
  };
  startWordMatch = function(selection) {
    if (currentMode !== 'games') { launch('match'); return; }
    if (!selection) { showUnitConfig('match', startWordMatch); return; }
    activate('match'); const {body,book,unit} = selection; const pool = vocabularyPool(unit);
    let round = 0;
    function draw() {
      body.replaceChildren(); round++;
      const words = shuffleGame(pool).slice(0,6); let selected = null, attempts = 0, matched = 0, locked = false;
      const started = performance.now();
      const heading = el('div', undefined, 'game-heading'); heading.append(el('strong',unit.title),el('small',book.title + ' · 第 ' + round + ' 轮'));
      const toolbar = el('div', undefined, 'match-toolbar'); const score = el('span','配对 0 / 6 · 尝试 0 次');
      const restart = button('↻',draw); restart.title = '换一组单词'; restart.setAttribute('aria-label','换一组单词'); toolbar.append(score,restart);
      const grid = el('div', undefined, 'match-grid');
      const feedback = el('div','', 'match-feedback'); feedback.setAttribute('role','status');
      const tiles = shuffleGame(words.flatMap(item => [{...item,side:'en',text:item.word},{...item,side:'zh',text:item.meaning}]));
      tiles.forEach(tile => {
        const choice = button(tile.text, () => {
          if (locked || choice.disabled) return;
          if (choice === selected) { choice.classList.remove('chosen'); choice.setAttribute('aria-pressed','false'); selected = null; return; }
          if (!selected || selected.dataset.side === tile.side) {
            if (selected) {selected.classList.remove('chosen');selected.setAttribute('aria-pressed','false');}
            selected = choice; choice.classList.add('chosen'); choice.setAttribute('aria-pressed','true'); return;
          }
          attempts++; const previous = selected; selected = null;
          previous.classList.remove('chosen'); previous.setAttribute('aria-pressed','false');
          if (previous.dataset.word === tile.word) {
            previous.disabled = true; choice.disabled = true; previous.classList.add('matched'); choice.classList.add('matched'); matched++;
            feedback.textContent = tile.word + ' · ' + tile.meaning;
          } else {
            locked = true; previous.classList.add('mismatch'); choice.classList.add('mismatch');
            feedback.textContent = '这两个不是一对，再试一次。';
            later(() => {previous.classList.remove('mismatch');choice.classList.remove('mismatch');locked = false;},650,body);
          }
          score.textContent = '配对 ' + matched + ' / 6 · 尝试 ' + attempts + ' 次';
          if (matched === 6) {
            feedback.textContent = '全部完成！用时 ' + Math.max(1,Math.round((performance.now()-started)/1000)) + ' 秒 · 准确率 ' + Math.round(6/attempts*100) + '%';
            feedback.append(button('下一轮',draw));
          }
        });
        choice.className = 'match-tile ' + tile.side; choice.dataset.word = tile.word; choice.dataset.side = tile.side; choice.setAttribute('aria-pressed','false'); grid.append(choice);
      });
      body.append(heading,toolbar,grid,feedback); scroll();
    }
    draw();
  };
  window.CX_GAME_TEST = {vocabularyPool, picturePool, exampleForWord, unitPicturePool, allPicturePool};
})();
