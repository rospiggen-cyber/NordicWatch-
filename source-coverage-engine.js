/* NordicWatch Source Coverage Engine v1 — explain observability, never infer absent events.
 * Pure module: no transport, mutable globals, cached state, or election/threat predictions.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.NordicWatchSourceCoverage=api;
})(globalThis,function(){
'use strict';
const DAY=86400000;
const slug=v=>String(v||'').normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const finiteTime=v=>{if(v==null||v==='')return null;const t=Date.parse(v);return Number.isFinite(t)?t:null};
const count=v=>Math.max(0,Math.floor(Number(v)||0));
const unique=a=>[...new Set(a.filter(Boolean))];
const REQUIREMENTS=Object.freeze({
  US_DOMESTIC_POLICY:[
    {id:'US_DOMESTIC',name:'US domestic political/economic developments',details:'Independent domestic measures, congressional decisions or original statistical releases',domain:'DOMESTIC',actor:'US'},
    {id:'US_POLICY',name:'Documented US foreign-policy decisions',details:'Original US government policy documents, with dates and source links',domain:'POLICY',actor:'US'}
  ],
  US_POLICY_NORDIC_SECURITY:[
    {id:'US_POLICY',name:'Documented US foreign-policy decisions',details:'Original US government policy documents, with dates and source links',domain:'POLICY',actor:'US'},
    {id:'NORDIC_SECURITY',name:'Nordic–Baltic security responses',details:'Official Nordic, EU or NATO regional developments explicitly relevant to the Nordic–Baltic area',domain:'ALLIANCE_SECURITY',actor:'REGIONAL'}
  ]
});
function fits(signal,requirement){
  if(!signal||signal.synthetic||signal.lead||signal.stance==='COUNTER')return false;
  if(requirement.id==='NORDIC_SECURITY')return signal.region==='NORDIC_BALTIC'&&
    (signal.domain==='SECURITY'||signal.domain==='ALLIANCE')&&
    ['NATO','EU','SE','FI','NO','DK','EE','LV','LT','PL'].includes(signal.actor);
  return signal.domain===requirement.domain&&signal.actor===requirement.actor;
}
function build({registry=[],feeds=[],health=[],signals=[],analysis=[],now=Date.now()}={}){
  const clock=finiteTime(now instanceof Date?now.toISOString():typeof now==='number'?new Date(now).toISOString():now)??Date.now();
  const sourceRecords=new Map();
  const configured=new Map();
  for(const feed of Array.isArray(feeds)?feeds:[]){
    const id=String(feed?.source?.id||'');if(!id)continue;
    configured.set(id,(configured.get(id)||0)+1);
  }
  for(const s of Array.isArray(registry)?registry:[]){
    if(!s||typeof s.id!=='string')continue;
    sourceRecords.set(s.id,{id:s.id,name:String(s.publisher||s.name||s.id),domain:String(s.domain||''),actor:String(s.actor||''),
      feedCount:configured.get(s.id)||0,responseCount:0,failedCount:0,items:0,topicMatches:0,
      recentSignals:0,sourceGroup:slug(s.id),lastSignalAt:null,status:'NOT_CONFIGURED'});
  }
  for(const h of Array.isArray(health)?health:[]){
    const r=sourceRecords.get(h?.id);if(!r)continue;
    if(h.ok)r.responseCount++;else r.failedCount++;
    r.items+=count(h.items);r.topicMatches+=count(h.accepted);
  }
  const safeSignals=(Array.isArray(signals)?signals:[]).filter(s=>s&&typeof s==='object'&&finiteTime(s.eventTime)!==null);
  for(const s of safeSignals){
    if(s.synthetic||s.lead)continue;
    const group=slug(s.source?.independenceGroup);
    const r=[...sourceRecords.values()].find(row=>row.sourceGroup===group);
    if(!r)continue;
    const t=finiteTime(s.eventTime);
    if(t<=clock&&clock-t<=14*DAY){
      r.recentSignals++;
      if(!r.lastSignalAt||t>finiteTime(r.lastSignalAt))r.lastSignalAt=new Date(t).toISOString();
    }
  }
  for(const s of sourceRecords.values()){
    if(s.feedCount===0){s.status='NOT_CONFIGURED';continue}
    if(s.responseCount===0){s.status='UNAVAILABLE';continue}
    if(s.failedCount>0||s.responseCount<s.feedCount){s.status='PARTIAL_FAILURE';continue}
    s.status=s.recentSignals>0?'RELEVANT':'NO_RECENT_RELEVANT';
  }
  const recent=safeSignals.filter(s=>{
    const t=finiteTime(s.eventTime);
    return t<=clock&&clock-t<=14*DAY&&!s.synthetic&&!s.lead;
  });
  const hypothesis=(Array.isArray(analysis)?analysis:[]).map(card=>{
    const reqs=REQUIREMENTS[card.id]||[];
    const dimensions=reqs.map(req=>{
      const subset=recent.filter(s=>fits(s,req));
      const groups=unique(subset.map(s=>slug(s.source?.independenceGroup)));
      const candidates=[...sourceRecords.values()].filter(src=>{
        if(req.id==='US_DOMESTIC')return src.actor==='US'&&src.domain==='DOMESTIC';
        if(req.id==='US_POLICY')return src.actor==='US'&&src.domain==='POLICY';
        return src.domain==='ALLIANCE'||src.domain==='SECURITY';
      });
      const connected=candidates.filter(src=>src.feedCount>0);
      const responding=connected.filter(src=>src.responseCount>0);
      let status;
      if(subset.length)status='SIGNALS_PRESENT';
      else if(!connected.length)status='NOT_MONITORED';
      else if(!responding.length)status='FEEDS_UNAVAILABLE';
      else status='NO_MATCHING_EVIDENCE';
      return {id:req.id,label:req.name,requirement:req.details,status,
        signals:subset.length,independentGroups:groups.length,
        respondingProviders:responding.length,configuredProviders:connected.length,
        contributingProviders:unique(subset.map(s=>s.source?.publisher)),
        evidencePreview:subset.slice(-3).map(s=>({title:s.title,sourceUrl:s.source?.url,eventTime:s.eventTime}))};
    });
    const observedGroups=unique(recent.filter(s=>dimensions.some(dim=>(reqs.some(req=>req.id===dim.id&&fits(s,req)))))
      .map(s=>slug(s.source?.independenceGroup)));
    const status=dimensions.every(d=>d.status==='SIGNALS_PRESENT')?'DIMENSIONS_OBSERVED':'COVERAGE_GAPS';
    const gaps=dimensions.filter(d=>d.status!=='SIGNALS_PRESENT').map(d=>({
      dimension:d.id,reason:d.status,
      detail:d.status==='NOT_MONITORED'?'No source feed for this evidence dimension is configured.':
        d.status==='FEEDS_UNAVAILABLE'?'All configured source feeds for this dimension failed.':
        'Connected source feeds responded, but no qualifying recent evidence was collected.'
    }));
    return {id:card.id,title:card.title,status,dimensions,gaps,
      observedIndependentGroups:observedGroups.length,
      validCrossDomainLinks:count(card.links?.length),
      conclusion:'Coverage is an observability assessment, not a statement that events did or did not happen.'};
  });
  const providers=[...sourceRecords.values()];
  const watched=providers.filter(p=>p.feedCount>0);
  const groups=unique(watched.map(p=>p.sourceGroup));
  return {version:'1.0',generatedAt:new Date(clock).toISOString(),
    technical:{configuredFeeds:watched.reduce((a,p)=>a+p.feedCount,0),
      respondingFeeds:watched.reduce((a,p)=>a+p.responseCount,0),
      connectedOrganizations:watched.length,independentOrganizations:groups.length,
      missingOrganizations:providers.filter(p=>p.status==='NOT_CONFIGURED').map(p=>p.name)},
    providers,hypotheses:hypothesis,
    caveat:'Responding RSS feeds do not guarantee topical coverage, independent corroboration, event occurrence dates, or historical completeness. No-news is not no-event.'};
}
return {build,REQUIREMENTS};
});
