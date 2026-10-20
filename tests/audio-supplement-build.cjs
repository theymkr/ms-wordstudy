/* Offline regression coverage for mixed audio-review run schemas. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const applyAudioSupplement = require('../scripts/audio-supplement-build.cjs');

const earlier = {
  date: '2026-10-19',
  processed: [
    {word: 'pear', status: 'pending', reason: 'review needed', candidatePages: ['https://example.test/pear']},
    {word: 'plum', status: 'held', reason: 'source needed', candidatePages: []}
  ]
};

function build(runs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-supplement-build-'));
  const write = (name, contents) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, typeof contents === 'string' ? contents : JSON.stringify(contents));
  };
  try {
    write('audio-supplement/manifest.json', []);
    runs.forEach((run, index) => write('audio-supplement/runs/' + index + '.json', run));
    write('public/audio-pilot/manifest.json', [{number: 1, word: 'apple', file: 'apple.mp3'}]);
    write('public/audio-pilot/index.html', '<script>const entries=[];let page=0;</script>');
    write('public/audio-pilot/SOURCES-KO.md', 'Source history');
    write('public/audio-pilot/located-audio.json', {});
    const input = 'const usAudioFiles=Object.freeze({"apple":"apple.mp3"});\n' +
      'const quizData=[{"number":1,"q":"apple"},{"number":2,"q":"pear"},{"number":3,"q":"plum"}];';
    const output = applyAudioSupplement(input, root);
    return {
      input, output,
      csv: fs.readFileSync(path.join(root, 'public/audio-pilot/remaining-audio.csv'), 'utf8'),
      progress: JSON.parse(fs.readFileSync(path.join(root, 'public/audio-pilot/collection-progress.json'), 'utf8'))
    };
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
}

test('metadata-only latest run preserves earlier decisions and audio counts', () => {
  const latest = {date: '2026-10-20', batch: {candidates: [{word: 'pear'}]}, outcome: {addedAcquired: 0}};
  const result = build([earlier, latest]);
  assert.equal(result.output, result.input);
  assert.match(result.csv, /"pear","pending: review needed","https:\/\/example.test\/pear"/);
  assert.match(result.csv, /"plum","held: source needed",""/);
  assert.equal(result.progress.date, latest.date);
  assert.deepEqual(result.progress.batch, latest.batch);
  assert.deepEqual(result.progress.current, {total: 3, mapped: 1, remaining: 2, additions: 0});
});

test('empty and null processed lists do not erase earlier decisions', () => {
  for (const processed of [[], null]) {
    const result = build([earlier, {processed}]);
    assert.match(result.csv, /pending: review needed/);
    assert.match(result.csv, /held: source needed/);
  }
});

test('new decisions override only the matching word across metadata-only runs', () => {
  const result = build([earlier, {batch: {}}, {processed: [
    {word: 'pear', status: 'deferred', reason: 'download unavailable', candidatePages: []}
  ]}]);
  assert.match(result.csv, /"pear","deferred: download unavailable",""/);
  assert.doesNotMatch(result.csv, /pending: review needed/);
  assert.match(result.csv, /"plum","held: source needed",""/);
});

test('a malformed non-array processed value still fails instead of hiding corrupt data', () => {
  assert.throws(() => build([earlier, {processed: {}}]), TypeError);
});
