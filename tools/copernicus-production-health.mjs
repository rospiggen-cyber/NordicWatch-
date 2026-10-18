/* Read-only health of NordicWatch's public CEMS snapshot and published Earth Observation UI. */
const staticData='https://rospiggen-cyber.github.io/NordicWatch-/data/copernicus-activations.json';
const page='https://rospiggen-cyber.github.io/NordicWatch-/earth-observation.html';
async function get(url){
 const res=await fetch(url+'?health='+Date.now(),{
  headers:{accept:'application/json,text/html;q=.9'},signal:AbortSignal.timeout(18000),redirect:'follow'
 });
 return {res,body:await res.text()};
}
try{
 const snap=await get(staticData);
 if(!snap.res.ok)throw Error('Missing GitHub Pages catalogue HTTP '+snap.res.status);
 let data;try{data=JSON.parse(snap.body)}catch{throw Error('Invalid static JSON')}
 const last=new Date(data.generatedAt||'').getTime();
 console.log(JSON.stringify({target:'copernicus-github-snapshot',http:snap.res.status,
  mode:data.mode,sourceHealth:data.sourceHealth?.status,
  original:data.provider,scannedPages:data.sourceHealth?.pagesScanned,
  advertised:data.sourceHealth?.totalAdvertised,counts:data.counts,
  generatedAt:data.generatedAt,stale:!Number.isFinite(last)||Date.now()-last>12*3600000}));
 if(data.mode!=='OFFICIAL_CEMS_GITHUB_SNAPSHOT'||data.sourceHealth?.status!=='AVAILABLE'||
   !Array.isArray(data.activations)||!Number.isFinite(last)||Date.now()-last>12*3600000)
  throw Error('Official Copernicus snapshot missing, unavailable or stale');
 const ui=await get(page);
 const hasTitle=ui.body.includes('<title>NordicWatch · Earth Observation</title>');
 const hasStatic=ui.body.includes('./data/copernicus-activations.json');
 console.log(JSON.stringify({target:'earth-observation-ui',http:ui.res.status,title:hasTitle,usesVerifiedSnapshot:hasStatic}));
 if(!ui.res.ok||!hasTitle||!hasStatic)throw Error('Earth Observation UI not using verified static snapshot');
}catch(e){console.error('PRODUCTION_EO_HEALTH_FAILED '+String(e.message||e));process.exitCode=1}
