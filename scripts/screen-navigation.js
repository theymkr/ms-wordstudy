/* Explicit menu/history navigation; never replays an exam or submits a result. */
(() => {
  'use strict';
  let saved = null, owner = null;
  const originalMenu = menu, originalHistory = showHistory, originalResult = result;
  const bookId = () => window.YMBookRange?.selection().bookId;
  function prepare() { if(owner !== activeUser){saved=null;owner=activeUser;} }
  function remember() {
    saved={book:bookId(),filter:document.getElementById('scoreFilter')?.value,week:document.getElementById('scoreWeek')?.value};
  }
  function mount(inHistory) {
    prepare();document.getElementById('ymScreenNavigation')?.remove();
    if(!activeUser)return;
    const nav=document.createElement('nav');nav.id='ymScreenNavigation';nav.setAttribute('aria-label','화면 이동');
    const back=document.createElement('button'),forward=document.createElement('button');
    back.type=forward.type='button';back.id='ymScreenBack';forward.id='ymScreenForward';
    back.textContent='← 뒤로가기';forward.textContent='앞으로가기 →';
    back.disabled=!inHistory;forward.disabled=inHistory||!saved||saved.book!==bookId();
    back.onclick=()=>{menu();document.getElementById('ymTab-study')?.click();};
    forward.onclick=()=>{
      if(!saved||saved.book!==bookId())return;
      const state=saved;showHistory();
      for(const [id,value]of [['scoreFilter',state.filter],['scoreWeek',state.week]]) {
        const input=document.getElementById(id);
        if(input&&Array.from(input.options).some(option=>option.value===value)){input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));}
      }
    };
    nav.append(back,forward);container.prepend(nav);
    const book=document.getElementById('ymBookSelect');
    book?.addEventListener('change',()=>{forward.disabled=!saved||saved.book!==bookId();});
  }
  menu=function(){prepare();if(document.getElementById('scoreHistory')&&!document.getElementById('question'))remember();const result=originalMenu.apply(this,arguments);mount(false);return result;};
  showHistory=function(){prepare();const result=originalHistory.apply(this,arguments);mount(true);return result;};
  result=function(){prepare();const value=originalResult.apply(this,arguments);mount(true);return value;};
  if(document.getElementById('scoreHistory'))mount(true);else if(document.getElementById('ymMenuTabs'))mount(false);
})();
