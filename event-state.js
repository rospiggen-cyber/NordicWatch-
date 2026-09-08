/* Evidence lifecycle only; does not calculate EventScore, CIC or geographic relevance. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchEventState=api})(globalThis,function(){
 'use strict';
 const H=3600000,clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),norm=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const date=v=>v!=null&&v!==''&&Number.isFinite(+new Date(v))?new Date(v).toISOString():null;
 const url=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
 const canonical=v=>{const s=url(v);if(!s)return '';const u=new URL(s);u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href};
 const words=v=>norm(v).split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!['incident','reported','report','drone','drones','finland','authorities','investigation','possible','unknown'].includes(w));
 const drone=t=>/\b(?:drone|drones|uas|uav|lennokki|drooni|dronare|unmanned)\b/.test(norm(t));
 function descriptor(raw){
  const title=raw.title||raw.displayName&&`${raw.displayName} — ${raw.region}`||raw.summary||'Event',content=[title,raw.summary,raw.description,raw.investigationStatus].join(' ');
  let locations=raw.locationTerms||raw.risk?.places?.map(p=>p.name)||raw.locations||[raw.areaName||raw.location||raw.region].filter(Boolean);
  if(/pelling|porvoo|pellinki|borga/.test(norm(content)))locations=['Porvoo','Pellinge','Pellinki','Pellingin','Borgå'];
  return {id:raw.eventId||raw.id||raw.signalId||(canonical(raw.url||raw.sourceUrl)?'article:'+canonical(raw.url||raw.sourceUrl):null),title:raw.incidentType==='UAV_RECOVERED'?`${raw.country||''} drone incident — ${locations[0]||raw.region}`.trim():title,locationTerms:locations.map(clean).filter(Boolean),entities:raw.entities||[],authorities:raw.authorities||(/border guard|rajavart|gransbevak/.test(norm(content))?['Finnish Border Guard','Rajavartiolaitos','police']:[]),topic:raw.eventType||raw.incidentType||(drone(content)?'drone incident':'event'),sourceUrl:raw.url||raw.sourceUrl,endTime:raw.endTime||null};
 }
 function evidence(raw){const sourceUrl=url(raw.sourceUrl)||url(raw.url),timestamp=date(raw.publishedAt||raw.articlePublishedAt||raw.timestamp||raw.startTime),updated=date(raw.sourceUpdatedAt||raw.updatedAt||raw.temporal?.lastUpdatedAt)||timestamp;
  if(!timestamp||!sourceUrl||raw.timeStatus==='TIME_UNCERTAIN')return null;
  const title=clean(raw.title||raw.displayName||'Original observation'),description=clean(raw.assessment||raw.description||raw.summary),host=new URL(sourceUrl).hostname;
  return {sourceUrl,source:clean(raw.sourceName||raw.source?.name||raw.domain)||host,title,description,timestamp,updated,timePrecision:raw.timePrecision||'TIMESTAMP',sourceConfidence:raw.confidence||raw.findingConfidence||'UNKNOWN',eventId:raw.linkedEventId||raw.eventId||null,kind:raw.evidenceKind||'REPORT',signature:JSON.stringify([canonical(sourceUrl),title,description,updated]),originalSignalId:raw.signalId||raw.id||null};
 }
 function related(d,e){
  if(e.eventId===d.id||canonical(e.sourceUrl)===canonical(d.sourceUrl))return true;
  const t=norm(e.title+' '+e.description),locations=d.locationTerms.filter(x=>norm(x).length>3&&!/^(finland|sweden|norway|germany|baltic sea|regional)$/i.test(x));
  if(!locations.some(l=>t.includes(norm(l))))return false;
  const topic=drone(d.title+' '+d.topic)?drone(t):words(d.title).filter(w=>t.includes(w)).length>=2;
  // A restriction elsewhere in the Gulf is not evidence that the recovered Porvoo case ended.
  return topic;
 }
 function assessment(e,d={}){
  const t=norm(e.title+'. '+e.description),host=new URL(e.sourceUrl).hostname;
  const official=/(^|\.)(?:raja\.fi|poliisi\.fi|valtioneuvosto\.fi|defmin\.fi|puolustusvoimat\.fi|polisen\.se|gov\.uk|gov\.pl|mil\.lv|mil\.ee|mod\.gov\.lv|forsvarsmakten\.se|forsvaret\.no|bundeswehr\.de|bmvg\.de|politi\.dk|politi\.no|traficom\.fi|finavia\.fi|nato\.int)$/.test(host);
  const attributed=/\b(?:police|authorities|border guard|defence forces|rajavartiolaitos|poliisi|myndigheterna|gransbevakningsvasendet)\b/.test(t);
  const qualified=official||attributed&&/(^|\.)(?:yle\.fi|reuters\.com|apnews\.com|bbc\.com|dailyfinland\.fi)$/.test(host);
  const denied=/\b(?:no drone (?:was |has been )?confirmed|sighting (?:was |has been )?not confirmed|ingen dronare (?:har )?bekraftats)\b/.test(t);
  const investigationEnded=/\b(?:incident (?:has |had )?ended|investigation (?:has been |has |had |was |is )?(?:concluded|closed)|utredningen (?:har )?avslutats)\b/.test(t);
  const resolved=investigationEnded||d.topic!=='UAV_RECOVERED'&&/\b(?:restrictions (?:have been |were |are )?lifted|lifted the restrictions|(?:activity|operations|traffic) (?:has |have )?returned to normal|restriktionerna (?:har )?havts)\b/.test(t);
  const negated=/\b(?:not (?:yet )?(?:ended|closed|concluded|lifted)|restrictions remain|investigation (?:is )?(?:ongoing|continues)|utredningen fortsatter)\b/.test(t);
  if(qualified&&denied)return {status:'UNCONFIRMED',active:false,confidence:'MEDIUM',text:e.description||e.title};
  if(qualified&&resolved&&!negated)return {status:'RESOLVED',active:false,confidence:official?'HIGH':'MEDIUM',text:e.description||e.title};
  return {status:'UPDATED',active:true,confidence:qualified?'MEDIUM':'LOW',text:e.description||e.title};
 }
 function reconcile(raw,previous=null,incoming=[],{now=Date.now(),checked=false,checkSucceeded=false,checkMethod=null}={}){
  const d=raw.incidentType==='UAV_RECOVERED'?descriptor(raw):previous?.descriptor||descriptor(raw),initial=evidence({...raw,url:d.sourceUrl}),sources=[...(previous?.sources||[])];
  for(const e of [initial,...incoming.map(evidence)].filter(Boolean)){
   if(!related(d,e)||+new Date(e.updated)>now||previous&&+new Date(e.timestamp)<+new Date(previous.firstSeen)-24*H)continue;
   const existing=sources.find(s=>s.signature===e.signature||canonical(s.sourceUrl)===canonical(e.sourceUrl)&&s.title===e.title&&s.description===e.description);
   if(!existing)sources.push(e);else if(!existing.timePrecision)existing.timePrecision=e.timePrecision;
  }
  sources.sort((a,b)=>+new Date(a.updated)-+new Date(b.updated)||a.signature.localeCompare(b.signature));
  const latest=sources.at(-1),firstSeen=previous?.firstSeen||sources[0]?.timestamp||null,lastSeen=latest?.updated||previous?.lastSeen||firstSeen;
  const changed=Boolean(latest&&latest.signature!==previous?.latestSignature);
  let verdict=latest?assessment(latest,d):{status:'UNCONFIRMED',active:false,confidence:'LOW',text:'No dated source supports this event.'};
  if(previous&&!changed&&['RESOLVED','UNCONFIRMED'].includes(previous.status))verdict={status:previous.status,active:false,confidence:previous.confidence,text:previous.latestAssessment};
  // Later generic reporting cannot reopen a resolved case. Require an explicit new active observation.
  if(previous?.status==='RESOLVED'&&verdict.active&&!/\b(?:reopened|renewed incident|new drone sighting|restrictions reimposed)\b/i.test(latest?.description+' '+latest?.title))verdict={status:'RESOLVED',active:false,confidence:previous.confidence,text:previous.latestAssessment};
  const scheduled=/exercise|deployment/.test(d.topic)&&date(d.endTime),expiry=scheduled?Math.max(+new Date(d.endTime),+new Date(lastSeen)+72*H):+new Date(lastSeen)+72*H;
  let status=verdict.status;if(verdict.active){status=now>expiry||scheduled&&now>+new Date(d.endTime)?'STALE':!previous&&sources.length<=1?'NEW':changed?'UPDATED':previous.status==='NEW'?'DEVELOPING':previous.status==='STALE'?'STALE':previous.status;}
  const check=checked?{timestamp:new Date(now).toISOString(),succeeded:checkSucceeded,method:checkMethod||'follow-up',newSources:sources.length-(previous?.sources.length||0)}:null;
  const checks=[...(previous?.checks||[])];if(check&&!checks.some(c=>c.timestamp===check.timestamp&&c.method===check.method))checks.push(check);
  const later=(a,b)=>!a?b:!b?a:a>b?a:b;
  return {id:d.id,descriptor:d,status,firstSeen,lastSeen,lastUpdated:changed?latest.updated:previous?.lastUpdated||lastSeen,lastChecked:later(previous?.lastChecked,checked?new Date(now).toISOString():null),lastSuccessfulCheck:later(previous?.lastSuccessfulCheck,checked&&checkSucceeded?new Date(now).toISOString():null),latestAssessment:status==='STALE'?'No recent information confirms that this situation remains active. Last source assessment: '+(verdict.text||'Unavailable'):verdict.text,sources,active:!['RESOLVED','STALE','UNCONFIRMED'].includes(status),confidence:status==='STALE'?'LOW':verdict.confidence,latestSignature:latest?.signature||null,checks,lastTargetedCheck:previous?.lastTargetedCheck||null,followupQueries:previous?.followupQueries||searches(d),lastFollowupError:previous?.lastFollowupError||null};
 }
 function searches(d){const locations=d.locationTerms.slice(0,5).map(x=>'"'+x.replace(/"/g,'')+'"').join(' OR '),entities=words(JSON.stringify(d.entities)).slice(0,4),topic=drone(d.title+' '+d.topic)?'(drone OR UAV OR UAS OR lennokki OR drooni OR drönare)':'('+words(d.title).slice(0,5).join(' OR ')+')';return [`(${locations||'"'+clean(d.title).replace(/"/g,'')+'"'}) ${topic}`,`${d.locationTerms[0]||''} ${d.authorities.join(' ')} ${entities.join(' ')} ${d.title} update investigation restrictions lifted`];}
 function attach(raw,registry){const key=raw.eventId||raw.id||raw.signalId,source=canonical(raw.url||raw.sourceUrl),state=registry[key]||Object.values(registry).find(s=>source&&s.sources.some(e=>canonical(e.sourceUrl)===source));return state?{...raw,eventState:state,eventId:state.id}:raw}
 return {descriptor,evidence,related,assessment,reconcile,searches,canonical,attach};
});
