const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
let html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url()==='https://imports.test/'?route.fulfill({contentType:'text/html',body:html}):route.abort());
  await page.addInitScript(()=>{window.fetch=async()=>({ok:false,json:async()=>({})});window.alert=()=>{};});
  await page.goto('https://imports.test/');
  const result=await page.evaluate(async()=>{
   enterUser('import-language-test');YMImportStudy.open();
   const source='★apple*** | 사과🍎, 과일! 123 | n.';
   const rows=text=>YMExtraction.parse(text);
   const extracted={};
   for(const ext of ['txt','csv','tsv'])extracted[ext]=rows(await YMImportStudy.extract(new File([source],'words.'+ext),1));
   window.mammoth={convertToHtml:async()=>({value:'<table><tr><td>★apple***</td><td>사과🍎, 과일! 123</td><td>n.</td></tr></table>'}),extractRawText:async()=>({value:source})};
   extracted.docx=rows(await YMImportStudy.extract(new File(['stub'],'words.docx'),1));
   const chunks=[];
   window.pdfjsLib={getDocument:()=>({destroy:async()=>{},promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:source,transform:[1,0,0,1,0,100],hasEOL:true}]}),getViewport:()=>({width:800,height:600}),render:()=>({promise:Promise.resolve()}),cleanup(){}}),destroy:async()=>{}})})};
   extracted.pdf=rows(await YMImportStudy.extract(new File(['stub'],'words.pdf'),1,1,text=>chunks.push(rows(text))));
   window.ocrCalls=[];window.Tesseract={createWorker:async(language)=>({setParameters:async params=>ocrCalls.push({language,params}),recognize:async()=>({data:{text:source,confidence:95}}),terminate:async()=>{}})};
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,400,200);
   const image=await new Promise(resolve=>canvas.toBlob(resolve));
   extracted.image=rows(await YMImportStudy.extract(new File([image],'words.png',{type:'image/png'}),1));
   return {extracted,chunks,calls:ocrCalls.map(x=>({language:x.language,korean:x.params.tessedit_char_whitelist.includes('한'),symbol:x.params.tessedit_char_whitelist.includes('★')}))};
  });
  const expected=[{word:'apple',meaning:'사과 과일',pos:'n',synonyms:''}];
  for(const [format,rows]of Object.entries(result.extracted))assert.deepEqual(rows,expected,format);
  assert.deepEqual(result.chunks,[expected]);assert.deepEqual(result.calls,[{language:'eng+kor',korean:true,symbol:false}]);
  await page.locator('#ymImportName').fill('영어 한국어 인식');
  await page.locator('#ymImportFiles').setInputFiles({name:'new-words.txt',mimeType:'text/plain',buffer:Buffer.from('★apple*** | 사과🍎, 과일! 123 | n.')});
  await page.waitForFunction(()=>document.getElementById('ymImportStatus').textContent.includes('인식 완료'));
  assert.equal(await page.getByRole('textbox',{name:'영단어 1',exact:true}).inputValue(),'apple');
  assert.equal(await page.getByRole('textbox',{name:'뜻 1',exact:true}).inputValue(),'사과 과일');
  await page.getByRole('button',{name:'확인 완료 · 단어장 저장',exact:true}).click();
  const saved=await page.evaluate(()=>YMImportStudy.sets().find(x=>x.name==='영어 한국어 인식'));
  assert.deepEqual(saved.words,expected);assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: TXT, CSV, TSV, DOCX table, PDF text and progressive preview, photo OCR configuration, file upload editor, and saved words.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
