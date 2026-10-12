(function(){
 const previous=ymMergeStudyData;
 const stamp=x=>Number(x?.updatedAt)||Date.parse(x?.updatedAt||x?.date)||0;
 const mergeRows=(a,b)=>{const rows=new Map();for(const x of [...a,...b]){const k=x.id||JSON.stringify(x),old=rows.get(k);if(!old||stamp(x)>stamp(old)||stamp(x)===stamp(old)&&!!x.deletedAt&&!old.deletedAt)rows.set(k,x);}return [...rows.values()];};
 ymMergeStudyData=function(local,remote){const result=previous(local,remote);for(const suffix of new Set([...Object.keys(local),...Object.keys(remote)])){
  if(suffix!=='-import-sets-v1'&&!/^-set-[^-].*$/.test(suffix))continue;
  if(suffix.endsWith('-wrong-words')||suffix.endsWith('-cumulative-misses-v1'))continue;
  try{const a=JSON.parse(local[suffix]||'[]'),b=JSON.parse(remote[suffix]||'[]');if(Array.isArray(a)&&Array.isArray(b))result[suffix]=JSON.stringify(suffix==='-import-sets-v1'?mergeRows(a,b):mergeRows(a,b).sort((x,y)=>Date.parse(x.date)-Date.parse(y.date)));}catch(e){}
 }return result;};
})();
