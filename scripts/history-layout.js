/* Paginate existing history rows; preserve attempt IDs and print handlers. */
(() => {
  'use strict';
  const pages = new WeakMap();
  window.YMHistoryLayout = function () {
    const root = document.getElementById('scoreHistory');
    if (!root) return;
    const note = root.querySelector('#storageNote');
    if (note && !note.closest('details') && !storageWarning) {
      const details = document.createElement('details');
      details.className = 'ym-history-notes';
      const summary = document.createElement('summary');
      summary.textContent = '저장 안내';
      note.before(details); details.append(summary, note);
    }
    const table = root.querySelector('#scoreTable table');
    if (!table) return;
    let state = pages.get(table);
    if (!state) {
      const rows = Array.from(table.rows).filter(row => row.dataset.attemptId);
      if (!rows.length) return;
      table.setAttribute('role', 'table');
      table.setAttribute('aria-label', '시험 회차별 성적 기록');
      table.rows[0].classList.add('ym-history-head');
      rows.forEach(row => {
        row.setAttribute('role', 'row');
        Array.from(row.cells).forEach(cell => cell.setAttribute('role', 'cell'));
      });
      const nav = document.createElement('nav');
      nav.className = 'ym-page-nav'; nav.setAttribute('aria-label', '성적 기록 페이지');
      const prev = document.createElement('button'), next = document.createElement('button');
      const label = document.createElement('span'); label.setAttribute('aria-live', 'polite');
      prev.type = next.type = 'button'; prev.textContent = '이전'; next.textContent = '다음';
      nav.append(prev, label, next); table.after(nav);
      state = {rows, nav, prev, next, label, start: 0, size: 1};
      pages.set(table, state);
      prev.onclick = () => {state.start = Math.max(0, state.start - state.size); draw(state);};
      next.onclick = () => {state.start = Math.min(state.rows.length - 1, state.start + state.size); draw(state);};
    }
    const size = window.innerWidth <= 700 || window.innerHeight < 700 ? 1 : window.innerHeight < 900 ? 3 : 5;
    if (state.size !== size) {state.start = Math.floor(state.start / size) * size; state.size = size;}
    draw(state);
  };
  function draw({rows, nav, prev, next, label, start, size}) {
    rows.forEach((row, i) => {row.hidden = i < start || i >= start + size;});
    nav.hidden = rows.length <= size;
    prev.disabled = start === 0; next.disabled = start + size >= rows.length;
    const text = (Math.floor(start / size) + 1) + ' / ' + Math.ceil(rows.length / size);
    if (label.textContent !== text) label.textContent = text;
  }
  window.YMHistoryLayout();
})();
