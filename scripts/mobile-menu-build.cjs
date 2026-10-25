'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = function applyMobileMenu(page) {
  page = require('./history-build.cjs')(page);
  if (!page.includes('id="ym-book-range-script"')) throw Error('Mobile menu requires book/range controls.');
  // Use the same complete POS/meaning pairs for questions and answer feedback.
  // The legacy quiz parser silently dropped prep./conj./pron./aux. senses.
  if (!page.includes("num:'수사'") || !page.includes('int|det|num|ad|n|v|a')) throw Error('Answer POS parser hook changed.');
  page = page.replace("num:'수사'", "num:'수사',art:'관사'").replace('int|det|num|ad|n|v|a', 'int|det|num|art|ad|n|v|a');
  const partsParser = /function loadParts\(q\)\{[\s\S]*? const states=/;
  if (!partsParser.test(page)) throw Error('Quiz sense parser hook changed.');
  page = page.replace(partsParser, 'function loadParts(q){\n const expected=ymAnswerParts(q);\n const states=');
  const posChoices = "['명사','동사','형용사','부사'].forEach(x=>add(posBox,x,'pos'));";
  if (!page.includes(posChoices)) throw Error('Quiz POS choices hook changed.');
  page = page.replace(posChoices, "[...new Set(['명사','동사','형용사','부사',...expected.map(e=>e.pos)])].forEach(x=>add(posBox,x,'pos'));");
  const posLabels = "{'명사':'N','동사':'V','형용사':'ADJ','부사':'ADV'}[label]";
  if (!page.includes(posLabels)) throw Error('Quiz POS labels hook changed.');
  page = page.replace(posLabels, "({'명사':'N','동사':'V','형용사':'ADJ','부사':'ADV','대명사':'PRON','전치사':'PREP','접속사':'CONJ','조동사':'AUX','감탄사':'INT','한정사':'DET','수사':'NUM','관사':'ART'}[label] || '')");
  page = page.replace('각 상자에서 서로 다른 품사와 그에 맞는 뜻을 선택하세요.', '각 상자에서 서로 다른 품사·뜻 묶음을 모두 선택하세요.');
  const oldFit = "c.style.zoom='1';const v=window.visualViewport;";
  if (!page.includes(oldFit)) throw Error('Screen fitting hook changed.');
  page = page.replace(oldFit, "if(c.querySelector('#ymBookSelect, #scoreHistory, #ymImportEditor, #ymMemorizeScreen')){c.style.zoom='1';c.style.maxWidth='';return;}" + oldFit);
  // Range changes regenerate this section after the menu panels are mounted.
  const rangeSummary = ' container.append(section);return ok;';
  if (page.split(rangeSummary).length !== 2) throw Error('Range summary placement hook changed.');
  page = page.replace(rangeSummary, " (document.getElementById('ymPanel-study') || container).append(section);return ok;");
  const pagination = / function paginate\(\)\{[^\n]*\}\n/;
  if (!pagination.test(page)) throw Error('History pagination hook changed.');
  page = page.replace(pagination, ' function paginate(){window.YMHistoryLayout?.();}\n');
  page = page.replace(/(<meta name="ym-build" content=")[^"]+/, (_, prefix) => prefix + '20261025-complete-pos-selections-v1');
  const shrink = "const scale=Math.min(1,(h-16)/Math.max(1,c.scrollHeight+16),(w-16)/Math.max(1,c.scrollWidth));c.style.zoom=String(Math.max(.1,scale));";
  if (!page.includes(shrink)) throw Error('Quiz fitting hook changed.');
  page = page.replace(shrink, "if(!c.querySelector('#question')){" + shrink + "}");
  page = page.replace("input.placeholder='영어 단어 입력 · 한글 입력도 자동 변환';", "input.placeholder='영어 단어 입력';");
  const restHook = "const overlay=document.createElement('div');restOverlay=overlay;";
  if (!page.includes(restHook)) throw Error('Rest screen hook changed.');
  page = page.replace(restHook, restHook + "overlay.id='ymRestScreen';");
  const css = ['mobile-menu.css', 'voice-resume.css', 'history-layout.css', 'memorize.css', 'screen-navigation.css'].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
  const js = ['mobile-menu.js', 'audio-playback.js', 'voice-resume.js', 'history-layout.js', 'memorize.js', 'screen-navigation.js'].map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
  page = page.replace('</body>', '<style id="ym-mobile-menu-style">\n' + css + '\n</style>\n<script id="ym-mobile-menu-script">\n' + js + '\n</script>\n</body>');
  return require('./audio-supplement-build.cjs')(page, path.join(__dirname, '..'));
};
