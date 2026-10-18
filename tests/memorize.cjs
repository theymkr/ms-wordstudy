const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const html=fs.readFileSync('public/index.html','utf8').replace(/<script([^>]*)>([\s\S]*?)<\/script>/g,(all,attrs,code)=>attrs.includes('src=')||code.includes('client.auth.onAuthStateChange')?'':all);
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:393,height:680}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='https://memo.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await page.addInitScript(()=>{window.fetch=async()=>({ok:false,json:async()=>({})});window.alert=()=>{};window.spoken=[];window.SpeechSynthesisUtterance=function(text){this.text=text;};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},resume(){},speak(u){window.spoken.push(u);}}});});
 await page.goto('https://memo.test/');await page.evaluate(()=>enterUser('memorize-test'));
 assert(await page.locator('#ymMemoOpen').count());
 await page.evaluate(()=>{captureRange=()=>true;selectedQuestions=()=>allQuestions.slice(0,205);pronunciationSource='iphone';YMMemorize.open();});
 assert.equal(await page.locator('.ym-memo-word').count(),100);assert.equal(await page.evaluate(()=>spoken.length),0);
 const baseline=await page.evaluate(()=>({count:pronunciationCount,records:JSON.stringify(records)}));
 await page.locator('.ym-memo-word').first().click();
 for(let i=1;i<=3;i++){assert.equal(await page.evaluate(()=>spoken.length),i);await page.evaluate(()=>spoken.at(-1).onend());if(i<3)await page.waitForTimeout(600);}
 await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>spoken.length),3);
 assert.deepEqual(await page.evaluate(()=>({count:pronunciationCount,records:JSON.stringify(records)})),baseline);
 await page.locator('.ym-memo-word').first().click();await page.evaluate(()=>{window.old=spoken.at(-1);old.onend();});await page.locator('.ym-memo-word').nth(1).click();await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>spoken.length),5);
 await page.locator('#ymMemoNext').click();await page.evaluate(()=>spoken.at(-1).onend());await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>spoken.length),5);assert.equal(await page.locator('.ym-memo-word small').first().textContent(),'101');
 await page.locator('#ymMemoNext').click();assert.equal(await page.locator('.ym-memo-word').count(),5);assert(await page.locator('#ymMemoNext').isDisabled());await page.locator('#ymMemoPrev').click();assert.equal(await page.locator('.ym-memo-word').count(),100);
 for(const [width,height]of [[320,568],[393,680],[844,390]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);const bounds=await page.locator('#ymMemoPager').boundingBox();assert(bounds.y+bounds.height<=height+1,JSON.stringify(bounds));assert(await page.locator('#ymMemoHome').isVisible());assert(await page.locator('#ymMemoList').evaluate(el=>el.scrollHeight>el.clientHeight));}
 await page.locator('#ymMemoFrom').fill('201');await page.locator('#ymMemoTo').fill('350');await page.locator('#ymMemoRange button').click();
 assert.equal(await page.locator('.ym-memo-word').count(),100);assert.equal(await page.locator('.ym-memo-word small').first().textContent(),'201');
 await page.locator('#ymMemoNext').click();assert.equal(await page.locator('.ym-memo-word').count(),50);assert.equal(await page.locator('.ym-memo-word small').first().textContent(),'301');
 await page.locator('#ymMemoFrom').fill('400');await page.locator('#ymMemoTo').fill('350');await page.locator('#ymMemoRange button').click();assert(await page.locator('#ymMemoRangeError').textContent());assert.equal(await page.locator('.ym-memo-word').count(),50);
 await page.locator('#ymMemoFrom').fill('201');await page.locator('#ymMemoRange button').click();
 await page.setViewportSize({width:393,height:680});await page.screenshot({path:'/tmp/memorize.png'});await page.locator('#ymMemoHome').click();assert(await page.locator('#ymMemoOpen').isVisible());assert.deepEqual(errors,[]);console.log('PASS: 100-item paging, three manual repeats, interruption, no exam side effects, mobile navigation and menu return');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
