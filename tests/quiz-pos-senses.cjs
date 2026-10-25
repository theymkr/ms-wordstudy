const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
let html=fs.readFileSync(process.env.QUIZ_HTML||'public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>',`<script>window.T={user:enterUser,data:quizData,all:allQuestions,parts:ymAnswerParts,stop:()=>stop(),
 start:n=>{YMImportStudy.reset();rangeStart=n;rangeEnd=n;mode='meaning';pronunciationSource='iphone';startRun(false);stop();},
 state:()=>({locked,records}),
 render:q=>{container.innerHTML='<div id="question"></div><div id="area"></div><p id="feedback"></p>';loadParts(q);}
};</script></body>`);
const errors=[],observers=[],vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS'))errors.push(e.detail?.stack||e.message)});
const dom=new JSDOM(html,{url:'https://quiz.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 const Original=w.MutationObserver;w.MutationObserver=class extends Original{constructor(cb){super(cb);observers.push(this)}};
 w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;
 w.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],speak(){}};w.SpeechSynthesisUtterance=function(){};w.HTMLMediaElement.prototype.pause=function(){};
}});
try {
 const w=dom.window,d=w.document;w.T.user('multi-pos-test');
 const panels=()=>[...d.querySelectorAll('.answer-panel')];
 const select=(index,part,value)=>{const b=[...panels()[index].querySelectorAll('button')].find(b=>b.dataset.part===part&&b.dataset.value===value);assert(b,`missing ${part}: ${value}`);b.click();};
 const pair=(index,pos,meaning)=>{select(index,'pos',pos);select(index,'meaning',meaning);};
 w.T.start(2217);assert.equal(d.getElementById('question').textContent,'grant');assert.equal(panels().length,2);
 assert(panels().every(p=>!p.hidden));assert(d.getElementById('area').classList.contains('ym-multi-sense'));
 pair(0,'명사','허가, 보조금');assert.equal(w.T.state().locked,false);assert.equal(w.T.state().records.length,0,'one pair must not submit');
 pair(1,'동사','승인하다, 허가하다, 주다');assert(w.T.state().locked);assert(w.T.state().records[0].correct,'either pair order must pass');w.T.stop();
 for(const bad of ['duplicate','mismatched']){
  w.T.start(2217);pair(0,'동사','승인하다, 허가하다, 주다');
  pair(1,bad==='duplicate'?'동사':'명사','승인하다, 허가하다, 주다');
  assert(w.T.state().locked);assert.equal(w.T.state().records[0].correct,false,`${bad} pair must fail`);w.T.stop();
 }
 // Audit every built-in entry against the independently read POS markers.
 const names={n:'명사',v:'동사',a:'형용사',adj:'형용사',ad:'부사',adv:'부사',pron:'대명사',prep:'전치사',conj:'접속사',aux:'조동사',int:'감탄사',interj:'감탄사',det:'한정사',num:'수사',art:'관사'};
 let multi=0;
 for(const q of w.T.all.slice(0,2956)){
  const raw=w.T.data[q.sourceIndex],answer=raw.options[raw.answer];
  const expected=answer.split(/\s*\/\s*(?=(?:adv|adj|pron|prep|conj|aux|interj|int|det|num|art|ad|n|v|a)\.\s*)/i).map(s=>{
   const m=s.match(/^(adv|adj|pron|prep|conj|aux|interj|int|det|num|art|ad|n|v|a)\.\s*(.*)$/i);assert(m,answer);return {pos:names[m[1].toLowerCase()],meaning:m[2].trim()};
  });
  if(expected.length>1)multi++;
  w.T.render(q);assert.equal(panels().length,expected.length,`${q.number} ${q.word}`);
  for(const [i,e]of expected.entries()){
   assert(panels()[i].querySelector(`[data-part="pos"][data-value="${e.pos}"]`),q.word+' '+e.pos);
   assert([...panels()[i].querySelectorAll('[data-part="meaning"]')].some(b=>b.dataset.value===e.meaning),q.word+' '+e.meaning);
  }
 }
 // Three senses and extra POS choices must also complete and grade once.
 w.T.start(104);assert.equal(panels().length,3);
 pair(0,'부사','단지, 다만');assert.equal(w.T.state().records.length,0);assert.equal(panels()[1].hidden,false);
 pair(1,'전치사','~을 제외하고');assert.equal(w.T.state().records.length,0);assert.equal(panels()[2].hidden,false);
 pair(2,'접속사','그러나');assert(w.T.state().records[0].correct);w.T.stop();
 w.T.start(145);assert.equal(panels().length,1);pair(0,'전치사','~쪽으로, ~를 향하여');assert(w.T.state().records[0].correct);w.T.stop();
 assert.deepEqual(errors,[]);
 console.log(`PASS: grant requires both distinct pairs; reversed order accepted; duplicates/mismatches rejected; 2956 entries (${multi} multi-sense) expose every POS/meaning; three-sense navigation and single prep grading`);
} finally {observers.forEach(o=>o.disconnect());dom.window.close();}
