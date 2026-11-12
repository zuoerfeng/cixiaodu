(() => {
  const submenu = window.CX_GAME_SUBMENU;
  if (!submenu || !Array.isArray(window.CX_PEP_VOCAB)) return;
  const pkMenu = button('单词 PK', () => window.CX_GAME_LAUNCH('pk'));
  pkMenu.dataset.game = 'pk'; submenu.append(pkMenu);
  let session = null, nextTimer = null;
  const previousNewChat = newChat;
  newChat = function() { endPk(); previousNewChat(); };
  const previousReset = resetConversationState;
  resetConversationState = function() { endPk(); previousReset(); };
  function endPk() { session = null; clearTimeout(nextTimer); nextTimer = null; }
  function uniqueWords(unit) {
    const seenEnglish = new Set(), seenChinese = new Set();
    return unit.words.filter(([english,chinese]) => {
      const en = english.toLocaleLowerCase(), zh = chinese.replace(/\s+/g,'');
      if (!en || !zh || seenEnglish.has(en) || seenChinese.has(zh)) return false;
      seenEnglish.add(en); seenChinese.add(zh); return true;
    });
  }
  function makeQuestions(words, count) {
    const targets = shuffleGame(words).slice(0, Math.min(count, words.length));
    return targets.map((target,index) => {
      const direction = index % 2 === 0 ? 'en-zh' : 'zh-en';
      const answerIndex = direction === 'en-zh' ? 1 : 0;
      const distractors = shuffleGame(words.filter(word => word !== target && word[answerIndex] !== target[answerIndex])).slice(0,3);
      const choices = shuffleGame([target,...distractors]);
      return {target, direction, choices, answer: choices.indexOf(target)};
    }).filter(question => question.choices.length === 4);
  }
  function select(label, values) {
    const control = el('select'); control.setAttribute('aria-label',label);
    values.forEach(([value,text]) => {const option=el('option',text);option.value=String(value);control.append(option);}); return control;
  }
  function showConfig() {
    endPk(); window.CX_GAME_ACTIVATE('pk');
    const body = say(''); body.classList.add('game-board','pk-config'); body.dataset.kind='pk';body.dataset.originalText='单词 PK';
    const head=el('div',undefined,'game-heading');head.append(el('strong','单词 PK'),el('small','人教版高中英语 2019'));
    const fields=el('div',undefined,'pk-fields');
    const book=select('选择册别',window.CX_PEP_VOCAB.map((item,index)=>[index,item.title]));
    const unit=select('选择单元',[]);const amount=select('选择题量',[[10,'10 题'],[15,'15 题'],[20,'20 题'],['all','本单元全部']]);
    function units(){unit.replaceChildren();window.CX_PEP_VOCAB[Number(book.value)].units.forEach((item,index)=>{const option=el('option',item.title);option.value=String(index);unit.append(option)});}
    book.onchange=units;units();
    [['册别',book],['单元',unit],['题量',amount]].forEach(([label,control])=>{const field=el('label',undefined,'pk-field');field.append(el('span',label),control);fields.append(field)});
    const note=el('p','A 组使用 1–4 键，B 组使用 7–0 键；也可以直接点击各自选项。','pk-note');
    const start=button('开始 PK',()=>{const selectedBook=window.CX_PEP_VOCAB[Number(book.value)];const selectedUnit=selectedBook.units[Number(unit.value)];const words=uniqueWords(selectedUnit);const count=amount.value==='all'?words.length:Number(amount.value);startPk(body,selectedBook,selectedUnit,makeQuestions(words,count));});start.className='pk-start';
    body.append(head,fields,note,start);scroll();
  }
  function startPk(body,book,unit,questions) {
    if (questions.length < 1) {body.append(el('p','这个单元没有足够的可用词条。','pk-error'));return;}
    session={body,book,unit,questions,index:0,score:[0,0],time:[0,0],answers:[null,null],shownAt:0,finished:false};
    drawQuestion();
  }
  function makeTeamOrders(question) {
    const first = shuffleGame(question.choices);
    let second = shuffleGame(question.choices);
    const firstAnswer = first.indexOf(question.target);
    while (second.indexOf(question.target) === firstAnswer) second = [second.at(-1),...second.slice(0,-1)];
    return [first,second];
  }
  function teamPanel(team,question) {
    const panel=el('section',undefined,'pk-team');panel.dataset.team=String(team);
    panel.append(el('div',team===0?'A 组':'B 组','pk-team-name'));
    const choices=el('div',undefined,'pk-choices');
    session.teamOrders[team].forEach((word,index)=>{
      const answer=question.direction==='en-zh'?word[1]:word[0];
      const choice=button(answer,()=>submitAnswer(team,index));choice.dataset.index=String(index);
      const key=team===0?index+1:[7,8,9,0][index];choice.append(el('kbd',String(key)));choices.append(choice);
    });
    const state=el('div','请选择答案','pk-team-state');state.setAttribute('role','status');panel.append(choices,state);return panel;
  }
  function drawQuestion() {
    const s=session;if(!s||s.finished)return;
    if(s.index>=s.questions.length){finishPk();return;}
    s.answers=[null,null];s.shownAt=performance.now();
    const question=s.questions[s.index];const body=s.body;body.replaceChildren();
    s.teamOrders=makeTeamOrders(question);
    const head=el('div',undefined,'game-heading');head.append(el('strong',s.unit.title),el('small','第 '+(s.index+1)+' / '+s.questions.length+' 题'));
    const score=el('div',undefined,'pk-score');score.append(el('span','A 组 '+s.score[0]+' 分'),el('span','B 组 '+s.score[1]+' 分'));
    const prompt=el('div',undefined,'pk-prompt');
    prompt.append(el('small',question.direction==='en-zh'?'选择正确的中文意思':'选择正确的英文单词'),el('h3',question.direction==='en-zh'?question.target[0]:question.target[1]));
    if(question.direction==='en-zh'){const audio=button('♪',()=>speak(question.target[0]));audio.title='听单词发音';audio.setAttribute('aria-label','听单词发音');prompt.append(audio)}
    const arena=el('div',undefined,'pk-arena');arena.append(teamPanel(0,question),teamPanel(1,question));
    const result=el('div','等待两组作答','pk-round-result');result.setAttribute('role','status');
    body.append(head,score,prompt,arena,result);scroll();
  }
  function submitAnswer(team,index) {
    const s=session;if(!s||s.finished||s.answers[team]!==null)return;
    const elapsed=Math.max(1,performance.now()-s.shownAt);s.answers[team]={index,elapsed};
    const panel=s.body.querySelectorAll('.pk-team')[team];panel.classList.add('submitted');panel.querySelectorAll('button').forEach(choice=>choice.disabled=true);
    panel.querySelector('.pk-team-state').textContent='已提交';
    if(s.answers.every(answer=>answer!==null))revealRound();
  }
  function revealRound() {
    const s=session;if(!s)return;const q=s.questions[s.index];
    s.body.querySelectorAll('.pk-team').forEach((panel,team)=>{
      const answer=s.answers[team];const correctIndex=s.teamOrders[team].indexOf(q.target);s.time[team]+=answer.elapsed;const correct=answer.index===correctIndex;if(correct)s.score[team]++;
      panel.querySelectorAll('button').forEach((choice,index)=>{if(index===correctIndex)choice.classList.add('correct');else if(index===answer.index)choice.classList.add('wrong');});
      panel.querySelector('.pk-team-state').textContent=correct?'回答正确 · '+(answer.elapsed/1000).toFixed(1)+' 秒':'回答错误 · 正确答案已标出';
    });
    const result=s.body.querySelector('.pk-round-result');result.textContent=q.target[0]+'：'+q.target[1];
    s.index++;nextTimer=setTimeout(drawQuestion,1600);
  }
  function finishPk() {
    const s=session;if(!s)return;s.finished=true;s.body.replaceChildren();
    const winner=s.score[0]===s.score[1]?(s.time[0]===s.time[1]?'平局':s.time[0]<s.time[1]?'A 组获胜':'B 组获胜'):s.score[0]>s.score[1]?'A 组获胜':'B 组获胜';
    const head=el('div',undefined,'pk-finish');head.append(el('small',s.book.title+' · '+s.unit.title),el('h3',winner));
    const scores=el('div',undefined,'pk-final-scores');
    [0,1].forEach(team=>{const card=el('div');card.append(el('strong',(team===0?'A 组':'B 组')+' · '+s.score[team]+' 分'),el('span','累计用时 '+(s.time[team]/1000).toFixed(1)+' 秒'));scores.append(card)});
    const actions=el('div',undefined,'pk-finish-actions');actions.append(button('再来一局',()=>{s.index=0;s.score=[0,0];s.time=[0,0];s.finished=false;drawQuestion()}),button('换单元',showConfig));
    s.body.append(head,scores,actions);scroll();
  }
  function handleKeys(event) {
    if(!session||session.finished||event.repeat||['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;
    const a={'1':0,'2':1,'3':2,'4':3},b={'7':0,'8':1,'9':2,'0':3};
    if(Object.hasOwn(a,event.key)){event.preventDefault();submitAnswer(0,a[event.key]);}
    else if(Object.hasOwn(b,event.key)){event.preventDefault();submitAnswer(1,b[event.key]);}
  }
  document.addEventListener('keydown',handleKeys);
  window.startWordPk=showConfig;
  window.CX_PK_TEST={uniqueWords,makeQuestions,makeTeamOrders};
})();
