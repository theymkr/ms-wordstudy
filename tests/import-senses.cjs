const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
let html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>','<script>window.T={user:enterUser,stop:()=>stop(),parts:()=>ymAnswerParts(questions[currentIdx]),state:()=>({locked,records})};</script></body>');
const errors=[],observers=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS'))errors.push(e.detail?.stack||e.message)});
const dom=new JSDOM(html,{url:'https://import.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 const Original=w.MutationObserver;w.MutationObserver=class extends Original{constructor(cb){super(cb);observers.push(this)}};
 w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=>'';
 w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;
 w.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],speak(){}};w.SpeechSynthesisUtterance=function(){};w.HTMLMediaElement.prototype.pause=function(){};
}});
(async()=>{try{
 const w=dom.window,d=w.document,key='usher-unified-range-user-v1:edit-test-import-sets-v1';w.T.user('edit-test');
 const set={id:'demo',name:'Test 605 book',words:Array.from({length:605},(_,i)=>({word:'apple',meaning:'사과 '+i,pos:'n'}))};
 set.words[4]={word:'clout',meaning:'「. 권력, 영향력 / v. 때리다',pos:'v',synonyms:'influence, pull, power / strike'};
 w.localStorage.setItem(key,JSON.stringify([set]));w.YMImportStudy.edit(set);
 assert.equal(d.querySelectorAll('.ym-import-row').length,605);assert(!d.getElementById('ymImportPager'));
 assert.equal(d.querySelectorAll('.ym-import-row')[4].querySelectorAll('.ym-import-sense').length,2);
 assert.equal(d.querySelector('[aria-label="품사 5-1"]').value,'');
 assert.equal(d.querySelector('[aria-label="품사 5-2"]').value,'v');
 assert.equal(d.querySelector('[aria-label="뜻 5-1"]').value,'권력, 영향력');
 assert.equal(d.querySelector('[aria-label="동의어 5-1"]').value,'influence, pull, power');
 assert.equal(d.querySelector('[aria-label="동의어 5-2"]').value,'strike');
 const edit=(label,value,event='input')=>{const n=d.querySelector('[aria-label="'+label+'"]');n.value=value;n.dispatchEvent(new w.Event(event));};
 edit('품사 5-1','n','change');edit('뜻 5-1','권력, 영향력');edit('뜻 605-1','끝 단어 수정');edit('동의어 5-2','hit, strike');
 assert.equal(set.words[4].meaning,'「. 권력, 영향력 / v. 때리다','editing must not mutate source object');
 d.querySelector('#ymImportBottom button').click();
 const saved=JSON.parse(w.localStorage.getItem(key))[0];assert.equal(saved.words.length,605);assert.equal(saved.words[4].meaning,'n. 권력, 영향력 / v. 때리다');assert.equal(saved.words[604].meaning,'끝 단어 수정');assert.equal(saved.words[4].synonyms,'influence, pull, power / hit, strike');assert.equal(saved.words[4].senses[1].synonyms,'hit, strike');
 w.YMImportStudy.edit(saved);assert.equal(d.querySelector('[aria-label="품사 5-1"]').value,'n');assert.equal(d.querySelector('[aria-label="뜻 5-2"]').value,'때리다');assert.equal(d.querySelector('[aria-label="동의어 5-2"]').value,'hit, strike');
 d.querySelectorAll('.ym-import-add-sense')[4].click();assert.equal(d.querySelectorAll('.ym-import-row')[4].querySelectorAll('.ym-import-sense').length,3);
 assert.equal(d.querySelector('[aria-label="동의어 5-3"]').value,'');edit('동의어 5-3','test synonym');edit('품사 5-3','n','change');edit('뜻 5-3','추가 의미');d.querySelector('[aria-label="뜻 5-3 삭제"]').click();assert.equal(d.querySelectorAll('.ym-import-row')[4].querySelectorAll('.ym-import-sense').length,2);
 w.YMImportStudy.start({id:'quiz',name:'Clout quiz',words:[saved.words[4]]},'meaning');w.T.stop();
 assert.equal(d.querySelectorAll('.answer-panel').length,2);assert.equal(w.T.parts().length,2);
 const panels=[...d.querySelectorAll('.answer-panel')];
 for(const [i,pos,meaning]of [[0,'명사','권력, 영향력'],[1,'동사','때리다']]){panels[i].querySelector('[data-part="pos"][data-value="'+pos+'"]').click();panels[i].querySelector('[data-part="meaning"][data-value="'+meaning+'"]').click();}
 assert(w.T.state().locked);assert(d.getElementById('ymAnswerFlash').textContent.includes('정답!'));w.T.stop();
 await new Promise(r=>setTimeout(r,60));assert.deepEqual(errors,[]);
 console.log('PASS: 605 continuous rows, ambiguous POS review, separate senses edit/save/reopen, add/remove sense, two-part quiz grading');
 }finally{observers.forEach(o=>o.disconnect());dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
