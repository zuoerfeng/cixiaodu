function polishWelcome(){const welcome=document.querySelector('.welcome');if(!welcome)return;const reading=currentMode==='reading';welcome.replaceChildren(el('div','词小读 · '+(reading?'课文晨读':'单词拼读'),'welcome-eyebrow'),el('h2',reading?'今天，想读哪篇课文？':'今天，想学哪个单词？'),el('p',reading?'发来一段英语课文，我们一起慢慢读。':'发来一个单词，我们一起读懂它。'))}
const newChatBeforeWelcomePolish=newChat;
newChat=function(){newChatBeforeWelcomePolish();polishWelcome()};
polishWelcome();
document.querySelector('.footnote').remove();
const aboutButton=document.querySelector('.aside-bottom button');
const aboutPanel=el('div',undefined,'about-popover');
aboutPanel.id='about-panel';aboutPanel.hidden=true;
const pictogramCredit=el('p','图示：Sergio Palao / ARASAAC，产权：西班牙阿拉贡政府。许可：CC BY-NC-SA（署名、非商业、相同方式共享）。配图按英文词条匹配，尚未逐图审核。');
const pictogramSource=el('a','ARASAAC 来源与许可');pictogramSource.href='https://aulaabierta.arasaac.org/en/tutorial-web-page-arasaac';pictogramSource.target='_blank';pictogramSource.rel='noopener noreferrer';
pictogramCredit.append(' ',pictogramSource);aboutPanel.append(pictogramCredit);
aboutPanel.setAttribute('role','region');aboutPanel.setAttribute('aria-label','关于词小读');
aboutPanel.append(el('strong','词小读'),el('p','高中英语拼读与课文伴读助手。'),el('p','本地英汉词库、设备朗读、情境记忆与单词游戏。未接入大模型；词库部分词条没有例句、拼读讲解或图片。'),el('p','对话、课文和补充图片保存在当前浏览器。配图已保存在本地；在线补充查询需要联网。'));
document.querySelector('.aside-bottom').append(aboutPanel);
aboutButton.removeAttribute('onclick');
aboutButton.setAttribute('aria-controls','about-panel');aboutButton.setAttribute('aria-expanded','false');
function closeAbout(){aboutPanel.hidden=true;aboutButton.setAttribute('aria-expanded','false')}
aboutButton.onclick=()=>{aboutPanel.hidden=!aboutPanel.hidden;aboutButton.setAttribute('aria-expanded',String(!aboutPanel.hidden))};
document.addEventListener('click',event=>{if(!aboutPanel.contains(event.target)&&!aboutButton.contains(event.target))closeAbout()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!aboutPanel.hidden){closeAbout();aboutButton.focus()}});
const pictureNavigation=document.querySelector('.feature-nav button[data-mode="picture"]');
pictureNavigation.dataset.mode='games';
pictureNavigation.replaceChildren(el('span','▦','nav-icon'),el('span','趣味游戏'));
modeNames.games='趣味游戏';
const learningSetMode=setMode;
setMode=function(mode){if(mode!=='games')return learningSetMode(mode);newChat();applyConversationMode(mode);showGames()};
function showGames(){const reply=say('今天想玩哪一个？');const options=el('div',undefined,'game-options');options.append(button('▧ 看图背单词',startPictureQuiz),button('▦ 单词消消乐',startWordMatch));reply.append(options);scroll()}
function shuffleGame(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
function startWordMatch(){const words=shuffleGame(Object.keys(curated)).slice(0,6);const reply=say('单词消消乐');const toolbar=el('div',undefined,'match-toolbar');const score=el('span','配对 0 / 6 · 尝试 0 次');toolbar.append(score,button('↻',startWordMatch));toolbar.lastChild.title='重新开始';toolbar.lastChild.setAttribute('aria-label','重新开始单词消消乐');const grid=el('div',undefined,'match-grid');const feedback=el('div','选一个英文单词，再选它的中文释义。','match-feedback');feedback.setAttribute('role','status');let selected=null,attempts=0,matched=0;const started=performance.now();const tiles=shuffleGame(words.flatMap(word=>[{word,side:'en',text:word},{word,side:'zh',text:curated[word][1].replace(/^[a-z.\s]+/,'').split(/[；;,，]/)[0].trim()}]));tiles.forEach(tile=>{const b=button(tile.text,()=>{if(b.disabled)return;if(selected===b){b.classList.remove('chosen');b.setAttribute('aria-pressed','false');selected=null;return}if(!selected){selected=b;b.classList.add('chosen');b.setAttribute('aria-pressed','true');feedback.textContent=tile.side==='en'?'找找它的中文意思。':'找找对应的英文单词。';return}if(selected.dataset.side===tile.side){selected.classList.remove('chosen');selected.setAttribute('aria-pressed','false');selected=b;b.classList.add('chosen');b.setAttribute('aria-pressed','true');return}attempts++;const previous=selected;previous.classList.remove('chosen');previous.setAttribute('aria-pressed','false');selected=null;if(previous.dataset.word===tile.word){previous.disabled=true;b.disabled=true;previous.classList.add('matched');b.classList.add('matched');matched++;feedback.textContent='配对成功：'+tile.word+' · '+curated[tile.word][1]}else feedback.textContent='还没配上，再试一次。';score.textContent='配对 '+matched+' / 6 · 尝试 '+attempts+' 次';if(matched===6){const seconds=Math.max(1,Math.round((performance.now()-started)/1000));feedback.textContent='全部完成！用时 '+seconds+' 秒，配对准确率 '+Math.round(6/attempts*100)+'%。';feedback.append(button('再玩一轮',startWordMatch))}});b.dataset.word=tile.word;b.dataset.side=tile.side;b.className='match-tile '+tile.side;b.setAttribute('aria-pressed','false');grid.append(b)});reply.append(toolbar,grid,feedback);scroll()}
