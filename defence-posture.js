(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchPosture=api})(globalThis,function(){
  'use strict';
  const H=3600000;
  const hosts=['government.se','regeringen.se','forsvarsmakten.se','nato.int','gov.pl','puolustusvoimat.fi','forsvaret.no','bundeswehr.de','reuters.com','apnews.com','pap.pl'];
  const countries={Poland:/\bpoland|\bpolish|\bpolen\b/i,Sweden:/\bsweden|\bswedish|\bsverige\b/i,Finland:/\bfinland|\bfinnish\b/i,Norway:/\bnorway|\bnorwegian\b/i,Germany:/\bgermany|\bgerman\b/i,Estonia:/\bestonia|\bestonian\b/i,Latvia:/\blatvia|\blatvian\b/i,Lithuania:/\blithuania|\blithuanian\b/i};
  function classify(raw,{now=Date.now()}={}){
    const url=raw.url||raw.sourceUrl;let host;try{const u=new URL(url);if(u.protocol!=='https:')return null;host=u.hostname.toLowerCase()}catch{return null}
    if(!hosts.some(h=>host===h||host.endsWith('.'+h)))return null;
    const timestamp=+new Date(raw.articlePublishedAt||raw.publishedAt||raw.timestamp||raw.startTime);
    if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>72*H)return null;
    const text=[raw.title,raw.summary||raw.description].join(' ');
    if(/\b(?:may|might|could|considering|proposal|previously announced|from the archives)\b/i.test(text))return null;
    const air=/air defen[cs]e|airspace|air and missile|fighter|gripen|luftförsvar|stridsflyg/i.test(text);
    const procedure=air&&/rules of engagement|engagement authorit|visual identification|positive (?:identification|verification)|air.defen[cs]e procedures/i.test(text)&&/new|chang|lift|remov|quicker|faster|introduc|loosen/i.test(text);
    const deployment=air&&/deploy|begin|start|provide|contribut|forward operating|skickar|bidrar/i.test(text)&&/fighter|gripen|air and missile|air.defen[cs]e|stridsflyg/i.test(text);
    if(!procedure&&!deployment)return null;
    return {id:url.split('#')[0],url,title:String(raw.title||''),timestamp,source:host,captureType:raw.captureType||null,sourceConfidence:/reuters|apnews|pap\.pl/.test(host)?'CONFIRMED_MAJOR_MEDIA':'CONFIRMED_OFFICIAL',regions:Object.entries(countries).filter(([,re])=>re.test(text)).map(([name])=>name),kind:procedure?'ENGAGEMENT_PROCEDURE_CHANGE':'AIR_DEFENCE_DEPLOYMENT'};
  }
  function correlate(reports=[],options={}){
    const signals=[...new Map(reports.map(r=>classify(r,options)).filter(Boolean).map(r=>[r.id,r])).values()],cards=[];
    for(const region of Object.keys(countries)){
      const rows=signals.filter(s=>s.regions.includes(region)),rules=rows.filter(s=>s.kind==='ENGAGEMENT_PROCEDURE_CHANGE'),forces=rows.filter(s=>s.kind==='AIR_DEFENCE_DEPLOYMENT');
      if(!rules.some(a=>forces.some(b=>a.id!==b.id&&Math.abs(a.timestamp-b.timestamp)<=48*H)))continue;
      const evidence=rows.filter(a=>rows.some(b=>a.id!==b.id&&a.kind!==b.kind&&Math.abs(a.timestamp-b.timestamp)<=48*H));
      cards.push({id:'posture-'+region,region,title:region+' — air-defence posture change',confidence:'MEDIUM',evidence,assessment:'Procedural change and fighter support are reported in the same region within 48 hours. This may affect air-defence readiness and decision speed; operational effects remain unverified.',caveat:'National engagement rules are not automatically the rules for allied pilots. No common command decision or hostile intent is established.',watch:['UAV / missile incursions','NATO AEW / tanker activity','Fighter operations and official follow-up']});
    }
    return cards;
  }
  return {classify,correlate};
});
