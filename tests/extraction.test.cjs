const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const core=require('../scripts/extraction-core.js');
test('ordinary imports, CSV quotes, POS, and synonyms parse',()=>{
 for(const source of ['apple | 사과 | n','apple\t사과\tn','apple n. 사과','"apple","사과","n"'])assert.deepEqual(core.parse(source),[{word:'apple',meaning:'사과',pos:'n',synonyms:''}]);
 assert.deepEqual(core.parse('obsolete** | unused, out of use | a. 구식의'),[{word:'obsolete',meaning:'구식의',pos:'a',synonyms:'unused, out of use'}]);
});
test('canonical records round-trip missing POS and comma-rich synonyms',()=>{const rows=[{word:'test',meaning:'시험',pos:'',synonyms:'exam, trial'},{word:'clout',meaning:'n. 권력, 영향력 / v. 때리다',pos:'',synonyms:'influence, pull, power / strike'}];assert.deepEqual(core.parse(core.serialize(rows)),rows);});
test('headword decorations and multiple senses are retained safely',()=>{assert.equal(core.cleanWord('12. well-known**'),'well-known');assert.deepEqual(core.meaningInfo('n. 청원, 탄원\nv. ~에 청원하다'),{meaning:'n. 청원, 탄원 / v. ~에 청원하다',pos:''});});
test('headers, examples, phonetic brackets do not create rows',()=>{assert.deepEqual(core.parse('word | meaning\nThe page was completely destroyed.\n[əˈpæl]\nThis is an example.'),[]);});
function fakePage(scale=1,pad=0){const width=800*scale+pad*2,height=700*scale+pad*2,data=new Uint8ClampedArray(width*height*4);data.fill(255);function box(x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const p=(j*width+i)*4;data[p]=60;data[p+1]=210;data[p+2]=50;}}for(let i=0;i<5;i++){box(pad+60*scale,pad+(180+i*90)*scale,120*scale,40*scale);box(pad+590*scale,pad+(180+i*90)*scale,150*scale,40*scale);}return {width,height,data};}
test('region detector scales and tolerates margins without black marks',()=>{for(const [scale,pad]of [[1,0],[2,0],[1,40]])assert.equal(core.detectRegions(fakePage(scale,pad)).length,5);});
test('no unsupported layout associations on a blank/grayscale page',()=>{const page=fakePage();page.data.fill(255);assert.deepEqual(core.detectRegions(page),[]);});
test('scripts parse and built result has only intended importer replacement',()=>{const html=fs.readFileSync('public/index.html','utf8');for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script[1].trim())new vm.Script(script[1]);for(const id of ['ym-extraction-core','ym-document-study-import','ym-book-merge'])assert.equal(html.split('id="'+id+'"').length-1,1);assert.match(html,/if\(!scoreMemoryDirty\)memoryHistory=JSON.parse\(localStorage.getItem\(SCORE_KEY\)/);});
function merger(){const ctx={ymMergeStudyData:(a,b)=>({...b,...a})};vm.createContext(ctx);vm.runInContext(fs.readFileSync('scripts/study-merge.js','utf8'),ctx);return ctx.ymMergeStudyData;}
test('sync keeps deleted books hidden against stale remote and restores newer decisions',()=>{const merge=merger(),key='-import-sets-v1',old={id:'book',updatedAt:1,words:[]},gone={...old,updatedAt:2,deletedAt:2};for(const [a,b]of [[old,gone],[gone,old]])assert.equal(JSON.parse(merge({[key]:JSON.stringify([a])},{[key]:JSON.stringify([b])})[key])[0].deletedAt,2);const restore={...old,updatedAt:3,deletedAt:null};assert.equal(JSON.parse(merge({[key]:JSON.stringify([restore])},{[key]:JSON.stringify([gone])})[key])[0].deletedAt,null);});
test('sync merges concurrent imported-book scores by attempt IDs',()=>{const merge=merger(),key='-set-abc-123';const r=JSON.parse(merge({[key]:JSON.stringify([{id:'a',date:'2026-01-01'},{id:'b',date:'2026-01-02'}])},{[key]:JSON.stringify([{id:'a',date:'2026-01-01'},{id:'c',date:'2026-01-03'}])})[key]);assert.equal(r.length,3);});
test('generic delimiter formats preserve meaning fragments',()=>{for(const s of ['apple;n;사과','apple;사과;n','apple,n,사과'])assert.equal(core.parse(s)[0].meaning,'사과');assert.deepEqual(core.parse('apple,사과,과일,n'),[{word:'apple',meaning:'사과, 과일',pos:'n',synonyms:''}]);});
test('uncertain structured records remain editable rather than disappearing',()=>{const rows=[{word:'uncertain?',meaning:'',pos:'',synonyms:'trial'},{word:'',meaning:'불확실',pos:'',synonyms:''}];assert.equal(core.parse(core.serialize(rows)).length,2);});
test('new file imports keep English and Korean while stripping symbols and other scripts',()=>{
 const source='① ★apple*** | 사과🍎, 과일! 123 | n.\n12. clout | influence, pull, power ★ | n. 권력, 영향력 / v. 때리다\n日本語 | 中文';
 assert.deepEqual(core.parseImport(source),[
  {word:'apple',meaning:'사과 과일',pos:'n',synonyms:''},
  {word:'clout',meaning:'n 권력 영향력 v 때리다',pos:'',synonyms:'influence pull power'}
 ]);
 for(const row of core.parseImport(source))for(const value of Object.values(row))assert.match(value,/^[A-Za-z\u1100-\u11ff\u3131-\u318e\uac00-\ud7a3 ]*$/);
});
test('file filtering preserves columns and incomplete rows, and does not change legacy parsing',()=>{
 const rows=[{word:'uncertain?',meaning:'',pos:'',synonyms:'trial★'},{word:'',meaning:'불확실!',pos:'',synonyms:''}];
 const result=core.parse(core.prepareImport(core.serialize(rows)));
 assert.deepEqual(result,[{word:'uncertain',meaning:'',pos:'',synonyms:'trial'},{word:'',meaning:'불확실',pos:'',synonyms:''}]);
 assert.equal(core.parseImport('"apple","사과, 과일!","n"')[0].meaning,'사과 과일');
 assert.equal(core.parseImport('apple;사과★;n')[0].pos,'n');
 assert.equal(core.parseImport('well-known | 잘 알려진!')[0].word,'wellknown');
 assert.equal(core.parse('well-known | 잘 알려진!')[0].word,'well-known');
 assert.equal(core.prepareImport('★ 日本語 中文 @#$ 123'),'');
 assert.equal(core.parseImport('apple [ˈæpəl] 사과')[0].word,'apple');
 assert.equal(core.parseImport('apple™ | 사과®')[0].word,'apple');
 assert.equal(core.parseImport('B12 | 비타민 12')[0].word,'B');
});
test('OCR whitelist uses only English and Korean plus temporary parsing delimiters',()=>{
 const en=core.ocrParameters('eng','7'),ko=core.ocrParameters('eng+kor','6');
 assert(en.tessedit_char_whitelist.includes('Z'));assert(!en.tessedit_char_whitelist.includes('한'));
 for(const character of '가한글힣ㄱ')assert(ko.tessedit_char_whitelist.includes(character));
 for(const character of '★♡€¥₩中文日本あ')assert(!ko.tessedit_char_whitelist.includes(character));
 assert.equal(ko.tessedit_pageseg_mode,'6');assert.throws(()=>core.ocrParameters('chi_sim','6'));
});
