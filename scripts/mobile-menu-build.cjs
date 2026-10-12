'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = function applyMobileMenu(page) {
  if (!page.includes('id="ym-book-range-script"')) throw Error('Mobile menu requires book/range controls.');
  const oldFit = "c.style.zoom='1';const v=window.visualViewport;";
  if (!page.includes(oldFit)) throw Error('Screen fitting hook changed.');
  page = page.replace(oldFit, "if(c.querySelector('#ymBookSelect')){c.style.zoom='1';c.style.maxWidth='';return;}" + oldFit);
  const shrink = "const scale=Math.min(1,(h-16)/Math.max(1,c.scrollHeight+16),(w-16)/Math.max(1,c.scrollWidth));c.style.zoom=String(Math.max(.1,scale));";
  if (!page.includes(shrink)) throw Error('Quiz fitting hook changed.');
  page = page.replace(shrink, "if(!c.querySelector('#question')){" + shrink + "}");
  page = page.replace("input.placeholder='영어 단어 입력 · 한글 입력도 자동 변환';", "input.placeholder='영어 단어 입력';");
  const focusHook = "document.getElementById('answer').focus();play();";
  if (!page.includes(focusHook)) throw Error('Listening focus hook changed.');
  page = page.replace(focusHook, "if(window.YMVoicePreference?.()!=='voice')document.getElementById('answer').focus();play();");
  const css = fs.readFileSync(path.join(__dirname, 'mobile-menu.css'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'voice-resume.css'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, 'mobile-menu.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'voice-resume.js'), 'utf8');
  return page.replace('</body>', '<style id="ym-mobile-menu-style">\n' + css + '\n</style>\n<script id="ym-mobile-menu-script">\n' + js + '\n</script>\n</body>');
};
