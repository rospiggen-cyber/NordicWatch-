/* Dedicated UI/data adapter. Existing hotspot scores and signal archives are read-only here. */
let germanyPatternLayer=null,germanyCurrentSignals=null;
function ingestGermanyRecords(records){
 try{
 const signals=window.NordicWatchGermany.accumulate(germanyCurrentSignals||readArray('NORDICWATCH_GERMANY_INFRASTRUCTURE'),records);germanyCurrentSignals=signals;
 try{localStorage.setItem('NORDICWATCH_GERMANY_INFRASTRUCTURE',JSON.stringify(signals))}catch(e){console.warn('German infrastructure storage unavailable',e)}
 renderGermanyHotspots();
 }catch(e){console.warn('German infrastructure adapter unavailable',e)}
}
function germanyHotspotContent(h){
 return `<p class="desc">Temporary · WATCH · Pattern relevance ${h.patternRelevance} · ${esc(h.confidence)} confidence</p><p class="desc">${esc(h.summary)}</p><p class="desc">Map placement represents the reported area, not an inferred facility position.</p><p class="desc">CIC ${h.cic.score}: coherence ${h.cic.coherence.toFixed(2)} × interaction ${h.cic.interaction.toFixed(2)} × corroboration ${h.cic.corroboration.toFixed(2)}. Independent source groups: ${h.cic.independentGroups}; unknown independence is not corroboration.</p>`+h.signals.map(s=>hotspotSignalMarkup({...s,sourceName:s.source})).join('');
}
function renderGermanyHotspots(){
 try{
 const box=document.getElementById('germanyHotspots');if(!box)return;
 const opened=new Set([...box.querySelectorAll('details[open]')].map(d=>d.dataset.pattern));
 const signals=germanyCurrentSignals||readArray('NORDICWATCH_GERMANY_INFRASTRUCTURE'),hotspots=window.NordicWatchGermany.correlate(signals);
 window.nordicWatchGermanyDiagnostics={signals,hotspots,coverage:window.nordicWatchGermanyCoverage||{status:'NOT_CHECKED'}};
 box.innerHTML=hotspots.map(h=>`<div class="hot"><div><b>${esc(h.name)}</b><details class="hotspot-signals" data-pattern="${esc(h.id)}" ${opened.has(h.id)?'open':''}><summary>${h.signalCount} signals <span class="hotspot-chevron">›</span></summary>${germanyHotspotContent(h)}<button type="button" class="hotspot-signals-close">Close signals</button></details></div></div>`).join('');
 box.querySelectorAll('details').forEach(d=>{const close=()=>{d.open=false;d.querySelector('summary').focus()};d.querySelector('button').onclick=close;d.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();close()}}});
 if(!germanyPatternLayer)germanyPatternLayer=L.layerGroup().addTo(G.hotspots);germanyPatternLayer.clearLayers();
 for(const h of hotspots){if(!h.coordinates)continue;const content=document.createElement('div');content.innerHTML=`<b>${esc(h.name)}</b><details class="hotspot-signals"><summary>${h.signalCount} signals ↓</summary>${germanyHotspotContent(h)}</details>`;
  L.circle([h.coordinates.lat,h.coordinates.lon],{radius:60000,color:'#f7c948',weight:2,dashArray:'5 5',fillOpacity:.06}).bindPopup(content,{maxHeight:340}).addTo(germanyPatternLayer);
 }
 const coverage=window.nordicWatchGermanyCoverage;
 document.getElementById('germanyCoverage').textContent=coverage?`German infrastructure: ${coverage.status.toLowerCase()} coverage · ${coverage.available}/${coverage.total} feeds · ${hotspots.length} temporary patterns`:'German infrastructure: checking coverage…';
 }catch(e){console.warn('German infrastructure display unavailable',e)}
}
async function loadGermanyInfrastructure(){
 const endpoint=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
 endpoint.search=new URLSearchParams({query:'(Germany OR Deutschland OR German OR Kiel OR Rostock OR Lübeck OR Rügen OR Fehmarn OR Greifswald OR Stralsund OR "Schleswig-Holstein" OR "Mecklenburg-Vorpommern") (infrastructure OR Kraftwerk OR Umspannwerk OR Stromnetz OR transformer OR "power plant" OR "power grid" OR telecommunications OR railway OR Bahn OR port OR Hafen OR pipeline OR Seekabel OR "military logistics") (drone OR Drohne OR sabotage OR fire OR Brand OR explosion OR outage OR Stromausfall OR intrusion OR disruption)',mode:'ArtList',maxrecords:'150',format:'json',sort:'DateDesc',timespan:'3d'});
 const results=await Promise.allSettled([fetchJSON(endpoint.href,20000),fetchJSON(eventWorkerBase()+'/germany-infrastructure',12000)]);
 const records=[];let available=0;
 for(const r of results){if(r.status!=='fulfilled')continue;const body=r.value;
  if(Array.isArray(body.articles)){available++;records.push(...body.articles.map(a=>({...a,publishedAt:window.NordicWatchFreshness.dates(a).timestamp})))}
  else if(Array.isArray(body.signals)){if(body.coverage?.status==='HEALTHY')available++;records.push(...body.signals.map(s=>s.originalRecord).filter(Boolean))}
 }
 window.nordicWatchGermanyCoverage={status:available===results.length?'HEALTHY':available?'DEGRADED':'INSUFFICIENT',available,total:results.length,checkedAt:new Date().toISOString(),fetched:records.length};
 ingestGermanyRecords(records);
}
