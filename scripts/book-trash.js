/* Optional release: recoverable trash for imported books. Requires book-range.js.
 * Permanent deletion remains unavailable without verified parent authorization. */
(() => {
 'use strict';
 if (!window.YMBookRange || window.YMBookTrash) return;
 const byId = id => document.getElementById(id);
 const imports = () => window.YMImportStudy;
 function selectedSet() {
  const id = window.YMBookRange.selection().bookId;
  return window.YMBookRange.books().find(book => book.id === id)?.set || null;
 }
 function updateSelected() {
  const trash = byId('ymTrashSelectedBook');
  if (trash) { trash.hidden = false; trash.disabled = typeof imports()?.trash !== 'function'; }
 }
 function openDeleteBook() {
  if (byId('ymDeleteBookDialog')) return;
  const saved = imports()?.sets?.() || [], selected = selectedSet();
  const dialog = document.createElement('dialog'); dialog.id = 'ymDeleteBookDialog';
  dialog.setAttribute('aria-labelledby','ymDeleteBookTitle');
  const title = document.createElement('h2'); title.id = 'ymDeleteBookTitle'; title.textContent = '삭제할 책 선택';
  const help = document.createElement('p');
  help.textContent = saved.length ? '삭제한 책은 휴지통에서 복원할 수 있으며 이전 성적은 유지됩니다. 기본 MS 단어장은 삭제할 수 없습니다.' : '삭제할 추가 단어장이 없습니다. 기본 MS 단어장은 삭제할 수 없습니다.';
  dialog.append(title,help);
  const select = document.createElement('select'); select.id = 'ymDeleteBookSelect';
  if (saved.length) {
   const label = document.createElement('label'); label.textContent = '책 선택';
   for (const set of saved) { const option = document.createElement('option'); option.value = set.id; option.textContent = set.name + ' · ' + (set.words.length + (set.pendingWords?.length || 0)) + '개'; select.append(option); }
   if (selected && saved.some(set => set.id === selected.id)) select.value = selected.id;
   label.append(select); dialog.append(label);
  }
  const actions = document.createElement('div'); actions.className = 'ym-edit-book-actions';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '취소'; cancel.onclick = () => dialog.close();
  actions.append(cancel);
  if (saved.length) {
   const submit = document.createElement('button'); submit.type = 'button'; submit.textContent = '선택한 책 삭제';
   submit.onclick = () => {
    const set = imports()?.sets?.().find(item => item.id === select.value);
    if (!set) { help.textContent = '책 목록이 변경되었습니다. 닫고 다시 선택해 주세요.'; return; }
    if (!window.confirm('“' + set.name + '” 책을 삭제할까요? 휴지통에서 복원할 수 있고 이전 성적은 유지됩니다.')) return;
    try { if (!imports()?.trash?.(set.id)) { help.textContent = '책을 찾지 못했습니다. 다시 선택해 주세요.'; return; } dialog.remove(); byId('ymTab-settings')?.click(); }
    catch (error) { help.textContent = '삭제 상태를 저장하지 못했습니다. 저장 공간을 확인해 주세요.'; }
   }; actions.append(submit);
  }
  dialog.addEventListener('close', () => { dialog.remove(); byId('ymTrashSelectedBook')?.focus(); });
  dialog.append(actions); container.append(dialog); dialog.showModal();
 }
 function mount() {
  const bookSelect = byId('ymBookSelect');
  if (!bookSelect || byId('ymTrashSelectedBook')) return;
  const trash = document.createElement('button'); trash.type = 'button'; trash.id = 'ymTrashSelectedBook'; trash.className = 'restart-btn'; trash.textContent = '🗑️ 책 삭제';
  trash.onclick = openDeleteBook;
  const anchor = byId('ymEditSelectedBook') || byId('ymFileImportOpen');
  if (anchor) anchor.after(trash); else container.append(trash);
  bookSelect.addEventListener('change',updateSelected);
  updateSelected();
  const deleted = (imports()?.sets?.(true) || []).filter(set => set?.deletedAt);
  if (!deleted.length || typeof imports()?.restore !== 'function') return;
  const details = document.createElement('details'); details.id = 'ymDeletedBooks'; details.className = 'ym-menu-details';
  const summary = document.createElement('summary'); summary.textContent = '휴지통 · ' + deleted.length + '권'; details.append(summary);
  for (const set of deleted) {
   const row = document.createElement('div'); row.className = 'ym-deleted-book';
   const label = document.createElement('span'); label.textContent = String(set.name || '내 단어장');
   const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'option-btn'; restore.textContent = '복원'; restore.setAttribute('aria-label',String(set.name || '내 단어장') + ' 복원');
   restore.onclick = () => { try { imports()?.restore?.(set.id); } catch (error) { window.alert('복원 상태를 저장하지 못했습니다. 저장 공간을 확인해 주세요.'); } };
   const purge = document.createElement('button'); purge.type = 'button'; purge.className = 'option-btn'; purge.textContent = '영구 삭제'; purge.disabled = true; purge.title = '보호자 권한 확인 후 사용 가능'; purge.setAttribute('aria-describedby','ymTrashPermissionNote');
   row.append(label,restore,purge); details.append(row);
  }
  const note = document.createElement('p'); note.id = 'ymTrashPermissionNote'; note.className = 'hint'; note.textContent = '영구 삭제는 보호자 권한 확인 후 사용 가능합니다. 현재는 복원만 할 수 있으며, 기존 성적은 유지됩니다.'; details.append(note);
  container.append(details);
 }
 const previousMenu = menu;
 menu = function () { const result = previousMenu.apply(this,arguments); mount(); return result; };
 const previousSelect = window.YMBookRange.selectBook;
 window.YMBookRange.selectBook = function () { const result = previousSelect.apply(this,arguments); updateSelected(); return result; };
 window.YMBookTrash = {mount};
 mount();
})();
