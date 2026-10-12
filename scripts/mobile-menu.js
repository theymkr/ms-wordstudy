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
    for (const [name, label] of [['study','학습'], ['review','오답·성적'], ['settings','설정·관리']]) {
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
      panel.setAttribute('aria-labelledby',tab.id); panels[name] = panel;
    }
    const study = panels.study, review = panels.review, settings = panels.settings;
    const fields = c.querySelector('.range-fields');
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
      if (node.id === 'ymFrequentActions' || node.id.startsWith('wrong-') || /성적 기록|결과 복사|틀린 문제만|각 방식의 최근 시험/.test(text)) move(review,node);
      else move(settings,node);
    }
    const rules = settings.querySelector('.range-rules');
    if (rules && !rules.closest('details')) {
      const details = document.createElement('details'); details.className = 'ym-menu-details';
      const title = document.createElement('summary'); title.textContent = '시험 안내';
      rules.before(details); details.append(title,rules);
    }
    if (speedHelp.children.length) settings.append(speedHelp);
    c.append(header,nav,study,review,settings);
    selectTab('study'); refreshSummary();
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
