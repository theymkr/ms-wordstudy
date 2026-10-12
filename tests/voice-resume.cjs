const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH || 'jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
let html=fs.readFileSync('public/index.html','utf8');
// The real app scripts run offline; cloud login is outside this feature test.
html=html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>',`<script>window.T={state:()=>({mode,currentIdx,records,locked,retryQueue:[...retryQueue],retryMode,elapsed:elapsedMilliseconds(),active:attemptActive}),user:id=>enterUser(id),menu:()=>menu(),start:(m='listen',n=3)=>{mode=m;rangeStart=1;rangeEnd=n;startRun(false);},grade:(ok=true)=>grade(ok,questions[currentIdx].word),next:()=>nextQuestion(),stop:()=>stop(),word:()=>questions[currentIdx].word,elapsed:n=>{clockStarted=Date.now()-n;},setUser:id=>{finishAttempt();activeUser=id;menu();},select:id=>YMBookRange.selectBook(id)};</script></body>`);
function boot(storage={}) {
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS')){errors.push(e); console.error(e.detail?.stack || e.stack);}});
 const dom=new JSDOM(html,{url:'https://test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
  w.alert=()=>{};w.confirm=()=>true;w.fetch=async()=>({ok:false,json:async()=>({})});
  w.speechSynthesis={cancel(){},getVoices:()=>[],speak(){}};w.SpeechSynthesisUtterance=function(){};
  w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
  w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=>'';
  w.SpeechRecognition=class {constructor(){w.rec=this;}start(){}abort(){this.aborted=true;}result(text){this.onresult({results:[[{transcript:text}]]});}};
 }});
 return {dom,w:dom.window,errors};
}
const saved=w=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)]}));
const click=(w,id)=>{assert(w.document.getElementById(id),id);w.document.getElementById(id).click()};
(async()=>{
 let a=boot(),w=a.w;w.T.user('test');await new Promise(r=>setTimeout(r,30));
 assert(w.document.querySelector('#ymVoiceChoice'),'voice choice');
 w.localStorage.setItem('ym-answer-method-v1:test','voice');w.T.start();
 assert(w.document.getElementById('ymSpeakAnswer'));assert.notEqual(w.document.activeElement.id,'answer');
 click(w,'ymSpeakAnswer');assert.equal(w.rec.lang,'en-US');w.rec.result(w.T.word()+'.');
 assert.equal(w.document.getElementById('answer').value,w.T.word());assert.equal(w.T.state().records.length,0,'speech needs confirmation');
 click(w,'submit');assert.equal(w.T.state().records[0].answerMethod,'voice');assert(w.T.state().locked);
 // Reload during feedback must advance once, not grade a second time.
 let b=boot(saved(w));w.T.stop();w=b.w;w.T.user('test');await new Promise(r=>setTimeout(r,30));click(w,'ymResumeCard');
 w.document.querySelector('#ymResumeCard button').click();assert.equal(w.T.state().currentIdx,1);assert.equal(w.T.state().records.length,1);
 w.T.stop();let input=w.document.getElementById('answer');input.value='par';input.dispatchEvent(new w.Event('input',{bubbles:true}));w.T.elapsed(40000);click(w,'home');
 const elapsed=JSON.parse(w.localStorage.getItem('ym-resume-v1:test')).elapsed;assert(elapsed>=40000);
 w.document.querySelector('#ymResumeCard button').click();assert.equal(w.document.getElementById('answer').value,'par');assert(w.T.state().elapsed<elapsed+3000);
 click(w,'ymSpeakAnswer');const late=w.rec;click(w,'home');late.result('stale');assert(!w.document.getElementById('answer'),'late recognition cannot restore old input');
 w.T.setUser('other');assert(!w.document.getElementById('ymResumeCard'),'account isolation');w.T.setUser('test');assert(w.document.getElementById('ymResumeCard'));
 w.T.start('listen',1);w.T.grade(false);w.T.next();assert(w.T.state().retryMode);w.T.grade(true);click(w,'home');w.document.querySelector('#ymResumeCard button').click();assert.equal(w.T.state().retryQueue.length,1,'retry requires second correct answer');w.T.grade(true);w.T.next();assert.equal(w.localStorage.getItem('ym-resume-v1:test'),null,'completed clears checkpoint');
 // A partial multiple-choice answer must retain original closure state.
 w.T.start('meaning',2);w.T.stop();let pos=w.document.querySelector('#area [data-part=pos]');pos.click();const chosen=pos.dataset.value;click(w,'home');w.document.querySelector('#ymResumeCard button').click();assert.equal(w.document.querySelector('#area [data-part=pos][aria-pressed=true]').dataset.value,chosen);assert.equal(w.T.state().records.length,0);
 click(w,'home');w.localStorage.setItem('ym-resume-v1:test','{bad json');w.T.menu();assert(!w.document.getElementById('ymResumeCard'));

 w.T.menu();w.localStorage.setItem('usher-unified-range-user-v1:test-import-sets-v1',JSON.stringify([{id:'demo',name:'Test book',words:[{word:'apple',meaning:'사과',pos:'n'},{word:'pear',meaning:'배',pos:'n'}]}]));w.T.menu();assert(w.T.select('set:demo'));w.T.start('listen',2);w.T.stop();let inp=w.document.getElementById('answer');inp.value='ap';inp.dispatchEvent(new w.Event('input'));click(w,'home');w.document.querySelector('#ymResumeCard button').click();assert.equal(w.document.getElementById('answer').value,'ap');assert.equal(w.YMImportStudy.currentSet().id,'demo');click(w,'home');
 const sets=JSON.parse(w.localStorage.getItem('usher-unified-range-user-v1:test-import-sets-v1'));sets[0].words[0].meaning='수정';w.localStorage.setItem('usher-unified-range-user-v1:test-import-sets-v1',JSON.stringify(sets));w.document.querySelector('#ymResumeCard button').click();assert(w.document.getElementById('ymResumeNotice').textContent.includes('수정되거나'));
 w.T.select('ms');w.T.start();delete w.SpeechRecognition;click(w,'ymSpeakAnswer');assert(w.document.getElementById('ymVoiceStatus').textContent.includes('지원하지'));assert.equal(w.T.state().records.length,0);
 Object.defineProperty(w.document,'visibilityState',{configurable:true,value:'hidden'});w.document.dispatchEvent(new w.Event('visibilitychange'));const before=w.T.state().elapsed;await new Promise(r=>setTimeout(r,30));assert.equal(w.T.state().elapsed,before);Object.defineProperty(w.document,'visibilityState',{configurable:true,value:'visible'});w.document.dispatchEvent(new w.Event('visibilitychange'));assert(w.document.getElementById('ymResumeCard'));
 assert.equal(a.errors.length,0,a.errors.map(String).join('\n'));assert.equal(b.errors.length,0,b.errors.map(String).join('\n'));
 console.log('PASS: voice confirmation, stale speech cancellation, reload during grading, draft/elapsed resume, account isolation, retry completion, partial MCQ, corrupt checkpoint.');w.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
