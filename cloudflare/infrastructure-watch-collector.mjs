/* Scheduled, source-linked civilian infrastructure monitoring.
   No active scanning, intrusion claims or actor attribution. */
import "../infrastructure-watch.js";
const Watch=globalThis.NordicWatchInfrastructureWatch;
const SNAPSHOT_KEY="infrastructure:watch:snapshot:v1";
const MAX_RESPONSE_BYTES=600000;
const MAX_OBSERVATIONS=150;
const SOURCE={id:"gdelt-doc2",name:"GDELT DOC 2.0",url:"https://www.gdeltproject.org/"};
const iso=ms=>new Date(ms).toISOString();
const safeText=(v,max)=>String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const sourceHealth=(status,reason=null,checkedAt=null)=>({source:SOURCE, status,reason,checkedAt});
function sanitized(row){
  if(!row||typeof row!=="object")return null;
  let url;
  try{url=new URL(String(row.url||row.sourceUrl||""));if(url.protocol!=="https:")return null}catch{return null}
  return {title:safeText(row.title,300),url:url.href,description:safeText(row.description||row.summary,450),publishedAt:safeText(row.publishedAt||row.seendate||row.date,42),sourcecountry:safeText(row.sourcecountry||row.country,60)};
}
function retain(prior,incoming,now){
  const byId=new Map();
  for(const raw of [...(Array.isArray(prior)?prior:[]),...(Array.isArray(incoming)?incoming:[])]){
    const record=sanitized(raw);
    if(!record)continue;
    const checked=Watch.classify(record,now);
    if(!checked)continue;
    const old=byId.get(checked.id);
    if(!old||Watch.parseDate(old.publishedAt)<Watch.parseDate(record.publishedAt))byId.set(checked.id,record);
  }
  return [...byId.values()].sort((a,b)=>Watch.parseDate(b.publishedAt)-Watch.parseDate(a.publishedAt)).slice(0,MAX_OBSERVATIONS);
}
async function sourceFetch(fetcher,url){
  const response=await fetcher(url,{headers:{accept:"application/json","user-agent":"NordicWatch-CivilInfrastructure/1.0"},redirect:"follow",signal:AbortSignal.timeout(12000),cf:{cacheTtl:0}});
  if(!response?.ok)throw new Error("GDELT_HTTP_"+String(response?.status||"unknown"));
  if(response.url){const final=new URL(response.url);if(final.protocol!=="https:"||final.hostname!=="api.gdeltproject.org")throw new Error("GDELT_BAD_REDIRECT")}
  const size=Number(response.headers?.get?.("content-length")||0);
  if(size>MAX_RESPONSE_BYTES)throw new Error("GDELT_TOO_LARGE");
  const body=await response.text();
  if(body.length>MAX_RESPONSE_BYTES)throw new Error("GDELT_TOO_LARGE");
  let decoded;
  try{decoded=JSON.parse(body)}catch{throw new Error("GDELT_NOT_JSON")}
  if(!Array.isArray(decoded?.articles))throw new Error("GDELT_BAD_SCHEMA");
  return decoded.articles;
}
async function collectInfrastructureWatch(env,{now=Date.now(),fetcher=fetch}={}){
  if(!env.EVENTS)throw new Error("EVENTS binding required");
  const enabled=env.INFRA_WATCH_ENABLED==="true",attemptedAt=iso(now),old=await env.EVENTS.get(SNAPSHOT_KEY,"json");
  if(!enabled)return {enabled:false,coverage:sourceHealth("DISABLED"),observations:[]};
  let snapshot;
  try{
    const rows=await sourceFetch(fetcher,Watch.endpoint());
    const observations=retain(old?.observations,rows,now);
    const computed=Watch.assess(observations,now);
    snapshot={schemaVersion:"1.0",enabled:true,lastAttemptAt:attemptedAt,lastSuccessfulAt:attemptedAt,
      observations,coverage:sourceHealth("HEALTHY",null,attemptedAt),
      diagnostics:{sourceRecords:rows.length,retained:observations.length,incidents:computed.incidents.length,watches:computed.watches.length}};
  }catch(error){
    // Keep the last successful observations, but never refresh the evidence timestamp.
    snapshot={schemaVersion:"1.0",enabled:true,lastAttemptAt:attemptedAt,lastSuccessfulAt:old?.lastSuccessfulAt||null,
      observations:retain(old?.observations,[],now),
      coverage:sourceHealth("DEGRADED",safeText(error?.message||"upstream unavailable",100),attemptedAt),
      diagnostics:old?.diagnostics||null};
  }
  await env.EVENTS.put(SNAPSHOT_KEY,JSON.stringify(snapshot),{expirationTtl:7*86400});
  return {...snapshot,observations:undefined};
}
async function readInfrastructureWatch(env,now=Date.now()){
  const enabled=env.INFRA_WATCH_ENABLED==="true";
  if(!enabled)return {schemaVersion:"1.0",enabled:false,degraded:true,reason:"Infrastructure watch disabled",watch:Watch.assess([],now),sourceHealth:sourceHealth("DISABLED")};
  const snapshot=await env.EVENTS?.get(SNAPSHOT_KEY,"json");
  const watch=Watch.assess(snapshot?.observations||[],now),lastSuccessfulAt=snapshot?.lastSuccessfulAt||null;
  const age=lastSuccessfulAt?now-Date.parse(lastSuccessfulAt):Infinity;
  const status=!snapshot?"NOT_YET_CHECKED":age>45*60000?"STALE":snapshot.coverage?.status||"UNKNOWN";
  return {schemaVersion:"1.0",enabled:true,generatedAt:iso(now),lastAttemptAt:snapshot?.lastAttemptAt||null,
    lastSuccessfulAt,sourceHealth:{...(snapshot?.coverage||sourceHealth("NOT_YET_CHECKED")),status},
    degraded:status!=="HEALTHY",watch,diagnostics:snapshot?.diagnostics||null,
    note:"GDELT indexing time is not the incident occurrence time. Co-reports do not prove a shared attacker."};
}
export {SNAPSHOT_KEY,SOURCE,sanitized,retain,collectInfrastructureWatch,readInfrastructureWatch};
