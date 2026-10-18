/* Read-only live CEMS catalog smoke. Tests actual source schema, no deployment. */
const urls=[
 'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=5&offset=0',
 'https://mapping.emergency.copernicus.eu/activations/api/activations/?limit=5&offset=0'
];
let passed=0;
for(const url of urls){
 try{
  const res=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'follow'});
  const txt=await res.text();let data;
  try{data=JSON.parse(txt)}catch{data=null}
  const ok=res.ok&&Array.isArray(data?.results)&&data.results.some(r=>r.code&&r.centroid&&r.activationTime);
  console.log(JSON.stringify({endpoint:new URL(url).hostname,status:res.status,url:res.url,bodyBytes:txt.length,
   total:data?.count??null,returned:data?.results?.length??null,firstCode:data?.results?.[0]?.code??null,
   firstCentroid:data?.results?.[0]?.centroid??null,next:data?.next?true:false,valid:ok}));
  if(ok)passed++;
 }catch(error){console.log(JSON.stringify({endpoint:new URL(url).hostname,valid:false,error:String(error?.message||error)}))}
}
console.log('CEMS verified JSON endpoints: '+passed+'/'+urls.length);
if(passed===0)process.exitCode=1;


// Independent real-data regional smoke; no publication, no mutations.
const core=await import('../earth-observation-core.js');
const EO=globalThis.NordicWatchEarthObservation||core.default;
try{
 const rows=[];let advertised=null,seen=0;
 const endpoint='https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/';
 for(let offset=0;offset<600;offset+=100){
  const url=endpoint+'?limit=100&offset='+offset;
  const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('HTTP '+r.status);
  const json=await r.json();
  if(!Array.isArray(json.results))throw Error('Invalid results list');
  advertised=json.count;seen+=json.results.length;rows.push(...json.results);
  if(!json.next||json.results.length===0)break;
 }
 const snapshot=EO.catalogue(rows,{now:Date.now(),scannedPages:Math.ceil(seen/100),sourceCount:advertised});
 console.log(JSON.stringify({
  cemsScan:'regional-actual-catalogue',advertised,seen,
  localCentroids:snapshot.counts.local,swedenContext:snapshot.counts.nationalContext,
  records:snapshot.activations.slice(0,12).map(x=>({code:x.code,scope:x.areaScope,title:x.title,areas:x.matchedAreas,when:x.activationAt}))
 }));
}catch(e){console.error('Regional catalogue scan failed: '+String(e.message||e));process.exitCode=1}
