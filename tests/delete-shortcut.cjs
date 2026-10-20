const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_PATH||'jsdom');
let html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
html=html.replace('</body>','<script>window.T={user:enterUser,stop:()=>stop(),menu:()=>menu(),result:()=>result()};</script></body>');
const errors=[],observers=[],requests=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Could not parse CSS'))errors.push(e.detail?.stack||e.message)});
let delayResolve,delayNext=false,fail=false;
const dom=new JSDOM(html,{url:'https://import.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
 const Original=w.MutationObserver;w.MutationObserver=class extends Original{constructor(cb){super(cb);observers.push(this)}};
 w.URL.revokeObjectURL=()=>{};w.URL.createObjectURL=()=>'';w.alert=()=>{};w.confirm=()=>true;
 w.fetch=async url=>{if(!url.startsWith('https://api.datamuse.com/'))return {ok:false,json:async()=>({})};requests.push(url);if(delayNext){delayNext=false;await new Promise(r=>delayResolve=r);}if(fail)throw Error('offline');const word=new URL(url).searchParams.get('sp');return {ok:true,json:async()=>word==='aplpe'?[{word:'apple',tags:['n']}]:word==='clout'?[{word:'clout',tags:['n','v'],defs:['n\tInfluence.','v\tTo hit.']}]:[{word,tags:['n'],defs:['n\tA fruit.']}]};};
 w.speechSynthesis={cancel(){},resume(){},getVoices:()=>[],speak(){}};w.SpeechSynthesisUtterance=function(){};w.HTMLMediaElement.prototype.pause=function(){};
}});

(async()=>{try{
 const w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.T.user('delete-test');
 const key='usher-unified-range-user-v1:delete-test-import-sets-v1';
 const books=[{id:'first',name:'First book',words:[{word:'apple',meaning:'사과',pos:'n'}]},{id:'second',name:'Second book',words:[{word:'pear',meaning:'배',pos:'n'}]}];
 w.localStorage.setItem(key,JSON.stringify(books));w.localStorage.setItem('unrelated-score','keep');w.T.menu();
 const open=()=>{d.getElementById('ymTab-settings').click();d.getElementById('ymTrashSelectedBook').click();};
 assert.equal(d.getElementById('ymEditSelectedBook').nextElementSibling.id,'ymTrashSelectedBook');
 assert(!d.getElementById('ymTrashSelectedBook').hidden,'delete shortcut remains visible on base book');
 open();assert.equal(d.querySelectorAll('#ymDeleteBookSelect option').length,2);assert(!d.getElementById('ymDeleteBookSelect').textContent.includes('MS'));
 d.querySelector('#ymDeleteBookDialog button').click();assert.equal(w.YMImportStudy.sets().length,2);
 open();d.getElementById('ymDeleteBookSelect').value='second';w.confirm=()=>false;d.querySelector('#ymDeleteBookDialog button:last-child').click();assert.equal(w.YMImportStudy.sets().length,2);
 w.confirm=()=>true;d.querySelector('#ymDeleteBookDialog button:last-child').click();assert.equal(w.YMImportStudy.sets().length,1);assert.equal(w.YMImportStudy.sets()[0].id,'first');
 assert(w.YMImportStudy.sets(true).find(x=>x.id==='second').deletedAt);assert.equal(w.localStorage.getItem('unrelated-score'),'keep');assert.equal(d.getElementById('ymTab-settings').getAttribute('aria-selected'),'true');
 d.querySelector('[aria-label="Second book 복원"]').click();assert.equal(w.YMImportStudy.sets().length,2);
 w.localStorage.setItem(key,'[]');w.T.menu();open();assert(d.getElementById('ymDeleteBookDialog').textContent.includes('삭제할 추가 단어장이 없습니다'));assert(!d.getElementById('ymDeleteBookSelect'));assert.equal(d.querySelectorAll('#ymDeleteBookDialog button').length,1);
 assert.deepEqual(errors,[]);console.log('PASS: persistent delete shortcut below editor, picker excludes base book, cancel, confirmed target-only trash, score preservation, restore, empty-state');
 }finally{observers.forEach(o=>o.disconnect());dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
