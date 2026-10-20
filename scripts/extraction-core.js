/* Local-only vocabulary extraction. No document content is sent to a service. */
(function(root){
'use strict';
const POS={n:'n',v:'v',a:'a',adj:'a',ad:'ad',adv:'ad','명사':'n','동사':'v','형용사':'a','부사':'ad'};
const normalizePos=s=>POS[String(s||'').trim().toLowerCase().replace(/\.$/,'')]||'';
const clean=s=>String(s||'').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[‐‑–—]/g,'-').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
const cleanWord=s=>clean(s).replace(/^[\s\d①-⑳.)·•▶▷>]+/,'').replace(/[*＊™®“”]+$/,'').trim();
// Remove a malformed OCR POS prefix, not punctuation inside a definition.
const cleanMeaning=s=>clean(s).replace(/^(?:[「『Γㄱ┌┐]\s*[.,。]\s*)+/u,'').trim();
function meaningInfo(value){
 const meaning=clean(String(value||'').trim().replace(/\s*\n\s*/g,' / '));
 const senses=[...meaning.matchAll(/(?:^|\s\/\s)(n|v|adj|adv|ad|a)[.,]\s*/gi)];
 return {meaning:senses.length===1&&senses[0].index===0?meaning.slice(senses[0][0].length).trim():meaning,pos:senses.length===1?normalizePos(senses[0][1]):''};
}
// Keep one headword with separately editable POS/meaning pairs. Also recognize
// older imports whose punctuation filtering removed the POS dots and slashes.
function splitSenses(row){
 if(Array.isArray(row.senses)&&row.senses.length)return row.senses.map(s=>({pos:normalizePos(s.pos),meaning:cleanMeaning(s.meaning),...(typeof s.synonyms==='string'?{synonyms:s.synonyms}:{})}));
 const value=clean(row.meaning);
 const marks=[...value.matchAll(/(?:^|\s*\/\s*|\s+)(adj|adv|ad|n|v|a)(?:[.,]\s*|\s+(?=[가-힣]))/gi)];
 if(!marks.length)return value.split(/\s+\/\s+/).map(meaning=>({pos:normalizePos(row.pos),meaning:cleanMeaning(meaning)}));
 const result=[];
 if(marks[0].index>0)result.push({pos:'',meaning:value.slice(0,marks[0].index).trim()});
 marks.forEach((m,i)=>result.push({pos:normalizePos(m[1]),meaning:value.slice(m.index+m[0].length,marks[i+1]?.index??value.length).trim()}));
 return result.map(s=>({...s,meaning:cleanMeaning(s.meaning)}));
}
function joinSenses(senses){
 return {pos:senses.length===1?normalizePos(senses[0].pos):'',meaning:senses.map(s=>(senses.length>1&&s.pos?normalizePos(s.pos)+'. ':'')+cleanMeaning(s.meaning)).join(' / ')};
}
function sensesWithSynonyms(row){
 const senses=splitSenses(row),groups=String(row.synonyms||'').split(/\s*\/\s*/);
 return senses.map((s,i)=>({...s,synonyms:typeof s.synonyms==='string'?s.synonyms:groups.length===senses.length?groups[i]:(i===0?String(row.synonyms||''): '')}));
}
function reviewIssues(row){
 const word=clean(row.word),meaning=clean(row.meaning),issues=[];
 if(!word||!meaning)issues.push('단어 또는 뜻이 비어 있습니다.');
 const senses=splitSenses(row);
 if(senses.length>1&&senses.some(s=>!s.pos||!s.meaning.trim()))issues.push('각 뜻의 품사와 내용을 확인해 주세요.');
 if(row.reviewed)return issues;
 if(row.review)issues.push('인식 신뢰도가 낮습니다. 원문과 비교해 주세요.');
 if(/[가-힣]/.test(word)||word.split(/\s+/).length>5||/\b[b-hj-z]\b/i.test(word)||/[a-z]\s+[A-Z][a-z]/.test(word))issues.push('단어에 다른 글자나 예문이 섞였는지 확인해 주세요.');
 if(/[가-힣]/.test(meaning)&&/\b[A-Z]{2,}\b/.test(meaning))issues.push('한글 뜻에 영문이 섞였습니다. 원문을 확인해 주세요.');
 if(/[£€¥₩$]\s*\d/.test(meaning))issues.push('통화기호·숫자가 뜻에 섞였습니다. 원문을 확인해 주세요.');
 if(/(?:^|\s\/\s)[0-9Γ].\s*[가-힣]/.test(meaning))issues.push('품사 표시가 숫자·기호로 읽힌 것 같습니다.');
 if(/\b[A-Z]{2,}\]/.test(meaning))issues.push('영문·괄호가 한글 뜻에 섞였습니다.');
 if(meaning&&/[A-Za-z]/.test(meaning)&&!/[가-힣]/.test(meaning))issues.push('뜻이 영문으로만 읽혔습니다. 원문과 비교해 주세요.');
 if(/[�]/.test(word+meaning))issues.push('읽지 못한 글자가 있습니다.');
 return issues;
}
function csv(line){const out=[];let part='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){part+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(part);part='';}else part+=c;}out.push(part);return out;}
function parse(text){
 const rows=[];let pending='',canonical=false;
 for(let line of String(text||'').split(/\r?\n/)){
  if(/^word\tmeaning\tpos\tsynonyms$/i.test(line.trim())){canonical=true;continue;}
  if(canonical&&line.includes('\t')){const p=line.split('\t');if(p.length===4||p.length===5){rows.push({word:cleanWord(p[0]),meaning:clean(p[1]),pos:normalizePos(p[2]),synonyms:clean(p[3]),...(p[4]==='review'?{review:true}:{})});continue;}}
  line=line.trim().replace(/^\d+[.)\s]+/,'');if(!line||/^(word|단어|영단어)\s*[,\t;|]/i.test(line))continue;
  const delimiter=line.includes('\t')?'tab':line.includes('|')?'pipe':line.includes(';')?'semi':'comma';
  let parts=delimiter==='tab'?line.split('\t'):delimiter==='pipe'?line.split(/\s*\|\s*/):delimiter==='semi'?line.split(/\s*;\s*/):line.includes(',')?csv(line):[line];
  let word='',meaning='',pos='',synonyms='';
  if(parts.length>=2&&/^[A-Za-z][A-Za-z '\-/().*]*$/.test(clean(parts[0]))){
   word=cleanWord(parts[0]);
   if(delimiter==='tab'&&parts.length===4){meaning=parts[1];pos=normalizePos(parts[2]);synonyms=parts[3];}
   else if(parts.length>=3&&/[A-Za-z]/.test(parts[1])&&!/[가-힣]/.test(parts[1])&&/[가-힣]/.test(parts[2])&&!normalizePos(parts[1])){synonyms=clean(parts[1]);meaning=parts.slice(2).join(', ');}
   else if(normalizePos(parts[1])&&parts.length>=3){pos=normalizePos(parts[1]);meaning=parts.slice(2).join(', ');}
   else {const tail=normalizePos(parts.at(-1));if(tail&&parts.length>=3){pos=tail;meaning=parts.slice(1,-1).join(', ');}else meaning=parts.slice(1).join(', ');}
  }else{
   const m=line.match(/^([A-Za-z][A-Za-z '\-/*]*?)\s+(?:(n|v|adj|adv|ad|a)\.\s*)?([가-힣].*)$/i);
   if(m){word=cleanWord(m[1]);pos=normalizePos(m[2]);meaning=m[3];}
   else if(/^[A-Za-z][A-Za-z '\-/*]{0,55}$/.test(line)&&line.split(/\s+/).length<=5){pending=cleanWord(line);continue;}
   else if(pending&&/^(?:(?:n|v|adj|adv|ad|a)\.\s*)?[가-힣]/i.test(line)){word=pending;meaning=line;pending='';}
  }
  if(word&&meaning){const info=meaningInfo(meaning);rows.push({word,meaning:info.meaning,pos:pos||info.pos,synonyms:clean(synonyms)});pending='';}
 }
 return rows;
}
function serialize(rows){return 'word\tmeaning\tpos\tsynonyms\n'+rows.map(r=>[r.word,r.meaning,r.pos||'',r.synonyms||'',...(r.review?['review']:[])].map(x=>String(x).replace(/[\t\r\n]/g,' ')).join('\t')).join('\n');}
// File-import policy only. Existing books and manual edits retain their spelling.
const withoutPhonetics=value=>String(value||'').replace(/\p{S}/gu,char=>char.normalize('NFKC')==='|'?'|':'').normalize('NFKC')
 .replace(/\[[^\]\r\n]*[æðθ\u0250-\u02ff][^\]\r\n]*\]/g,' ')
 .replace(/\/[^/\r\n]*[æðθ\u0250-\u02ff][^/\r\n]*\//g,' ');
function importLetters(value,word=false){
 return withoutPhonetics(value).replace(/[^A-Za-z\u1100-\u11ff\u3131-\u318e\uac00-\ud7a3\s]/g,word?'':' ').replace(/\s+/g,' ').trim();
}
// Commas separate synonyms; spaces inside phrases and slashes between senses
// are meaningful. Filter each entry without erasing those separators.
function importSynonyms(value){
 return withoutPhonetics(value).split('/').map(group=>group.split(/[,;]/).map(part=>importLetters(part)).filter(Boolean).join(', ')).join(' / ').trim();
}
function parseImport(text){
 // Keep delimiters and POS markers until columns are parsed; retain synonym separators.
 const source=withoutPhonetics(text).replace(/[^A-Za-z\u1100-\u11ff\u3131-\u318e\uac00-\ud7a3\s0-9|,;."'()\/*-]/g,'')
  .replace(/^[ \d.)*]+/gm,'').replace(/\d+/g,'');
 return parse(source).map(row=>({word:importLetters(row.word,true),...joinSenses(splitSenses(row).map(s=>({pos:s.pos,meaning:importLetters(s.meaning)}))),synonyms:importSynonyms(row.synonyms),...(row.review?{review:true}:{})})).filter(row=>row.word||row.meaning);
}
// PDF text items can be individual letters, words or cells. Reassemble nearby
// fragments before introducing column separators; hasEOL is not reading order.
function pdfText(items){
 const lines=[];
 for(const item of items.filter(x=>typeof x.str==='string'&&x.str.trim()).sort((a,b)=>(b.transform?.[5]||0)-(a.transform?.[5]||0))){
  const y=item.transform?.[5]||0,height=Math.abs(item.height||item.transform?.[3]||10);
  let line=lines.find(l=>Math.abs(l.y-y)<=Math.max(2,Math.min(l.height,height)*.3));
  if(!line){line={y,height,items:[]};lines.push(line);}line.items.push(item);
 }
 return lines.map(line=>{
  let text='',previous;
  for(const item of line.items.sort((a,b)=>(a.transform?.[4]||0)-(b.transform?.[4]||0))){
   if(previous){const height=Math.abs(previous.height||previous.transform?.[3]||10),width=Number.isFinite(previous.width)?previous.width:previous.str.length*height*.5;
    const gap=(item.transform?.[4]||0)-(previous.transform?.[4]||0)-width;
    text+=gap>Math.max(12,height*.9)?'\t':gap>height*.12?' ':'';
   }text+=item.str;previous=item;
  }return text;
 }).join('\n');
}
function prepareImport(text){
 const rows=parseImport(text);
 return rows.length?serialize(rows):String(text||'').split(/\r?\n/).map(line=>importLetters(line)).filter(Boolean).join('\n');
}
const ocrLatin='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
let ocrHangul;
function ocrParameters(language,psm){
 if(!['eng','eng+kor','kor+eng'].includes(language))throw Error('영어와 한국어만 인식할 수 있습니다.');
 if(language!=='eng'&&!ocrHangul)ocrHangul=[[0xac00,0xd7a3],[0x1100,0x11ff],[0x3131,0x318e]].map(([first,last])=>Array.from({length:last-first+1},(_,i)=>String.fromCharCode(first+i)).join('')).join('');
 // Numbers, separators and POS punctuation are structural input, removed above.
 return {tessedit_pageseg_mode:psm,preserve_interword_spaces:'1',tessedit_char_whitelist:ocrLatin+(language==='eng'?'':ocrHangul)+"0123456789 \t\n.,;|'()/\"-"};
}
function detectRegions(image){
 const {width:w,height:h,data}=image,mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),components=[];
 for(let i=0;i<mask.length;i++){const p=i*4,r=data[p],g=data[p+1],b=data[p+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);mask[i]=hi>110&&hi-lo>22?1:0;}
 const stack=new Int32Array(w*h);
 for(let i=0;i<mask.length;i++){
  if(!mask[i]||seen[i])continue;let count=0,minX=w,minY=h,maxX=0,maxY=0,top=0;stack[top++]=i;seen[i]=1;
  while(top){const at=stack[--top],x=at%w,y=Math.floor(at/w);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const n of [x>0?at-1:-1,x<w-1?at+1:-1,y>0?at-w:-1,y<h-1?at+w:-1])if(n>=0&&mask[n]&&!seen[n]){seen[n]=1;stack[top++]=n;}
  }
  const width=maxX-minX+1,height=maxY-minY+1,ratio=width/height;
  if(width>w*.075&&width<w*.35&&height>h*.012&&height<h*.085&&ratio>1.7&&ratio<12&&count/(width*height)>.36)components.push({x:minX,y:minY,width,height});
 }
 const left=components.filter(r=>r.x+r.width<w*.46),right=components.filter(r=>r.x>w*.52),pairs=[];
 for(const l of left){const r=right.filter(r=>Math.abs((r.y+r.height/2)-(l.y+l.height/2))<Math.min(r.height,l.height)*.35&&Math.max(r.height,l.height)/Math.min(r.height,l.height)<1.6).sort((a,b)=>Math.abs(a.y-l.y)-Math.abs(b.y-l.y))[0];if(r)pairs.push({left:l,right:r});}
 if(pairs.length<3)return [];
 const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];const lx=median(pairs.map(p=>p.left.x)),rx=median(pairs.map(p=>p.right.x));
 return pairs.filter(p=>Math.abs(p.left.x-lx)<w*.035&&Math.abs(p.right.x-rx)<w*.035).sort((a,b)=>a.left.y-b.left.y).map(p=>({...p,middle:{x:p.left.x+p.left.width+Math.max(3,w*.007),y:Math.min(p.left.y,p.right.y)-2,width:p.right.x-p.left.x-p.left.width-Math.max(7,w*.015),height:Math.round(Math.min(p.left.height,p.right.height)*.47)+2}}));
}
function prepareCrop(source,rect,panel){
 const inset=panel?Math.max(2,Math.round(rect.height*.10)):0;
 const x=Math.max(0,Math.round(rect.x+inset)),y=Math.max(0,Math.round(rect.y+inset));
 const w=Math.min(source.width-x,Math.round(rect.width-inset*2)),h=Math.min(source.height-y,Math.round(rect.height-inset*2));
 const crop=document.createElement('canvas');crop.width=w;crop.height=h;const ctx=crop.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,x,y,w,h,0,0,w,h);
 const pixels=ctx.getImageData(0,0,w,h),d=pixels.data;let sum=0,n=0;
 for(let i=0;i<d.length;i+=4){const hi=Math.max(d[i],d[i+1],d[i+2]),lo=Math.min(d[i],d[i+1],d[i+2]);if(hi-lo>22){sum+=lo;n++;}}
 const reverse=panel&&n>0&&sum/n<120;
 for(let i=0;i<d.length;i+=4){const lo=Math.min(d[i],d[i+1],d[i+2]);const value=panel?(reverse?255-(lo-75)*255/160:(lo-45)*255/140):(lo-100)*255/110;const v=Math.max(0,Math.min(255,value));d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
 if(!panel){for(let row=0;row<h;row++){let dark=0;for(let col=0;col<w;col++)if(d[(row*w+col)*4]<100)dark++;if(dark>w*.7)for(let col=0;col<w;col++){const at=(row*w+col)*4;d[at]=d[at+1]=d[at+2]=255;}}}
 ctx.putImageData(pixels,0,0);const scaled=document.createElement('canvas'),scale=Math.min(5,Math.max(3,100/h));scaled.width=Math.ceil(w*scale)+24;scaled.height=Math.ceil(h*scale)+24;const out=scaled.getContext('2d');out.fillStyle='white';out.fillRect(0,0,scaled.width,scaled.height);out.imageSmoothingEnabled=true;out.drawImage(crop,12,12,w*scale,h*scale);return scaled;
}
async function canvasFor(image){
 if(image&&typeof image.getContext==='function')return image;
 const url=URL.createObjectURL(image);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(2,2200/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas;}finally{URL.revokeObjectURL(url);}
}
async function extractImage(source,recognize,check=()=>{},progress=()=>{}){
 const canvas=await canvasFor(source);check();
 const small=document.createElement('canvas');const scale=Math.min(1,900/canvas.width);small.width=Math.round(canvas.width*scale);small.height=Math.round(canvas.height*scale);small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
 const regions=detectRegions(small.getContext('2d').getImageData(0,0,small.width,small.height));
 if(regions.length<3)return null;
 const rows=[];for(let i=0;i<regions.length;i++){
  check();progress('교재 '+(i+1)+'/'+regions.length+' · 단어·유의어·뜻 인식 중');const p=regions[i];const rect=r=>({x:r.x/scale,y:r.y/scale,width:r.width/scale,height:r.height/scale});
  const a=prepareCrop(canvas,rect(p.left),true),b=prepareCrop(canvas,rect(p.middle),false),c=prepareCrop(canvas,rect(p.right),true);
  const wordData=await recognize(a,'eng','7');check();const synData=await recognize(b,'eng','7');check();const meaningData=await recognize(c,'kor+eng','6');check();
  const word=cleanWord(wordData.text),info=meaningInfo(meaningData.text),synonyms=clean(synData.text).replace(/^[▶▷>»›|,+]+\s*/,'').replace(/\s*\|+$/,'');
  if(word||info.meaning)rows.push({word,meaning:info.meaning,pos:info.pos,synonyms,review:!word||!/[가-힣]/.test(info.meaning)||/[0-9#]/.test(info.meaning)||(!info.pos&&!/\b[nv][.,]/.test(info.meaning))||wordData.confidence<80||meaningData.confidence<80});
  a.width=b.width=c.width=1;
 }
 return {rows,regions:regions.length};
}
const api={normalizePos,cleanWord,meaningInfo,splitSenses,joinSenses,sensesWithSynonyms,reviewIssues,clean,parse,serialize,importLetters,parseImport,prepareImport,pdfText,ocrParameters,detectRegions,prepareCrop,canvasFor,extractImage};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.YMExtraction=api;
})(typeof window!=='undefined'?window:globalThis);
