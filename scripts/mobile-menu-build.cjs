'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = function applyMobileMenu(page) {
  if (!page.includes('id="ym-book-range-script"')) throw Error('Mobile menu requires book/range controls.');
  const oldFit = "c.style.zoom='1';const v=window.visualViewport;";
  if (!page.includes(oldFit)) throw Error('Screen fitting hook changed.');
  page = page.replace(oldFit, "if(c.querySelector('#ymBookSelect')){c.style.zoom='1';c.style.maxWidth='';return;}" + oldFit);
  const css = fs.readFileSync(path.join(__dirname, 'mobile-menu.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, 'mobile-menu.js'), 'utf8');
  return page.replace('</body>', '<style id="ym-mobile-menu-style">\n' + css + '\n</style>\n<script id="ym-mobile-menu-script">\n' + js + '\n</script>\n</body>');
};
