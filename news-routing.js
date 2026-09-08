(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchNewsRouting=api})(globalThis,function(){
  'use strict';
  const H=3600000,F=typeof module==='object'&&module.exports?require('./news-freshness.js'):globalThis.NordicWatchFreshness;
  const text=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase();
  const time=v=>v?+new Date(v):NaN;
  const regions=[['Sweden','sweden|swedish|gotland'],['Finland','finland|finnish'],['Norway','norway|norwegian|finnmark'],['Denmark','denmark|danish|bornholm'],['Iceland','iceland|icelandic'],['Estonia','estonia|estonian|narva'],['Latvia','latvia|latvian|namejs'],['Lithuania','lithuania|lithuanian'],['Polish Baltic coast','polish baltic coast|gdansk|gdynia|szczecin|suwalki'],['Northeastern Poland','masurian patrol|bemowo piskie|masuria'],['Baltic Sea','baltic|gulf of finland'],['Kaliningrad / Baltijsk','kaliningrad|konigsberg|koenigsberg|baltijsk|baltiysk'],['Kola / Murmansk','kola|murmansk|severomorsk'],['Barents / Svalbard','barents|svalbard|spitsbergen|barentsburg'],['Jan Mayen / High North','jan mayen|high north'],['Northern Germany','schleswig holstein|mecklenburg vorpommern|kiel|rostock|lubeck|hamburg']];
  const topics=[['MILITARY_EXERCISE','exercise|training|namejs|airshow'],['MILITARY_ACTIVITY','military|defence|defense|naval|navy|aircraft|intercept(?:ion|ed|s)?|isr|awacs|fighters?|deployments?|airlift|submarines?|warships?|missiles?|troops'],['INFRASTRUCTURE','infrastructure|cable|pipeline|railway|telecom|power grid|energy'],['HYBRID_SECURITY','cyber|sabotage|drone|gnss|jamming|security'],['POLITICAL_SECURITY','sanctions|seizure|diplomatic|rhetoric|protest|nato|molchanov']];
  function evaluateNordicRelevance(item){
    if(!item||typeof item!=='object')throw new TypeError('Invalid relevance input');
    // Publisher location and a generic NATO affiliation alone are not operational linkage.
    const content=text([item.title,item.description,item.summary,item.areaName,item.region,item.location,item.destination,item.origin,item.route,JSON.stringify(item.entities||[]),JSON.stringify(item.participants||[]),JSON.stringify(item.locations||[])].filter(Boolean).join(' '));
    const matchedRegions=regions.filter(([,r])=>new RegExp('\\b(?:'+r+')\\b').test(content)).map(([name])=>name);
    const matchedTopics=topics.filter(([,r])=>new RegExp('\\b(?:'+r+')\\b').test(content)).map(([name])=>name);
    const matchedEntities=[...new Set(content.match(/\b(?:namejs(?:\s+20\d\d)?|s102b|korpen|il[- ]?20|rc[- ]?135|professor molchanov)\b/g)||[])];
    const relevant=matchedRegions.length>0&&matchedTopics.length>0;
    const matchedAliases=regions.flatMap(([,r])=>content.match(new RegExp('\\b(?:'+r+')\\b','g'))||[]);
    const extractedCountries=[...new Set(content.match(/\b(?:poland|polish|sweden|swedish|finland|finnish|norway|norwegian|denmark|danish|iceland|estonia|latvia|lithuania)\b/g)||[])];
    const extractedPlaces=[...new Set([...matchedAliases,...(content.match(/\b(?:masuria|masurian|bemowo piskie)\b/g)||[])])];
    return {normalizedText:content,extractedCountries,extractedPlaces,matchedAliases:[...new Set(matchedAliases)],relevant,relevanceScore:relevant?Math.min(100,60+matchedRegions.length*5+matchedTopics.length*5):0,matchedRegions,matchedEntities,matchedTopics,reason:relevant?['Named AOI location or established event association','Security topic: '+matchedTopics.join(', ')]:[matchedRegions.length?'No security topic established':'No explicit Nordic/Baltic operational connection']};
  }
  function safeRelevance(item,evaluate=evaluateNordicRelevance){try{const result=evaluate(item);if(!result||typeof result.relevant!=='boolean')throw Error('Invalid relevance result');return result}catch{return {relevant:false,relevanceScore:0,matchedRegions:[],matchedEntities:[],matchedTopics:[],reason:['Relevance processing degraded'],degraded:true}}}
  const host=url=>{try{return new URL(url).hostname}catch{return ''}};
  const canonical=url=>{try{const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/.test(k))u.searchParams.delete(k);return u.href}catch{return ''}};
  function normalize(item,now=Date.now()){
    const dates=F.dates(item),url=item.url||item.sourceUrl,source=host(url),namejs=text(item.title+' '+(item.description||'' )).match(/\bnamejs\s*(20\d\d)\b/);
    const evidence=/^(CONFIRMED|CONFIRMED_EXTERNAL)$/.test(item.confidence)||/CONFIRMED/.test(item.risk?.sourceConfidence)||/(^|\.)(nato\.int|dvidshub\.net|mil|forsvarsmakten\.se|mil\.lv)$/.test(source)?'CONFIRMED_EXTERNAL':'INFERRED';
    return {...item,url,domain:source||item.domain||'External report',eventId:namejs?'exercise-namejs-'+namejs[1]:item.eventId||item.id||item.signalId||canonical(url)||text(item.title),publishedAt:dates.publishedAt||dates.updatedAt||F.parse(item.temporal?.articlePublishedAt)||F.parse(item.startTime),lastUpdatedAt:dates.updatedAt||F.parse(item.lastObservedAt)||(!item.routingSignature?F.parse(item.lastUpdated):null),lastChecked:item.lastChecked||item.lastCheckedAt||item.discovery?.lastPolledAt,evidenceType:evidence,eventType:namejs?'MILITARY_EXERCISE':item.eventType,ongoing:item.ongoing===true||(/exercise/i.test(item.eventType||'')&&time(item.endTime)>now)};
  }
  function windowFor(a,now){
    const published=time(a.publishedAt),updated=time(a.lastUpdatedAt),effective=Number.isFinite(updated)&&updated>published?updated:published;
    const age=now-effective,ongoing=a.ongoing||/developing/i.test(a.lifecycle||a.status||'');
    if(/resolved|stale|ended|inactive/i.test(a.lifecycle||a.status||''))return {brief:false,context:false,reason:'Resolved or stale event'};
    if(!Number.isFinite(age)||age < -F.SKEW_HOURS*H)return {brief:false,context:false,reason:'Missing or future evidence timestamp'};
    if(age<=72*H)return {brief:true,context:true,reason:null};
    if(age<=7*24*H&&ongoing)return {brief:false,context:true,reason:'Developing context older than 72h; lastChecked alone does not renew evidence'};
    return {brief:false,context:false,reason:'Outside evidence window'};
  }
  function route(items,{now=Date.now(),previous=[],evaluate=evaluateNordicRelevance,stages={}}={}){
    const diagnostics=[],groups=new Map(),urlKeys=new Map(),titleKeys=new Map(),signalKeys=new Map();let degraded=false;
    for(const item of items){const n=normalize(item,now);for(const id of item.sourceSignals||[])signalKeys.set(id,n.eventId);for(const url of item.sourceUrls||[])urlKeys.set(canonical(url),n.eventId);}
    for(const raw of items){const a=normalize(raw,now),relevance=safeRelevance(a,evaluate),window=windowFor(a,now);degraded ||= Boolean(relevance.degraded);
      const d={source:a.domain,publishedAt:a.publishedAt,normalizedLocation:a.areaName||a.region||a.location||null,matchedRegion:relevance.matchedRegions,relevanceScore:relevance.relevanceScore,relevanceReasons:relevance.reason,eventId:a.eventId,eventStatus:a.lifecycle||a.status||null,includedInWhatChanged:false,includedInDailyBrief:false,exclusionReason:!relevance.relevant?relevance.reason.join('; '):window.reason,within72h:window.brief,geoTagged:relevance.matchedRegions.length>0,topicTagged:relevance.matchedTopics.length>0,aoiRelevant:relevance.relevant};diagnostics.push(d);
      if(!relevance.relevant||!window.context)continue;
      const urlKey=canonical(a.url),titleKey=text(a.title)+'|'+String(a.publishedAt||'').slice(0,10),key=signalKeys.get(a.signalId)||urlKeys.get(urlKey)||titleKeys.get(titleKey)||a.eventId;if(urlKey)urlKeys.set(urlKey,key);titleKeys.set(titleKey,key);a.eventId=key;d.eventId=key;const group=groups.get(key)||[];group.push({...a,relevance,window,diagnostic:d});groups.set(key,group);
    }
    const events=[];
    for(const [eventId,members] of groups){members.sort((a,b)=>(time(b.lastUpdatedAt)||time(b.publishedAt))-(time(a.lastUpdatedAt)||time(a.publishedAt)));const a=members[0],old=previous.find(e=>e.eventId===eventId),sources=[...new Set(members.map(m=>m.domain))],signature=JSON.stringify([...new Set(members.map(m=>JSON.stringify([m.title,m.description||m.summary||'',m.lastUpdatedAt||m.publishedAt])))].sort()),changed=!old||old.routingSignature!==signature;
      const event={...a,id:eventId,eventId,sourceCount:sources.length,sources,sourceUrls:[...new Set(members.map(m=>m.url).filter(Boolean))],firstSeen:old?.firstSeen||now,lastUpdated:changed?now:old.lastUpdated,lastChecked:now,lifecycle:!old?'new':changed?'updated':'developing',routingSignature:signature,materialChange:changed,briefEligible:members.some(m=>m.window.brief)};delete event.diagnostic;delete event.window;
      events.push(event);for(const m of members){m.diagnostic.eventStatus=event.lifecycle;m.diagnostic.includedInDailyBrief=event.briefEligible;m.diagnostic.includedInWhatChanged=event.briefEligible&&changed;if(!changed&&!m.diagnostic.exclusionReason)m.diagnostic.exclusionReason='Unchanged event: evaluated by brief, not a new development'}
    }
    const articles=events.filter(e=>e.briefEligible);
    return {events,articles,diagnostics,degraded,counters:{...stages,stored:items.length,within72h:diagnostics.filter(d=>d.within72h).length,geoTagged:diagnostics.filter(d=>d.geoTagged).length,topicTagged:diagnostics.filter(d=>d.topicTagged).length,aoiRelevant:diagnostics.filter(d=>d.aoiRelevant).length,eventMatched:events.length,whatChanged:events.filter(e=>e.materialChange&&e.briefEligible).length,dailyBriefEvaluated:articles.length}};
  }
  function diagnose(item){const result=safeRelevance(item);const fields=['title','description','summary','areaName','region','location','locations','destination','origin','route','countries','tags','entities','participants'];return {source:item.sourceName||item.domain||item.sourceId,fields:Object.keys(item),rawTitle:item.title,rawDescription:item.description??null,rawSummary:item.summary??null,rawGeography:Object.fromEntries(['areaName','region','location','locations','countries','destination','origin','route'].map(k=>[k,item[k]??null])),rawTags:item.tags??null,rawEntities:item.entities??null,inputTypes:Object.fromEntries(fields.map(k=>[k,Array.isArray(item[k])?'array':typeof item[k]])),...result,geographicScore:result.relevanceScore,result:result.relevant?'PASS':'FAIL',rejectionReason:result.relevant?null:result.reason.join('; ')};}
  return {diagnose,evaluateNordicRelevance,safeRelevance,normalize,windowFor,route};
});
