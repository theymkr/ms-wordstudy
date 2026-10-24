const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
let html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>','<script>window.T={user:enterUser,stop:()=>stop(),menu:()=>menu(),history:()=>showHistory(),state:()=>({mode,rangeStart,rangeEnd,count:questions.length})};</script></body>');
const errors=[],observers=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS'))errors.push(e.detail?.stack||e.message)});
const dom=new JSDOM(html,{url:'https://import.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 const Original=w.MutationObserver;w.MutationObserver=class extends Original{constructor(cb){super(cb);observers.push(this)}};
 w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=>'';
 w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;
 w.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],speak(){}};w.SpeechSynthesisUtterance=function(){};w.HTMLMediaElement.prototype.pause=function(){};
}});
(async()=>{try{
 const w=dom.window,d=w.document;w.T.user('range-overflow-test');
 const key='usher-unified-range-user-v1:range-overflow-test';
 const history=[{id:'range-history',date:'2026-10-24T00:00:00Z',mode:'meaning',score:60,correct:30,total:50,rangeStart:2201,rangeEnd:2250,wrongWords:Array.from({length:20},(_,i)=>({sourceIndex:2200+i,number:2201+i,word:'word'+i,missCount:1}))}];
 w.localStorage.setItem(key,JSON.stringify(history));
 const assertPanel=()=>{
  assert.equal(d.querySelectorAll('#ymSameRangeSummary').length,1);
  assert.equal(d.getElementById('ymSameRangeSummary').parentElement.id,'ymPanel-study','range summary must stay inside the scrollable study panel');
  assert(!d.querySelector('.quiz-container > #ymSameRangeSummary'));
 };
 assertPanel();
 const changeRange=value=>{const select=d.getElementById('ymStudyRangeSelect');select.value=value;select.dispatchEvent(new w.Event('change'));assertPanel();};
 d.getElementById('ymTab-study').click();changeRange('2201:2250');
 assert.equal(d.querySelectorAll('#ymSameRangeSummary p').length,21);
 changeRange('2251:2300');assert(d.getElementById('ymSameRangeSummary').textContent.includes('저장된 오답이 없습니다'));
 changeRange('2201:2250');
 for(const tab of ['settings','memorize','study']){d.getElementById('ymTab-'+tab).click();assertPanel();assert.equal(d.getElementById('ymPanel-study').hidden,tab!=='study');}
 changeRange('custom');for(const [id,value]of [['ymRangeFrom','2202'],['ymRangeTo','2240']]){const input=d.getElementById(id);input.value=value;input.dispatchEvent(new w.Event('input'));assertPanel();}
 changeRange('2201:2250');
 const stored=w.localStorage.getItem(key);
 d.getElementById('sourceIphone').click();d.getElementById('rangeStartMeaning').click();w.T.stop();
 assert(d.getElementById('question'),'start button must enter an exam');assert.equal(w.T.state().count,50);assert.equal(w.T.state().rangeStart,2201);
 w.T.menu();assertPanel();d.getElementById('ymTab-study').click();
 d.getElementById('rangeStartListen').click();w.T.stop();assert(d.getElementById('answer'),'listening exam must also start');
 w.T.menu();assertPanel();assert.equal(w.localStorage.getItem(key),stored,'navigation must not alter saved scores');
 w.T.history();assert(!d.getElementById('ymScreenBack').disabled);d.getElementById('ymScreenBack').click();assertPanel();assert(!d.getElementById('ymPanel-study').hidden);
 await new Promise(r=>setTimeout(r,60));assert.deepEqual(errors,[]);
 console.log('PASS: long range summary containment, repeated range/custom/tab changes, both exam starts, history return and score preservation');
 }finally{observers.forEach(o=>o.disconnect());dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
