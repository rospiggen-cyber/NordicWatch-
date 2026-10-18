/* Read-only Copernicus Emergency Mapping discovery.
 * No credentials, no satellite imagery scraping and no operational alerts.
 */
import '../earth-observation-core.js';
const EO=globalThis.NordicWatchEarthObservation;
const ENDPOINTS=[
  'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/',
  'https://mapping.emergency.copernicus.eu/activations/api/activations/'
];
const TTL=6*60*60*1000, PAGE_LIMIT=100, MAX_PAGES=6, MAX_BYTES=2500000;
const acceptEndpoint=url=>{try{const u=new URL(url);return u.protocol==='https:'&&ENDPOINTS.some(e=>u.origin+u.pathname===e)}catch{return false}};
export function sourceEndpoints(){return [...ENDPOINTS]}
async function readPage(base,offset,limit=PAGE_LIMIT){
 const url=new URL(base);url.searchParams.set('limit',String(limit));url.searchParams.set('offset',String(offset));
 const response=await fetch(url.toString(),{headers:{accept:'application/json'},redirect:'follow',
  signal:AbortSignal.timeout(12000),cf:{cacheTtl:1200}});
 if(!response.ok||!acceptEndpoint(response.url))throw Error('CEMS_HTTP_OR_ORIGIN_'+response.status);
 if(Number(response.headers?.get?.('content-length')||0)>MAX_BYTES)throw Error('CEMS_TOO_LARGE');
 const body=await response.text();if(body.length>MAX_BYTES)throw Error('CEMS_TOO_LARGE');
 let parsed;try{parsed=JSON.parse(body)}catch{throw Error('CEMS_INVALID_JSON')}
 if(!parsed||!Array.isArray(parsed.results))throw Error('CEMS_INVALID_SCHEMA');
 const count=Number.isFinite(+parsed.count)?Math.max(0,Math.floor(+parsed.count)):null;
 return {items:parsed.results,count,more:Boolean(parsed.next)||count!==null&&offset+parsed.results.length<count};
}
export async function collectCopernicus(env,now=Date.now(),{force=false}={}){
 if(!env?.EVENTS)throw Error('EVENTS_KV_REQUIRED');
 const cached=await env.EVENTS.get('eo:latest','json');
 const prevAt=Date.parse(cached?.generatedAt||'');
 if(!force&&Number.isFinite(prevAt)&&now-prevAt<TTL&&now>=prevAt)
  return {cached:true,status:cached.sourceHealth?.status||'UNKNOWN',
   local:cached.counts?.local||0,regional:cached.counts?.nationalContext||0};
 let records=[],count=null,pages=0,source='',errors=[];
 for(const endpoint of ENDPOINTS){
  try{
   let result=[],localCount=null,read=0;
   for(let offset=0;read<MAX_PAGES;offset+=PAGE_LIMIT){
    const page=await readPage(endpoint,offset);
    result.push(...page.items);read++;
    localCount=page.count;
    if(!page.more||page.items.length===0)break;
   }
   records=result;count=localCount;pages=read;source=endpoint;break;
  }catch(e){errors.push(String(e.message||e).slice(0,100));}
 }
 if(!pages){
  // Keep last successful evidence but explicitly mark stale/degraded coverage.
  const degraded=cached?{...cached,
   sourceHealth:{...cached.sourceHealth,status:'UNAVAILABLE',errors},
   degraded:true,lastAttemptAt:new Date(now).toISOString()}:
   {...EO.catalogue([],{now,fetchFailures:errors}),degraded:true,lastAttemptAt:new Date(now).toISOString()};
  await env.EVENTS.put('eo:latest',JSON.stringify(degraded),{expirationTtl:30*86400});
  return {status:'UNAVAILABLE',cached:Boolean(cached),local:degraded.counts.local,errors};
 }
 const result=EO.catalogue(records,{now,scannedPages:pages,sourceCount:count,fetchFailures:[]});
 result.provider=source;
 result.degraded=result.sourceHealth.coverageIncomplete;
 result.lastAttemptAt=new Date(now).toISOString();
 await env.EVENTS.put('eo:latest',JSON.stringify(result),{expirationTtl:30*86400});
 return {status:result.sourceHealth.status,cached:false,local:result.counts.local,
  regional:result.counts.nationalContext,pages,coverageIncomplete:result.sourceHealth.coverageIncomplete};
}
export async function getCopernicusSnapshot(env){
 return env?.EVENTS?await env.EVENTS.get('eo:latest','json'):null;
}
