const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:700}}),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://imports.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.addInitScript(()=>{window.fetch=async()=>({ok:false,json:async()=>({})});window.alert=()=>{};});
  await page.goto('https://imports.test/');
  await page.evaluate(()=>{enterUser('editor-regression');YMImportStudy.open();});
  const source='strike b | 이 예문에는 ABC 문자가 섞였습니다\nobsolete | unused\napple | 사과 | n\nbanana | 바나나 | n\norange | 오렌지 | n\npear | 배 | n';
  await page.locator('#ymImportName').fill('확인 보관 테스트');
  await page.locator('#ymImportFiles').setInputFiles({name:'words.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.waitForFunction(()=>document.getElementById('ymImportStatus').textContent.includes('인식 완료'));
  assert.equal(await page.locator('.ym-import-row').count(),5);
  assert.equal(await page.getByRole('textbox',{name:'영단어 1',exact:true}).inputValue(),'strike b');
  assert.match(await page.getByRole('button',{name:/^(인식 확인|전체 보기)/}).textContent(),/2개/);
  await page.getByRole('button',{name:'확인 완료 · 단어장 저장',exact:true}).click();
  let saved=await page.evaluate(()=>YMImportStudy.sets().find(x=>x.name==='확인 보관 테스트'));
  assert.equal(saved.words.length,4);assert.equal(saved.pendingWords.length,2);
  await page.evaluate(()=>YMImportStudy.edit(YMImportStudy.sets().find(x=>x.name==='확인 보관 테스트')));
  await page.getByRole('button',{name:/^(인식 확인|전체 보기)/}).click();
  await page.getByRole('textbox',{name:'영단어 5',exact:true}).fill('strike');
  await page.getByRole('textbox',{name:'뜻 5',exact:true}).fill('치다');
  await page.getByRole('button',{name:'원문과 확인 완료',exact:true}).first().click();
  await page.getByRole('button',{name:'확인 완료 · 단어장 저장',exact:true}).click();
  saved=await page.evaluate(()=>YMImportStudy.sets().find(x=>x.name==='확인 보관 테스트'));
  assert.equal(saved.words.length,5);assert.equal(saved.pendingWords.length,1);assert(saved.words.find(x=>x.word==='strike').reviewed);
  // Embedded text must not be replaced by an OCR pass.
  const pdf=await page.evaluate(async()=>{
   YMImportStudy.open();window.pdfjsLib={getDocument:()=>({destroy:async()=>{},promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'obsolete',width:40,height:10,transform:[10,0,0,10,20,100],hasEOL:true},{str:'구식의',width:30,height:10,transform:[10,0,0,10,200,100],hasEOL:true}]}),render:()=>{throw Error('Text PDF must not be rasterized');},cleanup(){}}),destroy:async()=>{}})})};
   return YMExtraction.parse(await YMImportStudy.extract(new File(['stub'],'text.pdf'),1,1));
  });
  assert.deepEqual(pdf,[{word:'obsolete',meaning:'구식의',pos:'',synonyms:''}]);
  // Stop a later page while retaining already recognized pages and restoring save.
  await page.evaluate(()=>{
   window.awaitSecond=false;let rejectSecond;
   window.pdfjsLib={getDocument:()=>({destroy:async()=>{rejectSecond?.(Error('Stopped'));},promise:Promise.resolve({numPages:2,getPage:async n=>{
    if(n===2){window.awaitSecond=true;return new Promise((_,reject)=>rejectSecond=reject);}
    return {getTextContent:async()=>({items:[{str:'apple | 사과 | n',transform:[10,0,0,10,20,100]}]}),cleanup(){}};
   },destroy:async()=>{}})})};
  });
  await page.locator('#ymImportName').fill('중지 후 저장');
  await page.locator('#ymImportFiles').setInputFiles({name:'partial.pdf',mimeType:'application/pdf',buffer:Buffer.from('stub')});
  await page.waitForFunction(()=>window.awaitSecond);
  assert(await page.getByRole('textbox',{name:'영단어 1',exact:true}).evaluate(x=>x.disabled));
  assert(await page.getByRole('button',{name:'확인 완료 · 단어장 저장',exact:true}).isDisabled());
  await page.getByRole('button',{name:'인식 중지',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('ymImportStatus').textContent.includes('인식 중지 ·'));
  assert.equal(await page.getByRole('textbox',{name:'영단어 1',exact:true}).inputValue(),'apple');
  await page.getByRole('button',{name:'확인 완료 · 단어장 저장',exact:true}).click();
  saved=await page.evaluate(()=>YMImportStudy.sets().find(x=>x.name==='중지 후 저장'));
  assert.equal(saved.words.length,1);assert.equal(saved.words[0].word,'apple');
  assert.deepEqual(errors,[]);
  console.log('PASS: pending-word preservation and confirmation, embedded PDF text, cancellation and partial save.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
