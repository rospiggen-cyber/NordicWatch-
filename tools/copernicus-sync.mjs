/* Publishes a small, source-linked public CEMS catalogue for the NordicWatch PWA.
 * Runs only in GitHub Actions, where official CEMS APIs permit HTTP access.
 * Never generates disasters, locations or risk estimates.
 */
import '../earth-observation-core.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const EO=globalThis.NordicWatchEarthObservation;
const ENDPOINTS=[
 'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/',
 'https://mapping.emergency.copernicus.eu/activations/api/activations/'
];
const LIMIT=100,MAX_PAGES=6,MAX_BYTES=2500000;
async function download(base){
 const rows=[];let total=null,pages=0;
 for(let offset=0;pages<MAX_PAGES;offset+=LIMIT){
  const url=base+'?limit='+LIMIT+'&offset='+offset;
  const res=await fetch(url,{headers:{accept:'application/json'},redirect:'follow',signal:AbortSignal.timeout(20000)});
  if(!res.ok || new URL(res.url).origin!==new URL(base).origin)throw Error('HTTP_ORIGIN_'+res.status);
  const text=await res.text();
  if(text.length>MAX_BYTES)throw Error('API_PAYLOAD_TOO_LARGE');
  let data;try{data=JSON.parse(text)}catch{throw Error('BAD_JSON')}
  if(!Array.isArray(data.results))throw Error('BAD_SCHEMA');
  rows.push(...data.results);pages++;
  total=Number.isFinite(+data.count)?Math.floor(+data.count):null;
  if(!data.next||!data.results.length)break;
 }
 return {rows,total,pages};
}
let result,provider,error;
for(const url of ENDPOINTS){
 try{result=await download(url);provider=url;break}catch(e){error=e;console.error('CEMS source unavailable:',new URL(url).hostname,String(e.message||e))}
}
if(!result)throw Error('All Copernicus APIs unavailable: '+String(error?.message||error));
const snapshot=EO.catalogue(result.rows,{now:Date.now(),sourceCount:result.total,scannedPages:result.pages});
snapshot.provider=provider;snapshot.mode='OFFICIAL_CEMS_GITHUB_SNAPSHOT';
snapshot.degraded=snapshot.sourceHealth.coverageIncomplete;
snapshot.sourceHealth.collectionMethod='Read-only official API fetched by GitHub Actions; six-hour cadence';
snapshot.lastAttemptAt=snapshot.generatedAt;
const path='data/copernicus-activations.json';
mkdirSync('data',{recursive:true});
writeFileSync(path,JSON.stringify(snapshot,null,2)+'\n','utf8');
console.log(JSON.stringify({publishedFile:path,provider,advertised:result.total,scanned:result.rows.length,pages:result.pages,
 localCentroids:snapshot.counts.local,swedenContext:snapshot.counts.nationalContext,
 incomplete:snapshot.sourceHealth.coverageIncomplete,generatedAt:snapshot.generatedAt}));
