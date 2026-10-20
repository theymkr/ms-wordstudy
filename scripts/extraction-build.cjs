const fs=require('fs'),path=require('path');
module.exports=function(page,root){
 const old=/<script id="ym-document-study-import">[\s\S]*?<\/script>/;
 if(!old.test(page))throw Error('Import source changed');
 const dictionary=fs.readFileSync(path.join(root,'scripts/dictionary-check.js'),'utf8');
 const core=fs.readFileSync(path.join(root,'scripts/extraction-core.js'),'utf8'),ui=fs.readFileSync(path.join(root,'scripts/document-import.js'),'utf8'),merge=fs.readFileSync(path.join(root,'scripts/study-merge.js'),'utf8');
 page=page.replace(old,'<script id="ym-dictionary-check">\n'+dictionary+'\n</script>\n<script id="ym-extraction-core">\n'+core+'\n</script>\n<script id="ym-document-study-import">\n'+ui+'\n</script>\n<script id="ym-book-merge">\n'+merge+'\n</script>');
 const memory="memoryHistory=JSON.parse(localStorage.getItem(prefix())||'[]');";
 if(!page.includes(memory))throw Error('Sync memory source changed');
 page=page.replace(memory,"if(!scoreMemoryDirty)memoryHistory=JSON.parse(localStorage.getItem(SCORE_KEY)||'[]');");
 return page.replace('</head>','<style id="ym-import-layout">\n'+fs.readFileSync(path.join(root,'scripts/document-import.css'),'utf8')+'\n</style>\n</head>');
};
