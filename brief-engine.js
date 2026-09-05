(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchBrief=api})(globalThis,function(){
  'use strict';
  const H=3600000;
  const at=v=>v==null?NaN:+new Date(v);
  function eligible(a,now=Date.now()){
    const published=at(a.publishedAt||a.articlePublishedAt||a.ingestedAt),updated=at(a.lastUpdatedAt),occurrence=at(a.eventTime),age=now-published;
    if(age<0||!Number.isFinite(age))return false;
    const development=a.containsNewDevelopment===true||a.temporal?.containsNewDevelopment===true;
    if(Number.isFinite(occurrence)&&now-occurrence>72*H&&!development&&!a.ongoing)return false;
    return age<24*H||(age<=72*H&&(a.ongoing===true||development&&updated>published&&now-updated<24*H));
  }
  function rankNews(a,situations,now){const match=situations.filter(s=>s.observations.some(o=>o.incidentId===a.eventId||o.id===a.signalId)),correlation=Math.max(0,...match.map(s=>s.situationScore)),age=Math.max(0,(now-at(a.publishedAt||a.ingestedAt))/H),c=a.risk?.components||{};
    const components={geography:(c.geographicRelevance||0)*.2,security:(c.militarySignificance||a.risk?.score||0)*.15,eventScore:(a.risk?.eventScore||a.risk?.score||0)*.2,correlation:correlation*.2,recency:Math.max(0,100-age*100/72)*.15,reliability:(c.sourceConfidence||40)*.1};return {score:Math.round(Object.values(components).reduce((a,b)=>a+b,0)),components};
  }
  function selectNews(articles,{now=Date.now(),situations=[],geographic=()=>true}={}){const fresh=articles.filter(a=>eligible(a,now)),regional=fresh.filter(geographic),byId=new Map();for(const a of regional){const key=a.eventId||a.signalId||a.id,old=byId.get(key);if(!old||at(a.lastUpdatedAt)>at(old.lastUpdatedAt))byId.set(key,a)}const selected=[...byId.values()].map(a=>({...a,briefRanking:rankNews(a,situations,now)})).sort((a,b)=>b.briefRanking.score-a.briefRanking.score);return {articles:selected,counters:{fetched:articles.length,freshness:fresh.length,geographic:regional.length,dedup:byId.size,selected:selected.length}}}
  function build({articles=[],situations=[],signals=[],previous=null,now=Date.now(),geographic=()=>true}={}){const news=selectNews(articles,{now,situations,geographic}),developments=[];
    for(const s of situations.filter(s=>s.observations.length>=2)){const old=previous?.situations?.find(p=>p.situationId===s.situationId),changed=!old||s.signalIds.some(id=>!old.signalIds.includes(id))||Math.abs(s.situationScore-old.situationScore)>=5;
      if(changed)developments.push({id:s.situationId,title:s.title,score:s.situationScore+15,evidence:'AUTOMATIC ASSESSMENT',text:s.summary,situation:s});}
    for(const a of news.articles)if(!developments.some(d=>d.situation?.observations.some(o=>o.incidentId===a.eventId)))developments.push({id:a.signalId||a.id,title:a.title,score:a.briefRanking.score,evidence:/CONFIRMED_OFFICIAL|CONFIRMED_MAJOR_MEDIA/.test(a.risk?.sourceConfidence)?'CONFIRMED EXTERNAL REPORT':'DIRECT OBSERVATION',text:`${a.domain||'External reporting'} · EventScore ${a.risk?.eventScore||a.risk?.score||0} · ${a.timeStatus||'KNOWN'} publication time`,article:a});
    for(const s of signals.filter(s=>s.timestamp>=(previous?.t||now-24*H)&&s.timestamp<=now&&s.domain!=='NEWS'))if(!developments.some(d=>d.situation?.signalIds.includes(s.id)))developments.push({id:s.id,title:s.title,score:s.eventScore||20,evidence:s.evidence,text:s.domain+' · '+new Date(s.timestamp).toISOString(),signal:s});
    developments.sort((a,b)=>b.score-a.score);return {developments:developments.slice(0,3),news,watching:situations.filter(s=>['DEVELOPING','ELEVATED','HIGH'].includes(s.level)),snapshot:{t:now,situations:situations.map(s=>({situationId:s.situationId,signalIds:s.signalIds,situationScore:s.situationScore}))}};
  }
  return {eligible,rankNews,selectNews,build};
});
