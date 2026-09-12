(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchCollectors=api})(globalThis,function(){
  'use strict';
  const clean=(v,n=400)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
  const unique=xs=>[...new Set(xs.filter(Boolean))];
  const stamp=v=>{const n=+new Date(v);return Number.isFinite(n)?n:null};
  const id=v=>clean(v,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const priority=n=>n>=75?'HIGH':n>=50?'ELEVATED':n>0?'WATCH':'INFO';
  function normalizeEvidence(raw,collectorId,now){
    if(!raw||typeof raw!=='object')return null;const timestamp=stamp(raw.timestamp??raw.time??raw.eventTime??raw.publishedAt??raw.lastObservedAt);
    if(timestamp===null||timestamp>now+300000)return null;
    const evidenceId=clean(raw.id||raw.signalId||raw.eventId,180);if(!evidenceId)return null;
    return {id:evidenceId,collectorId,timestamp,title:clean(raw.title||raw.details||raw.kind||evidenceId),region:clean(raw.region||raw.areaName||raw.location),source:clean(raw.source?.name||raw.source?.publisher||raw.sourceName||raw.source||'UNKNOWN',120),sourceUrl:/^https:\/\//.test(String(raw.sourceUrl||raw.url||raw.link||''))?String(raw.sourceUrl||raw.url||raw.link):null,score:Math.max(0,Math.min(100,Number(raw.score??raw.eventScore??raw.risk?.total??raw.risk?.score)||0)),confidence:clean(raw.confidence||raw.sourceConfidence||'UNKNOWN',60),kind:clean(raw.kind||raw.role||raw.capability||raw.type,80),domain:clean(raw.domain||collectorId,40).toUpperCase()};
  }
  function createCollector(def){if(!def||!id(def.id)||typeof def.select!=='function')throw new Error('Collector requires id and select');return Object.freeze({id:id(def.id),title:clean(def.title||def.id,80),description:clean(def.description,220),windowMs:Math.max(60000,Number(def.windowMs)||86400000),select:def.select,score:typeof def.score==='function'?def.score:null})}
  function runCollector(collector,snapshot,{now=Date.now()}={}){
    const coverage=snapshot?.coverage?.[collector.id],checked=coverage?.checked===true;
    try{const selected=collector.select(snapshot||{})||[];if(!Array.isArray(selected))throw new Error('Collector output must be an array');const map=new Map();for(const raw of selected){const e=normalizeEvidence(raw,collector.id,now);if(!e||e.timestamp<now-collector.windowMs)continue;const old=map.get(e.id);if(!old||e.timestamp>old.timestamp)map.set(e.id,e)}const evidence=[...map.values()].sort((a,b)=>b.timestamp-a.timestamp),sources=unique(evidence.map(e=>e.source).filter(x=>x!=='UNKNOWN')),score=Math.round(Math.max(0,Math.min(100,collector.score?collector.score(evidence,snapshot):Math.min(100,evidence.reduce((n,e)=>n+Math.max(8,e.score*.25),0))))),status=evidence.length?'ACTIVE':checked?'QUIET':'NO DATA';return {id:'scan-'+collector.id,collectorId:collector.id,title:collector.title,description:collector.description,status,priority:priority(score),score,observationCount:evidence.length,sourceCount:sources.length,sources,latestAt:evidence[0]?.timestamp||null,evidence,health:{ok:true,checked,available:coverage?.available!==false,message:clean(coverage?.message)}}}catch(error){return {id:'scan-'+collector.id,collectorId:collector.id,title:collector.title,description:collector.description,status:'DEGRADED',priority:'INFO',score:0,observationCount:0,sourceCount:0,sources:[],latestAt:null,evidence:[],health:{ok:false,checked,available:false,message:clean(error?.message||error)}}}
  }
  function createSwarm(definitions){const collectors=definitions.map(createCollector),ids=collectors.map(c=>c.id);if(unique(ids).length!==ids.length)throw new Error('Collector ids must be unique');return {collectors,run:(snapshot,options)=>collectors.map(c=>runCollector(c,snapshot,options)).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title))}}
  const has=(v,re)=>re.test(clean(v).toLowerCase());
  function defaults(){return createSwarm([
    {id:'air-activity',title:'Air activity',description:'Military and state aircraft observations.',windowMs:6*3600000,select:s=>s.air||[],score:e=>Math.min(100,e.length*12+unique(e.map(x=>x.kind)).length*8)},
    {id:'maritime',title:'Maritime',description:'Vessel observations and maritime behavioural indicators.',windowMs:24*3600000,select:s=>s.maritime||[],score:e=>Math.min(100,e.length*10+Math.max(0,...e.map(x=>x.score)))},
    {id:'infrastructure',title:'Infrastructure',description:'Infrastructure, energy, telecom and transport incidents.',windowMs:72*3600000,select:s=>s.infrastructure||[],score:e=>Math.min(100,e.length*12+unique(e.map(x=>x.kind)).length*7)},
    {id:'isr-ew',title:'ISR / EW',description:'ISR, SIGINT, AWACS, EW and supporting air activity.',windowMs:24*3600000,select:s=>(s.air||[]).filter(x=>has(x.kind||x.role||x.title,/isr|sigint|awacs|aew|electronic warfare|\bew\b/)),score:e=>Math.min(100,e.length*16+unique(e.map(x=>x.kind||x.role)).length*8)},
    {id:'drone-gnss',title:'Drone / GNSS',description:'Drone incidents and GNSS interference indicators.',windowMs:72*3600000,select:s=>[...(s.drone||[]),...(s.gnss||[])],score:e=>Math.min(100,e.length*18+Math.max(0,...e.map(x=>x.score)))},
    {id:'high-north',title:'High North',description:'Signals around Svalbard, Jan Mayen, Barents and Kola.',windowMs:7*86400000,select:s=>(s.all||[]).filter(x=>has([x.region,x.areaName,x.title].join(' '),/svalbard|barents|jan mayen|high north|kola|murmansk/)),score:e=>Math.min(100,e.length*14+unique(e.map(x=>x.domain)).length*10)},
    {id:'escalation',title:'Escalation',description:'Explicit escalation events and supported cross-domain developments.',windowMs:7*86400000,select:s=>s.escalation||[],score:e=>Math.min(100,Math.max(0,...e.map(x=>x.score))+e.length*8)}
  ])}
  return {createCollector,createSwarm,runCollector,normalizeEvidence,defaults};
});
