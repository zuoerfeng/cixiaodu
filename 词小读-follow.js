(() => {
  const previousSpeak = speak;
  const previousStop = stop;
  const previousPause = togglePause;
  let session = null;
  function notify(state, remaining = 0) {
    session?.options.onState?.({state, index: session.index, remaining});
  }
  stop = function() {
    if (session) {
      clearTimeout(session.timer);
      notify('stopped');
      session = null;
    }
    previousStop();
  };
  togglePause = function() {
    if (!session) return previousPause();
    const current = session;
    if (current.stage === 'waiting') {
      current.paused = !current.paused;
      paused = current.paused;
      if (current.paused) {
        current.remaining = Math.max(0, current.due - Date.now());
        clearTimeout(current.timer);
        notify('paused', current.remaining);
      } else {
        current.due = Date.now() + current.remaining;
        current.tick();
      }
      $('#pause').textContent = paused ? '▶' : 'Ⅱ';
      $('#playstate').textContent = paused ? '已暂停' : '轮到你读了';
    } else {
      previousPause();
      current.paused = paused;
      notify(paused ? 'paused' : 'speaking');
    }
  };
  speak = function(text, rows = [], start = 0, only = false, options = {}) {
    if (!options.follow) return previousSpeak(text, rows, start, only);
    stop();
    if (!synth) { say('这台设备不支持浏览器朗读。'); return; }
    loadVoices();
    if (!voices.length) { say('请先在设备上安装英语朗读声音。'); return; }
    const parts = options.parts || sentences(text);
    if (!parts.length) return;
    const current = {options, index: Math.max(0, Math.min(start, parts.length - 1)), stage: 'speaking', paused: false, timer: null};
    session = current;
    const token = generation;
    const end = only ? current.index + 1 : parts.length;
    const gap = Math.max(1000, Math.min(30000, Number(options.gap) || 5000));
    function valid() { return session === current && generation === token; }
    function next(index) {
      if (!valid()) return;
      if (index >= end) { stop(); options.onState?.({state: 'complete', index: end - 1, remaining: 0}); return; }
      current.index = index; current.stage = 'speaking';
      document.querySelectorAll('.sentence.active').forEach(row => row.classList.remove('active'));
      if (rows[index]) { rows[index].classList.add('active'); rows[index].scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
      utterance = new SpeechSynthesisUtterance(parts[index]);
      utterance.lang = $('#accent').value;
      utterance.voice = voices.find(voice => voice.name === $('#voice').value) || voices.find(voice => voice.lang === utterance.lang) || voices[0];
      utterance.rate = Number($('#rate').value);
      utterance.onend = () => {
        if (!valid()) return;
        if (only) { next(end); return; }
        current.stage = 'waiting'; current.remaining = gap; current.due = Date.now() + gap;
        current.tick = () => {
          if (!valid() || current.paused) return;
          current.remaining = Math.max(0, current.due - Date.now());
          if (!current.remaining) { next(index + 1); return; }
          $('#playstate').textContent = '轮到你读了 · ' + Math.ceil(current.remaining / 1000) + ' 秒';
          notify('waiting', current.remaining);
          current.timer = setTimeout(current.tick, Math.min(200, current.remaining));
        };
        current.tick();
      };
      utterance.onerror = event => {
        if (!valid()) return;
        stop();
        if (!['canceled', 'interrupted'].includes(event.error)) say('朗读没有成功，可以换一个设备声音再试。');
      };
      $('#player').classList.add('visible');
      $('#playstate').textContent = '正在朗读 · 第 ' + (index + 1) + ' / ' + parts.length + ' 句';
      notify('speaking'); synth.speak(utterance);
    }
    next(current.index);
  };
})();
