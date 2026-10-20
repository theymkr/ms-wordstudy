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
 const w=dom.window,d=w.document;w.T.user('reset-test');
 const prefix='usher-unified-range-user-v1:reset-test',draftKey=prefix+'-import-draft-v1',booksKey=prefix+'-import-sets-v1';
 const saved={id:'saved',name:'저장한 책',words:[{word:'apple',meaning:'사과',pos:'n'}]};
 w.localStorage.setItem(booksKey,JSON.stringify([saved]));w.localStorage.setItem(prefix+'-set-saved','[{"score":100}]');
 const old={name:'1일차',raw:'obsolete | 구식의 | a',rows:[{word:'obsolete',meaning:'구식의',pos:'a'}]};
 w.localStorage.setItem(draftKey,JSON.stringify(old));w.YMImportStudy.open();
 assert.equal(d.querySelectorAll('.ym-import-row').length,1);assert(!d.getElementById('ymImportSource').open);
 assert(!d.getElementById('ymImportSource').contains(d.getElementById('ymImportClear')),'clear must be visible outside collapsed source');
 w.confirm=()=>false;d.getElementById('ymImportClear').click();assert.equal(d.querySelectorAll('.ym-import-row').length,1);
 w.confirm=()=>true;d.getElementById('ymImportClear').click();
 assert.equal(d.querySelectorAll('.ym-import-row').length,0);assert.equal(d.getElementById('ymImportRaw').value,'');assert(d.getElementById('ymImportSource').open);
 assert.equal(d.getElementById('ymImportName').value,'1일차');assert(d.getElementById('ymImportProgress').hidden);
 w.YMImportStudy.open();assert.equal(d.querySelectorAll('.ym-import-row').length,0);assert.equal(d.getElementById('ymImportRaw').value,'');
 assert(!d.getElementById('ymImportStatus').textContent.includes('복원'));
 assert.deepEqual(JSON.parse(w.localStorage.getItem(booksKey)),[saved]);assert.equal(w.localStorage.getItem(prefix+'-set-saved'),'[{"score":100}]');
 // A saved book must not inherit the raw text of an unrelated draft.
 w.localStorage.setItem(draftKey,JSON.stringify(old));w.YMImportStudy.edit(saved);
 assert.equal(d.querySelector('[aria-label="영단어 1"]').value,'apple');assert.equal(d.getElementById('ymImportRaw').value,'');
 // Replacement clears the old preview immediately, even while reading is pending.
 let resolveText;const file={name:'new.txt',size:30,type:'text/plain',text:()=>new Promise(r=>resolveText=r)};
 const input=d.getElementById('ymImportFiles');Object.defineProperty(input,'files',{value:[file],configurable:true});
 const reading=input.onchange({target:input});
 assert.equal(d.querySelectorAll('.ym-import-row').length,0);assert(d.getElementById('ymImportClear').disabled);
 assert.equal(JSON.parse(w.localStorage.getItem(draftKey)).rows.length,0);
 resolveText('banana | 바나나 | n');await reading;
 assert.equal(d.querySelectorAll('.ym-import-row').length,1);assert.equal(d.querySelector('[aria-label="영단어 1"]').value,'banana');
 assert(!d.getElementById('ymImportClear').disabled);
 d.getElementById('ymImportClear').click();w.YMImportStudy.open();assert.equal(d.querySelectorAll('.ym-import-row').length,0);
 await new Promise(r=>setTimeout(r,60));assert.deepEqual(errors,[]);
 console.log('PASS: restored draft clear/cancel/reopen, saved book and history preserved, editing raw isolation, immediate file replacement');
 }finally{observers.forEach(o=>o.disconnect());dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
