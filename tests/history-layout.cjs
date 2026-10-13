const fs = require('node:fs');
const assert = require('node:assert/strict');
const browserType = require(process.env.PLAYWRIGHT_PATH || 'playwright')[process.env.BROWSER || 'chromium'];
let html = fs.readFileSync('public/index.html', 'utf8');
// Run the real built app against local fixture records, without cloud sign-in.
html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (all, attrs, code) =>
  attrs.includes('src=') || code.includes('client.auth.onAuthStateChange') ? '' : all);
const scores = [0,44,60,33,0,12,66,63];
const entries = scores.map((score, i) => ({id:'layout-'+i,date:'2026-10-11T09:14:00Z',mode:i===2?'meaning':'listen',scope:'all',rangeStart:1601,rangeEnd:1650,correct:score,total:100,plannedTotal:100,attemptStatus:'in_progress',score,wrongWordsVersion:1,wrongWords:[{word:'apple',number:1601,meaning:'사과',missCount:1}]}));
(async () => {
  const browser = await browserType.launch({headless:true});
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === 'https://layout.test/'
      ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
    await page.addInitScript(() => {
      window.fetch = async () => ({ok:false,json:async()=>({})});
      window.alert = () => {}; window.confirm = () => true;
    });
    await page.goto('https://layout.test/');
    await page.evaluate(entries => {
      enterUser('layout-test');
      localStorage.setItem(SCORE_KEY, JSON.stringify(entries));
      showHistory();
    }, entries);
    for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[1280,800]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const dimensions = await page.evaluate(() => {
        const c = document.querySelector('.quiz-container'), root = document.getElementById('scoreHistory');
        const rect = c.getBoundingClientRect();
        const print = document.querySelector('#scoreTable tr:not([hidden])[data-attempt-id] .ym-attempt-print').getBoundingClientRect();
        const home = document.getElementById('historyHome').getBoundingClientRect();
        return {width:rect.width,zoom:getComputedStyle(c).zoom,overflow:document.documentElement.scrollWidth>innerWidth,
          historyOverflow:root.scrollHeight-root.clientHeight,print:{left:print.left,right:print.right,width:print.width},homeBottom:home.bottom,
          visible:document.querySelectorAll('#scoreTable tr[data-attempt-id]:not([hidden])').length};
      });
      assert.equal(dimensions.zoom,'1');
      assert(dimensions.width >= Math.min(width-16,1120)-1, JSON.stringify(dimensions));
      assert(!dimensions.overflow, JSON.stringify(dimensions));
      assert(dimensions.print.left >= 0 && dimensions.print.right <= width && dimensions.print.width > 90, JSON.stringify(dimensions));
      assert(dimensions.homeBottom <= height, JSON.stringify(dimensions));
      if (width <= 700) assert.equal(dimensions.visible,1);
      assert(dimensions.historyOverflow<=2,JSON.stringify({width,height,...dimensions}));
      console.log('PASS layout',width,height,JSON.stringify(dimensions));
      if (width===390) await page.screenshot({path:process.env.HISTORY_SCREENSHOT || '/tmp/ym-history-mobile.png'});
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => window.YMHistoryLayout());
    const seen=[];
    for (let i=0;i<8;i++) {
      const row=page.locator('#scoreTable tr[data-attempt-id]:visible');
      seen.push(await row.getAttribute('data-attempt-id'));
      if(i<7) await page.getByRole('button',{name:'다음',exact:true}).click();
    }
    assert.deepEqual(seen,entries.map(row=>row.id).reverse());
    assert(await page.getByRole('button',{name:'다음',exact:true}).isDisabled());
    await page.selectOption('#scoreFilter','meaning');
    await page.evaluate(() => window.YMHistoryLayout());
    assert.equal(await page.locator('#scoreTable tr[data-attempt-id]:visible').count(),1);
    assert.equal(await page.locator('#scoreTable tr[data-attempt-id]:visible').getAttribute('data-attempt-id'),'layout-2');
    await page.getByRole('button',{name:'3회차 오답 출력'}).click();
    assert.equal(await page.locator('#ymReviewHeading').innerText(),'3회차 오답 단어');
    assert((await page.locator('#ymReviewPaper').innerText()).includes('apple'));
    await page.locator('#ymReviewClose').click();
    await page.evaluate(() => {localStorage.setItem(SCORE_KEY,'[]');showHistory();});
    await page.evaluate(() => window.YMHistoryLayout());
    assert((await page.locator('#scoreSummary').innerText()).includes('아직 저장된 시험이 없습니다'));
    assert.equal(await page.locator('#scoreTable tr[data-attempt-id]').count(),0);
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS pagination, filtering, print attempt identity, and empty history');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
