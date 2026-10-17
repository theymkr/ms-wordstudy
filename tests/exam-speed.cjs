const fs = require('node:fs'), assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH || 'jsdom');
let html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,
  (all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>',`<script>window.T={user:enterUser,start:(m='listen')=>{mode=m;pronunciationSource='iphone';rangeStart=1;rangeEnd=3;startRun(false);},state:()=>({index:currentIdx,records:records.length,locked}),stop:()=>stop(),next:()=>nextQuestion(),menu:()=>menu(),recorded:()=>{activePronunciationSource='us';const q=allQuestions.find(q=>usAudioFiles[q.word.toLowerCase()]);playWordPronunciation(q.word,token,()=>{},()=>{});}};</script></body>`);
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS')){errors.push(e.message);console.error(e.cause?.stack || e.detail?.stack || e.stack);}});
const dom=new JSDOM(html,{url:'https://speed.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.spoken=[];w.mediaRates=[];
  w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=>'';
  w.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],speak(u){w.spoken.push(u);}};w.SpeechSynthesisUtterance=function(){};
  w.HTMLMediaElement.prototype.play=function(){w.mediaRates.push(this.playbackRate);return Promise.resolve();};w.HTMLMediaElement.prototype.pause=function(){};
}});
(async()=>{
 const w=dom.window,byId=id=>w.document.getElementById(id),speed=()=>byId('pronunciationSpeed');
 const change=value=>{byId('pronunciationRate').value=value;byId('pronunciationRate').dispatchEvent(new w.Event('input',{bubbles:true}));};
 w.T.user('speed-test');await new Promise(r=>setTimeout(r,30));w.T.start();
 assert(speed().classList.contains('ym-exam-speed'));assert(!speed().closest('details'),'speed is outside the collapsed settings');
 assert.equal(byId('ymExamToolbar').nextElementSibling,speed(),'speed directly below exam toolbar');
 const initial=JSON.stringify(w.T.state()),plays=w.spoken.length;
 byId('answer').value='partial answer';speed().querySelector('[data-speed-plus]').click();
 assert.equal(speed().querySelector('output').textContent,'0.70배');
 assert.equal(JSON.stringify(w.T.state()),initial);assert.equal(w.spoken.length,plays,'adjusting speed never restarts playback');assert.equal(byId('answer').value,'partial answer');
 w.spoken.at(-1).onend();await new Promise(r=>setTimeout(r,650));assert.equal(w.spoken.at(-1).rate,0.7,'next pronunciation uses adjusted speed');w.T.stop();
 for(const height of [400,844]){
  Object.defineProperty(w,'innerHeight',{configurable:true,value:height});byId('answer').focus();w.dispatchEvent(new w.Event('resize'));
  assert.notEqual(w.getComputedStyle(speed()).display,'none','keyboard compact mode keeps speed accessible');
  assert(!speed().closest('#ymExamSettings'));
 }
 change('1.5');assert(speed().querySelector('[data-speed-plus]').disabled);change('0.5');assert(speed().querySelector('[data-speed-minus]').disabled);
 change('0.85');assert.equal(w.localStorage.getItem('usher-pronunciation-rate-v1:speed-test'),'0.85');
 w.T.next();w.T.stop();assert.equal(speed().querySelector('output').textContent,'0.85배');
 w.T.menu();w.T.start('meaning');w.T.stop();assert(speed().classList.contains('ym-exam-speed'),'meaning exam exposes speed');
 change('1.1');w.T.recorded();assert.equal(w.mediaRates.at(-1),1.1,'recorded audio uses adjusted speed');w.T.stop();
 w.T.menu();assert.equal(speed().querySelector('output').textContent,'1.10배','menu retains updated setting');
 w.T.user('other-user');assert.equal(speed().querySelector('output').textContent,'0.65배','settings remain account scoped');
 assert.deepEqual(errors,[]);
 console.log('PASS: in-exam speed control, compact-mode visibility, next TTS and recorded audio rates, unchanged answer/progress, speed limits, persistence, account isolation, and both exam modes.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>dom.window.close());
