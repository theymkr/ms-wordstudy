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
  if (trash) trash.hidden = !selectedSet() || typeof imports()?.trash !== 'function';
 }
 function mount() {
  const bookSelect = byId('ymBookSelect');
  if (!bookSelect || byId('ymTrashSelectedBook')) return;
  const trash = document.createElement('button'); trash.type = 'button'; trash.id = 'ymTrashSelectedBook'; trash.className = 'option-btn'; trash.textContent = '선택한 책 삭제'; trash.hidden = true;
  trash.onclick = () => {
   const set = selectedSet();
   if (!set || !window.confirm('“' + set.name + '” 책을 삭제할까요? 휴지통에서 복원할 수 있고 이전 성적은 유지됩니다.')) return;
   try { imports()?.trash?.(set.id); }
   catch (error) { window.alert('삭제 상태를 저장하지 못했습니다. 책은 그대로 유지됩니다. 저장 공간을 확인해 주세요.'); }
  };
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
