/* Read-only dictionary checks. Only explicit candidate actions edit a word.
 * Datamuse definitions: Wiktionary / WordNet; no Korean semantic validation. */
(() => {
 'use strict';
 const norm=x=>String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
 const posCode=x=>({adj:'a',adv:'ad',n:'n',v:'v',a:'a',ad:'ad'})[x]||'';
 const posName=x=>({n:'명사',v:'동사',a:'형용사',ad:'부사'})[x]||'기타';
 const valid=x=>/^[a-z][a-z '\-]{0,79}$/i.test(x);
 const link=(label,url)=>{const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;return b;};
 function parse(data,word){
  if(!Array.isArray(data))throw Error('invalid response');
  const exact=data.find(x=>norm(x.word)===word),suggestions=data.filter(x=>valid(x.word)&&norm(x.word)!==word).slice(0,4).map(x=>x.word);
  if(!exact)return {status:'missing',suggestions};
  const definitions=(exact.defs||[]).filter(x=>typeof x==='string').map(x=>{const [p,...rest]=x.split('\t');return {pos:posCode(p),text:rest.join(' ').trim()};}).filter(x=>x.text);
  const parts=[...new Set([...(exact.tags||[]).map(posCode),...definitions.map(x=>x.pos)].filter(Boolean))];
  return {status:'found',parts,definitions,headword:exact.defHeadword||'',suggestions:[]};
 }
 function create({rows,changed,active}){
  let epoch=0,running=false,results=new WeakMap(),panels=new WeakMap(),status='인식 후 철자·품사를 자동 조회합니다. 한글 맞춤법은 브라우저 지원 시 표시됩니다.';
  const controllers=new Set(),cache=new Map();
  const live=e=>e===epoch&&active();
  function update(){const p=document.getElementById('ymDictionaryStatus');if(p)p.textContent=status;const b=document.getElementById('ymDictionaryBatch');if(b)b.textContent=running?'사전 확인 중지':'전체 사전 대조';}
  function cancel(){epoch++;running=false;for(const c of controllers)c.abort();controllers.clear();for(const row of rows()){if(results.get(row)?.status==='loading')results.delete(row);render(row);}status='사전 확인 중지 · 완료된 결과는 유지됩니다.';update();}
  function reset(){cancel();results=new WeakMap();panels=new WeakMap();status='인식 후 철자·품사를 자동 조회합니다. 한글 맞춤법은 브라우저 지원 시 표시됩니다.';}
  async function request(query){const c=new AbortController();controllers.add(c);const timer=setTimeout(()=>c.abort(),10000);try{const r=await fetch('https://api.datamuse.com/words?'+query,{signal:c.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data))throw Error('invalid response');return data;}finally{clearTimeout(timer);controllers.delete(c);}}
  function render(row){
   const panel=panels.get(row);if(!panel?.isConnected)return;
   panel.replaceChildren();const word=norm(row.word),result=results.get(row),current=result?.word===word?result:null;
   const actions=document.createElement('div');actions.className='ym-dictionary-actions';
   const check=button('사전 대조',async()=>{if(!running){await checkRow(row,epoch);}});check.disabled=running||!valid(word)||!active()||current?.status==='loading';
   actions.append(check,link('네이버 사전에서 확인 ↗','https://en.dict.naver.com/#/search?query='+encodeURIComponent(row.word||'')));panel.append(actions);
   const note=document.createElement('p');note.className='ym-dictionary-note';panel.append(note);
   if(!current){note.textContent='영문 철자·품사를 대조합니다. 뜻은 변경하지 않습니다.';return;}
   if(current.status==='loading'){note.textContent='사전 조회 중…';return;}
   if(current.status==='error'){note.textContent='사전 연결 실패 · 미검증 (오타로 판정하지 않음). 다시 대조할 수 있습니다.';return;}
   if(current.status==='unsupported'){note.textContent='영어 단어·숙어를 입력한 후 확인해 주세요.';return;}
   if(current.status==='missing'){
    note.textContent='사전에서 정확히 찾지 못함 · 오타 확정 아님. 원본을 확인해 주세요.';
    for(const candidate of current.suggestions||[]){const b=button('철자 후보: '+candidate+' 적용',()=>{if(norm(row.word)!==word)return;row.word=candidate;delete row.reviewed;results.delete(row);changed();});panel.append(b);}return;
   }
   const senses=window.YMExtraction.sensesWithSynonyms(row);
   const unmatched=senses.filter(s=>s.pos&&!current.parts.includes(s.pos));
   note.textContent='철자 조회됨 · 사전 품사: '+(current.parts.map(posName).join(', ')||'정보 없음')+(unmatched.length?' · 입력 품사가 사전에 없어 확인 필요':'');
   senses.forEach((sense,i)=>{
    if(sense.pos&&current.parts.includes(sense.pos))return;
    const choices=document.createElement('div');choices.className='ym-dictionary-actions';
    const label=document.createElement('span');label.textContent='뜻 '+(i+1)+' 품사 확인: ';choices.append(label);
    for(const pos of current.parts)choices.append(button(posName(pos)+' 적용',()=>{
     if(norm(row.word)!==word)return;
     const entries=window.YMExtraction.sensesWithSynonyms(row);if(!entries[i])return;
     entries[i].pos=pos;row.senses=entries;Object.assign(row,window.YMExtraction.joinSenses(entries));
     delete row.reviewed;changed();
    }));panel.append(choices);
   });
   if(current.headword){const p=document.createElement('p');p.textContent='사전 기본형: '+current.headword+' (입력 철자 유지)';panel.append(p);}
   panel.append(link('조회 출처: Datamuse ↗','https://www.datamuse.com/api/'));

  }
  async function checkRow(row,e){
   const word=norm(row.word);if(!live(e))return;
   if(!valid(word)){results.set(row,{word,status:'unsupported'});render(row);return {status:'unsupported'};}
   results.set(row,{word,status:'loading'});render(row);
   let data;try{data=cache.get(word)||parse(await request('sp='+encodeURIComponent(word)+'&md=dp&max=5'),word);if(live(e))cache.set(word,data);}catch(err){data={status:'error'};}
   if(live(e)&&norm(row.word)===word&&rows().includes(row)){results.set(row,{word,...data});render(row);}return data;
  }
  async function run(){
   if(running||!active())return;running=true;const e=epoch,items=[...rows()];let done=0,errors=0,failed=0,missing=0;
   status='사전 대조 0 / '+items.length+' · 영어 단어만 외부 사전으로 전송';update();
   for(const row of items){if(!live(e))break;const data=await checkRow(row,e);if(!live(e))break;done++;if(data?.status==='error')failed++;if(data?.status==='missing'||data?.status==='unsupported')missing++;errors=data?.status==='error'?errors+1:0;status='사전 대조 '+done+' / '+items.length+' · 영어 철자·품사 확인 중';update();if(errors>=3){status='연결 실패로 중지 · '+done+'개 시도. 다시 대조해 주세요.';break;}await new Promise(r=>setTimeout(r,200));}
   if(live(e)){running=false;if(done===items.length)status='사전 조회 '+done+'개 · 미검색 '+missing+'개 · 연결 실패 '+failed+'개 · 결과를 확인해 주세요';update();for(const row of rows())render(row);}
  }
  function toolbar(root){const bar=document.createElement('div');bar.className='ym-dictionary-toolbar';const b=button(running?'사전 확인 중지':'전체 사전 대조',()=>running?cancel():run());b.id='ymDictionaryBatch';b.disabled=!active()||!rows().length;const p=document.createElement('p');p.id='ymDictionaryStatus';p.setAttribute('role','status');p.textContent=status;bar.append(b,p);root.append(bar);}
  function attach(line,row){const panel=document.createElement('div');panel.className='ym-dictionary-panel';panels.set(row,panel);line.append(panel);}
  return {run,cancel,reset,toolbar,attach,refresh:render,refreshAll:()=>rows().forEach(render)};
 }
 window.YMDictionaryCheck={create,parse};
})();
