/* Book/range controls are presentation state only. Score and import storage keys
 * remain owned by the original quiz and YMImportStudy modules. */
(function (root, makeHelpers) {
 'use strict';
 const helpers = makeHelpers();
 if (typeof module === 'object' && module.exports) module.exports = helpers;
 if (!root || !root.document) return;
 const BASE = 2956;
 let owner = null, selectedBookId = 'ms', remembered = new Map();
 let msPronunciationSource = pronunciationSource, renderingMenu = false;
 const byId = id => document.getElementById(id);
 const imports = () => root.YMImportStudy;
 const activeSet = () => imports()?.currentSet?.() || null;
 const activeId = () => activeSet() ? 'set:' + activeSet().id : 'ms';
 function prepareOwner() {
  if (owner === activeUser) return;
  owner = activeUser; selectedBookId = 'ms'; remembered = new Map();
  msPronunciationSource = pronunciationSource;
 }
 function books() {
  const saved = imports()?.sets?.() || [];
  return [{id:'ms', name:'MS 단어장', count:BASE, set:null}, ...saved.filter(set => set && typeof set.id === 'string' && Array.isArray(set.words) && set.words.length).map(set => ({id:'set:' + set.id, name:String(set.name || '내 단어장'), count:set.words.length, set}))];
 }
 function selectedBook() { return books().find(book => book.id === selectedBookId) || books()[0]; }
 function rememberRange() {
  if (owner !== activeUser) return;
  const book = books().find(book => book.id === activeId());
  if (book && helpers.validRange(rangeStart, rangeEnd, book.count)) remembered.set(book.id, {start:rangeStart, end:rangeEnd});
 }
 function option(value, label) { const node = document.createElement('option'); node.value = value; node.textContent = label; return node; }
 function compatibilityValue(id, value) {
  const select = byId(id); if (!select) return;
  select.replaceChildren(option(String(value), String(value))); select.value = String(value);
 }
 function updateAudio() {
  const imported = !!activeSet();
  const recorded = byId('sourceUS');
  if (recorded) { recorded.disabled = imported; recorded.title = imported ? '이 책은 기기의 영어 음성으로 읽습니다.' : ''; }
  setPronunciationSource(imported ? 'iphone' : msPronunciationSource);
  const status = byId('sourceStatus');
  if (imported && status) status.textContent = '선택한 책은 기기의 미국식 영어 음성으로 읽습니다.';
 }
 const previousSource = setPronunciationSource;
 setPronunciationSource = function (source) {
  if (activeSet()) source = 'iphone';
  else if (!renderingMenu) msPronunciationSource = source === 'us' ? 'us' : 'iphone';
  return previousSource.call(this, source);
 };
 function setRangeControls(book, requested) {
  const bounds = helpers.validRange(requested?.start, requested?.end, book.count) ? requested : {start:1, end:Math.min(50, book.count)};
  const select = byId('ymStudyRangeSelect');
  select.replaceChildren(...helpers.ranges(book.count).map(range => option(range.value, range.label)), option('custom', '직접 지정…'));
  const value = bounds.start + ':' + bounds.end;
  select.value = Array.from(select.options).some(row => row.value === value) ? value : 'custom';
  for (const [id, val] of [['ymRangeFrom',bounds.start], ['ymRangeTo',bounds.end]]) {
   const input = byId(id); input.min = '1'; input.max = String(book.count); input.value = String(val);
  }
  byId('ymCustomRange').hidden = select.value !== 'custom';
  const edit = byId('ymEditSelectedBook'); if (edit) edit.hidden = !book.set || typeof imports()?.edit !== 'function';
  updateAudio(); captureRange();
 }
 function chooseBook(id, options = {}) {
  prepareOwner();
  let book = books().find(item => item.id === id || item.set?.id === id);
  if (!book) return false;
  // A direct call during an exam must not move its remaining answers to another book.
  finishAttempt(); stopClock(); stop(); if (options.remember !== false) rememberRange();
  const desired = remembered.get(book.id);
  if (book.id !== activeId()) {
   if (book.set) { if (typeof imports()?.activate !== 'function') return false; imports().activate(book.set); }
   else { if (activeSet() && typeof imports()?.reset !== 'function') return false; imports()?.reset?.(); }
  }
  selectedBookId = book.id;
  if (byId('ymBookSelect')) {
   byId('ymBookSelect').value = book.id;
   setRangeControls(book, desired);
  } else {
   const bounds = desired && helpers.validRange(desired.start, desired.end, book.count) ? desired : {start:1,end:Math.min(50,book.count)};
   rangeStart = bounds.start; rangeEnd = bounds.end; testCount = bounds.end - bounds.start + 1;
  }
  return true;
 }
 const previousSelected = selectedQuestions;
 selectedQuestions = function () {
  if (!imports()?.currentSet) return previousSelected.apply(this, arguments);
  const imported = !!activeSet();
  return allQuestions.filter(question => (imported ? question.sourceIndex >= BASE : question.sourceIndex < BASE) && question.number >= rangeStart && question.number <= rangeEnd);
 };
 const previousCapture = captureRange;
 captureRange = function () {
  const select = byId('ymStudyRangeSelect');
  if (!select) return previousCapture.apply(this, arguments);
  const book = selectedBook();
  const bounds = select.value === 'custom' ? {start:Number(byId('ymRangeFrom').value),end:Number(byId('ymRangeTo').value)} : helpers.decodeRange(select.value);
  const valid = !!bounds && helpers.validRange(bounds.start,bounds.end,book.count) && activeId() === book.id;
  byId('ymCustomRange').hidden = select.value !== 'custom';
  for (const id of ['ymRangeFrom','ymRangeTo']) byId(id).setAttribute('aria-invalid', select.value === 'custom' && !valid ? 'true' : 'false');
  if (valid) {
   rangeStart = bounds.start; rangeEnd = bounds.end; testCount = bounds.end - bounds.start + 1;
   remembered.set(book.id, {start:rangeStart,end:rangeEnd});
   compatibilityValue('rangeStartSelect', rangeStart); compatibilityValue('rangeCountSelect', testCount);
   previousCapture.apply(this, arguments);
  }
  const questionsInRange = valid ? selectedQuestions() : [];
  const enabled = valid && questionsInRange.length > 0;
  const status = byId('rangeCount');
  if (status) status.textContent = enabled ? book.name + ' · ' + rangeStart + '–' + rangeEnd + '번 · ' + questionsInRange.length + '개' : '이 책의 1–' + book.count + '번 안에서 시작·끝 번호를 확인해 주세요.';
  for (const id of ['rangeStartListen','rangeStartMeaning']) { const button = byId(id); if (button) button.disabled = !enabled; }
  const wrong = readWrong();
  for (const exam of ['listen','meaning']) {
   const button = byId('wrong-' + exam); if (!button) continue;
   const count = questionsInRange.filter(question => (wrong[exam] || []).includes(question.sourceIndex)).length;
   button.textContent = modeName(exam) + ' · 오답 ' + count + '개'; button.disabled = !enabled || !count; button.style.opacity = button.disabled ? '.5' : '1';
  }
  return enabled;
 };
 function mount() {
  const marker = byId('rangeStartSelect'); if (!marker || byId('ymBookSelect')) return;
  prepareOwner();
  const fields = marker.closest('.range-fields'); if (!fields) return;
  // Preserve marker IDs used by the existing compact menu and import controls.
  for (const child of Array.from(fields.children)) child.hidden = true;
  const makeSelect = (id, title) => {
   const label = document.createElement('label'); label.className = 'mode-field'; label.textContent = title;
   const select = document.createElement('select'); select.id = id; label.append(select); fields.append(label); return select;
  };
  const bookSelect = makeSelect('ymBookSelect', '책 선택');
  for (const book of books()) bookSelect.append(option(book.id, book.name + ' · ' + book.count + '개'));
  const rangeSelect = makeSelect('ymStudyRangeSelect', '학습 영역');
  const custom = document.createElement('div'); custom.id = 'ymCustomRange'; custom.className = 'ym-custom-range'; custom.hidden = true;
  for (const [id,title] of [['ymRangeFrom','시작 번호'],['ymRangeTo','끝 번호']]) {
   const label = document.createElement('label'); label.className = 'mode-field'; label.textContent = title;
   const input = document.createElement('input'); input.id = id; input.type = 'number'; input.step = '1'; input.inputMode = 'numeric'; input.setAttribute('aria-describedby','rangeCount'); input.addEventListener('input',captureRange); label.append(input); custom.append(label);
  }
  fields.after(custom);
  const edit = document.createElement('button'); edit.type = 'button'; edit.id = 'ymEditSelectedBook'; edit.className = 'option-btn'; edit.textContent = '선택한 책 수정'; edit.hidden = true;
  edit.onclick = () => { const set = selectedBook().set; if (set) imports()?.edit?.(set); };
  byId('ymFileImportOpen')?.after(edit);
  const list = byId('ymImportedSets'); if (list) list.hidden = true;
  const heading = container.querySelector('h2'); if (heading) heading.textContent = '단어 공부';
  const oldHint = fields.previousElementSibling; if (oldHint?.classList.contains('hint')) oldHint.textContent = '책을 고르고 공부할 영역을 선택하세요.';
  const rules = container.querySelector('.range-rules');
  if (rules?.firstChild?.nodeType === 3) rules.firstChild.textContent = '책 선택 → 학습 영역 선택 · 직접 지정으로 시작·끝 번호 설정';
  bookSelect.addEventListener('change', () => chooseBook(bookSelect.value));
  rangeSelect.addEventListener('change',captureRange);
  const book = books().find(item => item.id === selectedBookId) || books()[0];
  chooseBook(book.id, {remember:false});
 }
 const previousMenu = menu;
 menu = function () {
  // Finalize while the prior imported set and its score key are still active.
  const sameOwner = owner === activeUser;
  finishAttempt(); prepareOwner();
  if (sameOwner && activeSet()) selectedBookId = activeId();
  if (sameOwner) rememberRange();
  let result; renderingMenu = true;
  try { result = previousMenu.apply(this, arguments); } finally { renderingMenu = false; }
  mount(); return result;
 };
 root.YMBookRange = {books,selectBook:chooseBook,mount,selection:() => ({bookId:selectedBookId,start:rangeStart,end:rangeEnd})};
 mount();
})(typeof window === 'undefined' ? null : window, function () {
 'use strict';
 function validRange(start,end,total) { return Number.isInteger(start) && Number.isInteger(end) && Number.isInteger(total) && total > 0 && start >= 1 && end >= start && end <= total; }
 function decodeRange(value) { const match = /^(\d+):(\d+)$/.exec(String(value)); return match ? {start:Number(match[1]),end:Number(match[2])} : null; }
 function ranges(total) {
  if (!Number.isInteger(total) || total < 1) return [];
  const list = [];
  for (let start = 1; start <= total; start += 50) { const end = Math.min(start + 49,total); list.push({value:start + ':' + end,label:(total <= 50 ? '전체 · ' : '') + start + '–' + end + '번 (' + (end-start+1) + '개)'}); }
  if (total > 50) list.push({value:'1:' + total,label:'전체 · 1–' + total + '번 (' + total + '개)'});
  return list;
 }
 return {validRange,decodeRange,ranges};
});
