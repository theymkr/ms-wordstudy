/* Overlay verified recordings after the original archive is extracted on every build. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = function applyAudioSupplement(page, root) {
  const directory = path.join(root, 'audio-supplement');
  const additions = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const mappingPattern = /const usAudioFiles=Object\.freeze\((\{[^\n]*\})\);/;
  const match = page.match(mappingPattern);
  if (!match) throw Error('Original audio mapping changed; review supplement integration');
  const mapping = JSON.parse(match[1]);
  const baselineCount = Object.keys(mapping).length;
  const questionMatch = page.match(/const quizData\s*=\s*(\[[^\n]*\]);/);
  if (!questionMatch) throw Error('Original word list changed');
  const questions = JSON.parse(questionMatch[1]);
  const target = path.join(root, 'public', 'audio-pilot');
  const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
  for (const entry of additions) {
    const question = questions.find(item => item.number === entry.number);
    if (!question || question.q.toLowerCase() !== entry.word) throw Error('Audio word identity mismatch: ' + entry.word);
    if (mapping[entry.word] || manifest.some(item => item.word === entry.word)) throw Error('Audio supplement overlaps original archive: ' + entry.word);
    if (path.basename(entry.file) !== entry.file || !entry.file.endsWith('.mp3')) throw Error('Invalid supplement filename');
    const bytes = fs.readFileSync(path.join(directory, 'files', entry.file));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Audio checksum mismatch: ' + entry.word);
    if (entry.region !== 'United States English' || entry.verification.tts !== false || !entry.verification.downloaded) throw Error('Audio verification missing: ' + entry.word);
    fs.copyFileSync(path.join(directory, 'files', entry.file), path.join(target, entry.file));
    mapping[entry.word] = entry.file;
    manifest.push(entry);
  }
  const remaining = questions.filter(item => !mapping[item.q.toLowerCase()]);
  const count = questions.length - remaining.length;
  const fmt = value => value.toLocaleString('en-US');
  page = page.replace(mappingPattern, 'const usAudioFiles=Object.freeze(' + JSON.stringify(mapping) + ');');
  page = page.replaceAll(fmt(baselineCount) + '개 확보', fmt(count) + '개 확보')
    .replaceAll('다운로드 · ' + fmt(baselineCount) + '개', '다운로드 · ' + fmt(count) + '개')
    .replaceAll((questions.length - baselineCount) + '개 미확보', remaining.length + '개 미확보')
    .replaceAll('미확보 ' + (questions.length - baselineCount) + '개 목록', '미확보 ' + remaining.length + '개 목록');

  manifest.sort((a, b) => a.number - b.number);
  fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  let catalog = fs.readFileSync(path.join(target, 'index.html'), 'utf8');
  if (!/const entries=\[.*\];let page=0;/.test(catalog)) throw Error('Audio catalog changed');
  catalog = catalog.replace(/const entries=\[.*\];let page=0;/, 'const entries=' + JSON.stringify(manifest) + ';let page=0;')
    .replace('녹음 ' + baselineCount + '개', '녹음 ' + count + '개');
  fs.writeFileSync(path.join(target, 'index.html'), catalog);

  // Keep historical source notes, and put current totals above them.
  let sources = fs.readFileSync(path.join(target, 'SOURCES-KO.md'), 'utf8');
  sources = sources.replace('확보 ' + fmt(baselineCount) + ' / ' + fmt(questions.length) + '개. 미확보 ' + (questions.length - baselineCount) + '개.', '확보 ' + fmt(count) + ' / ' + fmt(questions.length) + '개. 미확보 ' + remaining.length + '개.')
    .replace('전체 범위에 확보된 ' + fmt(baselineCount) + '개 음원을 적용했습니다.', '전체 범위에 확보된 ' + fmt(count) + '개 음원을 적용했습니다.')
    .replace('640개는 미확보이며 photographer도 포함됩니다.', remaining.length + '개는 미확보이며 photographer도 포함됩니다.');
  sources = sources.replace('| 원출처 |', '아래 표는 원본 아카이브 2,316개의 구성입니다. 추가 확보분은 아래 날짜별 기록과 최신 manifest.json을 참고하세요.\n\n| 원출처 |');
  sources += '\n## 추가 확보 (파일별 검증일은 manifest.json 참조)\n\n' + additions.length + '개 추가: ' + additions.map(item => item.word).join(', ') + '. 원본 Ogg와 SHA-256, 파일별 미국식 근거·라이선스·다운로드 및 재생 검증은 저장소 audio-supplement에 보존했습니다. 앱용 MP3로 형식만 변환했으며 원 라이선스를 유지합니다. 현재 manifest.json이 최신 확보 목록입니다. collection-progress.json에 처리 범위와 보류 사유를 기록했습니다.\n';
  fs.writeFileSync(path.join(target, 'SOURCES-KO.md'), sources);
  const csv = value => '"' + String(value).replaceAll('"', '""') + '"';
  const located = JSON.parse(fs.readFileSync(path.join(target, 'located-audio.json'), 'utf8'));
  const runs = fs.readdirSync(path.join(directory, 'runs')).filter(file => file.endsWith('.json')).sort()
    .map(file => JSON.parse(fs.readFileSync(path.join(directory, 'runs', file), 'utf8')));
  const run = runs.at(-1);
  // Preserve unresolved earlier batches; newer reviews override only the same word.
  const statuses = Object.fromEntries(runs.flatMap(history => history.processed.map(item => [item.word, item])));
  const lines = [['단어장 번호', '단어', '상태', '확인한 출처'], ...remaining.map(item => {
    const state = statuses[item.q];
    return [item.number, item.q, state ? state.status + ': ' + state.reason : '미확보 · 다음 검토 대상', (state?.candidatePages || (located[item.q] || []).map(source => source.imageinfo?.[0]?.descriptionurl).filter(Boolean)).join(' | ')];
  })];
  fs.writeFileSync(path.join(target, 'remaining-audio.csv'), '\ufeff' + lines.map(line => line.map(csv).join(',')).join('\n') + '\n');
  fs.writeFileSync(path.join(target, 'collection-progress.json'), JSON.stringify({ ...run, current: { total: questions.length, mapped: count, remaining: remaining.length, additions: additions.length } }, null, 2) + '\n');
  console.log('US recordings: ' + count + '/' + questions.length + '; remaining ' + remaining.length);
  return page;
};
