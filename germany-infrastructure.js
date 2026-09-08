/* Independent German infrastructure evidence layer. Never writes EventScore or legacy signals. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchGermany=api})(globalThis,function(){
 'use strict';
 const HOURS=72,H=3600000;
 const text=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[-–]/g,' ').replace(/\s+/g,' ').trim();
 const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').trim();
 const hash=v=>{let n=2166136261;for(const c of v){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return (n>>>0).toString(36)};
 const http=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
 const iso=v=>v!=null&&v!==''&&Number.isFinite(+new Date(v))?new Date(v).toISOString():null;
 // Approximate place centroids, never presented as an observed facility position.
 const PLACES=[
  ['Kiel','kiel',54.32,10.14,true],['Lübeck','lubeck|luebeck',53.87,10.69,true],['Rostock','rostock|warnemunde|warnemuende',54.09,12.14,true],
  ['Rügen','rugen|ruegen|sassnitz|mukran',54.42,13.43,true],['Fehmarn','fehmarn|puttgarden',54.44,11.19,true],['Greifswald','greifswald|lubmin',54.09,13.39,true],['Stralsund','stralsund',54.31,13.09,true],
  ['Schleswig-Holstein','schleswig holstein',54.22,9.70,true],['Mecklenburg-Vorpommern','mecklenburg vorpommern',53.77,12.58,true],
  ['German Baltic coast','german baltic (?:coast|ports?)|deutsche ostseekuste|deutschen ostseehafen|deutsche ostseehafen',54.2,11.8,true],
  ['Hamburg','hamburg',53.55,10,false],['Berlin','berlin',52.52,13.41,false],['Bremen','bremen|bremerhaven',53.08,8.8,false],
  ['Hanover','hannover|hanover',52.38,9.73,false],['Frankfurt','frankfurt',50.11,8.68,false],['Cologne','cologne|koln|koeln',50.94,6.96,false],
  ['Leipzig','leipzig',51.34,12.37,false],['Dresden','dresden',51.05,13.74,false],['Munich','munich|munchen|muenchen',48.14,11.58,false],
  ['Kaiserslautern','kaiserslautern|ramstein',49.44,7.77,false],['Brunsbüttel','brunsbuttel|brunsbuettel',53.9,9.14,false]
 ];
 const match=(re,t)=>new RegExp('\\b(?:'+re+')\\b').test(t);
 function geography(raw){
  const explicit=text([raw.location?.name||raw.location,raw.areaName,raw.region,JSON.stringify(raw.locations||[])].filter(Boolean).join(' '));
  const content=text([raw.title,raw.description,raw.summary,explicit].filter(Boolean).join(' '));
  const p=PLACES.find(p=>match(p[1],explicit))||PLACES.find(p=>match(p[1],content));
  const country=text(raw.country||raw.location?.country||(Array.isArray(raw.countries)&&raw.countries.length===1?raw.countries[0]:''));
  if(country&&!/^(de|deu|germany|deutschland|german)$/.test(country))return {german:false,directGeographicRelevance:false,location:null,coordinates:null};
  const german=Boolean(p)||/^(de|deu|germany|deutschland|german)$/.test(country)||match('germany|deutschland|german|deutsch(?:e|en|er)',explicit||content);
  const lat=raw.coordinates?.lat??raw.latitude??raw.lat,lon=raw.coordinates?.lon??raw.longitude??raw.lon;
  const supplied=lat!=null&&lon!=null&&Number.isFinite(+lat)&&Number.isFinite(+lon)&&+lat>=47.2&&+lat<=55.1&&+lon>=5.8&&+lon<=15.1;
  return {german,directGeographicRelevance:Boolean(p?.[4]),location:p?.[0]||(german?clean(raw.location?.name||raw.location||raw.areaName)||'Germany — location unspecified':null),coordinates:supplied?{lat:+lat,lon:+lon}:p?{lat:p[2],lon:p[3]}:null,coordinatePrecision:supplied?'SOURCE_REPORTED':p?'PLACE_CENTROID':'UNKNOWN'};
 }
 const INFRA=[['POWER_PLANT','power plant|kraftwerk'],['SUBSTATION','substation|transformer|umspannwerk|transformator'],['POWER_GRID','power grid|electricity grid|electrical grid|stromnetz|stromausfall|power outage'],['ENERGY','energy infrastructure|energieinfrastruktur|lng terminal'],['TELECOM','telecommunications?|telecom|telekommunikation|mobile network|mobilfunk'],['RAIL','rail(?:way)? infrastructure|railway|rail line|rail disruption|rail network|rail traffic|bahn|bahnverkehr|stellwerk|schiene'],['PORT','ports?|harbour|harbor|hafen|hafenanlagen'],['PIPELINE','pipelines?|gasleitung'],['CABLE_LANDING','subsea cable|undersea cable|cable landing|seekabel|kabelanlandung'],['MILITARY_LOGISTICS','military logistics|logistics (?:node|hub|depot)|militarlogistik|military base|naval base|marinebasis|bundeswehr(?: depot)?']];
 const EVENTS=[['DRONE_INCURSION','(?:drone|uav|drohne[n]?).{0,65}(?:sighting|incursion|spotted|seen|sighted|detected|over|near|uber|gesichtet)|(?:sighting|incursion|sighted|detected).{0,35}(?:drone|uav)|drohnensichtung'],['SABOTAGE_REPORT','sabotage|arson|brandstiftung'],['FIRE_EXPLOSION','fire|explosion|exploded|brand|feuer'],['UNAUTHORIZED_ACCESS','unauthori[sz]ed (?:access|entry)|trespass|intrusion|unbefugte[rns]? (?:zutritt|zugang)|eingedrungen'],['OUTAGE','outage|disruption|failure|blackout|stromausfall|ausfall|storung|unterbrechung|lahmgelegt']];
 const routine=/\b(?:scheduled|planned|routine|maintenance|technical fault|equipment failure|storm|lightning|geplant|wartung|technischer defekt|unwetter|blitzschlag)\b/;
 function infrastructureIncidentTerms(raw){const t=text([raw.title,raw.description,raw.summary].join(' '));return INFRA.some(([,re])=>match(re,t))&&EVENTS.some(([,re])=>match(re,t))}
 function detect(raw){
  if(!raw||raw.mock||raw.seed||raw.testOnly)return null;
  if((raw.timeStatus==='TIME_UNCERTAIN'||raw.timestampStatus==='UNKNOWN')&&!raw.eventOccurredAt)return null;
  const geo=geography(raw);if(!geo.german)return null;
  const t=text([raw.title,raw.description,raw.summary].join(' ')),categories=INFRA.filter(([,re])=>match(re,t)).map(([kind])=>kind);
  if(!categories.length)return null;
  const events=EVENTS.filter(([,re])=>match(re,t)).map(([kind])=>kind);
  if(!events.length||/\b(?:exercise scenario|fictional|simulation|planned drone inspection|drone inspection|no (?:drone sightings|incident|outage)|keine drohnen)\b/.test(t))return null;
  if(events.length===1&&events[0]==='SABOTAGE_REPORT'&&!/\b(?:suspect(?:ed|s)?|reported|investigat\w*|attack|attempt|damag\w*|confirmed|verdacht|ermitt\w*|anschlag)\b/.test(t))return null;
  if(/\b(?:warns? of|risk of|threat of|prepares? for|prevention of|schutz vor)\b/.test(t)&&!/\b(?:occurred|reported|detected|sighted|damaged|broke out|gesichtet|beschadigt)\b/.test(t))return null;
  const timestamp=iso(raw.eventOccurredAt||raw.eventTime||raw.publishedAt||raw.articlePublishedAt||raw.timestamp||raw.startTime);
  if(!timestamp)return null; // Fetch/ingestion time must not turn undated reporting into an incident.
  const sourceUrl=http(raw.url)||http(raw.sourceUrl),source=clean(raw.sourceName||raw.source?.name||(typeof raw.source==='string'?raw.source:'')||(sourceUrl?new URL(sourceUrl).hostname:''))||'Source name unavailable';
  const sabotageDenied=/\b(?:no (?:evidence|indication|sign).{0,35}(?:sabotage|arson)|sabotage.{0,25}(?:ruled out|excluded)|keine.{0,30}sabotage)\b/.test(t);
  const sabotage=events.includes('SABOTAGE_REPORT')&&!sabotageDenied;
  if(!sabotage)events.splice(events.indexOf('SABOTAGE_REPORT'),events.includes('SABOTAGE_REPORT')?1:0);
  if(!events.length)return null;
  const cause=sabotage?'SOURCE_REPORTS_SABOTAGE_OR_ARSON':routine.test(t)?'SOURCE_REPORTS_ROUTINE_OR_TECHNICAL_CAUSE':'UNKNOWN';
  const unusual=events.includes('DRONE_INCURSION')||events.includes('UNAUTHORIZED_ACCESS')||sabotage||(!routine.test(t)&&(/\b(?:suspicious|unexplained|unknown cause|cause unknown|under investigation|verdachtig|ungeklart|unbekannt)\b/.test(t)||events.includes('FIRE_EXPLOSION')));
  const canonical=sourceUrl?new URL(sourceUrl):null;if(canonical){canonical.hash='';for(const key of [...canonical.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))canonical.searchParams.delete(key);canonical.searchParams.sort()}
  const id='de-'+hash(canonical?.href||text(raw.title)+'|'+timestamp+'|'+source);
  const explicitIncidentId=raw.incidentId||null;
  // Conservative grouping: one place/day is one incident absent a supplied incident ID.
  // Different descriptions of a plant/transformer/grid failure cannot inflate incident count.
  const incidentId=explicitIncidentId?'de-incident-'+hash(String(explicitIncidentId)):'de-incident-'+hash(geo.location+'|'+timestamp.slice(0,10));
  return {id,incidentId,eventType:events[0],eventTypes:events,title:clean(raw.title)||'Untitled source report',description:clean(raw.description||raw.summary),...geo,timestamp,source,sourceUrl,entities:raw.entities||[],infrastructureType:categories[0],infrastructureTypes:categories,severity:unusual?'ELEVATED':'LOW',confidence:/^(CONFIRMED|CONFIRMED_EXTERNAL|HIGH)$/.test(raw.confidence||'')?'HIGH':'LOW',suspectedCause:cause,causeEvidence:sabotage?clean(raw.title+' '+(raw.description||raw.summary||'')):null,unusual,nearMilitaryLogistics:categories.includes('MILITARY_LOGISTICS'),independenceGroup:clean(raw.independenceGroup||raw.source?.independenceGroup)||null,originalRecord:raw};
 }
 function accumulate(previous,incoming,{now=Date.now()}={}){
  const rows=new Map(previous.map(s=>[s.id,s]));for(const raw of incoming){const s=detect(raw);if(!s)continue;const old=rows.get(s.id);rows.set(s.id,old?{...s,timestamp:old.timestamp,incidentId:old.incidentId}:s)}
  return [...rows.values()].filter(s=>now>=+new Date(s.timestamp)&&now-+new Date(s.timestamp)<=HOURS*H);
 }
 function correlate(signals,{now=Date.now()}={}){
  const current=signals.filter(s=>s.unusual&&now>=+new Date(s.timestamp)&&now-+new Date(s.timestamp)<=HOURS*H).sort((a,b)=>+new Date(a.timestamp)-+new Date(b.timestamp)||a.id.localeCompare(b.id));
  const groups=new Map();for(const s of current){const group=groups.get(s.incidentId)||[];group.push(s);groups.set(s.incidentId,group)}
  const incidents=[...groups.values()],distinct=incidents.map(g=>({...g[0],infrastructureTypes:[...new Set(g.flatMap(s=>s.infrastructureTypes))],eventTypes:[...new Set(g.flatMap(s=>s.eventTypes))],directGeographicRelevance:g.some(s=>s.directGeographicRelevance),nearMilitaryLogistics:g.some(s=>s.nearMilitaryLogistics)}));
  const anchors=distinct.filter(s=>s.directGeographicRelevance||s.nearMilitaryLogistics).sort((a,b)=>(a.location+'|'+a.infrastructureType).localeCompare(b.location+'|'+b.infrastructureType));
  if(distinct.length<3||!anchors.length)return [];
  // Only connected evidence propagates: same category, drone/infrastructure overlap,
  // or simultaneous rail/energy/telecom disruption (within 24h), seeded at a strategic anchor.
  const edge=(a,b)=>{const hours=Math.abs(+new Date(a.timestamp)-+new Date(b.timestamp))/H;const shared=a.infrastructureTypes.filter(c=>b.infrastructureTypes.includes(c));const drone=a.eventTypes.includes('DRONE_INCURSION')||b.eventTypes.includes('DRONE_INCURSION');const disruption=c=>c.infrastructureTypes.some(t=>['RAIL','ENERGY','POWER_GRID','POWER_PLANT','SUBSTATION','TELECOM','PORT','MILITARY_LOGISTICS'].includes(t));return shared.length?`Repeated ${shared.join('/')} incidents within ${HOURS}h`:hours<=24&&(drone||disruption(a)&&disruption(b))?'Infrastructure incidents overlap within 24h'+(drone?' with reported drone activity':''):null};
  const hotspots=[],visited=new Set();
  for(const anchor of anchors){
  if(visited.has(anchor.incidentId))continue;
  const reached=new Map(),reasons=new Map(),queue=[anchor];reached.set(anchor.incidentId,anchor);reasons.set(anchor.incidentId,anchor.directGeographicRelevance?'Direct German Baltic AOI incident':'Source explicitly names military/logistics infrastructure');
  while(queue.length){const a=queue.shift();for(const b of distinct){if(reached.has(b.incidentId))continue;const reason=edge(a,b);if(reason){reached.set(b.incidentId,b);reasons.set(b.incidentId,reason+'; linked to '+a.location);queue.push(b)}}}
  const members=[...reached.values()];members.forEach(s=>visited.add(s.incidentId));if(members.length<3)continue;
  const categories=new Set(members.flatMap(s=>s.infrastructureTypes)),places=new Set(members.map(s=>s.location));
  if(categories.size<2&&places.size<2)continue;
  const evidence=incidents.filter(g=>reached.has(g[0].incidentId)).flat();
  const independent=new Set(evidence.map(s=>s.independenceGroup).filter(Boolean));
  const corroborated=incidents.some(g=>new Set(g.map(s=>s.independenceGroup).filter(Boolean)).size>=2);
  const coherence=Math.min(1,members.length/5),interaction=Math.min(1,(categories.size+(places.size>1?1:0))/4),corroboration=independent.size>=2?Math.min(1,independent.size/3):.25;
  const cic={coherence,interaction,corroboration,score:Math.round(100*coherence*interaction*corroboration),independentGroups:independent.size,independentIncidentCorroboration:corroborated};
  const relevance=Math.min(85,35+members.length*5+(places.size>1?10:0)+(categories.size>1?10:0)+(members.some(s=>s.eventTypes.includes('DRONE_INCURSION'))?5:0)+(corroborated?5:0));
  const coastal=members.filter(s=>s.directGeographicRelevance),name=coastal.length===members.length?'German Baltic coast':categories.size===1&&/POWER|SUBSTATION|ENERGY/.test([...categories][0])?'German power-grid incidents':'Northern Germany infrastructure';
  const points=coastal.filter(s=>s.coordinates);const center=points[0]?.coordinates||anchor.coordinates;
  hotspots.push({id:'de-infrastructure-'+hash(anchor.location+'|'+anchor.infrastructureType),name,temporary:true,windowHours:HOURS,incidentCount:members.length,signalCount:evidence.length,patternRelevance:relevance,level:'WATCH',confidence:corroborated?'MEDIUM':'LOW',cic,coordinates:center,expiresAt:new Date(Math.min(...members.map(s=>+new Date(s.timestamp)))+HOURS*H).toISOString(),directGeographicRelevance:coastal.length>0,correlatedStrategicRelevance:true,signals:evidence.map(s=>({...s,linkedHotspot:name,reason:reasons.get(s.incidentId)+(s.directGeographicRelevance?' · Direct Baltic relevance':' · Correlated strategic relevance')})),summary:`${members.length} distinct unusual incidents in ${HOURS}h; common cause or actor not established.`});
  }
  return hotspots;
 }
 return {HOURS,PLACES,geography,infrastructureIncidentTerms,detect,accumulate,correlate};
});
