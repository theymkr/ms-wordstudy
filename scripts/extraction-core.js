/* Local-only vocabulary extraction. No document content is sent to a service. */
(function(root){
'use strict';
const POS={n:'n',v:'v',a:'a',adj:'a',ad:'ad',adv:'ad','명사':'n','동사':'v','형용사':'a','부사':'ad'};
const normalizePos=s=>POS[String(s||'').trim().toLowerCase().replace(/\.$/,'')]||'';
const clean=s=>String(s||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
const cleanWord=s=>clean(s).replace(/^[\s\d①-⑳.)·•▶▷>]+/,'').replace(/[*＊™®“”]+$/,'').trim();
function meaningInfo(value){
 const meaning=clean(String(value||'').trim().replace(/\s*\n\s*/g,' / '));
 const senses=[...meaning.matchAll(/(?:^|\s\/\s)(n|v|adj|adv|ad|a)[.,]\s*/gi)];
 return {meaning:senses.length===1&&senses[0].index===0?meaning.slice(senses[0][0].length).trim():meaning,pos:senses.length===1?normalizePos(senses[0][1]):''};
}
function csv(line){const out=[];let part='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){part+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(part);part='';}else part+=c;}out.push(part);return out;}
function parse(text){
 const rows=[];let pending='',canonical=false;
 for(let line of String(text||'').split(/\r?\n/)){
  if(/^word\tmeaning\tpos\tsynonyms$/i.test(line.trim())){canonical=true;continue;}
  if(canonical&&line.includes('\t')){const p=line.split('\t');if(p.length===4){rows.push({word:cleanWord(p[0]),meaning:clean(p[1]),pos:normalizePos(p[2]),synonyms:clean(p[3])});continue;}}
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
function serialize(rows){return 'word\tmeaning\tpos\tsynonyms\n'+rows.map(r=>[r.word,r.meaning,r.pos||'',r.synonyms||''].map(x=>String(x).replace(/[\t\r\n]/g,' ')).join('\t')).join('\n');}
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
const api={normalizePos,cleanWord,meaningInfo,parse,serialize,detectRegions,prepareCrop,canvasFor,extractImage};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.YMExtraction=api;
})(typeof window!=='undefined'?window:globalThis);
