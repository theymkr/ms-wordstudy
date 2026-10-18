/* Tap-to-listen study, independent of exam attempts and pronunciation counts. */
(() => {
  'use strict';
  let repeatTimer, generation = 0;
  const priorStop = stop;
  stop = function () {
    generation++; clearTimeout(repeatTimer);
    document.querySelectorAll('.ym-memo-word[aria-pressed="true"]').forEach(el => el.setAttribute('aria-pressed','false'));
    return priorStop.apply(this, arguments);
  };
  function open() {
    if (!captureRange()) return;
    const items = selectedQuestions().slice(), owner = activeUser;
    if (!items.length) return;
    stopClock(); stop();
    activePronunciationSource = pronunciationSource;
    container.innerHTML = `<section id="ymMemorizeScreen"><header><button id="ymMemoHome" type="button">← 메뉴로 돌아가기</button><h2>암기 · 발음 듣기</h2><p>단어를 누르면 발음을 3회 들려드립니다.</p></header><div class="ym-memo-controls"><button id="ymMemoStop" type="button">재생 중지</button><label>발음 속도 <select id="ymMemoSpeed" aria-label="발음 속도"></select></label></div><div id="ymMemoProgress" role="status">듣고 싶은 단어를 누르세요.</div><div id="audioStatus" aria-live="polite"></div><div id="ymMemoList"></div><nav id="ymMemoPager" aria-label="단어 페이지"><button id="ymMemoPrev" type="button">← 이전 100개</button><span id="ymMemoPage"></span><button id="ymMemoNext" type="button">다음 100개 →</button></nav></section>`;
    const byId = id => document.getElementById(id), screen = byId('ymMemorizeScreen');
    let page = 0;
    const speed = byId('ymMemoSpeed');
    for (let i=50;i<=150;i+=5) { const option=document.createElement('option');option.value=String(i/100);option.textContent=(i/100).toFixed(2)+'배';speed.append(option); }
    speed.value=String(getPronunciationRate());speed.onchange=()=>setPronunciationRate(Number(speed.value));
    const reset = () => {stop();byId('ymMemoProgress').textContent='듣고 싶은 단어를 누르세요.';byId('audioStatus').textContent='';};
    byId('ymMemoStop').onclick=reset;
    byId('ymMemoHome').onclick=()=>{stop();menu();};
    function listen(q, button) {
      stop(); const run=generation; let count=0;
      const current=()=>run===generation&&screen.isConnected&&activeUser===owner;
      button.setAttribute('aria-pressed','true');
      function playNext() {
        if(!current())return;
        count++;byId('ymMemoProgress').textContent=q.word+' · '+count+' / 3회';
        playWordPronunciation(q.word,token,()=>{
          if(!current())return;
          if(count<3)repeatTimer=setTimeout(playNext,550);
          else {button.setAttribute('aria-pressed','false');byId('ymMemoProgress').textContent=q.word+' · 3회 재생 완료';byId('audioStatus').textContent='';}
        },()=>{if(current()){button.setAttribute('aria-pressed','false');byId('ymMemoProgress').textContent='단어를 다시 눌러 재생해 주세요.';}},{study:true});
      }
      playNext();
    }
    function render() {
      reset(); const list=byId('ymMemoList');list.replaceChildren();
      items.slice(page*100,(page+1)*100).forEach(q=>{
        const button=document.createElement('button');button.type='button';button.className='ym-memo-word';button.setAttribute('aria-pressed','false');
        const number=document.createElement('small'),word=document.createElement('strong'),meaning=document.createElement('span');
        number.textContent=q.number;word.textContent=q.word;const raw=quizData[q.sourceIndex];meaning.textContent=String(raw?.options?.[raw.answer]||q.options[q.answer]||'');
        button.append(number,word,meaning);button.onclick=()=>listen(q,button);list.append(button);
      });
      list.scrollTop=0;
      byId('ymMemoPage').textContent=(page+1)+' / '+Math.ceil(items.length/100)+'페이지 · '+(page*100+1)+'–'+Math.min((page+1)*100,items.length)+' / '+items.length+'개';
      byId('ymMemoPrev').disabled=page===0;byId('ymMemoNext').disabled=(page+1)*100>=items.length;
    }
    byId('ymMemoPrev').onclick=()=>{if(page>0){page--;render();}};
    byId('ymMemoNext').onclick=()=>{if((page+1)*100<items.length){page++;render();}};
    render();
  }
  function mount() {
    const panel=document.getElementById('ymPanel-study');
    if(!panel||document.getElementById('ymMemoOpen'))return;
    const button=document.createElement('button');button.id='ymMemoOpen';button.type='button';button.className='option-btn';button.textContent='암기 · 발음 듣기 (100개씩)';button.onclick=open;panel.prepend(button);
  }
  const priorMenu=menu;
  menu=function(){stop();const result=priorMenu.apply(this,arguments);mount();return result;};
  window.YMMemorize={open};mount();
})();
