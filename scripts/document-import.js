
(() => {
 'use strict';
 const BASE=2956; let owner='',baseKey='',currentSet=null,editorRows=[],page=0,busy=false,cancelled=false;
 const loads=new Map(),cancelJobs=new Set();let progressValue=0,invalidOnly=false;
 const validRow=x=>!!(String(x.word||'').trim()&&String(x.meaning||'').trim()&&/[A-Za-z]/.test(x.word));
 async function bounded(task,label,ms=90000){let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' 시간이 오래 걸립니다. 페이지 범위를 줄여 다시 시도해 주세요.')),ms);})]);}finally{clearTimeout(timer);}}
 const normalizePos=window.YMExtraction.normalizePos;
 const parse=window.YMExtraction.parse;
 let extractionReview=0,editorGeneration=0;
 async function script(url,global){if(window[global])return window[global];if(!loads.has(url))loads.set(url,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>resolve(window[global]);s.onerror=()=>{loads.delete(url);s.remove();reject(Error('인식 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));};document.head.append(s);}));return loads.get(url);}
 let pdfPromise;
 async function pdfLib(){if(window.pdfjsLib)return window.pdfjsLib;return pdfPromise ||= import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';return lib;}).catch(e=>{pdfPromise=null;throw e;});}
 function notice(text){const node=document.getElementById('ymImportStatus');if(node&&!busy){node.hidden=false;node.textContent=text;}}
 function progress(value){progressValue=Math.max(progressValue,Math.min(100,Math.round(value*100)));const root=document.getElementById('ymImportProgress');if(root){root.hidden=false;root.querySelector('progress').value=progressValue;root.querySelector('span').textContent=progressValue+'%';}const status=document.getElementById('ymImportStatus');if(status&&busy)status.hidden=true;}
 async function extract(file,from,to,onChunk=()=>{},onProgress=()=>{}){
  const startedGeneration=editorGeneration,startedUser=activeUser;
  if(file.size>40*1024*1024)throw Error('파일은 40MB 이하로 올려 주세요. 큰 PDF는 페이지를 나누어 저장해 주세요.');
  const ext=file.name.split('.').pop().toLowerCase();
  if(['txt','csv','tsv'].includes(ext))return file.text();
  if(ext==='docx'){const m=await script('https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js','mammoth');const data=await file.arrayBuffer();const html=(await m.convertToHtml({arrayBuffer:data})).value;const documentCopy=new DOMParser().parseFromString(html,'text/html');const rows=[];for(const tr of documentCopy.querySelectorAll('tr')){const cells=[...tr.children].filter(x=>x.matches('td,th')).map(x=>x.textContent.trim().replace(/\s+/g,' '));if(cells.length>=2)rows.push(...parse(cells.join('\t')));}if(rows.length)return window.YMExtraction.serialize(rows);return (await m.extractRawText({arrayBuffer:data})).value;}
  if(ext==='doc')throw Error('구형 .doc 파일은 Word에서 .docx 또는 PDF로 저장한 뒤 올려 주세요.');
  const workers=new Map();let pageBase=0,pageSpan=1,layoutActive=false;const cancelWorkers=()=>Promise.all([...workers.values()].map(w=>w.terminate()));cancelJobs.add(cancelWorkers);
  function check(){if(cancelled||startedGeneration!==editorGeneration||activeUser!==startedUser)throw Error('취소했습니다.');}
  async function recognize(image,language='eng+kor',psm='6'){
   check();let worker=workers.get(language);
   if(!worker){const t=await script('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js','Tesseract');worker=await t.createWorker(language,1,{logger:m=>{if(startedGeneration===editorGeneration&&startedUser===activeUser&&m.status==='recognizing text')(!layoutActive&&onProgress(pageBase+pageSpan*(m.progress||0)));}});workers.set(language,worker);}
   await worker.setParameters({tessedit_pageseg_mode:psm,preserve_interword_spaces:'1'});
   const data=(await bounded(worker.recognize(image),'글자 인식')).data;check();return data;
  }
  async function ocr(image){
   const result=await window.YMExtraction.extractImage(image,recognize,check,text=>{check();layoutActive=true;const m=String(text).match(/(\d+)\/(\d+)/);if(m)onProgress(pageBase+pageSpan*(Number(m[1])-1)/Number(m[2]));});
   layoutActive=false;if(result){extractionReview+=result.rows.filter(x=>x.review).length;return window.YMExtraction.serialize(result.rows);}
   const canvas=await window.YMExtraction.canvasFor(image);return (await recognize(canvas,'eng+kor','3')).text;
  }
  try{
   if(ext==='pdf'){
    const lib=await pdfLib();const task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});const cancelPdf=()=>task.destroy();cancelJobs.add(cancelPdf);const pdf=await bounded(task.promise,'PDF 열기');
    try{const first=Math.max(1,from||1),last=Math.min(pdf.numPages,to||pdf.numPages);if(first>last)throw Error('PDF 페이지 범위를 확인해 주세요.');if(last-first+1>50)throw Error('한 번에 최대 50페이지를 처리합니다. 시작·끝 페이지를 지정해 주세요.');const texts=[];
     for(let n=first;n<=last;n++){if(cancelled)throw Error('취소했습니다.');pageBase=(n-first)/(last-first+1);pageSpan=1/(last-first+1);const p=await bounded(pdf.getPage(n),'PDF 페이지');const content=await bounded(p.getTextContent(),'PDF 텍스트');const items=content.items.filter(x=>typeof x.str==='string').sort((a,b)=>Math.abs(a.transform[5]-b.transform[5])>3?b.transform[5]-a.transform[5]:a.transform[4]-b.transform[4]);
      const lines=[];let line='',y=null;for(const x of items){const now=x.transform?.[5];if(y!==null&&Math.abs(now-y)>3){lines.push(line);line='';}line+=(line?'\t':'')+x.str;if(x.hasEOL){lines.push(line);line='';y=null;}else y=now;}if(line)lines.push(line);let text=lines.join('\n');
      const viewport=p.getViewport({scale:Math.min(2,1800/p.getViewport({scale:1}).width)});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const layout=await window.YMExtraction.extractImage(canvas,recognize,check,text=>{check();layoutActive=true;const m=String(text).match(/(\d+)\/(\d+)/);if(m)onProgress(pageBase+pageSpan*(Number(m[1])-1)/Number(m[2]));});
      layoutActive=false;if(layout){text=window.YMExtraction.serialize(layout.rows);extractionReview+=layout.rows.filter(x=>x.review).length;}
      else if(!parse(text).length)text=(await recognize(canvas,'eng+kor','3')).text;
      canvas.width=canvas.height=1;texts.push(text);onChunk(texts.join('\n'),n,last);onProgress((n-first+1)/(last-first+1));p.cleanup();
     }return texts.join('\n');
    }finally{cancelJobs.delete(cancelPdf);await pdf.destroy();}
   }
   if(file.type.startsWith('image/')||['png','jpg','jpeg','webp','bmp','gif'].includes(ext))return await ocr(file);
   throw Error('사진, PDF, Word(.docx), TXT, CSV, TSV 파일을 선택해 주세요.');
  }finally{cancelJobs.delete(cancelWorkers);await Promise.all([...workers.values()].map(worker=>worker.terminate()));}
 }
 function key(){return baseKey+'-import-sets-v1';}
 function sets(includeDeleted=false){try{return JSON.parse(localStorage.getItem(key())||'[]').filter(x=>x.id&&Array.isArray(x.words)&&(includeDeleted||!x.deletedAt));}catch(e){return [];}}
 function reset(){if(currentSet){if(activeUser===owner)SCORE_KEY=baseKey;quizData.length=BASE;allQuestions.length=BASE;memoryHistory=[];wrongMemory={listen:[],meaning:[]};currentSet=null;}}
 function prepareOwner(){if(activeUser!==owner){reset();owner=activeUser;baseKey=SCORE_KEY;}if(!baseKey)baseKey=SCORE_KEY;}
 function button(text,onclick){const b=document.createElement('button');b.type='button';b.className='restart-btn';b.textContent=text;b.onclick=onclick;return b;}
 function mount(){if(!document.getElementById('rangeStartSelect')||document.getElementById('ymFileImportOpen'))return;prepareOwner();document.getElementById('ymPhotoImport')?.setAttribute('hidden','');const b=button('📷 사진 · PDF · Word로 단어장 만들기',open);b.id='ymFileImportOpen';container.append(b);const list=document.createElement('div');list.id='ymImportedSets';container.append(list);
  for(const set of sets()){const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0';const label=document.createElement('span');label.textContent=set.name+' · '+set.words.length+'개';row.append(label,button('뜻 시험',()=>start(set,'meaning')),button('듣고 쓰기',()=>start(set,'listen')),button('성적',()=>{activate(set);showHistory();}),button('단어 수정',()=>{open();document.getElementById('ymImportName').value=set.name;document.getElementById('ymImportEditor').dataset.setId=set.id;editorRows=set.words.map(x=>({...x}));page=0;draw();}));list.append(row);}
 }
 function open(){if(!document.getElementById('ymImportDisabledStyle')){const style=document.createElement('style');style.id='ymImportDisabledStyle';style.textContent='#ymImportActions button:disabled,#ymImportBottom button:disabled{opacity:.4;filter:grayscale(1);cursor:wait}#ymImportProgress[hidden]{display:none!important}';document.head.append(style);}invalidOnly=false;editorGeneration++;cancelled=true;prepareOwner();stop();stopClock();busy=false;cancelled=false;editorRows=[];page=0;container.innerHTML='<h2>내 자료로 단어장 만들기</h2><label class="mode-field">단어장 이름<input id="ymImportName" maxlength="80" placeholder="예: 영어 3과"></label><div id="ymImportActions" style="display:flex;gap:8px;flex-wrap:wrap"></div><input type="file" id="ymImportFiles" multiple accept="image/*,.pdf,.docx,.doc,.txt,.csv,.tsv" hidden><input type="file" id="ymImportCamera" accept="image/*" capture="environment" hidden><div style="display:flex;gap:8px;margin:8px 0"><label>PDF 시작 페이지<input id="ymPdfFrom" type="number" min="1" value="1" style="width:55px"></label><label>끝 페이지<input id="ymPdfTo" type="number" min="1" placeholder="전체" style="width:55px"></label></div><p class="hint" id="ymImportStatus" role="status">교재의 단어·유의어·한글 뜻을 묶어 추출합니다. 예문은 제외하며, 저장 전 인식 결과를 확인해 주세요.</p><textarea id="ymImportRaw" placeholder="추출된 원문 · 직접 입력도 가능&#10;apple | 사과 | n" style="width:100%;height:80px;box-sizing:border-box;background:#222;color:white;font-size:16px"></textarea><div id="ymImportProgress" hidden style="display:flex;gap:12px;align-items:center;margin:12px 0"><progress value="0" max="100" aria-label="진행률" style="width:80%;height:18px"></progress><span aria-live="polite">0%</span></div><div id="ymImportEditor"></div><div id="ymImportBottom" style="display:flex;gap:8px;flex-wrap:wrap"></div>';
  const actions=document.getElementById('ymImportActions');actions.append(button('📷 사진 찍기',()=>document.getElementById('ymImportCamera').click()),button('📄 파일 선택',()=>document.getElementById('ymImportFiles').click()));
  document.getElementById('ymImportFiles').onchange=readFiles;document.getElementById('ymImportCamera').onchange=readFiles;
  const bottom=document.getElementById('ymImportBottom');bottom.append(button('원문에서 단어 추출',()=>{editorRows=parse(document.getElementById('ymImportRaw').value);page=0;draw();notice(editorRows.length+'개 추출 · 단어와 뜻을 확인해 주세요.');}),button('단어 추가',()=>{editorRows.push({word:'',meaning:'',pos:'',synonyms:''});page=Math.floor((editorRows.length-1)/5);draw();}),button('확인 완료 · 단어장 저장',save),button('닫기',()=>{if(busy){cancelled=true;for(const cancel of cancelJobs){try{Promise.resolve(cancel()).catch(()=>{});}catch(e){}}notice('인식 중지 중 · 완료된 페이지는 남깁니다.');return;}menu();}));bottom.append(button('빈 행 제외하고 저장',()=>{editorRows=editorRows.filter(validRow);invalidOnly=false;page=0;draw();save();}));draw();
 }
 async function readFiles(event){
  if(busy)return;const files=[...event.target.files];if(!files.length)return;
  busy=true;cancelled=false;progressValue=0;progress(0);const user=owner,generation=editorGeneration;const controls=[...document.querySelectorAll('#ymImportActions button,#ymImportBottom button')];
  controls.forEach(b=>{b.disabled=true;b.dataset.normalText=b.textContent;b.title='파일을 읽는 중입니다. 인식이 완료되면 사용할 수 있습니다.';});
  const cancelButton=controls.find(b=>b.textContent==='닫기');if(cancelButton){cancelButton.disabled=false;cancelButton.textContent='인식 중지';}
  const rawBox=document.getElementById('ymImportRaw');rawBox.readOnly=true;const texts=[],errors=[];
  if(!document.getElementById('ymImportName').value)document.getElementById('ymImportName').value=files[0].name.replace(/\.[^.]+$/,'');
  function preview(raw){if(generation!==editorGeneration||activeUser!==user||!document.getElementById('ymImportRaw'))return;rawBox.value=raw;editorRows=parse(raw);page=0;draw();}
  try{
   for(const [fileIndex,file] of files.entries()){if(cancelled||generation!==editorGeneration||activeUser!==user)break;let partial='';try{
    notice(file.name+' 읽는 중…');const text=await extract(file,Number(document.getElementById('ymPdfFrom').value),Number(document.getElementById('ymPdfTo').value),(chunk,n,total)=>{partial=chunk;preview([...texts,chunk].join('\n'));},fraction=>progress((fileIndex+Math.min(.99,fraction))/files.length));
    texts.push(text);preview(texts.join('\n'));progress((fileIndex+1)/files.length);
   }catch(e){if(partial)texts.push(partial);errors.push(file.name+': '+e.message);}}
   if(generation!==editorGeneration||activeUser!==user||!document.getElementById('ymImportRaw'))return;
   preview(texts.join('\n'));
   busy=false;notice((cancelled?'인식 중지 · 완료된 부분 ':'인식 완료 · ')+editorRows.length+'개 추출. '+(editorRows.length?'① 단어·뜻 확인 ② “확인 완료 · 단어장 저장” ③ 시험 시작':'원문을 “영단어 | 뜻” 형식으로 수정한 후 “원문에서 단어 추출”을 누르거나 “단어 추가”를 이용하세요.')+(errors.length?' · '+errors.join(' / '):''));
  }catch(e){busy=false;notice('인식 중 오류: '+String(e.message||e)+' · 원문에서 단어 추출을 다시 눌러 주세요.');}
  finally{if(generation!==editorGeneration)return;busy=false;const status=document.getElementById('ymImportStatus');if(status)status.hidden=false;rawBox.readOnly=false;controls.forEach(b=>{b.disabled=false;b.textContent=b.dataset.normalText;b.title='';});event.target.value='';if(document.getElementById('ymImportEditor'))draw();}
 }
 function draw(){const root=document.getElementById('ymImportEditor');if(!root)return;root.replaceChildren();const nav=document.createElement('div');nav.style.cssText='display:flex;gap:10px;align-items:center';const indexes=editorRows.map((_,i)=>i).filter(i=>!invalidOnly||!validRow(editorRows[i]));const bad=editorRows.filter(x=>!validRow(x)).length;const toggle=button(invalidOnly?'전체 보기':'빈 항목 '+bad+'개 보기',()=>{invalidOnly=!invalidOnly;page=0;draw();});toggle.disabled=busy;root.append(toggle);const pages=Math.max(1,Math.ceil(indexes.length/5));page=Math.min(page,pages-1);const prev=button('◀',()=>{page--;draw();});prev.disabled=busy||page===0;const next=button('▶',()=>{page++;draw();});next.disabled=busy||page===pages-1;const label=document.createElement('span');label.textContent=(invalidOnly?'확인 필요한 '+indexes.length:editorRows.length)+'개 · '+(page+1)+'/'+pages+'페이지';nav.append(prev,label,next);root.append(nav);
  for(const i of indexes.slice(page*5,page*5+5)){const row=editorRows[i],line=document.createElement('div');line.style.cssText='display:grid;grid-template-columns:1fr 1fr 70px 36px;gap:5px;margin:5px 0';for(const [field,label]of [['word','영단어'],['meaning','뜻']]){const input=document.createElement('input');input.value=row[field];input.placeholder=label;input.setAttribute('aria-label',label+' '+(i+1));input.style.cssText='min-width:0;width:100%;box-sizing:border-box;padding:8px;background:#222;color:white;border:1px solid #666;font-size:16px';input.oninput=()=>row[field]=input.value;line.append(input);}const pos=document.createElement('select');pos.setAttribute('aria-label','품사 '+(i+1));for(const [v,t]of [['','미지정'],['n','명사'],['v','동사'],['a','형용사'],['ad','부사']]){const o=document.createElement('option');o.value=v;o.textContent=t;pos.append(o);}pos.value=row.pos;pos.onchange=()=>row.pos=pos.value;line.append(pos,button('×',()=>{editorRows.splice(i,1);draw();}));const synonyms=document.createElement('input');synonyms.value=row.synonyms||'';synonyms.placeholder='영어 유의어 (선택)';synonyms.setAttribute('aria-label','유의어 '+(i+1));synonyms.style.cssText='grid-column:1/-1;min-width:0;padding:6px;background:#222;color:#c7e5b0;border:1px solid #555;font-size:14px';synonyms.oninput=()=>row.synonyms=synonyms.value;line.append(synonyms);if(!validRow(row))line.style.border='2px solid #ff7777';if(busy)line.querySelectorAll('input,select,button').forEach(x=>x.disabled=true);root.append(line);}
 }
 function save(){if(busy)return;const name=document.getElementById('ymImportName').value.trim(),root=document.getElementById('ymImportEditor');const words=editorRows.map(x=>({word:x.word.trim(),meaning:x.meaning.trim(),pos:normalizePos(x.pos),synonyms:(x.synonyms||'').trim()}));if(!name||!words.length){notice('단어장 이름과 단어를 입력해 주세요.');return;}if(words.some(x=>!x.word||!x.meaning||!/[A-Za-z]/.test(x.word))){const bad=words.filter(x=>!validRow(x)).length;invalidOnly=true;page=0;draw();notice('빈 항목이 있는 '+bad+'개 행만 표시했습니다. 빨간 행을 수정하거나 “빈 행 제외하고 저장”을 누르세요.');return;}if(words.length>2000){notice('한 단어장은 최대 2000개입니다. 나누어 저장해 주세요.');return;}const all=sets(true),id=root.dataset.setId||crypto.randomUUID();const old=all.find(x=>x.id===id);if(old&&JSON.stringify(old.words.map(x=>({word:x.word,meaning:x.meaning,pos:normalizePos(x.pos)})))!==JSON.stringify(words.map(x=>({word:x.word,meaning:x.meaning,pos:x.pos})))&&localStorage.getItem(baseKey+'-set-'+id)){notice('시험 기록이 있는 단어장의 구성은 변경하지 않습니다. 새 이름으로 새 단어장을 저장해 주세요.');delete root.dataset.setId;return;}const set={...old,id,name,words,updatedAt:Date.now(),createdAt:old?.createdAt||Date.now()};try{localStorage.setItem(key(),JSON.stringify([...all.filter(x=>x.id!==id),set]));saved(set);}catch(e){notice('단어장을 저장하지 못했습니다. 기기의 저장 공간을 확인해 주세요.');}}
 function saved(set){
  container.replaceChildren();const h=document.createElement('h2');h.textContent='단어장 저장 완료';const label=document.createElement('p');label.textContent=set.name+' · '+set.words.length+'개';const note=document.createElement('p');note.className='hint';note.textContent='시험 방식을 선택하세요. 단어장과 기록은 이 기기에 저장되며 시험 완료 또는 지금 동기화 버튼으로 서버에 저장합니다.';
  container.append(h,label,note,button('뜻 시험 시작',()=>start(set,'meaning')),button('듣고 쓰기 시작',()=>start(set,'listen')),button('단어장 목록',()=>menu()));
 }
 function activate(set){reset();prepareOwner();currentSet=set;SCORE_KEY=baseKey+'-set-'+set.id;memoryHistory=[];wrongMemory={listen:[],meaning:[]};scoreMemoryDirty=false;rangeStart=1;rangeEnd=set.words.length;testCount=set.words.length;
  const meanings=[...new Set(set.words.map(x=>x.meaning))];set.words.forEach((x,i)=>{const distractors=meanings.filter(m=>m!==x.meaning).sort(()=>Math.random()-.5).slice(0,3);const raw={number:i+1,q:x.word,options:[(x.pos?x.pos+'. ':'')+x.meaning,...distractors],answer:0};const sourceIndex=quizData.length;quizData.push(raw);allQuestions.push({sourceIndex,number:i+1,word:x.word,options:[x.meaning,...distractors],answer:0});});
 }
 function start(set,exam){activate(set);mode=exam;pronunciationSource='iphone';startRun(false);}
 const previousSelected=selectedQuestions;selectedQuestions=function(){return currentSet?allQuestions.slice(BASE):previousSelected();};
 const previousMenu=menu;menu=function(...args){if(typeof finishAttempt==='function')finishAttempt();reset();const r=previousMenu.apply(this,args);mount();return r;};
 const previousParts=loadParts;loadParts=function(q){if(!currentSet||currentSet.words[q.sourceIndex-BASE]?.pos)return previousParts(q);document.getElementById('question').textContent=q.word;const area=document.getElementById('area');area.replaceChildren();area.className='options';document.getElementById('feedback').textContent='뜻을 선택하세요. (품사 미지정)';for(const value of [...q.options].sort(()=>Math.random()-.5)){const b=button(value,()=>grade(value===q.options[q.answer],value));b.className='option-btn';area.append(b);}};
 const previousLoad=load;load=function(...args){const r=previousLoad.apply(this,args);if(currentSet){const label=document.createElement('p');label.className='hint';label.textContent='단어장: '+currentSet.name+' · 미국식 기기 음성';container.prepend(label);}return r;};
 const previousSave=saveScore;saveScore=function(...args){const r=previousSave.apply(this,args);if(currentSet&&savedAttemptId){const entries=readScores();const entry=entries.find(x=>x.id===savedAttemptId);if(entry){entry.setName=currentSet.name;entry.setId=currentSet.id;memoryHistory=entries;try{localStorage.setItem(SCORE_KEY,JSON.stringify(entries));}catch(e){scoreMemoryDirty=true;}}}return r;};
 function edit(set){open();document.getElementById('ymImportName').value=set.name;document.getElementById('ymImportEditor').dataset.setId=set.id;editorRows=set.words.map(x=>({...x}));page=0;draw();}
 function setDeleted(id,deleted){prepareOwner();const all=sets(true),item=all.find(x=>x.id===id);if(!item)return false;const now=Math.max(Date.now(),Number(item.updatedAt||0)+1);item.deletedAt=deleted?now:null;item.updatedAt=now;localStorage.setItem(key(),JSON.stringify(all));menu();return true;}
 window.YMImportStudy={parse,extract,open,sets,start,activate,reset,edit,currentSet:()=>currentSet,trash:id=>setDeleted(id,true),restore:id=>setDeleted(id,false)};mount();
})();
