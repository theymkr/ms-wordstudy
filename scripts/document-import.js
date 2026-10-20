
(() => {
 'use strict';
 const BASE=2956; let owner='',baseKey='',currentSet=null,editorRows=[],busy=false,cancelled=false;
 const loads=new Map(),cancelJobs=new Set();let progressValue=0,invalidOnly=false;
 const reviewRow=x=>window.YMExtraction.reviewIssues?.(x)||[];
 const readyRow=x=>validRow(x)&&reviewRow(x).length===0;
 const validRow=x=>!!(String(x.word||'').trim()&&String(x.meaning||'').trim()&&/[A-Za-z]/.test(x.word));
 async function bounded(task,label,ms=90000){let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' 시간이 오래 걸립니다. 페이지 범위를 줄여 다시 시도해 주세요.')),ms);})]);}finally{clearTimeout(timer);}}
 const normalizePos=window.YMExtraction.normalizePos;
 const parse=window.YMExtraction.parse;
 const splitSenses=window.YMExtraction.splitSenses,joinSenses=window.YMExtraction.joinSenses;
 const copyRow=x=>({...x,...(x.senses?{senses:x.senses.map(s=>({...s}))}:{})});
 let extractionReview=0,editorGeneration=0;
 const dictionary=window.YMDictionaryCheck.create({rows:()=>editorRows,changed:()=>draw(),active:()=>!busy&&activeUser===owner&&!!document.getElementById('ymImportEditor')});
 async function script(url,global){if(window[global])return window[global];if(!loads.has(url))loads.set(url,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>resolve(window[global]);s.onerror=()=>{loads.delete(url);s.remove();reject(Error('인식 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));};document.head.append(s);}));return loads.get(url);}
 let pdfPromise;
 async function pdfLib(){if(window.pdfjsLib)return window.pdfjsLib;return pdfPromise ||= import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';return lib;}).catch(e=>{pdfPromise=null;throw e;});}
 function notice(text){const node=document.getElementById('ymImportStatus');if(node&&!busy){node.hidden=false;node.textContent=text;}}
 function progress(value){progressValue=Math.max(progressValue,Math.min(100,Math.round(value*100)));const root=document.getElementById('ymImportProgress');if(root){root.hidden=false;root.querySelector('progress').value=progressValue;root.querySelector('span').textContent=progressValue+'%';}const status=document.getElementById('ymImportStatus');if(status&&busy)status.hidden=true;}
 async function extract(file,from,to,onChunk=()=>{},onProgress=()=>{}){
  const prepare=window.YMExtraction.prepareImport;
  return prepare(await extractSource(file,from,to,(text,n,last)=>onChunk(prepare(text),n,last),onProgress));
 }
 async function extractSource(file,from,to,onChunk=()=>{},onProgress=()=>{}){
  const startedGeneration=editorGeneration,startedUser=activeUser;
  if(file.size>40*1024*1024)throw Error('파일은 40MB 이하로 올려 주세요. 큰 PDF는 페이지를 나누어 저장해 주세요.');
  const ext=file.name.split('.').pop().toLowerCase();
  if(['txt','csv','tsv'].includes(ext))return file.text();
  if(ext==='docx'){const m=await script('https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js','mammoth');const data=await file.arrayBuffer();const html=(await m.convertToHtml({arrayBuffer:data})).value;const documentCopy=new DOMParser().parseFromString(html,'text/html');const rows=[];for(const tr of documentCopy.querySelectorAll('tr')){const cells=[...tr.children].filter(x=>x.matches('td,th')).map(x=>x.textContent.trim().replace(/\s+/g,' '));if(cells.length>=2)rows.push(...window.YMExtraction.parseImport(cells.join('\t')));}if(rows.length)return window.YMExtraction.serialize(rows);return (await m.extractRawText({arrayBuffer:data})).value;}
  if(ext==='doc')throw Error('구형 .doc 파일은 Word에서 .docx 또는 PDF로 저장한 뒤 올려 주세요.');
  const workers=new Map();let pageBase=0,pageSpan=1,layoutActive=false;const cancelWorkers=()=>Promise.all([...workers.values()].map(w=>w.terminate()));cancelJobs.add(cancelWorkers);
  function check(){if(cancelled||startedGeneration!==editorGeneration||activeUser!==startedUser)throw Error('취소했습니다.');}
  async function recognize(image,language='eng+kor',psm='6'){
   check();let worker=workers.get(language);
   if(!worker){const t=await script('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js','Tesseract');worker=await t.createWorker(language,1,{logger:m=>{if(startedGeneration===editorGeneration&&startedUser===activeUser&&m.status==='recognizing text')(!layoutActive&&onProgress(pageBase+pageSpan*(m.progress||0)));}});workers.set(language,worker);}
   await worker.setParameters(window.YMExtraction.ocrParameters(language,psm));
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
     for(let n=first;n<=last;n++){
      check();pageBase=(n-first)/(last-first+1);pageSpan=1/(last-first+1);
      const p=await bounded(pdf.getPage(n),'PDF 페이지');let canvas;
      try{
       const content=await bounded(p.getTextContent(),'PDF 텍스트');check();
       let text=window.YMExtraction.pdfText(content.items),rows=window.YMExtraction.parseImport(text);
       // Keep usable embedded text. OCR can degrade correct spelling and Hangul.
       const usable=rows.length>0&&rows.every(readyRow)&&!text.includes('�');
       if(!usable){
        const viewport=p.getViewport({scale:Math.min(2,1800/p.getViewport({scale:1}).width)});
        canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await bounded(p.render({canvasContext:canvas.getContext('2d'),viewport}).promise,'PDF 이미지');check();
        const layout=await window.YMExtraction.extractImage(canvas,recognize,check,text=>{check();layoutActive=true;const m=String(text).match(/(\d+)\/(\d+)/);if(m)onProgress(pageBase+pageSpan*(Number(m[1])-1)/Number(m[2]));});
        layoutActive=false;
        if(layout){text=window.YMExtraction.serialize(layout.rows);extractionReview+=layout.rows.filter(x=>x.review).length;}
        else if(!rows.length)text=(await recognize(canvas,'eng+kor','3')).text;
       }
       check();texts.push(text);onChunk(texts.join('\n'),n,last);onProgress((n-first+1)/(last-first+1));
      }finally{if(canvas)canvas.width=canvas.height=1;p.cleanup();}
     }return texts.join('\n');
    }finally{cancelJobs.delete(cancelPdf);await pdf.destroy();}
   }
   if(file.type.startsWith('image/')||['png','jpg','jpeg','webp','bmp','gif'].includes(ext))return await ocr(file);
   throw Error('사진, PDF, Word(.docx), TXT, CSV, TSV 파일을 선택해 주세요.');
  }finally{cancelJobs.delete(cancelWorkers);await Promise.all([...workers.values()].map(worker=>worker.terminate()));}
 }
 function key(){return baseKey+'-import-sets-v1';}
 function draftKey(){return baseKey+'-import-draft-v1';}
 function readDraft(){try{return JSON.parse(localStorage.getItem(draftKey())||'null');}catch(e){return null;}}
 function storeDraft(){const root=document.getElementById('ymImportEditor'),name=document.getElementById('ymImportName'),raw=document.getElementById('ymImportRaw');if(!root||!name||!raw)return;try{localStorage.setItem(draftKey(),JSON.stringify({name:name.value,raw:raw.value,rows:editorRows,setId:root.dataset.setId||null}));}catch(e){notice('임시 저장 공간이 부족합니다. 원문을 복사해 보관해 주세요.');}}
 function sets(includeDeleted=false){try{return JSON.parse(localStorage.getItem(key())||'[]').filter(x=>x.id&&Array.isArray(x.words)&&(includeDeleted||!x.deletedAt));}catch(e){return [];}}
 function reset(){if(currentSet){if(activeUser===owner)SCORE_KEY=baseKey;quizData.length=BASE;allQuestions.length=BASE;memoryHistory=[];wrongMemory={listen:[],meaning:[]};currentSet=null;}}
 function prepareOwner(){if(activeUser!==owner){reset();owner=activeUser;baseKey=SCORE_KEY;}if(!baseKey)baseKey=SCORE_KEY;}
 function button(text,onclick){const b=document.createElement('button');b.type='button';b.className='restart-btn';b.textContent=text;b.onclick=onclick;return b;}
 function mount(){if(!document.getElementById('rangeStartSelect')||document.getElementById('ymFileImportOpen'))return;prepareOwner();document.getElementById('ymPhotoImport')?.setAttribute('hidden','');const b=button('📷 사진 · PDF · Word로 단어장 만들기',open);b.id='ymFileImportOpen';container.append(b);const list=document.createElement('div');list.id='ymImportedSets';container.append(list);
  for(const set of sets()){const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0';const label=document.createElement('span');label.textContent=set.name+' · 시험 가능 '+set.words.length+'개 · 확인 필요 '+(set.pendingWords?.length||0)+'개 보관';row.append(label,button('뜻 시험',()=>start(set,'meaning')),button('듣고 쓰기',()=>start(set,'listen')),button('성적',()=>{activate(set);showHistory();}),button('단어 수정',()=>edit(set)));list.append(row);}
 }
 function open(options={}){
  dictionary.reset();invalidOnly=false;editorGeneration++;cancelled=true;prepareOwner();const resumedDraft=options.resume===false?null:readDraft();stop();stopClock();busy=false;cancelled=false;editorRows=[];
  container.innerHTML=`
   <h2>내 자료로 단어장 만들기</h2>
   <label class="ym-import-name">단어장 이름<input id="ymImportName" maxlength="80" placeholder="예: 영어 3과"></label>
   <details id="ymImportSource" open>
    <summary>사진 · 파일 · 원문</summary>
    <div id="ymImportActions"></div>
    <input type="file" id="ymImportFiles" multiple accept="image/*,.pdf,.docx,.doc,.txt,.csv,.tsv" hidden>
    <input type="file" id="ymImportCamera" accept="image/*" capture="environment" hidden>
    <div class="ym-import-pdf"><label>PDF 시작 페이지<input id="ymPdfFrom" type="number" min="1" value="1"></label><label>끝 페이지<input id="ymPdfTo" type="number" min="1" placeholder="전체"></label></div>
    <textarea id="ymImportRaw" aria-label="추출된 원문" placeholder="추출된 원문 · 직접 입력도 가능&#10;apple | 사과 | n"></textarea>
    <div id="ymImportTools"></div>
   </details>
   <p class="hint" id="ymImportStatus" role="status">영어·한국어를 인식하며 불필요한 기호는 제외합니다. 동의어의 쉼표와 구문 안의 띄어쓰기는 유지합니다.</p>
   <div id="ymImportProgress" hidden><progress value="0" max="100" aria-label="진행률"></progress><span aria-live="polite">0%</span></div>
   <div id="ymImportEditor"></div>
   <div id="ymImportBottom"></div>`;
  const source=document.getElementById('ymImportSource'),actions=document.getElementById('ymImportActions');
  actions.append(button('📷 사진 찍기',()=>document.getElementById('ymImportCamera').click()),button('📄 파일 선택',()=>document.getElementById('ymImportFiles').click()));
  document.getElementById('ymImportFiles').onchange=readFiles;document.getElementById('ymImportCamera').onchange=readFiles;
  document.getElementById('ymImportTools').append(button('원문에서 단어 추출',()=>{dictionary.reset();editorRows=parse(document.getElementById('ymImportRaw').value);invalidOnly=false;if(editorRows.length)source.open=false;draw(true);notice(editorRows.length+'개 추출 · 단어와 뜻을 확인해 주세요.');dictionary.run();}));
  document.getElementById('ymImportBottom').append(button('확인 완료 · 단어장 저장',save),button('닫기',()=>{if(busy){cancelled=true;for(const cancel of cancelJobs){try{Promise.resolve(cancel()).catch(()=>{});}catch(e){}}notice('인식 중지 중 · 완료된 페이지는 남깁니다.');return;}menu();}));
  if(resumedDraft&&Array.isArray(resumedDraft.rows)){editorRows=resumedDraft.rows;document.getElementById('ymImportName').value=resumedDraft.name||'';document.getElementById('ymImportRaw').value=resumedDraft.raw||'';if(resumedDraft.setId)document.getElementById('ymImportEditor').dataset.setId=resumedDraft.setId;if(editorRows.length)notice('임시 저장한 '+editorRows.length+'개 항목을 복원했습니다. 계속 수정하거나 “인식 결과 전체 지우기”를 누르세요.');}
  source.open=!editorRows.length;
  document.getElementById('ymImportName').addEventListener('input',storeDraft);document.getElementById('ymImportRaw').addEventListener('input',storeDraft);draw(true);
 }
 function clearResults(){
  if(busy)return;
  if((editorRows.length||document.getElementById('ymImportRaw').value.trim())&&!confirm('현재 인식 결과와 원문을 모두 지울까요? 저장한 단어장과 시험 기록은 유지됩니다.'))return;
  dictionary.reset();editorGeneration++;cancelled=false;editorRows=[];invalidOnly=false;extractionReview=0;progressValue=0;
  document.getElementById('ymImportRaw').value='';
  document.getElementById('ymImportFiles').value='';document.getElementById('ymImportCamera').value='';
  document.getElementById('ymImportProgress').hidden=true;document.getElementById('ymImportSource').open=true;
  draw(true);notice('인식 결과와 원문을 모두 지웠습니다. 새 사진·파일을 선택해 주세요.');
 }
 async function readFiles(event){
  if(busy)return;const files=[...event.target.files];if(!files.length)return;
  dictionary.reset();editorRows=[];document.getElementById('ymImportRaw').value='';busy=true;cancelled=false;extractionReview=0;invalidOnly=false;progressValue=0;progress(0);document.getElementById('ymImportSource').open=false;draw(true);const user=owner,generation=editorGeneration;const controls=[...document.querySelectorAll('#ymImportActions button,#ymImportTools button,#ymImportBottom button,#ymPdfFrom,#ymPdfTo')];
  controls.forEach(b=>{b.disabled=true;b.dataset.normalText=b.textContent;b.title='파일을 읽는 중입니다. 인식이 완료되면 사용할 수 있습니다.';});
  const cancelButton=controls.find(b=>b.textContent==='닫기');if(cancelButton){cancelButton.disabled=false;cancelButton.textContent='인식 중지';}
  const rawBox=document.getElementById('ymImportRaw');rawBox.readOnly=true;const texts=[],errors=[];
  if(!document.getElementById('ymImportName').value)document.getElementById('ymImportName').value=files[0].name.replace(/\.[^.]+$/,'');
  function preview(raw){if(generation!==editorGeneration||activeUser!==user||!document.getElementById('ymImportRaw'))return;rawBox.value=raw;editorRows=parse(raw);draw();}
  try{
   for(const [fileIndex,file] of files.entries()){if(cancelled||generation!==editorGeneration||activeUser!==user)break;let partial='';try{
    notice(file.name+' 읽는 중…');const text=await extract(file,Number(document.getElementById('ymPdfFrom').value),Number(document.getElementById('ymPdfTo').value),(chunk,n,total)=>{partial=chunk;preview([...texts,chunk].join('\n'));},fraction=>{if(generation===editorGeneration&&activeUser===user)progress((fileIndex+Math.min(.99,fraction))/files.length);});
    texts.push(text);preview(texts.join('\n'));progress((fileIndex+1)/files.length);
   }catch(e){if(partial)texts.push(partial);errors.push(file.name+': '+e.message);}}
   if(generation!==editorGeneration||activeUser!==user||!document.getElementById('ymImportRaw'))return;
   preview(texts.join('\n'));
   busy=false;notice((cancelled?'인식 중지 · 완료된 부분 ':'인식 완료 · ')+editorRows.length+'개 추출. '+(editorRows.length?'① 단어·뜻 확인 ② “확인 완료 · 단어장 저장” ③ 시험 시작':'원문을 “영단어 | 뜻” 형식으로 수정한 후 “원문에서 단어 추출”을 누르거나 “단어 추가”를 이용하세요.')+(errors.length?' · '+errors.join(' / '):''));
  }catch(e){busy=false;notice('인식 중 오류: '+String(e.message||e)+' · 원문에서 단어 추출을 다시 눌러 주세요.');}
  finally{if(generation!==editorGeneration)return;busy=false;const status=document.getElementById('ymImportStatus');if(status)status.hidden=false;rawBox.readOnly=false;controls.forEach(b=>{b.disabled=false;b.textContent=b.dataset.normalText;b.title='';});event.target.value='';if(document.getElementById('ymImportEditor')){draw();if(!cancelled)dictionary.run();}}
 }
 function draw(resetScroll=false){
  storeDraft();const root=document.getElementById('ymImportEditor');if(!root)return;
  const scrollTop=resetScroll?0:document.getElementById('ymImportRows')?.scrollTop||0;
  root.replaceChildren();
  const indexes=editorRows.map((_,i)=>i).filter(i=>!invalidOnly||!validRow(editorRows[i])||reviewRow(editorRows[i]).length);
  const bad=editorRows.filter(x=>!validRow(x)||reviewRow(x).length).length;
  const tools=document.createElement('div');tools.className='ym-import-review-tools';
  const toggle=button(invalidOnly?'전체 보기':'인식 확인 '+bad+'개 보기',()=>{invalidOnly=!invalidOnly;draw(true);});
  toggle.setAttribute('aria-pressed',String(invalidOnly));
  const add=button('단어 추가',()=>{editorRows.push({word:'',meaning:'',pos:'',synonyms:''});invalidOnly=false;document.getElementById('ymImportSource').open=false;draw();const list=document.getElementById('ymImportRows');list.scrollTop=list.scrollHeight;list.lastElementChild?.querySelector('input')?.focus({preventScroll:true});});add.disabled=busy;
  const clear=button('인식 결과 전체 지우기',clearResults);clear.id='ymImportClear';clear.disabled=busy;tools.append(toggle,clear,add);root.append(tools);dictionary.toolbar(root);
  const count=document.createElement('p');count.className='ym-import-count';count.textContent=(invalidOnly?'확인 필요 ':'전체 ')+indexes.length+'개 · 아래로 스크롤하여 수정';root.append(count);
  const list=document.createElement('div');list.id='ymImportRows';list.tabIndex=0;list.setAttribute('role','region');list.setAttribute('aria-label','단어 목록 · 위아래로 스크롤');root.append(list);
  if(!indexes.length){const empty=document.createElement('p');empty.className='hint';empty.textContent=invalidOnly?'확인이 필요한 항목이 없습니다.':busy?'인식된 단어가 여기에 표시됩니다.':'사진·파일을 선택하거나 원문을 입력해 주세요.';list.append(empty);}
  for(const i of indexes){
   const row=editorRows[i],line=document.createElement('div');line.className='ym-import-row';
   const wordLabel=document.createElement('label');wordLabel.className='ym-import-word';wordLabel.textContent=(i+1)+'. 영단어';
   const word=document.createElement('input');word.lang='en-US';word.spellcheck=true;word.setAttribute('autocorrect','off');word.value=row.word;word.setAttribute('aria-label','영단어 '+(i+1));word.oninput=()=>{row.word=word.value;delete row.reviewed;storeDraft();dictionary.refresh(row);};wordLabel.append(word);line.append(wordLabel);
   const senses=row.senses=window.YMExtraction.sensesWithSynonyms(row);
   const sync=()=>{Object.assign(row,joinSenses(senses));row.synonyms=senses.map(s=>s.synonyms||'').join(' / ');delete row.reviewed;storeDraft();dictionary.refresh(row);};
   const senseList=document.createElement('div');senseList.className='ym-import-senses';line.append(senseList);
   senses.forEach((sense,j)=>{
    const group=document.createElement('div');group.className='ym-import-sense';
    const posLabel=document.createElement('label');posLabel.textContent='품사 '+(j+1);
    const pos=document.createElement('select');pos.setAttribute('aria-label','품사 '+(i+1)+'-'+(j+1));
    for(const [v,t]of [['','미지정'],['n','명사'],['v','동사'],['a','형용사'],['ad','부사']]){const o=document.createElement('option');o.value=v;o.textContent=t;pos.append(o);}pos.value=sense.pos;pos.onchange=()=>{sense.pos=pos.value;sync();};posLabel.append(pos);
    const label=document.createElement('label');label.textContent='뜻 '+(j+1);
    const input=document.createElement('input');input.lang='ko';input.spellcheck=true;input.setAttribute('autocorrect','on');input.title='한국어 맞춤법: 브라우저에서 한국어 검사를 지원하고 켜둔 경우 밑줄로 표시됩니다. 뜻은 자동 변경하지 않습니다.';input.value=sense.meaning;input.setAttribute('aria-label','뜻 '+(i+1)+'-'+(j+1));input.oninput=()=>{sense.meaning=input.value;sync();};label.append(input);
    group.append(posLabel,label);
    if(senses.length>1){const removeSense=button('×',()=>{senses.splice(j,1);sync();draw();});removeSense.setAttribute('aria-label','뜻 '+(i+1)+'-'+(j+1)+' 삭제');group.append(removeSense);}
    const synonymLabel=document.createElement('label');synonymLabel.className='ym-import-synonyms';synonymLabel.textContent='동의어 '+(j+1);
    const synonyms=document.createElement('input');synonyms.value=sense.synonyms;synonyms.placeholder='이 뜻의 영어 동의어 (선택)';synonyms.setAttribute('aria-label','동의어 '+(i+1)+'-'+(j+1));synonyms.oninput=()=>{sense.synonyms=synonyms.value;sync();};synonymLabel.append(synonyms);group.append(synonymLabel);
    senseList.append(group);
   });
   const addSense=button('+ 뜻·품사·동의어 추가',()=>{senses.push({pos:'',meaning:'',synonyms:''});sync();draw();document.querySelectorAll('.ym-import-row')[indexes.indexOf(i)]?.querySelector('.ym-import-sense:last-child input')?.focus({preventScroll:true});});addSense.className='restart-btn ym-import-add-sense';line.append(addSense);
   const remove=button('×',()=>{editorRows.splice(i,1);draw();});remove.classList.add('ym-import-remove');remove.setAttribute('aria-label','단어 '+(i+1)+' 삭제');line.append(remove);
   dictionary.attach(line,row);const issues=reviewRow(row);if(issues.length){const note=document.createElement('small');note.textContent=issues.join(' ');line.append(note);line.classList.add('ym-import-review');}if(!busy&&validRow(row)&&issues.length){const confirm=button('원문과 확인 완료',()=>{row.reviewed=true;draw();});confirm.style.gridColumn='1/-1';line.append(confirm);}if(!validRow(row))line.classList.add('ym-import-invalid');if(busy)line.querySelectorAll('input,select,button').forEach(x=>x.disabled=true);list.append(line);
  }
  list.scrollTop=scrollTop;dictionary.refreshAll();
 }
 function save(){
  dictionary.cancel();
  if(busy){notice('인식 완료 후 저장합니다.');return;}
  storeDraft();const name=document.getElementById('ymImportName').value.trim(),root=document.getElementById('ymImportEditor');
  const entries=editorRows.map(x=>({word:window.YMExtraction.cleanWord(x.word),...joinSenses(splitSenses(x)),senses:splitSenses(x),synonyms:String(x.synonyms||'').trim(),...(x.review?{review:true}:{}),...(x.reviewed?{reviewed:true}:{})}));
  if(!name||!entries.length){notice('단어장 이름과 단어를 입력해 주세요.');return;}
  if(entries.length>2000){notice('한 단어장은 최대 2000개입니다. 나누어 저장해 주세요.');return;}
  const words=entries.filter(readyRow),pendingWords=entries.filter(x=>!readyRow(x));
  const all=sets(true),id=root.dataset.setId||crypto.randomUUID(),old=all.find(x=>x.id===id);
  if(old&&JSON.stringify(old.words.map(x=>({word:x.word,meaning:x.meaning,pos:normalizePos(x.pos)})))!==JSON.stringify(words.map(x=>({word:x.word,meaning:x.meaning,pos:x.pos})))&&localStorage.getItem(baseKey+'-set-'+id)){notice('시험 기록이 있는 단어장은 새 단어장으로 저장합니다. 저장 버튼을 한 번 더 눌러 주세요.');delete root.dataset.setId;storeDraft();return;}
  const set={...old,id,name,words,pendingWords,updatedAt:Date.now(),createdAt:old?.createdAt||Date.now()};
  try{localStorage.setItem(key(),JSON.stringify([...all.filter(x=>x.id!==id),set]));localStorage.setItem(draftKey(),'null');saved(set);}catch(e){notice('저장 공간이 부족하거나 차단됐습니다. 임시 저장된 내용을 보관한 뒤 다시 시도해 주세요.');}
 }
 function saved(set){
  container.replaceChildren();const h=document.createElement('h2');h.textContent='단어장 저장 완료';const label=document.createElement('p');label.textContent=set.name+' · 시험 가능 '+set.words.length+'개 · 확인 필요 '+(set.pendingWords?.length||0)+'개 보관';const note=document.createElement('p');note.className='hint';note.textContent='확인이 필요한 항목은 시험에서 제외하고 함께 보관합니다. 시험 방식을 선택하세요. 단어장과 기록은 이 기기에 저장되며 시험 완료 또는 지금 동기화 버튼으로 서버에 저장합니다.';
  const meaning=button('뜻 시험 시작',()=>start(set,'meaning')),listen=button('듣고 쓰기 시작',()=>start(set,'listen'));meaning.disabled=listen.disabled=!set.words.length;container.append(h,label,note,meaning,listen);if(set.pendingWords?.length)container.append(button('확인 필요 항목 수정',()=>edit(set)));container.append(button('단어장 목록',()=>menu()));
 }
 function activate(set){reset();prepareOwner();currentSet=set;SCORE_KEY=baseKey+'-set-'+set.id;memoryHistory=[];wrongMemory={listen:[],meaning:[]};scoreMemoryDirty=false;rangeStart=1;rangeEnd=set.words.length;testCount=set.words.length;
  const sensesFor=x=>splitSenses(x),answerFor=x=>sensesFor(x).map(s=>(s.pos?s.pos+'. ':'')+s.meaning).join(' / ');
  const meanings=[...new Set(set.words.flatMap(x=>sensesFor(x).map(s=>s.meaning)))];
  set.words.forEach((x,i)=>{const senses=sensesFor(x),answer=answerFor(x),distractors=meanings.filter(m=>!senses.some(s=>s.meaning===m)).sort(()=>Math.random()-.5).slice(0,3);const raw={number:i+1,q:x.word,options:[answer,...distractors],answer:0};const sourceIndex=quizData.length;quizData.push(raw);allQuestions.push({sourceIndex,number:i+1,word:x.word,options:[senses.map(s=>s.meaning).join(' / '),...distractors],answer:0});});
 }
 function start(set,exam){activate(set);mode=exam;pronunciationSource='iphone';startRun(false);}
 const previousSelected=selectedQuestions;selectedQuestions=function(){return currentSet?allQuestions.slice(BASE):previousSelected();};
 const previousMenu=menu;menu=function(...args){dictionary.reset();if(typeof finishAttempt==='function')finishAttempt();reset();const r=previousMenu.apply(this,args);mount();return r;};
 const previousParts=loadParts;loadParts=function(q){if(!currentSet||splitSenses(currentSet.words[q.sourceIndex-BASE]).every(s=>s.pos))return previousParts(q);document.getElementById('question').textContent=q.word;const area=document.getElementById('area');area.replaceChildren();area.className='options';document.getElementById('feedback').textContent='뜻을 선택하세요. (품사 미지정)';for(const value of [...q.options].sort(()=>Math.random()-.5)){const b=button(value,()=>grade(value===q.options[q.answer],value));b.className='option-btn';area.append(b);}};
 const previousLoad=load;load=function(...args){const r=previousLoad.apply(this,args);if(currentSet){const label=document.createElement('p');label.className='hint';label.textContent='단어장: '+currentSet.name+' · 미국식 기기 음성';container.prepend(label);}return r;};
 const previousSave=saveScore;saveScore=function(...args){const r=previousSave.apply(this,args);if(currentSet&&savedAttemptId){const entries=readScores();const entry=entries.find(x=>x.id===savedAttemptId);if(entry){entry.setName=currentSet.name;entry.setId=currentSet.id;memoryHistory=entries;try{localStorage.setItem(SCORE_KEY,JSON.stringify(entries));}catch(e){scoreMemoryDirty=true;}}}return r;};
 function edit(set){open({resume:false});document.getElementById('ymImportName').value=set.name;document.getElementById('ymImportEditor').dataset.setId=set.id;editorRows=[...set.words,...(set.pendingWords||[])].map(copyRow);document.getElementById('ymImportSource').open=!editorRows.length;draw(true);}
 function setDeleted(id,deleted){prepareOwner();const all=sets(true),item=all.find(x=>x.id===id);if(!item)return false;const now=Math.max(Date.now(),Number(item.updatedAt||0)+1);item.deletedAt=deleted?now:null;item.updatedAt=now;localStorage.setItem(key(),JSON.stringify(all));menu();return true;}
 window.YMImportStudy={parse,extract,open,sets,start,activate,reset,edit,currentSet:()=>currentSet,trash:id=>setDeleted(id,true),restore:id=>setDeleted(id,false)};mount();
})();
