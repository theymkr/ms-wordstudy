'use strict';
module.exports = function applyHistory(page) {
  function replace(from, to) {
    if (!page.includes(from)) throw Error('History source changed: ' + from.slice(0, 60));
    page = page.replace(from, to);
  }
  replace('function renderHistory(root){', `
// Calendar weeks always use Korea time, regardless of the device timezone.
function historyWeek(date){
 const d=new Date(new Date(date).getTime()+9*60*60*1000);
 d.setUTCHours(0,0,0,0);
 d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
function historyWeekLabel(key){
 const end=new Date(key+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);
 return key+' ~ '+end.toISOString().slice(0,10);
}
function renderHistory(root){`);
  replace('</select></label><p class="hint" id="scoreSummary">', '</select></label><label>주별 조회 <select id="scoreWeek"><option value="all">전체 기간</option></select></label><p class="hint" id="scoreSummary">');
  replace("const filter=root.querySelector('#scoreFilter');filter.onchange=draw;draw();", `const filter=root.querySelector('#scoreFilter'),week=root.querySelector('#scoreWeek');
 [...new Set(readScores().map(r=>historyWeek(r.date)))].sort().reverse().forEach(key=>{
  const option=document.createElement('option');option.value=key;option.textContent=historyWeekLabel(key);week.append(option);
 });
 filter.onchange=week.onchange=draw;draw();`);
  replace("rows=all.filter(r=>filter.value==='all'||r.mode===filter.value)", "rows=all.filter(r=>(filter.value==='all'||r.mode===filter.value)&&(week.value==='all'||historyWeek(r.date)===week.value))");
  replace(":'아직 저장된 시험이 없습니다. 10문제 이상 풀면 자동 저장됩니다.'", ":all.length?'선택한 주와 시험 방식에 해당하는 기록이 없습니다.':'아직 저장된 시험이 없습니다. 10문제 이상 풀면 자동 저장됩니다.'");
  replace("const ns='http://www.w3.org/2000/svg',width=", "const plot=document.createElement('div');plot.className='ym-history-plot';plot.tabIndex=0;plot.setAttribute('role','region');plot.setAttribute('aria-label','점수 그래프 · 좌우로 스크롤');chart.append(plot);\n const ns='http://www.w3.org/2000/svg',width=");
  replace('chart.append(svg);', 'plot.append(svg);');
  // Keep SVG text at its native 12px size inside the 180px-high scroll viewport.
  replace('height=270,left=42,bottom=220', 'height=180,left=42,bottom=140');
  replace('y=score=>bottom-score*1.85', 'y=score=>bottom-score*1.05');
  replace('y:244,fill:', 'y:164,fill:');
  return page;
};
