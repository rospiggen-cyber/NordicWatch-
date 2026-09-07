(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchBrief=api})(globalThis,function(){
  'use strict';
  const H=3600000,F=typeof module==='object'&&module.exports?require('./news-freshness.js'):globalThis.NordicWatchFreshness;
  const at=v=>v==null?NaN:+new Date(v);
  function eligible(a,now=Date.now()){
    if(a.relevance)return a.relevance.relevant===true&&a.briefEligible===true;
    return F.assess(a,now).freshnessResult==='PASS';
  }
  function rankNews(a,situations,now){const match=situations.filter(s=>s.observations.some(o=>o.incidentId===a.eventId||o.id===a.signalId)),correlation=Math.max(0,...match.map(s=>s.situationScore)),age=Math.max(0,(now-at(a.publishedAt||a.ingestedAt))/H),c=a.risk?.components||{};
    const components={geography:(c.geographicRelevance||0)*.2,security:(c.militarySignificance||a.risk?.score||0)*.15,eventScore:(a.risk?.eventScore||a.risk?.score||0)*.2,correlation:correlation*.2,recency:Math.max(0,100-age*100/72)*.15,reliability:(c.sourceConfidence||40)*.1};return {score:Math.round(Object.values(components).reduce((a,b)=>a+b,0)),components};
  }
  function selectNews(articles,{now=Date.now(),situations=[],geographic=()=>true}={}){const fresh=articles.filter(a=>eligible(a,now)),regional=fresh.filter(geographic),byId=new Map();for(const a of regional){const key=a.eventId||a.signalId||a.id||a.url,old=byId.get(key);if(!old||at(a.lastUpdatedAt)>at(old.lastUpdatedAt))byId.set(key,a)}const selected=[...byId.values()].map(a=>({...a,briefRanking:rankNews(a,situations,now)})).sort((a,b)=>b.briefRanking.score-a.briefRanking.score);return {articles:selected,counters:{fetched:articles.length,freshness:fresh.length,geographic:regional.length,dedup:byId.size,selected:selected.length}}}
  function assessCoverage(coverage,counters){
    const hasCoverage=coverage&&typeof coverage==='object',value=Number(coverage?.coverage),status=String(coverage?.status||'').toUpperCase();
    const insufficient=hasCoverage?(status==='INSUFFICIENT'||Number.isFinite(value)&&value<40):counters.fetched===0;
    const degraded=!insufficient&&(hasCoverage?(status==='DEGRADED'||Number.isFinite(value)&&value<70):(counters.fetched>0&&counters.freshness===0));
    return {status:insufficient?'INSUFFICIENT':degraded?'DEGRADED':'HEALTHY',confidence:insufficient?'LOW':degraded?'REDUCED':'NORMAL',coverage:Number.isFinite(value)?value:null,warning:insufficient?'Insufficient news coverage — no evidence of change must not be presented as evidence of no change.':degraded?'News coverage is degraded; reduce confidence in quiet/no-change assessments.':null};
  }
  function build({articles=[],situations=[],signals=[],previous=null,coverage={},now=Date.now(),geographic=()=>true}={}){const news=selectNews(articles,{now,situations,geographic}),coverageAssessment=assessCoverage(coverage,news.counters),developments=[];
    const newsCoverage={articlesAvailable:news.counters.geographic,articlesEvaluated:news.articles.length,status:!news.articles.length?'INSUFFICIENT':coverage?.newsChecked===true?'SUFFICIENT':'PARTIAL'};
    const layer=count=>({count,status:count?'PARTIAL':'INSUFFICIENT'});
    const liveObservationCoverage=layer(signals.filter(s=>!['NEWS','OFFICIAL'].includes(s.domain)&&now-s.timestamp<H&&s.timestamp<=now).length);
    const historicalCoverage=layer(signals.filter(s=>s.timestamp<now-H&&s.timestamp>=now-72*H).length);
    const externalEventCoverage={checked:coverage?.externalChecked===true,status:coverage?.externalChecked===true?'SUFFICIENT':'INSUFFICIENT'};
    const coverageStatus=!news.articles.length?'INSUFFICIENT':newsCoverage.status==='SUFFICIENT'&&externalEventCoverage.checked?'SUFFICIENT':'PARTIAL';
    const confidence=coverageStatus==='SUFFICIENT'?'MODERATE':coverageStatus==='PARTIAL'?'LIMITED':'LOW';
    const assessment=coverageStatus==='SUFFICIENT'?'No new significant development':'Insufficient evidence to assess significant change';
    const limitation=coverageStatus==='SUFFICIENT'?'Available reporting and external events were checked; no qualifying change was found.':'Assessment based primarily on available observations. External reporting coverage is unavailable or insufficient. Current assessment has reduced confidence.';
    const events=news.articles.map(a=>{const id=a.eventId||a.signalId||a.id||a.url,signature=JSON.stringify([a.title,a.description||a.summary,a.lastUpdatedAt]),old=previous?.events?.find(e=>e.id===id);return {id,signature,firstSeen:old?.firstSeen||now,lastUpdated:old?.signature===signature?old.lastUpdated:now,lastChecked:now,sourceCount:new Set(articles.filter(x=>(x.eventId||x.signalId||x.id||x.url)===id).map(x=>x.domain||x.url)).size,status:a.resolved?'resolved':!old?'new':old.signature!==signature?'updated':'developing',changed:!old||old.signature!==signature}});
    for(const old of previous?.events||[])if(!events.some(e=>e.id===old.id))events.push({...old,status:'stale',changed:false,lastChecked:now});
    for(const s of situations.filter(s=>s.observations.length>=2)){const old=previous?.situations?.find(p=>p.situationId===s.situationId),changed=!old||s.signalIds.some(id=>!old.signalIds.includes(id))||Math.abs(s.situationScore-old.situationScore)>=5;
      if(changed)developments.push({id:s.situationId,title:s.title,score:s.situationScore+15,evidence:'AUTOMATIC ASSESSMENT',text:s.summary,situation:s});}
    for(const a of news.articles)if(events.some(e=>e.id===(a.eventId||a.signalId||a.id||a.url)&&e.changed&&e.status!=='resolved')&&!developments.some(d=>d.situation?.observations.some(o=>o.incidentId===a.eventId)))developments.push({id:a.signalId||a.id,title:a.title,score:a.briefRanking.score,evidence:a.evidenceType==='CONFIRMED_EXTERNAL'||/CONFIRMED_OFFICIAL|CONFIRMED_MAJOR_MEDIA/.test(a.risk?.sourceConfidence)?'CONFIRMED EXTERNAL REPORT':'AUTOMATIC ASSESSMENT',text:`${a.domain||'External reporting'} · EventScore ${a.risk?.eventScore||a.risk?.score||0} · ${a.timeStatus||'KNOWN'} publication time`,article:a});
    for(const s of signals.filter(s=>s.timestamp>=(previous?.t||now-24*H)&&s.timestamp<=now&&s.domain!=='NEWS'))if(!developments.some(d=>d.situation?.signalIds.includes(s.id)))developments.push({id:s.id,title:s.title,score:s.eventScore||20,evidence:s.evidence,text:s.domain+' · '+new Date(s.timestamp).toISOString(),signal:s});
    developments.sort((a,b)=>b.score-a.score);return {coverageAssessment,coverageStatus,confidence,assessment,limitation,newsCoverage,liveObservationCoverage,historicalCoverage,externalEventCoverage,relevantStoredNewsEvaluated:news.articles.length,events,developments:developments.slice(0,3),news,watching:situations.filter(s=>['DEVELOPING','ELEVATED','HIGH'].includes(s.level)),snapshot:{t:now,events,situations:situations.map(s=>({situationId:s.situationId,signalIds:s.signalIds,situationScore:s.situationScore}))}};
  }
  return {eligible,rankNews,selectNews,assessCoverage,build};
});
