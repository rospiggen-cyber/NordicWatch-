/* One persistent lifecycle registry shared by news, events and physical UAV records. */
let eventStateRegistry=null;
function eventStates(){if(!eventStateRegistry){try{eventStateRegistry=JSON.parse(localStorage.getItem('NORDICWATCH_EVENT_STATES')||'{}')}catch{eventStateRegistry={}}}return eventStateRegistry}
function saveEventStates(){try{localStorage.setItem('NORDICWATCH_EVENT_STATES',JSON.stringify(eventStates()))}catch(e){console.warn('Event state persistence unavailable',e)}}
function stateFor(raw){const states=eventStates(),id=raw.eventId||raw.id||raw.signalId;if(states[id])return states[id];const canonical=window.NordicWatchEventState.canonical(raw.url||raw.sourceUrl);return canonical?Object.values(states).find(s=>s.sources.some(e=>window.NordicWatchEventState.canonical(e.sourceUrl)===canonical)):null}
function eventStateActive(raw){return stateFor(raw)?.active!==false}
function registerEventState(raw){
 const E=window.NordicWatchEventState,e=E.evidence(raw),candidates=e?Object.values(eventStates()).filter(s=>E.related(s.descriptor,e)&&Math.abs(+new Date(e.timestamp)-+new Date(s.firstSeen))<=7*86400000):[];
 const local=stateFor(raw)||(candidates.length===1?candidates[0]:null),remote=raw.eventState;
 const old=remote&&Array.isArray(remote.sources)&&String(remote.lastChecked||'')>String(local?.lastChecked||'')?remote:local||remote,d=old?.descriptor||E.descriptor(raw);if(!d.id)return null;
 const next=E.reconcile({...raw,eventId:d.id},old);eventStates()[d.id]=next;return next;
}
function reconcileStoredEvents(incoming=[],options={}){
 const E=window.NordicWatchEventState,states=eventStates();
 for(const [id,old] of Object.entries(states))states[id]=E.reconcile({...old.descriptor},old,incoming,options);
 saveEventStates();renderEventStateHistory();
}
function eventTimelineMarkup(s){return `<div class="desc">⚪ <b>${esc(s.status)}</b> · Last updated: ${esc(s.lastUpdated||'Unknown')}<br>Last checked: ${esc(s.lastChecked||'Not checked')}<br>${esc(s.latestAssessment)}</div><details class="hotspot-signals"><summary>${new Set(s.sources.map(x=>x.sourceUrl)).size} sources · View timeline ›</summary>${s.sources.map(e=>`<article class="hotspot-evidence"><time>${esc(e.timePrecision==='DATE'?e.updated.slice(0,10)+' (stored date; exact time unknown)':e.updated)}</time><b>${esc(e.title)}</b><p>${esc(e.description)}</p><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(e.source)} · View source ↗</a></article>`).join('')}<p class="desc">${s.checks.length} follow-up checks. ${s.lastSuccessfulCheck?'Last successful check: '+esc(s.lastSuccessfulCheck):'No successful follow-up check recorded.'}</p><button type="button" class="hotspot-signals-close">Close timeline</button></details>`}
function renderEventStateHistory(){const box=document.getElementById('eventStateHistory');if(!box)return;const opened=new Set([...box.querySelectorAll('details[open]')].map(x=>x.closest('[data-state-id]')?.dataset.stateId));const states=Object.values(eventStates()).sort((a,b)=>String(b.lastUpdated).localeCompare(String(a.lastUpdated)));const signature=JSON.stringify(states);if(box.dataset.signature===signature)return;box.dataset.signature=signature;box.innerHTML=states.map(s=>`<article class="signal" data-state-id="${esc(s.id)}"><b>${esc(s.descriptor.title)}</b>${eventTimelineMarkup(s)}</article>`).join('');box.querySelectorAll('[data-state-id]').forEach(row=>{const details=row.querySelector('details');if(opened.has(row.dataset.stateId))details.open=true;const close=()=>{details.open=false;details.querySelector('summary').focus()};row.querySelector('button').onclick=close;details.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();close()}}});}
async function loadEventReconciliation(){
 try{const evidence=await fetchJSON('data/verified-event-followups.json',5000);for(const raw of uavIncidents)registerEventState(raw);reconcileStoredEvents(evidence.reports,{now:+new Date(evidence.checkedAt),checked:true,checkSucceeded:true,checkMethod:evidence.checkMethod});}catch(e){console.warn('Verified follow-up history unavailable',e)}
 reconcileStoredEvents();renderUAVIncidents();updateActivityScore();
 await checkEventFollowups();
}
async function checkEventFollowups(){
 try{const body=await fetchJSON(eventWorkerBase()+'/event-states',15000);if(!Array.isArray(body.states))throw Error('Event reconciliation feed unavailable');
  for(const remote of body.states){const old=eventStates()[remote.id];if(!old||String(remote.lastChecked||'')>String(old.lastChecked||'')){const merged=window.NordicWatchEventState.reconcile(remote.descriptor,old,remote.sources.map(s=>({sourceUrl:s.sourceUrl,sourceName:s.source,title:s.title,description:s.description,publishedAt:s.timestamp,sourceUpdatedAt:s.updated,timePrecision:s.timePrecision,linkedEventId:remote.id})),{now:Date.now()});eventStates()[remote.id]={...merged,lastChecked:remote.lastChecked,lastSuccessfulCheck:remote.lastSuccessfulCheck,checks:[...(old?.checks||[]),...(remote.checks||[])]}}}
 }catch(e){console.warn('Event follow-up service unavailable; last successful check retained',e);reconcileStoredEvents([],{checked:true,checkSucceeded:false,checkMethod:'Follow-up service unavailable: '+String(e.message)})}
 reconcileStoredEvents();renderUAVIncidents();renderEvents();renderNews(currentArticles.filter(eventStateActive));updateActivityScore();
}
