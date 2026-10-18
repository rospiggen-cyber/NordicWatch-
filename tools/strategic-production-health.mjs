/* Public production read-only health probe: tests deployed endpoints only. */
const api='https://nordicwatch-event-feed.rospiggen.workers.dev/strategic';
const page='https://rospiggen-cyber.github.io/NordicWatch-/strategic-review.html';
async function get(url){
  let error;
  for(let i=0;i<3;i++){
    try{
      const r=await fetch(url+'?check='+Date.now(),{signal:AbortSignal.timeout(14000),
        redirect:'follow',headers:{accept:'application/json,text/html;q=.9'}});
      return {r,body:await r.text()};
    }catch(e){error=e;if(i<2)await new Promise(r=>setTimeout(r,1500))}
  }
  throw error;
}
try{
  const {r,body}=await get(api);
  let data;
  try{data=JSON.parse(body)}catch{throw new Error('Worker did not return valid JSON')}
  console.log(JSON.stringify({service:'strategic-worker',http:r.status,enabled:data.enabled,
    awaitingFirstRun:data.reason==='Awaiting first scheduled collection',
    sourcesHealthy:data.sourcesHealthy??null,sourcesTotal:data.sourcesTotal??null,
    storedSignals:data.signals?.length??null,analysis:data.analysis?.length??null,
    generatedAt:data.generatedAt||null,degraded:data.degraded??null,
    coverageStatus:data.sourceCoverage?.version||'PENDING_NEXT_SCHEDULED_COLLECTION',
    connectedOrganizations:data.sourceCoverage?.technical?.connectedOrganizations??null,
    coverageHypotheses:data.sourceCoverage?.hypotheses?.length??null}));
  if(r.status!==200||data.enabled!==true)throw Error('Worker strategic endpoint not activated');
  const p=await get(page);
  console.log(JSON.stringify({service:'strategic-review-page',http:p.r.status,
    titleFound:p.body.includes('<title>Strategic Review — NordicWatch</title>'),
    size:p.body.length,coveragePanel:p.body.includes('Source Coverage Engine')}));
  if(!p.body.includes('Source Coverage Engine'))throw Error('Source Coverage panel not available on published page');
  if(!p.r.ok || !p.body.includes('<title>Strategic Review — NordicWatch</title>'))
    throw Error('Pages strategic dashboard not published');
}catch(e){console.error('Production probe failed: '+String(e.message||e));process.exitCode=1}
