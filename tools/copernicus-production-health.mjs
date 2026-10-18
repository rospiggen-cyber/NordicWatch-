/* Read-only production smoke: never triggers collection or changes KV. */
const endpoint='https://nordicwatch-event-feed.rospiggen.workers.dev/earth-observation';
const page='https://rospiggen-cyber.github.io/NordicWatch-/earth-observation.html';
async function get(url){
 const res=await fetch(url+'?smoke='+Date.now(),{headers:{accept:'application/json,text/html;q=.9'},signal:AbortSignal.timeout(15000),redirect:'follow'});
 return {res,body:await res.text()};
}
try{
 const api=await get(endpoint);
 let data;try{data=JSON.parse(api.body)}catch{throw Error('Worker JSON schema invalid')}
 console.log(JSON.stringify({target:'earth-observation-api',status:api.res.status,enabled:data.enabled,
  sourceHealth:data.sourceHealth?.status||'PENDING',count:data.counts||null,
  scannedPages:data.sourceHealth?.pagesScanned??null,advertised:data.sourceHealth?.totalAdvertised??null,
  sourceErrors:data.sourceHealth?.errors??[],
  lastScan:data.sourceHealth?.lastSuccessfulScan||null,records:data.activations?.length??null,
  degraded:data.degraded??null}));
 if(api.res.status!==200||data.enabled!==true||!Array.isArray(data.activations))throw Error('Earth Observation API unavailable');
 if(!['AVAILABLE','PARTIAL'].includes(data.sourceHealth?.status))throw Error('Copernicus collection not healthy; check upstream from Worker');
 const ui=await get(page);
 const hasTitle=ui.body.includes('<title>NordicWatch · Earth Observation</title>');
 const hasCaveat=ui.body.includes('kartläggningsuppdrag, inte kontinuerlig satellitövervakning');
 console.log(JSON.stringify({target:'earth-observation-UI',status:ui.res.status,titleFound:hasTitle,sourceCaveat:hasCaveat}));
 if(!ui.res.ok||!hasTitle||!hasCaveat)throw Error('Earth Observation page not published');
}catch(e){console.error('PRODUCTION_EO_HEALTH_FAILED '+String(e.message||e));process.exitCode=1}
