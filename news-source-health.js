(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NordicWatchNewsSources=api;
})(globalThis,function(){
  'use strict';
  // GDELT's free DOC API is rate limited. Never fire independent searches simultaneously.
  // Separate calls by an explicit post-completion gap, including after rejected requests.
  const GAP_MS=6000;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function sequence(tasks,{gapMs=GAP_MS,sleep=pause}={}){
    if(!Array.isArray(tasks)||tasks.some(task=>typeof task!=='function'))throw new TypeError('Expected request functions');
    const results=[];
    for(let i=0;i<tasks.length;i++){
      if(i)await sleep(gapMs);
      try{results.push({status:'fulfilled',value:await tasks[i]()})}
      catch(error){results.push({status:'rejected',reason:error})}
    }
    return results;
  }
  function summarize(results){
    return results.map((result,i)=>{
      const names=['GDELT · Nordic/Baltic','GDELT · Black Sea','Cloudflare event feed'];
      const ok=result?.status==='fulfilled'&&Array.isArray(result.value?.articles);
      const value=result?.value||{};
      const fetched=ok?value.articles.length:0;
      const reason=ok?'':String(result?.reason?.message||result?.reason||'Invalid source response').slice(0,160);
      return {name:names[i]||'Source '+(i+1),ok,fetched,reason,available:ok&&Number.isFinite(+value.available)?Number(value.available):ok?1:0,total:ok&&Number.isFinite(+value.total)?Math.max(1,Number(value.total)):1,sourceFailures:ok&&Array.isArray(value.telemetry?.failures)?value.telemetry.failures:[],coverageStatus:ok?value.coverage?.status||null:null};
    });
  }
  return {sequence,summarize,GAP_MS};
});
