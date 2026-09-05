/* Presentation/adapters for the independent situation and brief engines. */
const SX=window.NordicWatchSituations, BX=window.NordicWatchBrief;
let situationClusters=[],situationObservations=[],situationLayer=null,situationRefreshAt=0;
const SITUATION_SIGNALS='NORDICWATCH_SITUATION_SIGNALS',SITUATION_STATE='NORDICWATCH_SITUATION_STATE',SITUATION_ALERTS='NORDICWATCH_SITUATION_ALERTS';
function situationRegion(lat,lon,fallback='Regional'){
  const areas=[{name:'Svalbard / Barentsburg',lat:78.06,lon:14.22,r:600},{name:'Jan Mayen / High North',lat:70.98,lon:-8.46,r:500},{name:'Kola / Murmansk',lat:68.97,lon:33.07,r:600},{name:'Northern Germany',lat:54.1,lon:11,r:280},{name:'Kaliningrad / Baltijsk',lat:54.7,lon:20.5,r:400}];
  return areas.find(a=>SX.km({lat,lon},a)<=a.r)?.name||fallback;
}
function refreshSituations(force=false){
  if(!force&&Date.now()-situationRefreshAt<30000)return;
  situationRefreshAt=Date.now();
  try{
    const incoming=[],now=Date.now();
    for(const a of readArray('NORDICWATCH_SIGNAL_ARCHIVE')){const p=a.risk?.places?.[0];if(!IC.perimeter(a).visible)continue;incoming.push({id:a.signalId||a.id,incidentId:a.eventId,domain:'NEWS',timestamp:a.temporal?.containsNewDevelopment?a.lastUpdatedAt:a.eventTime||a.ingestedAt,lat:p?.lat,lon:p?.lon,region:situationRegion(p?.lat,p?.lon,p?.name),title:a.title,description:a.description,source:a.domain,sourceUrl:a.url,evidence:/CONFIRMED/.test(a.risk?.sourceConfidence)?'CONFIRMED EXTERNAL REPORT':'DIRECT OBSERVATION',quality:a.timeStatus==='TIME_UNCERTAIN'?35:a.risk?.components?.sourceConfidence,eventScore:a.risk?.score,entities:a.entities})}
    for(const e of allEvents){incoming.push({id:'event-'+e.id,incidentId:readArray('NORDICWATCH_SIGNAL_ARCHIVE').find(a=>IC.canonical(a.url)===IC.canonical(e.sourceUrl))?.eventId||e.id,domain:'OFFICIAL',timestamp:e.lastObservedAt||e.temporal?.articlePublishedAt||e.startTime,lat:e.latitude,lon:e.longitude,region:situationRegion(e.latitude,e.longitude,e.areaName),title:e.title,description:e.description,source:new URL(e.sourceUrl).hostname,sourceUrl:e.sourceUrl,evidence:e.confidence==='CONFIRMED'?'CONFIRMED EXTERNAL REPORT':'AUTOMATIC ASSESSMENT',eventScore:e.discovery?.score,quality:e.confidence==='CONFIRMED'?95:50,entities:e.countries,kind:e.eventType})}
    for(const a of rawAircraft.filter(isMilitaryAircraft)){const c=aircraftClass(a),timestamp=now-Math.max(0,+a.seen||0)*1000;incoming.push({id:'aircraft-'+aircraftHex(a),identity:aircraftHex(a),domain:'AVIATION',timestamp,lat:+a.lat,lon:+a.lon,region:situationRegion(+a.lat,+a.lon,nearestZone(a)?.name),title:(c.platformName||a.t||'Aircraft')+' · '+(a.flight||a.r||''),role:c.role,platform:c.platformName||a.t,source:'Public ADS-B',evidence:'DIRECT OBSERVATION',quality:c.confidence==='CONFIRMED'?85:60,eventScore:25})}
    for(const r of maritimeRecords){const b=maritimeEvents.find(e=>e.record===r)?.behavior;incoming.push({id:'ais-'+r.id+'-'+r.timestamp,identity:r.mmsi||r.imo,domain:'AIS',timestamp:r.timestamp,lat:r.lat,lon:r.lon,region:situationRegion(r.lat,r.lon),title:r.title,description:r.description,source:r.source,sourceUrl:r.link||r.source.url,mock:r.source.quality==='mock',evidence:r.evidence==='confirmed'?'CONFIRMED EXTERNAL REPORT':'DIRECT OBSERVATION',quality:r.source.quality==='official'?90:60,eventScore:b?.score||20,kind:b?'Maritime pattern '+b.tags.join(' '):r.type})}
    situationObservations=SX.accumulate(readArray(SITUATION_SIGNALS),incoming);
    // Store the complete accumulated history; the engine alone selects analytical windows.
    localStorage.setItem(SITUATION_SIGNALS,JSON.stringify(situationObservations));
    situationClusters=SX.build(situationObservations,{now,previous:readArray(SITUATION_STATE)});
    localStorage.setItem(SITUATION_STATE,JSON.stringify(situationClusters));const history=maritimeRead('NORDICWATCH_SITUATION_HISTORY',{});for(const s of situationClusters)history[s.situationId]=s;localStorage.setItem('NORDICWATCH_SITUATION_HISTORY',JSON.stringify(history));renderSituations();void notifySituations();
  }catch(error){console.warn('Situation layer unavailable; existing layers remain operational',error)}
}
function renderSituations(){
  const box=document.getElementById('situations');if(!box)return;box.replaceChildren();
  if(!situationLayer)situationLayer=L.layerGroup().addTo(map);situationLayer.clearLayers();
  const visible=situationClusters.filter(s=>s.observations.length>=2);
  if(!visible.length){box.textContent='No developing cluster supported by current observations.';return}
  for(const s of visible.slice(0,8)){const row=document.createElement('button');row.className='situation-card';row.textContent=`${s.level} · SituationScore ${s.situationScore} · ${s.title}`;row.onclick=()=>showSituation(s);const desc=document.createElement('p');desc.className='desc';desc.textContent=s.relationship+' · '+s.summary;row.append(desc);box.append(row);
    if(s.lat!==null){const circle=L.circle([s.lat,s.lon],{radius:90000,color:s.situationScore>=65?'#f7c948':'#61dafb',weight:2,fillOpacity:.035,dashArray:'3 7'});const content=document.createElement('button');content.className='primary';content.textContent=`${s.title} · SituationScore ${s.situationScore} — explain`;content.onclick=()=>showSituation(s);circle.bindPopup(content).addTo(situationLayer)}
  }
}
function openExplanation(title){const drawer=document.getElementById('explanationDrawer');document.getElementById('explanationTitle').textContent=title;const body=document.getElementById('explanationContent');body.replaceChildren();drawer.classList.add('show');return body}
function explanationText(parent,title,value){const block=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=value;block.append(h,p);parent.append(block)}
function showSituation(s){const body=openExplanation(s.title);explanationText(body,`SituationScore ${s.situationScore} · ${s.level}`,`${s.relationship} · confidence ${s.confidence}. ${s.summary}`);
  explanationText(body,'Why these observations were connected',s.links.map(p=>`${p.a} ↔ ${p.b}: ${p.reason}; ${p.distanceKm??'unknown'} km / ${p.hours} h`).join('\n'));
  explanationText(body,'Score contributions',Object.entries(s.components).map(([k,v])=>`${k}: ${v.toFixed(1)}`).join(' · ')+'. Final score is capped for isolated, single-source or routine surveillance evidence.');
  explanationText(body,'Baseline → deviation → CIC',`${s.baseline.status} · ${s.baseline.sampleDays} reference days · deviation ${s.baseline.deviation.toFixed(0)}. Coherence ${s.cic.coherence.toFixed(2)} × Interaction ${s.cic.interaction.toFixed(2)} × Corroboration ${s.cic.corroboration.toFixed(2)} = ${s.cic.score}/100.`);
  explanationText(body,'Acceleration',`${s.acceleration.recent6h} observations in the last 6 h; ${s.acceleration.previous6h} in the previous 6 h. Observation frequency depends on feed coverage.`);
  if(s.case)explanationText(body,'Separate escalation dimensions',`Legal/economic: ${s.escalation.legalEconomic}; diplomatic: ${s.escalation.diplomatic}; information/political: ${s.escalation.informationPolitical}; military signalling score ${s.escalation.militarySignallingScore}; confirmed military escalation: ${s.escalation.confirmedMilitaryEscalation}. SituationScore is not a military escalation score.`);
  for(const o of s.observations){const item=document.createElement('article');item.className='evidence-record';explanationText(item,o.evidence,`${o.title}\n${o.domain} · ${new Date(o.timestamp).toISOString()} · ${o.source}\n${o.id}`);if(o.sourceUrl){const a=document.createElement('a');a.href=o.sourceUrl;a.textContent='Open source';a.target='_blank';a.rel='noopener noreferrer';item.append(a)}body.append(item)}
}
function showEventExplanation(event){const body=openExplanation(event.title);explanationText(body,'EventScore',String(event.risk?.eventScore??event.eventScore??event.discovery?.score??'Not scored'));explanationText(body,'Automatic assessment',event.risk?.why?.join(' · ')||event.discovery?.scoreExplanation||'No scored assessment supplied');explanationText(body,'Contributions',JSON.stringify(event.risk?.components||event.discovery?.scoreReasons||{},null,2));explanationText(body,'Source observation',`${event.description||event.title} · ${event.publishedAt||event.lastObservedAt||event.startTime||'Time uncertain'}`);const source=event.url||event.sourceUrl;if(source&&/^https:\/\//.test(source)){const a=document.createElement('a');a.href=source;a.textContent='Open source evidence';a.target='_blank';a.rel='noopener noreferrer';body.append(a)}}
async function notifySituations(){
  if(localStorage.getItem('NORDICWATCH_ALERTS_ENABLED')!=='1'&&localStorage.getItem(ALERT_KEY)!=='1')return;
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const run=async()=>{const ledger=maritimeRead(SITUATION_ALERTS,{});for(const s of situationClusters){const decision=SX.alert(s,ledger[s.situationId]);if(!decision.shouldNotify)continue;const options={body:s.relationship+' · '+s.summary,tag:s.situationId,data:{url:'?situation='+encodeURIComponent(s.situationId)},icon:'icon-192.png',badge:'icon-192.png'};try{if(swReg)await swReg.showNotification(`NordicWatch Situation · ${s.level}`,options);else new Notification(`NordicWatch Situation · ${s.level}`,options);ledger[s.situationId]={...decision.record,firstNotifiedAt:ledger[s.situationId]?.firstNotifiedAt||Date.now(),lastNotifiedAt:Date.now(),notificationFingerprint:decision.fingerprint};localStorage.setItem(SITUATION_ALERTS,JSON.stringify(ledger))}catch(error){console.warn('Situation notification failed',error)}}};
  if(navigator.locks)await navigator.locks.request('nordicwatch-situation-alerts',run);else await run();
}
function generateBrief(kind){
  refreshSituations(true);const previous=maritimeRead('NORDICWATCH_BRIEF_V2',null),brief=BX.build({articles:readArray('NORDICWATCH_SIGNAL_ARCHIVE'),situations:situationClusters,signals:situationObservations,previous,geographic:a=>IC.perimeter(a).visible});
  generateBriefLiveDetails(kind);const content=document.getElementById('briefContent'),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Current coverage, live observations and legacy brief detail';details.append(summary);while(content.firstChild)details.append(content.firstChild);content.append(details);
  const top=document.createElement('section');const heading=document.createElement('h3');heading.textContent='Daily Brief 2.0 · top developments';top.append(heading);
  for(const d of brief.developments){const row=briefItem(d.evidence==='CONFIRMED EXTERNAL REPORT'?'external':d.evidence==='DIRECT OBSERVATION'?'obs':'infer',d.title,d.text,{label:'Explain evidence',run:()=>d.situation?showSituation(d.situation):showEventExplanation(d.article||d.signal)});top.append(row)}
  if(!brief.developments.length)explanationText(top,'No new significant development','Stored observations were evaluated; no qualifying change is supported.');
  const news=document.createElement('details'),label=document.createElement('summary');label.textContent=`Relevant stored news evaluated: ${brief.news.articles.length}`;news.append(label);for(const a of brief.news.articles)news.append(briefItem(/CONFIRMED/.test(a.risk?.sourceConfidence)?'external':'obs',a.title,`Brief ranking ${a.briefRanking.score} · ${a.publishedAt||a.ingestedAt}`,{label:'Explain EventScore',run:()=>showEventExplanation(a)}));top.append(news);
  explanationText(top,'What NordicWatch is watching',brief.watching.map(s=>`${s.title}: ${s.level}. Watch for further independent observations, frequency changes and corroboration.`).join('\n')||'Further independent signals and deviations from regional baseline.');
  content.prepend(top);localStorage.setItem('NORDICWATCH_BRIEF_V2',JSON.stringify(brief.snapshot));
}
function initSituationUI(){
  document.getElementById('explanationClose').onclick=()=>document.getElementById('explanationDrawer').classList.remove('show');
  document.getElementById('explanationDrawer').onclick=e=>{if(e.target.id==='explanationDrawer')e.currentTarget.classList.remove('show')};
  document.getElementById('mobileIntel').onclick=()=>document.querySelector('.side').classList.add('mobile-open');
  document.getElementById('mobileIntelClose').onclick=()=>document.querySelector('.side').classList.remove('mobile-open');
  document.getElementById('importSituation').onclick=()=>document.getElementById('situationFile').click();
  document.getElementById('situationFile').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('Maximum file size is 2 MiB');const result=SX.importSignals(JSON.parse(await file.text()));localStorage.setItem(SITUATION_SIGNALS,JSON.stringify(SX.accumulate(readArray(SITUATION_SIGNALS),result.accepted)));document.getElementById('situationImportStatus').textContent=`${result.accepted.length} accepted · ${result.rejected.length} rejected`;refreshSituations(true)}catch(error){document.getElementById('situationImportStatus').textContent=error.message}finally{e.target.value=''}};
  document.addEventListener('click',e=>{const button=e.target.closest('[data-explain-event]');if(button){const event=allEvents.find(x=>x.id===button.dataset.explainEvent);if(event)showEventExplanation(event)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.drawer.show').forEach(x=>x.classList.remove('show'));document.querySelector('.side').classList.remove('mobile-open')}});
  refreshSituations(true);const id=new URLSearchParams(location.search).get('situation');if(id){const s=situationClusters.find(s=>s.situationId===id);if(s)showSituation(s)}
}
