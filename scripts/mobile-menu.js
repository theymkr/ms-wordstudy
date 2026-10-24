/* Rearrange existing controls without replacing handlers or changing study data. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  function selectTab(name, focus = false) {
    for (const tab of document.querySelectorAll('#ymMenuTabs button')) {
      const selected = tab.dataset.panel === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    }
    for (const panel of document.querySelectorAll('.ym-menu-panel')) panel.hidden = panel.dataset.panel !== name;
    if (name === 'memorize' || name === 'study') {
      const panel=byId('ymPanel-'+name), fields=document.querySelector('.range-fields');
      const nodes=[fields,byId('ymCustomRange'),byId('rangeCount')].filter(Boolean);
      if(panel)panel.prepend(...nodes);
    }
    if(typeof stop==='function')stop();
  }
  function refreshSummary() {
    const summary = byId('ymAudioSummary');
    if (!summary) return;
    const status = byId('sourceStatus')?.textContent || '';
    const text = byId('sourceUS')?.getAttribute('aria-pressed') === 'true'
      ? '미국식 녹음 · 음원이 있는 단어만 출제'
      : '기기의 미국식 영어 음성으로 출제';
    if (summary.textContent !== text) summary.textContent = text;
    summary.title = status;
  }
  function mount() {
    const c = document.querySelector('.quiz-container');
    if (!c || !byId('ymBookSelect')) return;
    if (byId('ymMenuTabs')) { refreshSummary(); return; }
    const original = Array.from(c.children);
    const heading = c.querySelector('h2');
    const header = document.createElement('header'); header.className = 'ym-menu-header';
    if (heading) header.append(heading);
    const sync = document.createElement('div'); sync.className = 'ym-menu-sync';
    for (const id of ['cloudStatus', 'ymSyncNow']) { const node = byId(id); if (node) sync.append(node); }
    if (sync.children.length) header.append(sync);
    const nav = document.createElement('div'); nav.id = 'ymMenuTabs'; nav.setAttribute('role','tablist'); nav.setAttribute('aria-label','단어 공부 메뉴');
    const panels = {};
    for (const [name, label] of [['memorize','암기·발음'], ['study','시험·성적'], ['settings','설정·관리']]) {
      const tab = document.createElement('button'); tab.type = 'button'; tab.id = 'ymTab-' + name;
      tab.dataset.panel = name; tab.textContent = label; tab.setAttribute('role','tab');
      tab.setAttribute('aria-controls','ymPanel-' + name); tab.onclick = () => selectTab(name);
      tab.onkeydown = event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = Array.from(nav.children), index = buttons.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        selectTab(buttons[next].dataset.panel, true);
      };
      nav.append(tab);
      const panel = document.createElement('section'); panel.id = 'ymPanel-' + name;
      panel.className = 'ym-menu-panel'; panel.dataset.panel = name; panel.setAttribute('role','tabpanel');
      panel.setAttribute('aria-labelledby',tab.id); panel.tabIndex = 0; panels[name] = panel;
    }
    const study = panels.study, review = panels.study, settings = panels.settings;
    const fields = c.querySelector('.range-fields');
    // Keep the original selector and its listeners available in every tab,
    // including settings where edit/delete act on the selected book.
    const bookField = byId('ymBookSelect').closest('label');
    bookField.id = 'ymMenuBook';
    const intro = fields?.previousElementSibling;
    if (intro?.classList.contains('hint')) intro.hidden = true;
    const sources = c.querySelector('.pronunciation-source-buttons');
    const sourceHeading = sources?.previousElementSibling;
    const modes = byId('rangeStartListen')?.parentElement;
    const modeHeading = modes?.previousElementSibling;
    const move = (parent, node) => { if (node) parent.append(node); };
    for (const node of [fields, byId('ymCustomRange'), byId('rangeCount'), sourceHeading, sources]) move(study,node);
    const summary = document.createElement('p'); summary.id = 'ymAudioSummary'; summary.className = 'hint'; summary.setAttribute('aria-live','polite'); study.append(summary);
    move(study,byId('pronunciationSpeed'));
    for (const node of [modeHeading,modes]) move(study,node);
    // Shorter labels fit two full-width columns on a phone.
    for (const [id,label,detail] of [['sourceUS','🇺🇸 미국식 녹음','2,316개 확보'],['sourceIphone','기기 음성','미국식 영어']]) {
      const button = byId(id); if (!button) continue;
      button.replaceChildren(document.createTextNode(label));
      const small = document.createElement('small'); small.textContent = detail; button.append(small);
    }
    const speed = byId('pronunciationSpeed');
    const speedHelp = document.createElement('div'); speedHelp.className = 'ym-settings-help';
    for (const node of [speed?.querySelector('.pronunciation-speed-scale'), byId('pronunciationSpeedNote')]) move(speedHelp,node);
    const account = original.find(node => node.classList.contains('quiz-header'));
    if (account) { account.classList.add('ym-menu-account'); move(settings,account); }
    for (const id of ['ymFileImportOpen','ymEditSelectedBook','ymTrashSelectedBook','ymDeletedBooks']) move(settings,byId(id));
    // Remaining original controls retain their nodes, listeners, IDs and state.
    for (const node of original) {
      if (node.parentElement !== c) continue;
      if (node.hidden || node.classList.contains('range-eyebrow')) { node.hidden = true; continue; }
      const text = node.textContent || '';
      if (node.id === 'ymSameRangeSummary' || node.id === 'ymFrequentActions' || node.id.startsWith('wrong-') || /성적 기록|결과 복사|틀린 문제만|각 방식의 최근 시험/.test(text)) move(review,node);
      else move(settings,node);
    }
    const rules = settings.querySelector('.range-rules');
    if (rules && !rules.closest('details')) {
      const details = document.createElement('details'); details.className = 'ym-menu-details';
      const title = document.createElement('summary'); title.textContent = '시험 안내';
      rules.before(details); details.append(title,rules);
    }
    if (speedHelp.children.length) settings.append(speedHelp);
    c.append(header,bookField,nav,panels.memorize,study,settings);
    selectTab('memorize'); refreshSummary();
  }
  const previousMenu = menu;
  menu = function () { const result = previousMenu.apply(this,arguments); mount(); return result; };
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; mount(); });
  }).observe(container,{childList:true,subtree:true});
  mount();
})();

/* Keep exam controls at normal phone width. Paging only changes visibility;
 * the original answer buttons and per-part grading state remain intact. */
