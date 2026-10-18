const fs = require('node:fs');
const assert = require('node:assert/strict');
const browserType = require(process.env.PLAYWRIGHT_PATH || 'playwright')[process.env.BROWSER || 'chromium'];
let html = fs.readFileSync('public/index.html', 'utf8');
if(process.env.HISTORY_FONT_CSS){
  const path=require('node:path'),file=process.env.HISTORY_FONT_CSS;
  const css=fs.readFileSync(file,'utf8').replace(/url\(([^)]+)\)/g,(_,url)=>'url(data:font/woff2;base64,'+fs.readFileSync(path.resolve(path.dirname(file),url.replace(/["']/g,''))).toString('base64')+')');
  html=html.replace('</head>','<style>'+css+' body,button,select{font-family:"Noto Sans KR",sans-serif!important}</style></head>');
}
// Run the real built app against local fixture records, without cloud sign-in.
html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (all, attrs, code) =>
  attrs.includes('src=') || code.includes('client.auth.onAuthStateChange') ? '' : all);
const scores = [0,44,60,33,0,12,66,63];
const entries = scores.map((score, i) => ({id:'layout-'+i,date:'2026-10-11T09:14:00Z',mode:i===2?'meaning':'listen',scope:'all',rangeStart:1601,rangeEnd:1650,correct:score,total:100,plannedTotal:100,attemptStatus:'in_progress',score,wrongWordsVersion:1,wrongWords:[{word:'apple',number:1601,meaning:'사과',missCount:1}]}));
(async () => {
  const browser = await browserType.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox']} : {})});
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url() === 'https://layout.test/'
      ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
    await page.addInitScript(() => {
      window.fetch = async () => ({ok:false,json:async()=>({})});
      window.testAlerts=[];window.alert = message => window.testAlerts.push(message); window.confirm = () => true;
      window.testPrints=0;window.print=()=>window.testPrints++;
    });
    await page.goto('https://layout.test/');
    await page.evaluate(()=>document.fonts.ready);
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
      // Short screens scroll the history panel; controls must remain reachable.
      await page.locator('#scoreTable tr[data-attempt-id]:visible .ym-attempt-print').first().scrollIntoViewIfNeeded();
      assert(await page.locator('#scoreTable tr[data-attempt-id]:visible .ym-attempt-print').first().isVisible());
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
    await page.locator('#ymReviewPrint').click();
    assert.equal(await page.evaluate(()=>window.testPrints),1);
    await page.locator('#ymReviewClose').click();
    const storedBefore=await page.evaluate(()=>localStorage.getItem(SCORE_KEY));
    assert(await page.locator('#ymScreenForward').isDisabled());
    await page.locator('#ymScreenBack').click();
    assert(await page.locator('#ymTab-study').getAttribute('aria-selected')==='true');
    assert(await page.locator('#ymScreenBack').isDisabled());
    assert(await page.locator('#ymScreenForward').isEnabled());
    await page.locator('#ymScreenForward').click();
    assert.equal(await page.locator('#scoreFilter').inputValue(),'meaning');
    assert.equal(await page.evaluate(()=>localStorage.getItem(SCORE_KEY)),storedBefore);
    assert(await page.locator('#ymScreenBack').isEnabled());
    await page.locator('#historyHome').click();assert(await page.locator('#ymScreenForward').isEnabled());
    await page.locator('#ymScreenForward').click();

    // More than 100 records across September/October, including old score-only rows.
    const history = Array.from({length:120}, (_,i) => ({...entries[i%8],id:'archive-'+i,
      date:new Date(Date.UTC(2026,8,1)+i*8*3600000).toISOString(),
      mode:i%2?'meaning':'listen',score:i%101,correct:i%101,
      ...(i===0?{wrongWordsVersion:undefined,wrongWords:undefined}:{} )}));
    history.push({...entries[0],id:'sunday',date:'2026-09-27T14:59:59Z'},
      {...entries[2],id:'monday',date:'2026-09-27T15:00:00Z'});
    const snapshot=JSON.stringify(history);
    await page.evaluate(snapshot=>{localStorage.setItem(SCORE_KEY,snapshot);showHistory();},snapshot);
    await page.evaluate(()=>window.YMHistoryLayout());
    const ids=[];
    for(let i=0;i<history.length;i++){
      ids.push(await page.locator('#scoreTable tr[data-attempt-id]:visible').getAttribute('data-attempt-id'));
      if(i<history.length-1)await page.getByRole('button',{name:'다음',exact:true}).click();
    }
    assert.deepEqual(ids,history.map(r=>r.id).reverse());
    await page.getByRole('button',{name:'이전',exact:true}).click();
    assert.equal(await page.locator('#scoreTable tr[data-attempt-id]:visible').getAttribute('data-attempt-id'),'archive-1');
    for(const week of ['2026-08-31','2026-09-21','2026-09-28','2026-10-05']){
      await page.selectOption('#scoreWeek',week);
      for(const mode of ['all','listen','meaning']){
        await page.selectOption('#scoreFilter',mode);
        await page.evaluate(()=>window.YMHistoryLayout());
        const expected=history.filter(r=>{
          const d=new Date(Date.parse(r.date)+9*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
          return d.toISOString().slice(0,10)===week&&(mode==='all'||mode===r.mode);
        });
        assert.deepEqual(await page.locator('#scoreTable tr[data-attempt-id]').evaluateAll(rs=>rs.map(r=>r.dataset.attemptId)),expected.map(r=>r.id).reverse());
        assert.equal(await page.locator('#scoreChart circle').count(),expected.length);
      }
    }
    await page.selectOption('#scoreFilter','all');await page.selectOption('#scoreWeek','all');
    assert.equal(await page.locator('#scoreChart circle').count(),122);
    assert(await page.locator('.ym-history-plot').evaluate(el=>el.scrollWidth>el.clientWidth));
    await page.selectOption('#scoreWeek','2026-08-31');
    await page.evaluate(()=>window.YMHistoryLayout());
    while(!await page.getByRole('button',{name:'다음',exact:true}).isDisabled()){
      await page.getByRole('button',{name:'다음',exact:true}).click();
    }
    await page.getByRole('button',{name:'1회차 오답 출력',exact:true}).click();
    assert.equal(await page.locator('#ymReviewPaper').count(),0);
    assert((await page.evaluate(()=>window.testAlerts.at(-1))).includes('점수만 저장'));
    assert.equal(await page.evaluate(()=>localStorage.getItem(SCORE_KEY)),snapshot);
    console.log('PASS 122 September/October records, back navigation, KST weeks, combined filters, graph, legacy output, unchanged storage');
    await page.evaluate(() => {localStorage.setItem(SCORE_KEY,'[]');showHistory();});
    await page.evaluate(() => window.YMHistoryLayout());
    assert((await page.locator('#scoreSummary').innerText()).includes('아직 저장된 시험이 없습니다'));
    assert.equal(await page.locator('#scoreTable tr[data-attempt-id]').count(),0);
    assert.equal(errors.length,0,errors.join('\n'));
    console.log('PASS pagination, filtering, print attempt identity, and empty history');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
