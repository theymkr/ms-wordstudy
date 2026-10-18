/* Real HTMLAudioElement playback, isolated from accounts and score writes. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const entries = JSON.parse(fs.readFileSync('audio-supplement/manifest.json', 'utf8'));
const origin = process.env.AUDIO_BASE_URL || 'https://audio-verification.test';
const html = fs.readFileSync(process.env.AUDIO_HTML_PATH || 'public/index.html', 'utf8')
  .replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (all, attrs, code) => attrs.includes('src=') || code.includes('client.auth.onAuthStateChange') ? '' : all);

(async () => {
  const proxy = process.env.AUDIO_BASE_URL && process.env.HTTPS_PROXY ? {server:process.env.HTTPS_PROXY} : undefined;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH, args:['--no-sandbox'], proxy});
  try {
    const page = await browser.newPage({viewport:{width:393,height:680}, ignoreHTTPSErrors:!!proxy});
    const errors = [], responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.url().includes('/audio-pilot/extra-us-')) responses.push({url:response.url(),status:response.status()});});
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.href === origin + '/') return route.fulfill({contentType:'text/html',body:html});
      if (url.origin === origin && /^\/audio-pilot\/extra-us-[a-z]+\.mp3$/.test(url.pathname)) {
        if (process.env.AUDIO_BASE_URL) return route.continue();
        return route.fulfill({contentType:'audio/mpeg',body:fs.readFileSync(path.join('public',decodeURIComponent(url.pathname)))});
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      // Disable network APIs used for account/scoring; leave browser media untouched.
      window.fetch = async () => ({ok:false,json:async()=>({})});
      window.alert = () => {};
      window.mediaEvents = []; window.ttsCalls = 0;
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (!this.dataset.observed) {
          this.dataset.observed = 'true';
          for (const type of ['playing','ended','error']) this.addEventListener(type, () => mediaEvents.push({type,src:this.currentSrc,error:this.error?.code || null,duration:this.duration}));
        }
        return originalPlay.apply(this,arguments);
      };
      window.SpeechSynthesisUtterance = function(text) {this.text=text;};
      Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},resume(){},speak(){window.ttsCalls++;}}});
    });
    await page.goto(origin + '/');
    await page.evaluate(() => enterUser('isolated-audio-verification'));
    const expected = JSON.parse(html.match(/const usAudioFiles=Object.freeze\((\{[^\n]*\})\);/)[1]);
    await page.locator('#ymTab-study').click();
    assert((await page.locator('#sourceUS').textContent()).includes(Object.keys(expected).length.toLocaleString('en-US')));
    await page.locator('#ymTab-memorize').click();
    await page.evaluate(numbers => {
      captureRange=()=>true;
      selectedQuestions=()=>allQuestions.filter(q=>numbers.includes(q.number));
      pronunciationSource='us'; YMMemorize.open();
    }, entries.map(item=>item.number));
    const before = await page.evaluate(() => ({count:pronunciationCount,records:JSON.stringify(records)}));
    const results = [];
    for (const entry of entries) {
      await page.evaluate(() => {window.mediaEvents=[];});
      await page.locator('.ym-memo-word').filter({has:page.locator('strong',{hasText:new RegExp('^'+entry.word+'$')})}).click();
      await page.waitForFunction(() => document.getElementById('ymMemoProgress').textContent.includes('3회 재생 완료'), undefined, {timeout:30000});
      const events = await page.evaluate(() => mediaEvents);
      assert.equal(events.filter(event=>event.type==='playing').length,3,entry.word);
      assert.equal(events.filter(event=>event.type==='ended').length,3,entry.word);
      assert(events.every(event=>event.src.endsWith('/'+entry.file) && !event.error),entry.word);
      results.push({word:entry.word,file:entry.file,playing:3,ended:3,ttsFallback:false,events});
    }
    assert.equal(await page.evaluate(()=>ttsCalls),0);
    assert.deepEqual(await page.evaluate(() => ({count:pronunciationCount,records:JSON.stringify(records)})),before);
    assert.deepEqual(errors,[]);
    assert(responses.every(item=>item.status===200 || item.status===206));
    const report={mode:process.env.AUDIO_BASE_URL?'deployed-assets-isolated-app-fixture':'local-build',origin,results,responses,pageErrors:errors,personalDataWrites:false};
    if(process.env.AUDIO_REPORT_PATH)fs.writeFileSync(process.env.AUDIO_REPORT_PATH,JSON.stringify(report,null,2)+'\n');
    console.log('PASS: '+entries.length+' real recordings each played/ended 3 times; no TTS, account requests or score changes');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