(() => {
  'use strict';
  function viewportSize() {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--ym-exam-height', height + 'px');
    const c = document.querySelector('.quiz-container');
    c?.classList.toggle('ym-keyboard-compact', document.activeElement?.id === 'answer' && height < 500);
    c?.classList.toggle('ym-import-compact', height < 500);
  }
  viewportSize();
  window.addEventListener('resize',viewportSize);
  window.visualViewport?.addEventListener('resize',viewportSize);
  document.addEventListener('focusin',viewportSize);
  document.addEventListener('focusout',() => requestAnimationFrame(viewportSize));
  function mountExam() {
    const c = document.querySelector('.quiz-container'), question = document.getElementById('question');
    if (!c || !question || document.getElementById('ymExamToolbar')) return;
    const toolbar = document.createElement('div'); toolbar.id = 'ymExamToolbar';
    const header = c.querySelector('.quiz-header'), speaker = c.querySelector('.ym-top-speaker');
    if (header) toolbar.append(header);
    if (speaker) toolbar.append(speaker);
    c.prepend(toolbar);
    const meta = document.createElement('div'); meta.id = 'ymExamMeta';
    const number = [...c.children].find(node => node.tagName === 'P' && node.textContent.startsWith('단어 번호'));
    if (number) meta.append(number);
    const elapsed = document.getElementById('elapsedTime'); if (elapsed) meta.append(elapsed);
    toolbar.after(meta);
    const speed = document.getElementById('pronunciationSpeed');
    if (speed) {
      speed.classList.add('ym-exam-speed');
      speed.title = '발음 속도 · 다음 발음부터 적용';
      toolbar.after(speed);
      const details = document.createElement('details'); details.id = 'ymExamSettings';
      const summary = document.createElement('summary'); summary.id = 'ymExamSettingsSummary';
      summary.textContent = '사전 · 설정';
      details.append(summary); meta.after(details);
      const dictionary = document.getElementById('ymNaverDictionary'); if (dictionary) details.append(dictionary);
      const close = document.createElement('button'); close.type = 'button'; close.className = 'option-btn'; close.textContent = '설정 닫기'; close.onclick = () => { details.open = false; summary.focus(); }; details.append(close);
      details.addEventListener('keydown',event => { if (event.key === 'Escape') { details.open = false; summary.focus(); } });
    }
    const input = document.getElementById('answer');
    if (input) {
      input.placeholder = '영어 단어 입력';
      input.setAttribute('enterkeyhint','done');
      const dismiss = document.createElement('button');
      dismiss.id = 'ymHideKeyboard'; dismiss.type = 'button';
      dismiss.textContent = '키보드 닫기';
      dismiss.addEventListener('click',() => { input.blur(); viewportSize(); });
      toolbar.append(dismiss);
    }
    const home = document.getElementById('home'); if (home) { home.textContent = '시험 종료 · 메뉴'; home.title = '10문제 이상 채점한 기록은 자동 저장됩니다.'; }
    const area = document.getElementById('area');
    const parts = [...area.children].filter(node => node.classList.contains('answer-panel'));
    if (parts.length === 2 && c.classList.contains('wide-quiz')) {
      area.classList.add('ym-multi-sense');
      parts.forEach(panel => { panel.hidden = false; });
    } else if (parts.length > 1) {
      let current = 0;
      const nav = document.createElement('div'); nav.id = 'ymPartPager'; nav.setAttribute('aria-label','품사와 뜻 선택 단계');
      const prev = document.createElement('button'), next = document.createElement('button'), label = document.createElement('span');
      prev.type = next.type = 'button'; prev.textContent = '← 이전'; next.textContent = '다음 →';
      label.setAttribute('aria-live','polite'); nav.append(prev,label,next); area.before(nav);
      function show(index) {
        current = index; parts.forEach((panel,i) => { panel.hidden = i !== current; });
        label.textContent = '품사·뜻 ' + (current + 1) + ' / ' + parts.length;
        prev.disabled = current === 0; next.disabled = current === parts.length-1;
      }
      prev.onclick = () => show(current-1); next.onclick = () => show(current+1);
      area.addEventListener('click',event => {
        if (locked || !event.target.closest('button[data-part]')) return;
        const panel = parts[current];
        if (current < parts.length-1 && panel.querySelector('[data-part="pos"][aria-pressed="true"]') && panel.querySelector('[data-part="meaning"][aria-pressed="true"]')) show(current+1);
      });
      show(0);
    }
    viewportSize();
  }
  const previousLoad = load;
  load = function () { const result = previousLoad.apply(this,arguments); mountExam(); return result; };
  mountExam();
})();
