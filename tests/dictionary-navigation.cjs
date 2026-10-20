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
const pause=()=>new Promise(r=>setTimeout(r,40));
(async()=>{try{
 const w=dom.window,d=w.document;w.T.user('dictionary-test');
 const set={id:'demo',name:'Dictionary book',words:[{word:'clout',meaning:'n. 권력, 영향력 / v. 때리다',pos:'n',senses:[{pos:'n',meaning:'권력, 영향력',synonyms:'power'},{pos:'v',meaning:'때리다',synonyms:'strike'}]},{word:'aplpe',meaning:'사과',pos:'v'}]};
 w.YMImportStudy.edit(set);
 const panel=i=>d.querySelectorAll('.ym-dictionary-panel')[i];
 assert.equal(d.querySelector('[aria-label="뜻 1-1"]').lang,'ko');assert.equal(d.querySelector('[aria-label="뜻 1-1"]').spellcheck,true);
 panel(0).querySelector('button').click();await pause();assert(panel(0).textContent.includes('명사, 동사'));assert(!panel(0).textContent.includes('입력 품사가 사전에 없어'));
 panel(1).querySelector('button').click();await pause();assert.equal(d.querySelector('[aria-label="영단어 2"]').value,'aplpe');
 assert(panel(1).textContent.includes('오타 확정 아님'));[...panel(1).querySelectorAll('button')].find(b=>b.textContent.includes('철자 후보: apple')).click();
 assert.equal(d.querySelector('[aria-label="영단어 2"]').value,'apple');assert.equal(d.querySelector('[aria-label="뜻 2-1"]').value,'사과');
 panel(1).querySelector('button').click();await pause();assert(panel(1).textContent.includes('입력 품사가 사전에 없어'));
 [...panel(1).querySelectorAll('button')].find(b=>b.textContent==='명사 적용').click();assert.equal(d.querySelector('[aria-label="품사 2-1"]').value,'n');assert.equal(d.querySelector('[aria-label="뜻 2-1"]').value,'사과');
 const word=d.querySelector('[aria-label="영단어 2"]');word.value='banana';word.dispatchEvent(new w.Event('input'));assert(!panel(1).textContent.includes('철자 조회됨'));
 delayNext=true;panel(1).querySelector('button').click();await pause();word.value='pear';word.dispatchEvent(new w.Event('input'));delayResolve();await pause();assert(!panel(1).textContent.includes('철자 조회됨'),'late result must not attach to edited word');
 fail=true;panel(1).querySelector('button').click();await pause();assert(panel(1).textContent.includes('연결 실패'));assert(!panel(1).textContent.includes('오타 확정'));
 fail=false;delayNext=true;panel(1).querySelector('button').click();await pause();w.T.menu();delayResolve();await pause();assert(!d.getElementById('ymImportEditor'));
 w.YMImportStudy.edit(set);const raw=d.getElementById('ymImportRaw');raw.value='apple | 사과 | n';d.querySelector('#ymImportTools button').click();await new Promise(r=>setTimeout(r,350));assert(panel(0).textContent.includes('철자 조회됨'),'extraction should auto-check');
 const naver=panel(0).querySelector('a');assert(naver.href.endsWith('query=apple'));
 // Finish a real imported-book attempt, then navigate without creating another score.
 w.YMImportStudy.start(set,'meaning');w.T.stop();w.T.result();await pause();assert(d.querySelector('.result-screen'));assert(d.getElementById('ymScreenBack'));assert(!d.getElementById('ymScreenBack').disabled);
 const before=w.localStorage.length;d.getElementById('ymScreenBack').click();assert.equal(d.getElementById('ymTab-study').getAttribute('aria-selected'),'true');assert(!d.getElementById('ymScreenForward').disabled);
 d.getElementById('ymScreenForward').click();assert(d.getElementById('scoreHistory'));assert(!d.querySelector('.result-screen'),'forward opens score history, never resubmits result');assert.equal(w.localStorage.length,before);
 assert(requests.every(url=>!/[가-힣]/.test(decodeURIComponent(url))));await pause();assert.deepEqual(errors,[]);
 console.log('PASS dictionary: exact/POS, typo candidate opt-in, Korean unchanged, per-sense preservation, stale response, offline, automatic extraction, Korean spellcheck flags; completed-exam back/forward');
 }finally{observers.forEach(o=>o.disconnect());dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1});
