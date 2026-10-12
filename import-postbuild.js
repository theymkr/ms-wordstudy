const fs=require('fs');
const file='public/index.html';
const html=fs.readFileSync(file,'utf8');
const pattern=/<script id="ym-document-study-import">[\s\S]*?<\/script>/;
if(!pattern.test(html))throw Error('Document import module not found');
const moduleText=fs.readFileSync('import-study.js','utf8');
fs.writeFileSync(file,html.replace(pattern,()=>'<script id="ym-document-study-import">\n'+moduleText+'\n</script>'));
