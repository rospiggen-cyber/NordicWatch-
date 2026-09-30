(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchRegionalDelta=api})(globalThis,function(){
  'use strict';
  const H=3600000,DAY=24*H;
  const unique=xs=>[...new Set(xs.filter(Boolean))];
  const safeRegion=v=>{const s=String(v||'').trim();return s&&!/^(regional|unknown)$/i.test(s)?s:null};
  const byCount=rows=>Object.entries(rows.reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const dayKey=t=>Math.floor(Number(t)/DAY);
  function regionSituationScore(region,situations=[]){
    const matching=situations.filter(s=>Array.isArray(s.observations)&&s.observations.some(o=>safeRegion(o.region)===region));
    return matching.length?Math.max(...matching.map(s=>Number(s.situationScore)||0)):0;
  }
  function snapshot(signals=[],situations=[],{now=Date.now(),previous=null}={}){
    const usable=signals.filter(s=>s&&Number.isFinite(Number(s.timestamp))&&Number(s.timestamp)<=now&&safeRegion(s.region));
    const regions=unique(usable.map(s=>safeRegion(s.region)));
    const previousMap=new Map((previous?.regions||[]).map(r=>[r.region,r]));
    const rows=regions.map(region=>{
      const all=usable.filter(s=>safeRegion(s.region)===region),current=all.filter(s=>s.timestamp>now-DAY),prior=all.filter(s=>s.timestamp<=now-DAY&&s.timestamp>now-2*DAY),reference=all.filter(s=>s.timestamp<=now-DAY&&s.timestamp>now-7*DAY);
      const referenceDays=unique(reference.map(s=>dayKey(s.timestamp))).length,baselineAvailable=referenceDays>=3,baselineDaily=baselineAvailable?reference.length/6:null;
      const delta24h=current.length-prior.length,ratio=baselineDaily&&baselineDaily>0?current.length/baselineDaily:null;
      const sources=unique(current.map(s=>s.source).filter(x=>x&&x!=='UNKNOWN')),domains=unique(current.map(s=>s.domain)),drivers=byCount(current.map(s=>s.domain)).slice(0,3).map(([domain,count])=>({domain,count}));
      const score=regionSituationScore(region,situations),old=previousMap.get(region),scoreDelta=old&&Number.isFinite(Number(old.situationScore))?score-Number(old.situationScore):null;
      const oldIds=new Set(old?.signalIds||[]),newSinceViewed=current.filter(s=>!oldIds.has(s.id)).map(s=>s.id);
      let direction='STABLE';
      if(delta24h>=2||(ratio!==null&&ratio>=1.5&&current.length>=2)||(scoreDelta!==null&&scoreDelta>=10))direction='UP';
      else if(delta24h<=-2||(ratio!==null&&ratio<=0.5&&prior.length>=2)||(scoreDelta!==null&&scoreDelta<=-10))direction='DOWN';
      let confidence='LOW';if(baselineAvailable&&sources.length>=3&&domains.length>=2)confidence='HIGH';else if(baselineAvailable||sources.length>=2)confidence='MEDIUM';
      const comparison=baselineAvailable?`${current.length} observations / 24 h vs ${prior.length} previous 24 h; 7-day reference avg ${baselineDaily.toFixed(1)}/day.`:`${current.length} observations / 24 h vs ${prior.length} previous 24 h; insufficient historical coverage for a 7-day reference.`;
      return {region,direction,current24h:current.length,previous24h:prior.length,delta24h,baselineAvailable,baselineDaily,baselineRatio:ratio,situationScore:score,situationScoreDelta:scoreDelta,newSinceViewed:newSinceViewed.length,newSignalIds:newSinceViewed,drivers,sourceGroups:sources.length,domains:domains.length,confidence,comparison,coverageNote:'Regional Delta measures observed reporting/sensor activity. Changes in feed coverage can affect counts; direction is not a threat or escalation rating.',signalIds:current.map(s=>s.id)};
    });
    rows.sort((a,b)=>{const weight=x=>x.direction==='UP'?2:x.direction==='DOWN'?1:0;return weight(b)-weight(a)||b.newSinceViewed-a.newSinceViewed||Math.abs(b.delta24h)-Math.abs(a.delta24h)||b.current24h-a.current24h});
    return {generatedAt:now,regions:rows,state:{t:now,regions:rows.map(r=>({region:r.region,signalIds:r.signalIds,situationScore:r.situationScore,current24h:r.current24h}))}};
  }
  return {snapshot};
});
