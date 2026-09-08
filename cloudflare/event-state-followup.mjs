import '../event-state.js';
import '../news-freshness.js';
import originalUAV from '../mock/uav-incidents.json' with {type:'json'};
import verified from '../data/verified-event-followups.json' with {type:'json'};
const E=globalThis.NordicWatchEventState,F=globalThis.NordicWatchFreshness;
// Bounded targeted searches complement ordinary source polling. No ingestion date is evidence time.
export async function reconcileWorkerEvents(env,events,articles,now=Date.now(),sourceScanSucceeded=false){
 const registry=await env.EVENTS.get('event-state:registry','json')||{};
 for(const raw of [...originalUAV.incidents,...events,...articles.filter(a=>globalThis.NordicWatchNewsRouting.safeRelevance(a).relevant)]){const e=E.evidence(raw),matches=e?Object.values(registry).filter(s=>E.related(s.descriptor,e)&&Math.abs(+new Date(e.timestamp)-+new Date(s.firstSeen))<=7*86400000):[],d=matches.length===1?matches[0].descriptor:E.descriptor(raw);if(d.id)registry[d.id]=E.reconcile({...raw,eventId:d.id},registry[d.id],articles,{now,checked:true,checkSucceeded:sourceScanSucceeded,checkMethod:'Scheduled source scan'})}
 for(const raw of originalUAV.incidents){if(now>=+new Date(verified.checkedAt)){const old=registry[raw.id];if(!old.sources.some(s=>s.sourceUrl===verified.reports.at(-1).sourceUrl))registry[raw.id]=E.reconcile(raw,old,verified.reports,{now})}}
 const due=Object.values(registry).filter(s=>s.status!=='RESOLVED'&&(!s.lastTargetedCheck||now-+new Date(s.lastTargetedCheck)>=3600000)).sort((a,b)=>String(a.lastTargetedCheck||'').localeCompare(String(b.lastTargetedCheck||''))).slice(0,1);
 for(const state of due){
  const queries=E.searches(state.descriptor),endpoint=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  endpoint.search=new URLSearchParams({query:queries[0],mode:'ArtList',format:'json',sort:'DateDesc',timespan:'7d',maxrecords:'30'});
  let incoming=[],succeeded=false,error=null;
  try{const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.articles))throw Error('Invalid follow-up response');incoming=data.articles.map(a=>({...a,publishedAt:F.dates(a).timestamp}));succeeded=true}catch(e){error=String(e.message)}
  registry[state.id]={...E.reconcile(state.descriptor,state,incoming,{now,checked:true,checkSucceeded:succeeded,checkMethod:'Targeted search: '+queries[0]}),lastTargetedCheck:new Date(now).toISOString(),followupQueries:queries,lastFollowupError:error};
 }
 await env.EVENTS.put('event-state:registry',JSON.stringify(registry));return registry;
}
