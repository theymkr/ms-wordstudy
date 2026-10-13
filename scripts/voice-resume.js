/* Local account-scoped checkpoints; speech capture starts only on a tap. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const key = () => activeUser ? 'ym-resume-v1:' + encodeURIComponent(activeUser) : null;
  const methodKey = () => 'ym-answer-method-v1:' + encodeURIComponent(activeUser);
  let restoring = false, owner = '', suspended = false, speech = null, speechTimer = null;
  let speechGeneration = 0, answerMethod = 'keyboard', voiceText = '', preferred = 'keyboard';
  function preference() {
    try { return localStorage.getItem(methodKey()) === 'voice' ? 'voice' : 'keyboard'; } catch (_) { return preferred; }
  }
  window.YMVoicePreference = preference;
  function setPreference(value) { preferred = value; try { localStorage.setItem(methodKey(), value); } catch (_) {} }
  function notice(message) { const node = byId('ymVoiceStatus'); if (node) node.textContent = message; }
  function stopSpeech() {
    speechGeneration++; clearTimeout(speechTimer); speechTimer = null;
    const old = speech; speech = null; if (old) { try { old.abort(); } catch (_) {} }
    const button = byId('ymSpeakAnswer'); if (button) { button.textContent = '🎤 철자 말하기'; button.setAttribute('aria-pressed','false'); }
  }
  const originalStop = stop;
  stop = function () { stopSpeech(); return originalStop.apply(this, arguments); };
  function storageNotice() {
    const node = byId('feedback') || byId('ymResumeNotice');
    if (node) node.textContent = '이 브라우저에 시험을 저장하지 못했습니다. 화면을 닫으면 이어서 할 수 없습니다.';
  }
  function readCheckpoint() {
    try {
      const raw = key() && localStorage.getItem(key()); if (!raw || raw.length > 6000000) return null;
      const data = JSON.parse(raw);
      if (data.version !== 1 || data.owner !== activeUser || !Array.isArray(data.questions) || !data.questions.length || data.questions.length > 20000 || !['listen','meaning'].includes(data.mode)) return null;
      if (!Number.isInteger(data.currentIdx) || data.currentIdx < 0 || data.currentIdx >= data.questions.length || !Array.isArray(data.records) || !Array.isArray(data.retryQueue)) return null;
      if (!data.retryQueue.every(i => Number.isInteger(i) && i >= 0 && i < data.questions.length)) return null;
      if (!Number.isFinite(data.elapsed) || data.elapsed < 0) return null;
      return data;
    } catch (_) { return null; }
  }
  function clearCheckpoint() { try { if (key()) localStorage.removeItem(key()); } catch (_) {} }
  function selections() {
    return [...document.querySelectorAll('#area .answer-panel')].map(panel => [...panel.querySelectorAll('[aria-pressed="true"]')].map(b => ({part:b.dataset.part,value:b.dataset.value})));
  }
  function checkpoint() {
    if (restoring || !attemptActive || !activeUser || owner !== activeUser || currentIdx >= questions.length) return;
    const set = window.YMImportStudy?.currentSet();
    const data = {
      version:1, owner:activeUser, savedAt:Date.now(), bookId:set ? 'set:' + set.id : 'ms', bookName:set?.name || 'MS 단어장',
      bookRevision:set ? JSON.stringify(set.words) : null,
      mode, rangeStart, rangeEnd, questions, currentIdx, records, wrongOnly, retryQueue, retryMode, retryTotal, retryCorrect,
      elapsed:elapsedMilliseconds(), pending:locked, runSaved, savedAttemptId, source:activePronunciationSource,
      misses:[...attemptMissCounts], sessionMisses:[...sessionMisses], pronunciationCount,
      answer:byId('answer')?.value || '', selections:selections(), answerMethod, voiceText, preference:preference()
    };
    try { localStorage.setItem(key(), JSON.stringify(data)); } catch (_) { storageNotice(); }
  }
  function resume() {
    const data = readCheckpoint(); if (!data) return;
    const set = data.bookId === 'ms' ? null : window.YMImportStudy?.sets().find(s => 'set:' + s.id === data.bookId);
    if (data.bookId !== 'ms' && (!set || JSON.stringify(set.words) !== data.bookRevision)) {
      byId('ymResumeNotice').textContent = '저장 후 단어장이 수정되거나 삭제됐습니다. 새 시험을 시작해 주세요.'; return;
    }
    restoring = true;
    try {
      if (!window.YMBookRange.selectBook(data.bookId)) throw Error('책을 찾을 수 없습니다.');
      if (!data.questions.every(q => {
        const live = allQuestions[q.sourceIndex];
        return live && live.word === q.word && live.number === q.number && live.options[live.answer] === q.options?.[q.answer];
      })) throw Error('단어 내용이 변경됐습니다. 새 시험을 시작해 주세요.');
      stop(); stopClock(); owner = activeUser; suspended = false;
      mode = data.mode; rangeStart = data.rangeStart; rangeEnd = data.rangeEnd; testCount = rangeEnd-rangeStart+1;
      questions = data.questions; currentIdx = data.currentIdx; records = data.records;
      wrongOnly = data.wrongOnly; retryQueue = data.retryQueue; retryMode = data.retryMode; retryTotal = data.retryTotal; retryCorrect = data.retryCorrect;
      runSaved = data.runSaved; savedAttemptId = data.savedAttemptId;
      attemptMissCounts = new Map(data.misses); sessionMisses = new Map(data.sessionMisses); pronunciationCount = data.pronunciationCount;
      activePronunciationSource = set ? 'iphone' : data.source === 'us' ? 'us' : 'iphone';
      setPreference(data.preference === 'voice' ? 'voice' : 'keyboard');
      attemptActive = true; locked = false;
      clockElapsed = data.elapsed; clockStarted = Date.now()-clockElapsed; clockInterval = setInterval(updateClock,250);
      if (data.pending) nextQuestion();
      else {
        load(); stop(); // Resume waits for an explicit replay/submission; no surprise grading.
        const input = byId('answer');
        if (input) { input.value = data.answer; answerMethod = data.answerMethod; voiceText = data.voiceText; }
        for (const [index, choices] of (data.selections || []).entries()) {
          const panel = document.querySelectorAll('#area .answer-panel')[index];
          for (const choice of choices) {
            const button = [...(panel?.querySelectorAll('button') || [])].find(b => b.dataset.part === choice.part && b.dataset.value === choice.value);
            button?.click();
          }
        }
        notice('이어서 시작했습니다. 답을 입력하거나 말한 뒤 입력 완료를 누르세요.');
      }
    } catch (error) { stopClock(); stop(); attemptActive = false; menu(); const n=byId('ymResumeNotice'); if(n)n.textContent=error.message; }
    finally { restoring = false; checkpoint(); }
  }
  function mountMenu() {
    const panel = byId('ymPanel-study'); if (!panel || byId('ymVoiceChoice')) return;
    const choice = document.createElement('label'); choice.id = 'ymVoiceChoice';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = preference() === 'voice';
    checkbox.onchange = () => setPreference(checkbox.checked ? 'voice' : 'keyboard');
    choice.append(checkbox, document.createTextNode('알파벳을 하나씩 말하기 · 확인 후 채점'));
    panel.querySelector('.exam-mode-buttons')?.before(choice);
    if (!choice.isConnected) panel.append(choice);
    const data = readCheckpoint(); if (!data) return;
    const box = document.createElement('div'); box.id = 'ymResumeCard';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'restart-btn'; button.textContent = '▶ 이어서 하기'; button.onclick = resume;
    const info = document.createElement('p'); info.id = 'ymResumeNotice';
    info.textContent = data.bookName + ' · ' + (data.mode === 'listen' ? '철자 쓰기' : '품사·뜻') + ' · ' + data.records.length + '/' + data.questions.length + '개 채점 · 이 기기에 저장됨';
    const hint = document.createElement('small'); hint.textContent = '새 시험을 시작하면 이전 이어하기는 새 시험으로 바뀝니다.';
    box.append(button,info,hint); panel.prepend(box);
  }
  // Decode letter names only: never infer spelling from the expected answer.
  function spelledLetters(raw) {
    const aliases = {a:'a',ay:'a',aye:'a',b:'b',bee:'b',be:'b',c:'c',see:'c',sea:'c',d:'d',dee:'d',e:'e',ee:'e',f:'f',ef:'f',eff:'f',g:'g',gee:'g',h:'h',aitch:'h',haitch:'h',i:'i',eye:'i',j:'j',jay:'j',k:'k',kay:'k',l:'l',el:'l',ell:'l',m:'m',em:'m',n:'n',en:'n',o:'o',oh:'o',p:'p',pee:'p',q:'q',cue:'q',queue:'q',r:'r',are:'r',ar:'r',s:'s',ess:'s',es:'s',t:'t',tee:'t',tea:'t',u:'u',you:'u',v:'v',vee:'v',w:'w',x:'x',ex:'x',y:'y',why:'y',z:'z',zee:'z',zed:'z',에이:'a',비:'b',씨:'c',시:'c',디:'d',이:'e',에프:'f',지:'g',에이치:'h',아이:'i',제이:'j',케이:'k',엘:'l',엠:'m',엔:'n',오:'o',피:'p',큐:'q',알:'r',에스:'s',티:'t',유:'u',브이:'v',더블유:'w',엑스:'x',와이:'y',제트:'z',지드:'z'};
    const tokens = String(raw).toLowerCase().replace(/double[ -]+(?:u|you)/g,'w').replace(/[.,!?;:–—-]/g,' ').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || tokens.some(t => !aliases[t])) return null;
    return tokens.map(t => aliases[t]).join('');
  }
  function startSpeech() {
    if (locked) return;
    if (speech) { try { speech.stop(); notice('철자를 정리하고 있습니다.'); } catch (_) { stopSpeech(); } return; }
    setPreference('voice'); stop(); byId('answer')?.blur();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { notice('음성 입력을 지원하지 않습니다. Safari에서 열거나 키보드의 마이크를 사용해 주세요.'); return; }
    const input = byId('answer'), generation = ++speechGeneration;
    const current = () => generation === speechGeneration && input?.isConnected && !locked && attemptActive;
    let received = false;
    try {
      const recognition = new Recognition(); speech = recognition;
      recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        if (!current()) return;
        const raw = Array.from(event.results || [], result => result[0]?.transcript || '').join(' ');
        const text = spelledLetters(raw);
        if (!text) { notice('알파벳 이름을 하나씩 말해 주세요. 예: B · O · T · T · O · M. 다시 누르면 처음부터 인식합니다.'); stopSpeech(); return; }
        received = true; input.value = text; answerMethod = 'voice'; voiceText = text;
        notice('인식한 철자: ' + text.toUpperCase().split('').join(' · ') + ' → ' + text + ' · 다 말했으면 말하기 완료를 누르세요.'); checkpoint();
      };
      recognition.onerror = event => {
        if (!current()) return;
        const message = ['not-allowed','service-not-allowed'].includes(event.error) ? '마이크·음성 인식 권한을 허용해 주세요.' : event.error === 'no-speech' ? '목소리가 감지되지 않았습니다. 다시 눌러 말해 주세요.' : '음성 인식이 연결되지 않았습니다. Safari 또는 키보드 마이크를 이용해 주세요.';
        stopSpeech(); notice(message);
      };
      recognition.onend = () => { if (!current()) return; stopSpeech(); notice(received ? '인식한 철자를 확인 후 입력 완료를 누르세요.' : '인식된 철자가 없습니다. 다시 말하거나 직접 입력해 주세요.'); };
      recognition.start();
      const button = byId('ymSpeakAnswer'); button.textContent = '■ 말하기 완료'; button.setAttribute('aria-pressed','true');
      notice('알파벳을 하나씩 말해 주세요. 예: B · O · T · T · O · M. 다시 시작하면 새 철자로 바뀝니다.');
      speechTimer = setTimeout(() => { if (current()) { stopSpeech(); if (!received) notice('음성 인식 응답이 없습니다. Safari 또는 키보드 마이크를 이용해 주세요.'); } },30000);
    } catch (_) { stopSpeech(); notice('음성 인식을 시작하지 못했습니다. 다시 누르거나 직접 입력해 주세요.'); }
  }
  // Enter confirms a completed spoken spelling, including when the mobile keyboard is hidden.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || mode !== 'listen' || answerMethod !== 'voice' || !voiceText || locked || !attemptActive) return;
    const input = byId('answer'), submit = byId('submit');
    if (!input || input.value !== voiceText || event.target === submit) return;
    event.preventDefault();
    stopSpeech();
    submit?.click();
  }, true);
  function mountExam() {
    if (!byId('question')) return;
    const home = byId('home'); if (home) home.textContent = '저장·나가기';
    window.YMPlaybackControls?.();
    const input = byId('answer'); if (!input || byId('ymVoiceControls')) return;
    const controls = document.createElement('div'); controls.id = 'ymVoiceControls';
    const speak = document.createElement('button'); speak.id = 'ymSpeakAnswer'; speak.type = 'button'; speak.textContent = '🎤 철자 말하기'; speak.setAttribute('aria-pressed','false'); speak.onclick = startSpeech;
    const keyboard = document.createElement('button'); keyboard.type = 'button'; keyboard.textContent = '직접 입력'; keyboard.onclick = () => { stop(); setPreference('keyboard'); input.focus(); notice('답을 입력한 뒤 입력 완료를 누르세요.'); };
    const status = document.createElement('p'); status.id = 'ymVoiceStatus'; status.setAttribute('role','status');
    status.textContent = '알파벳을 하나씩 말하기 → 철자 확인 → 입력 완료 · 음성은 브라우저 인식 서비스에서 처리됩니다.';
    controls.append(speak,keyboard); input.before(controls); controls.after(status);
    input.addEventListener('input',() => { answerMethod = 'keyboard'; voiceText = ''; checkpoint(); });
    if (preference() === 'voice') input.blur();
  }
  const originalPlay = play;
  play = function () {
    if (preference() !== 'voice') return originalPlay.apply(this,arguments);
    if (locked) return;
    stop(); byId('answer')?.blur(); const id = token; let count = 0;
    const next = () => {
      if (id !== token) return;
      const status = byId('audioStatus'); if (!status) return;
      status.textContent = '발음 재생 ' + (++count) + ' / 2';
      playWordPronunciation(questions[currentIdx].word,id,() => {
        if (id !== token) return;
        if (count < 2) timer = setTimeout(next,3000);
        else timer = setTimeout(() => { if (id === token) status.textContent = '🎤 철자 말하기를 누르세요. 확인 후 채점합니다.'; },3000);
      },() => { if (id === token) status.textContent = '발음을 다시 재생하거나 말로 답하기를 누르세요.'; });
    }; next();
  };
  const originalLoad = load;
  load = function () { answerMethod = 'keyboard'; voiceText = ''; const r = originalLoad.apply(this,arguments); mountExam(); checkpoint(); return r; };
  const originalRecord = recordAnswer;
  recordAnswer = function (q,correct,typed) {
    const wasRetry = retryMode; const r = originalRecord.apply(this,arguments);
    if (!wasRetry && records.length) records[records.length-1].answerMethod = mode === 'meaning' ? 'choice' : answerMethod === 'voice' && typed === voiceText ? 'voice' : 'keyboard';
    saveScore(); checkpoint(); return r;
  };
  const originalSave = saveScore;
  saveScore = function () {
    const r = originalSave.apply(this,arguments);
    if (savedAttemptId && runSaved && records.length >= 10) {
      const entry = memoryHistory.find(row => row.id === savedAttemptId);
      if (entry) {
        entry.answerMethods = {voice:records.filter(row => row.answerMethod === 'voice').length, keyboard:records.filter(row => !row.answerMethod || row.answerMethod === 'keyboard').length, choice:records.filter(row => row.answerMethod === 'choice').length};
        try { localStorage.setItem(SCORE_KEY,JSON.stringify(memoryHistory)); } catch (_) { storageNotice(); }
      }
    }
    return r;
  };
  const originalChangeUser = changeUser;
  changeUser = function () { finishAttempt(); stop(); return originalChangeUser.apply(this,arguments); };
  const originalStart = startRun;
  startRun = function () { finishAttempt(); clearCheckpoint(); owner = activeUser; suspended = false; return originalStart.apply(this,arguments); };
  const originalFinish = finishAttempt;
  finishAttempt = function () { checkpoint(); return originalFinish.apply(this,arguments); };
  const originalResult = result;
  result = function () { clearCheckpoint(); owner = ''; return originalResult.apply(this,arguments); };
  const originalMenu = menu;
  menu = function () { const r = originalMenu.apply(this,arguments); mountMenu(); return r; };
  // Save selection state after original handlers; hidden-page saves also cover OS interruption.
  container.addEventListener('click',() => { if (attemptActive) checkpoint(); });
  window.addEventListener('pagehide',() => { checkpoint(); if (attemptActive) { stopClock(); stop(); suspended = true; } });
  document.addEventListener('visibilitychange',() => {
    if (document.visibilityState === 'hidden') { checkpoint(); if (attemptActive) { stopClock(); stop(); suspended = true; } }
    else if (suspended) { suspended = false; if (activeUser && owner === activeUser) menu(); }
  });
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mountMenu(); }); }).observe(container,{childList:true,subtree:true});
  mountMenu();
})();
