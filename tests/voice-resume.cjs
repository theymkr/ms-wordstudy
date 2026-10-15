const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH || 'jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
let html=fs.readFileSync('public/index.html','utf8');
// The real app scripts run offline; cloud login is outside this feature test.
html=html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>',`<script>window.T={state:()=>({mode,currentIdx,records,locked,retryQueue:[...retryQueue],retryMode,elapsed:elapsedMilliseconds(),active:attemptActive}),user:id=>enterUser(id),menu:()=>menu(),start:(m='listen',n=3)=>{mode=m;rangeStart=1;rangeEnd=n;startRun(false);},grade:(ok=true)=>grade(ok,questions[currentIdx].word),next:()=>nextQuestion(),stop:()=>stop(),word:()=>questions[currentIdx].word,elapsed:n=>{clockStarted=Date.now()-n;},setUser:id=>{finishAttempt();activeUser=id;menu();},select:id=>YMBookRange.selectBook(id),audioSource:v=>{activePronunciationSource=v;}};</script></body>`);
function boot(storage={}) {
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS')){errors.push(e); console.error(e.detail?.stack || e.stack);}});
 const dom=new JSDOM(html,{url:'https://test.invalid/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
  w.alert=()=>{};w.confirm=()=>true;w.fetch=async()=>({ok:false,json:async()=>({})});
  w.spoken=[];w.mediaPlays=[];w.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],speak(u){w.spoken.push(u);}};w.SpeechSynthesisUtterance=function(){};
  w.HTMLMediaElement.prototype.play=function(){w.mediaPlays.push(this);return w.rejectPlayback ? Promise.reject(w.rejectPlayback) : Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};
  w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=>'';
  w.SpeechRecognition=class {constructor(){w.rec=this;}start(){}abort(){this.aborted=true;}stop(){this.onend?.();}result(text){this.onresult({results:[[{transcript:text}]]});}};
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
 click(w,'ymSpeakAnswer');assert.equal(w.rec.lang,'en-US');w.rec.result(w.T.word().split('').join(' ')+'.');
 assert.equal(w.document.getElementById('answer').value,w.T.word());assert.equal(w.T.state().records.length,0,'speech needs confirmation');
 const enter=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});w.document.getElementById('answer').dispatchEvent(enter);assert(enter.defaultPrevented,'Enter confirms a spoken spelling');assert.equal(w.T.state().records[0].answerMethod,'voice');assert(w.T.state().locked);
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

 // Letter names, repeat letters, cumulative speech results, and no word inference.
 w.SpeechRecognition=class {constructor(){w.rec=this;}start(){}abort(){}stop(){this.onend?.();}result(text){this.onresult({results:[[{transcript:text}]]});}};
 click(w,'ymSpeakAnswer');w.rec.result('bee oh tea tee oh em');assert.equal(w.document.getElementById('answer').value,'bottom');assert(w.rec.continuous);w.T.stop();
 click(w,'ymSpeakAnswer');w.rec.onresult({resultIndex:1,results:[[{transcript:'A P'}],[{transcript:'P L E'}]]});assert.equal(w.document.getElementById('answer').value,'apple');w.T.stop();
 click(w,'ymSpeakAnswer');w.rec.result('bottom');assert.equal(w.document.getElementById('answer').value,'apple','whole-word guess must not replace spelling');assert(w.document.getElementById('ymVoiceStatus').textContent.includes('하나씩'));
 click(w,'ymSpeakAnswer');w.rec.result('double you eye en');assert.equal(w.document.getElementById('answer').value,'win');w.T.stop();
 assert.equal(w.T.state().records.length,0);
 // A blocked media play reports a direct-tap recovery, without grading.
 w.T.audioSource('us');w.rejectPlayback={name:'NotAllowedError'};click(w,'play');await new Promise(r=>setTimeout(r,0));assert(w.document.getElementById('audioStatus').textContent.includes('차단'));assert.equal(w.T.state().records.length,0);
 const reused=w.mediaPlays.at(-1);w.rejectPlayback=null;click(w,'play');assert.equal(w.mediaPlays.at(-1),reused,'reuse unlocked audio element');
 const oldEnd=reused.onended;click(w,'ymSpeakAnswer');oldEnd();assert.equal(w.T.state().records.length,0,'stale playback callback ignored');w.T.stop();
 w.T.audioSource('us');w.rejectPlayback={name:'NetworkError'};const utterances=w.spoken.length;click(w,'play');await new Promise(r=>setTimeout(r,0));assert.equal(w.spoken.length,utterances+1,'recording failure falls back to synthesis');assert.equal(w.T.state().records.length,0);
 w.spoken.at(-1).onerror();assert(w.document.getElementById('audioStatus').textContent.includes('기기 음성'));assert.equal(w.T.state().records.length,0);
 w.document.querySelector('#ymAudioRecovery button').click();assert.equal(w.spoken.length,utterances+2,'direct device replay');w.T.stop();w.rejectPlayback=null;
 // Voice mode: one pronunciation, automatic capture, then three seconds or Enter.
 let c=boot(),p=c.w;p.T.user('timing');await new Promise(r=>setTimeout(r,30));
 p.localStorage.setItem('ym-answer-method-v1:timing','voice');click(p,'sourceIphone');
 const timers=new Map(),nativeSetTimeout=p.setTimeout.bind(p),nativeClearTimeout=p.clearTimeout.bind(p);
 let now=0,nextTimer=-1;
 p.setTimeout=(fn,ms,...args)=>{
  if(ms===3000||ms===1500){const id=nextTimer--;timers.set(id,{at:now+ms,run:()=>fn(...args)});return id;}
  return nativeSetTimeout(fn,ms,...args);
 };
 p.clearTimeout=id=>{if(!timers.delete(id))nativeClearTimeout(id);};
 const advance=ms=>{const end=now+ms;while(true){const entry=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);entry[1].run();}now=end;};
 const begin=()=>{
  const before=p.spoken.length,oldRec=p.rec;p.T.start('listen',2);
  assert.equal(p.rec,oldRec,'capture waits for pronunciation end');
  assert.equal(p.spoken.length,before+1,'exactly one pronunciation');
  assert(p.document.getElementById('play').textContent.includes('1번'));
  p.spoken.at(-1).onend();assert.notEqual(p.rec,oldRec,'capture automatically starts');
  assert.equal(p.spoken.length,before+1,'no second pronunciation');
  assert(p.rec.interimResults,'receive interim letters without waiting for service disconnect');
  return p.rec;
 };
 const pressEnter=(target=p.document.body,extra={})=>{const e=new p.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...extra});target.dispatchEvent(e);return e;};
 let rec=begin();rec.result('A');advance(2000);rec.result('A P');advance(2999);
 assert.equal(p.T.state().records.length,0,'new letters restart the three-second wait');
 advance(1);assert.equal(p.T.state().records.length,1);assert.equal(p.T.state().records[0].typed,'ap');assert.equal(p.T.state().records[0].answerMethod,'voice');
 rec.result('A P P L E');assert.equal(p.T.state().records.length,1,'late result cannot submit twice');p.T.stop();
 rec=begin();rec.onspeechstart();rec.result('B');advance(4000);assert.equal(p.T.state().records.length,0,'never submit while speech is active');
 rec.onspeechend();advance(2999);assert.equal(p.T.state().records.length,0);advance(1);assert.equal(p.T.state().records.length,1);p.T.stop();
 rec=begin();rec.result('A');advance(1000);rec.onend();advance(1999);assert.equal(p.T.state().records.length,0,'natural end preserves the pending delay');advance(1);assert.equal(p.T.state().records.length,1);p.T.stop();
 rec=begin();rec.result('A P');let stopping=0;rec.stop=()=>{stopping++;};
 assert(pressEnter(p.document.getElementById('answer'),{isComposing:true}).defaultPrevented===false);assert.equal(stopping,0,'IME Enter does not submit');
 assert(pressEnter(p.document.getElementById('answer')).defaultPrevented);assert.equal(stopping,1);
 pressEnter(p.document.getElementById('answer'),{repeat:true});assert.equal(stopping,1,'held Enter stops only once');
 assert.equal(p.T.state().records.length,0,'wait for the final recognition result');rec.result('A P P L E');rec.onend();
 assert.equal(p.T.state().records.length,1);assert.equal(p.T.state().records[0].typed,'apple');advance(1500);assert.equal(p.T.state().records.length,1,'completion fallback was cleared');p.T.stop();
 rec=begin();rec.result('B');rec.stop=()=>{};pressEnter();advance(1500);assert.equal(p.T.state().records.length,1,'stuck recognition still completes with captured letters');p.T.stop();
 rec=begin();pressEnter();assert.equal(p.T.state().records.length,0,'no empty answer auto-grading');assert(p.document.getElementById('ymVoiceStatus').textContent.includes('인식된 철자'));
 rec=begin();rec.result('C');click(p,'submit');assert.equal(p.T.state().records.length,1,'completion button uses the same finalization');p.T.stop();
 rec=begin();rec.result('A');advance(2000);p.document.querySelector('#ymVoiceControls button:last-child').click();advance(4000);assert.equal(p.T.state().records.length,0,'keyboard switch cancels submission');assert(rec.aborted);assert(p.document.getElementById('play').textContent.includes('3번'));
 p.localStorage.setItem('ym-answer-method-v1:timing','voice');
 rec=begin();rec.result('B');const typed=p.document.getElementById('answer');typed.value='edited';typed.dispatchEvent(new p.Event('input'));advance(4000);assert.equal(p.T.state().records.length,0,'manual edits cancel speech submission');rec.result('C');assert.equal(typed.value,'edited');
 rec=begin();rec.result('B');click(p,'home');advance(4000);assert.equal(p.T.state().records.length,0,'leaving cancels speech submission');assert(rec.aborted);
 rec=begin();rec.result('A');rec.onerror({error:'not-allowed'});advance(4000);assert.equal(p.T.state().records.length,0,'permission errors never grade');assert(p.document.getElementById('ymVoiceStatus').textContent.includes('권한'));
 rec=begin();rec.result('A');rec.result('not a letter');advance(4000);assert.equal(p.T.state().records.length,0,'unrecognized text cancels stale partial submission');
 rec=begin();rec.result('A');Object.defineProperty(p.document,'visibilityState',{configurable:true,value:'hidden'});p.document.dispatchEvent(new p.Event('visibilitychange'));advance(4000);assert.equal(p.T.state().records.length,0,'hidden page cancels submission');assert(rec.aborted);
 Object.defineProperty(p.document,'visibilityState',{configurable:true,value:'visible'});p.document.dispatchEvent(new p.Event('visibilitychange'));p.document.querySelector('#ymResumeCard button').click();assert.equal(p.rec,rec,'resume does not automatically activate the microphone');
 p.T.stop();

 Object.defineProperty(w.document,'visibilityState',{configurable:true,value:'hidden'});w.document.dispatchEvent(new w.Event('visibilitychange'));const before=w.T.state().elapsed;await new Promise(r=>setTimeout(r,30));assert.equal(w.T.state().elapsed,before);Object.defineProperty(w.document,'visibilityState',{configurable:true,value:'visible'});w.document.dispatchEvent(new w.Event('visibilitychange'));assert(w.document.getElementById('ymResumeCard'));
 assert.equal(a.errors.length,0,a.errors.map(String).join('\n'));assert.equal(b.errors.length,0,b.errors.map(String).join('\n'));
 assert.equal(c.errors.length,0,c.errors.map(String).join('\n'));
 console.log('PASS: letter-name decoding, cumulative spelling, media reuse, blocked playback, TTS fallback, voice confirmation, stale speech cancellation, reload during grading, draft/elapsed resume, account isolation, retry completion, partial MCQ, corrupt checkpoint, single pronunciation, automatic voice capture, three-second silence reset, final-result Enter completion, no empty grading, and cancellation on edits/navigation/visibility.');p.close();w.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
