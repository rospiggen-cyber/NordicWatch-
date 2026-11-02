/* Scheduled passive civilian infrastructure monitoring.
   Source reports are not forensic evidence or actor attribution. */
import "../infrastructure-watch.js";
const Watch=globalThis.NordicWatchInfrastructureWatch;
const SNAPSHOT_KEY="infrastructure:watch:snapshot:v1";
const MAX_RESPONSE_BYTES=600000;
const MAX_OBSERVATIONS=150;
const SOURCE={id:"gdelt-doc2",name:"GDELT DOC 2.0",url:"https://www.gdeltproject.org/"};
const FEEDS=Object.freeze([
  {id:"svt",name:"SVT Nyheter",url:"https://www.svt.se/nyheter/rss.xml",articleHosts:["svt.se"]},
  {id:"sr-ekot",name:"Sveriges Radio Ekot",url:"https://api.sr.se/api/rss/program/83",articleHosts:["sverigesradio.se","sr.se"]},
  {id:"rtbf",name:"RTBF Belgique",url:"https://rss.rtbf.be/article/rss/highlight_rtbf_info-belgique.xml",articleHosts:["rtbf.be"]},
  {id:"france24",name:"France 24",url:"https://www.france24.com/fr/rss",articleHosts:["france24.com"]}
]);
const iso=ms=>new Date(ms).toISOString();
const safeText=(v,max)=>String(v||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const sourceHealth=(status,reason=null,checkedAt=null)=>({source:SOURCE,status,reason,checkedAt});
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
const entity=(text)=>String(text||"").replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp|#039);/gi,(_,code)=>{
  const basic={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ", "#039":"'"};
  if(basic[code.toLowerCase()]!==undefined)return basic[code.toLowerCase()];
  if(code[0]==="#"){const n=code[1]?.toLowerCase()==="x"?parseInt(code.slice(2),16):parseInt(code.slice(1),10);return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):" "}
  return " ";
});
const xmlText=raw=>safeText(entity(String(raw||"").replace(/^<!\[CDATA\[|\]\]>$/g,"")).replace(/<[^>]+>/g," "),1000);
function tag(block,name){
  const pattern=new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i");
  return xmlText(block.match(pattern)?.[1]);
}
function parseSyndication(xml,feed){
  if(typeof xml!=="string"||xml.length>MAX_RESPONSE_BYTES)throw Error("FEED_TOO_LARGE");
  const blocks=xml.match(/<(item|entry)\b[^>]*>[\s\S]*?<\/\1>/gi)||[];
  if(!/<rss\b|<feed\b/i.test(xml))throw Error("FEED_BAD_SCHEMA");
  return blocks.slice(0,80).map(block=>{
    const raw=tag(block,"link")||block.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)?.[1];
    let url;
    try{url=new URL(entity(raw),feed.url);if(url.protocol!=="https:"||!feed.articleHosts.some(h=>url.hostname===h||url.hostname.endsWith("."+h)))return null}catch{return null}
    const title=tag(block,"title"),description=tag(block,"description")||tag(block,"summary");
    const publishedAt=tag(block,"pubDate")||tag(block,"published")||tag(block,"updated")||tag(block,"dc:date");
    if(!title||!Number.isFinite(Watch.parseDate(publishedAt)))return null;
    return {title,url:url.href,description,publishedAt};
  }).filter(Boolean);
}
async function fetchBounded(fetcher,url,expectedHost){
  const response=await fetcher(url,{headers:{accept:"application/rss+xml,application/atom+xml,application/json,application/xml,text/xml","user-agent":"NordicWatch-CivilInfrastructure/1.1"},redirect:"follow",signal:AbortSignal.timeout(12000),cf:{cacheTtl:0}});
  if(!response?.ok)throw Error("HTTP_"+String(response?.status||"unknown"));
  if(response.url){const final=new URL(response.url);if(final.protocol!=="https:"||final.hostname!==expectedHost)throw Error("UNEXPECTED_REDIRECT")}
  const size=Number(response.headers?.get?.("content-length")||0);
  if(size>MAX_RESPONSE_BYTES)throw Error("SOURCE_TOO_LARGE");
  const body=await response.text();
  if(body.length>MAX_RESPONSE_BYTES)throw Error("SOURCE_TOO_LARGE");
  return body;
}
async function fetchGdelt(fetcher){
  const body=await fetchBounded(fetcher,Watch.endpoint(),"api.gdeltproject.org");
  let data;
  try{data=JSON.parse(body)}catch{throw Error("GDELT_NOT_JSON")}
  if(!Array.isArray(data?.articles))throw Error("GDELT_BAD_SCHEMA");
  return data.articles;
}
async function fetchFeed(fetcher,feed){
  return parseSyndication(await fetchBounded(fetcher,feed.url,new URL(feed.url).hostname),feed);
}
async function collectInfrastructureWatch(env,{now=Date.now(),fetcher=fetch,feeds=FEEDS}={}){
  if(!env.EVENTS)throw Error("EVENTS binding required");
  const enabled=env.INFRA_WATCH_ENABLED==="true",attemptedAt=iso(now),old=await env.EVENTS.get(SNAPSHOT_KEY,"json");
  if(!enabled)return {enabled:false,coverage:sourceHealth("DISABLED"),observations:[]};
  const sources=[],tasks=[];
  const backoff=old?.gdeltBackoffUntil&&Date.parse(old.gdeltBackoffUntil)>now;
  if(backoff)sources.push({source:SOURCE,status:"BACKOFF",reason:"GDELT rate limit; retry after "+old.gdeltBackoffUntil});
  else tasks.push({source:SOURCE,run:()=>fetchGdelt(fetcher),gdelt:true});
  for(const feed of feeds)tasks.push({source:{id:feed.id,name:feed.name,url:feed.url},run:()=>fetchFeed(fetcher,feed),gdelt:false});
  const results=await Promise.allSettled(tasks.map(task=>task.run()));
  let accepted=[],successful=0,gdeltBackoffUntil=backoff?old.gdeltBackoffUntil:null;
  for(let i=0;i<tasks.length;i++){
    const task=tasks[i],result=results[i];
    if(result.status==="fulfilled"){
      successful++;
      accepted.push(...result.value);
      sources.push({source:task.source,status:"HEALTHY",checkedAt:attemptedAt,records:result.value.length});
      if(task.gdelt)gdeltBackoffUntil=null;
    }else{
      const reason=safeText(result.reason?.message||result.reason||"SOURCE_UNAVAILABLE",100);
      sources.push({source:task.source,status:"DEGRADED",reason,checkedAt:attemptedAt});
      if(task.gdelt&&reason.includes("HTTP_429"))gdeltBackoffUntil=iso(now+2*3600000);
    }
  }
  const observations=retain(old?.observations,accepted,now),computed=Watch.assess(observations,now);
  const status=successful===tasks.length&&!backoff?"HEALTHY":successful>0?"PARTIAL":"DEGRADED";
  const coverage={...sourceHealth(status,status==="HEALTHY"?null:"One or more sources unavailable or throttled",attemptedAt),sources};
  const snapshot={schemaVersion:"1.1",enabled:true,lastAttemptAt:attemptedAt,
    lastSuccessfulAt:successful?attemptedAt:old?.lastSuccessfulAt||null,
    observations,gdeltBackoffUntil,coverage,
    diagnostics:{sourcesSuccessful:successful,sourcesAttempted:tasks.length,sourceRecords:accepted.length,retained:observations.length,incidents:computed.incidents.length,watches:computed.watches.length}};
  await env.EVENTS.put(SNAPSHOT_KEY,JSON.stringify(snapshot),{expirationTtl:7*86400});
  return {...snapshot,observations:undefined};
}
async function readInfrastructureWatch(env,now=Date.now()){
  const enabled=env.INFRA_WATCH_ENABLED==="true";
  if(!enabled)return {schemaVersion:"1.1",enabled:false,degraded:true,reason:"Infrastructure watch disabled",watch:Watch.assess([],now),sourceHealth:sourceHealth("DISABLED")};
  const snapshot=await env.EVENTS?.get(SNAPSHOT_KEY,"json");
  const watch=Watch.assess(snapshot?.observations||[],now),lastSuccessfulAt=snapshot?.lastSuccessfulAt||null;
  const age=lastSuccessfulAt?now-Date.parse(lastSuccessfulAt):Infinity;
  const status=!snapshot?"NOT_YET_CHECKED":!lastSuccessfulAt?(snapshot.coverage?.status||"NOT_YET_CHECKED"):age>45*60000?"STALE":snapshot.coverage?.status||"UNKNOWN";
  return {schemaVersion:"1.1",enabled:true,generatedAt:iso(now),lastAttemptAt:snapshot?.lastAttemptAt||null,
    lastSuccessfulAt,sourceHealth:{...(snapshot?.coverage||sourceHealth("NOT_YET_CHECKED")),status},
    degraded:status!=="HEALTHY",watch,diagnostics:snapshot?.diagnostics||null,
    note:"Reports are source claims. Indexing/publication times do not prove incident occurrence times or a common attacker."};
}
export {SNAPSHOT_KEY,SOURCE,FEEDS,sanitized,retain,parseSyndication,collectInfrastructureWatch,readInfrastructureWatch};
