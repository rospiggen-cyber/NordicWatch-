(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.NordicWatchBrief=api;
})(globalThis,function(){
  'use strict';

  const H=3600000;
  const F=typeof module==='object'&&module.exports?require('./news-freshness.js'):globalThis.NordicWatchFreshness;
  const at=v=>v==null?NaN:+new Date(v);
  const nowOr=(value,fallback)=>Number.isFinite(at(value))?at(value):fallback;

  function eligible(article,now=Date.now()){
    if(article.relevance)return article.relevance.relevant===true&&article.briefEligible===true;
    return F.assess(article,now).freshnessResult==='PASS';
  }

  function rankNews(article,situations,now){
    const match=situations.filter(s=>s.observations.some(o=>o.incidentId===article.eventId||o.id===article.signalId));
    const correlation=Math.max(0,...match.map(s=>s.situationScore));
    const age=Math.max(0,(now-at(article.publishedAt||article.ingestedAt))/H);
    const c=article.risk?.components||{};
    const components={
      geography:(c.geographicRelevance||0)*.2,
      security:(c.militarySignificance||article.risk?.score||0)*.15,
      eventScore:(article.risk?.eventScore||article.risk?.score||0)*.2,
      correlation:correlation*.2,
      recency:Math.max(0,100-age*100/72)*.15,
      reliability:(c.sourceConfidence||40)*.1
    };
    return {score:Math.round(Object.values(components).reduce((a,b)=>a+b,0)),components};
  }

  function selectNews(articles,{now=Date.now(),situations=[],geographic=()=>true}={}){
    const fresh=articles.filter(a=>eligible(a,now));
    const regional=fresh.filter(geographic);
    const byId=new Map();
    for(const article of regional){
      const key=article.eventId||article.signalId||article.id||article.url;
      const old=byId.get(key);
      if(!old||at(article.lastUpdatedAt)>at(old.lastUpdatedAt))byId.set(key,article);
    }
    const selected=[...byId.values()].map(a=>({...a,briefRanking:rankNews(a,situations,now)})).sort((a,b)=>b.briefRanking.score-a.briefRanking.score);
    return {articles:selected,counters:{fetched:articles.length,freshness:fresh.length,geographic:regional.length,dedup:byId.size,selected:selected.length}};
  }

  function assessCoverage(coverage,counters){
    const hasCoverage=coverage&&typeof coverage==='object',value=Number(coverage?.coverage),status=String(coverage?.status||'').toUpperCase();
    const insufficient=hasCoverage?(status==='INSUFFICIENT'||Number.isFinite(value)&&value<40):counters.fetched===0;
    const degraded=!insufficient&&(hasCoverage?(status==='DEGRADED'||Number.isFinite(value)&&value<70):(counters.fetched>0&&counters.freshness===0));
    return {status:insufficient?'INSUFFICIENT':degraded?'DEGRADED':'HEALTHY',confidence:insufficient?'LOW':degraded?'REDUCED':'NORMAL',coverage:Number.isFinite(value)?value:null,warning:insufficient?'Insufficient news coverage — no evidence of change must not be presented as evidence of no change.':degraded?'News coverage is degraded; reduce confidence in quiet/no-change assessments.':null};
  }

  function evidenceLabel(value){
    const text=String(value||'').toUpperCase();
    if(/CONFIRMED|OFFICIAL/.test(text))return 'CONFIRMED EXTERNAL REPORT';
    if(/DIRECT|OBSERVED/.test(text))return 'DIRECT OBSERVATION';
    return 'AUTOMATIC ASSESSMENT';
  }

  function eventStatus(event,now){
    const status=String(event.status||'').toUpperCase();
    if(status)return status;
    const start=at(event.startDate||event.startTime),end=at(event.endDate||event.endTime);
    if(Number.isFinite(start)&&now<start)return 'UPCOMING';
    if(Number.isFinite(end)&&now>end)return 'ENDED';
    return 'ACTIVE';
  }

  function eventScore(event,now){
    const score=Number(event.eventScore??event.discovery?.score??event.risk?.eventScore??event.risk?.score??0);
    const observed=nowOr(event.lastObservedAt||event.updatedAt||event.startTime,now-72*H);
    const age=Math.max(0,(now-observed)/H),recency=Math.max(0,25-age*25/72);
    const official=/CONFIRMED|OFFICIAL|HIGH/.test(String(event.confidence||event.verification?.status||''))?15:5;
    return Math.round(Math.min(100,score*.65+recency+official));
  }

  function eventFingerprint(event,now){
    return JSON.stringify([event.title,event.description,event.lastObservedAt,event.updatedAt,event.eventScore,event.discovery?.score,event.confidence,eventStatus(event,now)]);
  }

  function materialEventCandidates(events,{now,previous,kind,geographic}){
    const previousById=new Map((previous?.officialEvents||[]).map(e=>[e.id,e])),since=kind==='evening'&&previous?.t?previous.t:now-24*H;
    return events.filter(event=>{
      if(!geographic(event))return false;
      const status=eventStatus(event,now);
      if(!['ACTIVE','UPCOMING'].includes(status))return false;
      const observed=nowOr(event.lastObservedAt||event.updatedAt||event.startTime,0),old=previousById.get(event.eventId||event.id),changed=!old||old.fingerprint!==eventFingerprint(event,now);
      return kind!=='evening'||changed&&observed>=since;
    }).map(event=>{
      const id=event.eventId||event.id,sourceCount=event.sourceCount||event.confirmedSources?.length||1;
      return {id,eventId:id,type:'OFFICIAL_EVENT',title:event.title,score:eventScore(event,now),evidence:evidenceLabel(event.confidence||event.verification?.status),text:`${event.areaName||event.region||event.locations?.join(', ')||'Regional'} · ${eventStatus(event,now)} · ${sourceCount} source${sourceCount===1?'':'s'}`,event};
    });
  }

  function mergeCandidates(candidates){
    const byId=new Map();
    for(const candidate of candidates){
      const key=candidate.eventId||candidate.id,old=byId.get(key);
      if(!old||candidate.score>old.score)byId.set(key,candidate);
    }
    return [...byId.values()].sort((a,b)=>b.score-a.score);
  }

  function build({articles=[],events:officialEvents=[],situations=[],signals=[],upstreamTriggers=[],previous=null,coverage={},now=Date.now(),geographic=()=>true,kind='morning'}={}){
    const news=selectNews(articles,{now,situations,geographic}),coverageAssessment=assessCoverage(coverage,news.counters);
    const core=typeof globalThis.NordicWatchIntelligence==='object'?globalThis.NordicWatchIntelligence:typeof require==='function'?require('./intelligence-core.js'):null;
    const triggerWatch=core?.watchDirectives(upstreamTriggers,now)||[];
    const newsCoverage={articlesAvailable:news.counters.geographic,articlesEvaluated:news.articles.length,status:!news.articles.length?'INSUFFICIENT':coverage?.newsChecked===true?'SUFFICIENT':'PARTIAL'};
    const layer=count=>({count,status:count?'PARTIAL':'INSUFFICIENT'});
    const liveObservationCoverage=layer(signals.filter(s=>!['NEWS','OFFICIAL'].includes(s.domain)&&now-s.timestamp<H&&s.timestamp<=now).length);
    const historicalCoverage=layer(signals.filter(s=>s.timestamp<now-H&&s.timestamp>=now-72*H).length);
    const externalEventCoverage={checked:coverage?.externalChecked===true,status:coverage?.externalChecked===true?'SUFFICIENT':'INSUFFICIENT'};

    const eventStates=news.articles.map(article=>{
      const id=article.eventId||article.signalId||article.id||article.url,signature=JSON.stringify([article.title,article.description||article.summary,article.lastUpdatedAt]),old=previous?.events?.find(e=>e.id===id);
      return {id,signature,firstSeen:old?.firstSeen||now,lastUpdated:old?.signature===signature?old.lastUpdated:now,lastChecked:now,sourceCount:new Set(articles.filter(x=>(x.eventId||x.signalId||x.id||x.url)===id).map(x=>x.domain||x.url)).size,status:article.resolved?'resolved':!old?'new':old.signature!==signature?'updated':'developing',changed:!old||old.signature!==signature};
    });
    for(const old of previous?.events||[])if(!eventStates.some(e=>e.id===old.id))eventStates.push({...old,status:'stale',changed:false,lastChecked:now});

    const situationCandidates=[];
    for(const situation of situations.filter(s=>s.observations.length>=2)){
      const old=previous?.situations?.find(p=>p.situationId===situation.situationId),changed=!old||situation.signalIds.some(id=>!old.signalIds.includes(id))||Math.abs(situation.situationScore-old.situationScore)>=5;
      if(kind==='evening'&&!changed)continue;
      situationCandidates.push({id:situation.situationId,eventId:situation.situationId,type:'FUSED_SITUATION',title:situation.title,score:situation.situationScore+15,evidence:'AUTOMATIC ASSESSMENT',text:situation.summary,situation});
    }

    const officialCandidates=materialEventCandidates(officialEvents,{now,previous,kind,geographic});
    const newsCandidates=[];
    for(const article of news.articles){
      const id=article.eventId||article.signalId||article.id||article.url,state=eventStates.find(e=>e.id===id);
      if(!state?.changed||state.status==='resolved')continue;
      if(situationCandidates.some(d=>d.situation?.observations.some(o=>o.incidentId===article.eventId)))continue;
      newsCandidates.push({id:article.signalId||article.id,eventId:id,type:'NEWS_EVENT',title:article.title,score:article.briefRanking.score,evidence:evidenceLabel(article.evidenceType||article.risk?.sourceConfidence),text:`${article.domain||'External reporting'} · EventScore ${article.risk?.eventScore||article.risk?.score||0} · ${article.timeStatus||'KNOWN'} publication time`,article});
    }

    const since=kind==='evening'&&previous?.t?previous.t:now-24*H;
    const observationCandidates=signals.filter(s=>s.timestamp>=since&&s.timestamp<=now&&!['NEWS','OFFICIAL'].includes(s.domain)).filter(s=>Number(s.eventScore||0)>=35||/CONFIRMED|DIRECT/.test(String(s.evidence||''))).filter(s=>!situationCandidates.some(d=>d.situation?.signalIds.includes(s.id))).map(s=>({id:s.id,eventId:s.incidentId||s.id,type:'SIGNIFICANT_OBSERVATION',title:s.title,score:s.eventScore||35,evidence:evidenceLabel(s.evidence),text:s.domain+' · '+new Date(s.timestamp).toISOString(),signal:s}));
    const developments=mergeCandidates([...situationCandidates,...officialCandidates,...newsCandidates,...observationCandidates]).slice(0,3);

    const primaryEvidenceCount=news.articles.length+officialCandidates.length+situationCandidates.length;
    const coverageStatus=primaryEvidenceCount===0?'INSUFFICIENT':newsCoverage.status==='SUFFICIENT'&&externalEventCoverage.checked?'SUFFICIENT':'PARTIAL';
    const confidence=coverageStatus==='SUFFICIENT'?'MODERATE':coverageStatus==='PARTIAL'?'LIMITED':'LOW';
    const assessment=coverageStatus==='SUFFICIENT'&&!developments.length?'No new significant development':!developments.length?'Insufficient evidence to assess significant change':'Material developments identified';
    const limitation=coverageStatus==='SUFFICIENT'?'Available reporting and external events were checked; no qualifying change was found.':'One or more collection layers are unavailable or degraded. Findings are shown, but quiet/no-change conclusions have reduced confidence.';
    const officialSnapshot=officialEvents.map(event=>({id:event.eventId||event.id,fingerprint:eventFingerprint(event,now)}));

    return {coverageAssessment,coverageStatus,confidence,assessment,limitation,newsCoverage,liveObservationCoverage,historicalCoverage,externalEventCoverage,relevantStoredNewsEvaluated:news.articles.length,eventStates,events:eventStates,developments,news,triggerWatch,watching:[...situations.filter(s=>s.analyst?.reviewPriority==='REVIEW'||['DEVELOPING','ELEVATED','HIGH'].includes(s.level)),...triggerWatch],snapshot:{t:now,kind,events:eventStates,officialEvents:officialSnapshot,situations:situations.map(s=>({situationId:s.situationId,signalIds:s.signalIds,situationScore:s.situationScore}))}};
  }

  return {eligible,rankNews,selectNews,assessCoverage,build,mergeCandidates,materialEventCandidates};
});
