const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:680},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url()==='https://imports.test/'?route.fulfill({contentType:'text/html',body:html}):route.abort());
  await page.addInitScript(()=>{window.fetch=async()=>({ok:false,json:async()=>({})});window.alert=()=>{};});
  await page.goto('https://imports.test/');
  await page.evaluate(()=>{enterUser('import-layout-test');YMImportStudy.open();});
  await page.locator('#ymImportName').fill('페이지 및 스크롤');
  const words=['apple','banana','cherry','date','egg','fruit','grape','house','island','juice','kiwi','lemon'];
  await page.locator('#ymImportFiles').setInputFiles({name:'words.txt',mimeType:'text/plain',buffer:Buffer.from(words.map(w=>w+' | 뜻 | n').join('\n'))});
  await page.waitForFunction(()=>document.getElementById('ymImportStatus').textContent.includes('인식 완료'));
  async function checkLayout(width,height){
   await page.setViewportSize({width,height});
   await page.waitForFunction(h=>Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--ym-exam-height'))-h)<2,height);
   const result=await page.evaluate(()=>{
    const c=document.querySelector('.quiz-container'),rows=document.getElementById('ymImportRows'),nav=document.getElementById('ymImportPager'),bottom=document.getElementById('ymImportBottom');
    const v=window.visualViewport;
    return {width:c.getBoundingClientRect().width,zoom:getComputedStyle(c).zoom,scroll:rows.scrollHeight>rows.clientHeight,height:rows.clientHeight,footer:bottom.getBoundingClientRect().bottom,nav:nav.getBoundingClientRect().bottom,limit:v.height,horizontal:c.scrollWidth>c.clientWidth+1||rows.scrollWidth>rows.clientWidth+1};
   });

   assert(result.width>=Math.min(width,900)-20,JSON.stringify(result));assert.equal(result.zoom,'1');assert(!result.horizontal,JSON.stringify(result));assert(result.height>40,JSON.stringify(result));assert(result.footer<=result.limit+1,JSON.stringify(result));assert(result.nav<result.footer,JSON.stringify(result));return result;
  }
  for(const [w,h]of [[320,568],[393,680],[430,730],[844,390],[1280,900]])await checkLayout(w,h);
  await checkLayout(393,680);
  await page.getByRole('textbox',{name:'뜻 1',exact:true}).fill('수정된 뜻');
  await page.locator('#ymImportRows').evaluate(el=>el.scrollTop=el.scrollHeight);
  assert(await page.locator('#ymImportRows').evaluate(el=>el.scrollTop>0));
  await page.getByRole('button',{name:'다음',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'영단어 6',exact:true}).inputValue(),'fruit');
  assert.equal(await page.locator('#ymImportRows').evaluate(el=>el.scrollTop),0);
  await page.getByRole('button',{name:'이전',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'뜻 1',exact:true}).inputValue(),'수정된 뜻');
  await page.getByRole('spinbutton',{name:'페이지 번호'}).fill('99');await page.getByRole('spinbutton',{name:'페이지 번호'}).press('Enter');
  assert.equal(await page.getByRole('spinbutton',{name:'페이지 번호'}).inputValue(),'3');
  assert(await page.getByRole('button',{name:'다음',exact:true}).isDisabled());
  await page.getByRole('spinbutton',{name:'페이지 번호'}).fill('0');await page.getByRole('spinbutton',{name:'페이지 번호'}).press('Enter');
  assert.equal(await page.getByRole('spinbutton',{name:'페이지 번호'}).inputValue(),'1');
  await page.getByRole('textbox',{name:'뜻 1',exact:true}).focus();await checkLayout(393,340);
  await page.keyboard.press('Tab');await checkLayout(393,680);
  if(process.env.IMPORT_SCREENSHOT)await page.screenshot({path:process.env.IMPORT_SCREENSHOT});
  await page.getByRole('button',{name:'확인 완료 · 단어장 저장',exact:true}).click();
  const saved=await page.evaluate(()=>YMImportStudy.sets().find(x=>x.name==='페이지 및 스크롤'));assert.equal(saved.words.length,12);assert.equal(saved.words[0].meaning,'수정된 뜻');
  await page.evaluate(()=>YMImportStudy.edit(YMImportStudy.sets().find(x=>x.name==='페이지 및 스크롤')));
  await checkLayout(393,680);assert.equal(await page.locator('#ymImportSource').evaluate(el=>el.open),false);
  // Streaming PDF pages must not reset the reader's current page or scroll.
  await page.evaluate(()=>{
   window.releasePdf=null;
   const source=Array.from({length:10},(_,i)=>({str:'apple | 사과 | n',transform:[1,0,0,1,0,400-i*20],hasEOL:true}));
   YMExtraction.extractImage=async()=>null;
   window.pdfjsLib={getDocument:()=>({destroy:async()=>{},promise:Promise.resolve({numPages:2,getPage:async n=>{if(n===2)await new Promise(resolve=>window.releasePdf=resolve);return {getTextContent:async()=>({items:source}),getViewport:()=>({width:800,height:600}),render:()=>({promise:Promise.resolve()}),cleanup(){}};},destroy:async()=>{}})})};
  });
  await page.locator('#ymImportFiles').setInputFiles({name:'stream.pdf',mimeType:'application/pdf',buffer:Buffer.from('stub')});
  await page.waitForFunction(()=>typeof window.releasePdf==='function');
  await page.getByRole('button',{name:'다음',exact:true}).click();
  assert.equal(await page.getByRole('spinbutton',{name:'페이지 번호'}).inputValue(),'2');
  assert(await page.getByRole('textbox',{name:'영단어 6',exact:true}).isDisabled());
  await page.locator('#ymImportRows').evaluate(el=>el.scrollTop=70);
  await page.evaluate(()=>window.releasePdf());
  await page.waitForFunction(()=>document.getElementById('ymImportStatus').textContent.includes('인식 완료'));
  assert.equal(await page.getByRole('spinbutton',{name:'페이지 번호'}).inputValue(),'2');
  assert.equal(await page.locator('#ymImportRows').evaluate(el=>el.scrollTop),70);
  assert(!(await page.getByRole('textbox',{name:'영단어 6',exact:true}).isDisabled()));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: mobile/desktop/short viewport layout, list scrolling, edit retention, page bounds, save/reopen, and paging during streamed recognition.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
