/* NordicWatch Cascade Lab v0.1: isolated, deterministic, SYNTHETIC scenario engine.
 * Not formal HAZOP/FMEA/LOPA, not a risk prediction, and never connected to live alerts.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.NordicWatchCascadeLab=api;
})(globalThis,function(){
 "use strict";
 const MODELS={
  cyber:{
   id:"cyber",name:"Cyber · Gemensam IT-tjänst",trigger:"En central IT-tjänst stängs av förebyggande",
   description:"Inspirerad av PHP-nyheterna. Alla beroenden och tidsteg nedan är syntetiska; ingen verklig organisations systemkarta används.",
   hazop:"Ingen tillgång till en kritisk tjänst",fmea:"Bortfall av gemensam identitets- eller tjänsteplattform",
   lopa:"Alternativa åtkomstvägar och reservrutiner behöver vara faktiskt oberoende för att kunna räknas som skydd.",
   nodes:[
    {id:"service",name:"Delad IT-tjänst otillgänglig",kind:"trigger"},
    {id:"login",name:"Inloggning påverkas",kind:"technical"},
    {id:"portal",name:"Webbportal otillgänglig",kind:"technical"},
    {id:"teaching",name:"Digital undervisning begränsas",kind:"service"},
    {id:"research",name:"Forskningsarbete fördröjs",kind:"service"},
    {id:"administration",name:"Administrativa ärenden försenas",kind:"impact"}
   ],
   edges:[
    {from:"service",to:"login",delay:1,barrier:"authBackup"},
    {from:"service",to:"portal",delay:1,barrier:"portalBackup"},
    {from:"login",to:"teaching",delay:2,barrier:"offlineCourses"},
    {from:"login",to:"research",delay:4,barrier:"localResearch"},
    {from:"portal",to:"administration",delay:3,barrier:"manualService"}
   ],
   safeguards:[
    {id:"authBackup",name:"Oberoende autentiseringsväg",note:"Antas i demonstrationen skydda inloggning; gemensamt backendberoende skulle göra skyddet otillräckligt."},
    {id:"portalBackup",name:"Separat reservportal",note:"Antas tekniskt oberoende av den ordinarie tjänsten."},
    {id:"offlineCourses",name:"Offline-undervisning",note:"Alternativt arbetssätt för berörd utbildning."},
    {id:"localResearch",name:"Lokal forskningsrutin",note:"Kan minska påverkan för vissa forskningsflöden."},
    {id:"manualService",name:"Manuell ärendehantering",note:"Kan förhindra vissa följdförseningar."}
   ]
  },
  industry:{
   id:"industry",name:"Industri · Pump och process",trigger:"Cirkulationspump stannar",
   description:"Syntetisk processillustration. Ej en faktisk anläggning eller ett underlag för driftbeslut.",
   hazop:"Lågt eller inget flöde",fmea:"Motor-, pump- eller styrfel",
   lopa:"Reservpump, processbegränsningar och oberoende skydd måste provas mot den verkliga anläggningen.",
   nodes:[
    {id:"pump",name:"Cirkulationspump stannar",kind:"trigger"},
    {id:"flow",name:"Flödet faller",kind:"technical"},
    {id:"temperature",name:"Temperaturreglering avviker",kind:"technical"},
    {id:"quality",name:"Möjlig produktkvalitetspåverkan",kind:"service"},
    {id:"batch",name:"Batch kräver bedömning",kind:"service"},
    {id:"schedule",name:"Produktionsplan riskerar försening",kind:"impact"}
   ],
   edges:[
    {from:"pump",to:"flow",delay:1,barrier:"standbyPump"},
    {from:"flow",to:"temperature",delay:1,barrier:"alternateCooling"},
    {from:"temperature",to:"quality",delay:2,barrier:"independentProtectiveAction"},
    {from:"quality",to:"batch",delay:1},
    {from:"batch",to:"schedule",delay:4,barrier:"buffer"}
   ],
   safeguards:[
    {id:"standbyPump",name:"Verifierad reservpump",note:"Antas fungera och automatiskt kunna ta över."},
    {id:"alternateCooling",name:"Oberoende kylväg",note:"Kräver faktisk funktion och tillräcklig kapacitet."},
    {id:"independentProtectiveAction",name:"Oberoende processkydd",note:"Antas förebygga kvalitetsrelaterad påverkan, inte göra ett avvikande batchresultat godkänt."},
    {id:"buffer",name:"Ledig produktionskapacitet",note:"Antas begränsa planeringskonsekvensen."}
   ]
  }
 };
 const MAX_NODES=40,MAX_EDGES=150;
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function get(id){if(!own(MODELS,id))throw Error("Unknown scenario");return MODELS[id]}
 function validate(model){
  if(!model||!Array.isArray(model.nodes)||!Array.isArray(model.edges)||model.nodes.length<1||model.nodes.length>MAX_NODES||model.edges.length>MAX_EDGES)throw Error("Invalid model bounds");
  const ids=new Set(model.nodes.map(n=>n.id)),barriers=new Set((model.safeguards||[]).map(b=>b.id));
  if(ids.size!==model.nodes.length||!ids.has(model.nodes[0].id))throw Error("Invalid node identity");
  for(const edge of model.edges)if(!ids.has(edge.from)||!ids.has(edge.to)||!Number.isFinite(edge.delay)||edge.delay<0||edge.delay>168||(edge.barrier&&!barriers.has(edge.barrier)))throw Error("Invalid graph edge");
  return true;
 }
 function simulate(id,{enabledSafeguards=[],horizon=24}={}){
  const model=get(id);validate(model);
  const allowed=new Set(model.safeguards.map(s=>s.id)),active=new Set(enabledSafeguards.filter(x=>allowed.has(x)));
  const timeLimit=Math.max(0,Math.min(168,Number(horizon)||0)),source=model.nodes[0].id;
  const times=new Map([[source,0]]),previous=new Map(),blocked=[];
  const queue=[{id:source,time:0}];
  // Deterministic earliest-arrival propagation; time and edges are illustrative.
  while(queue.length){
   queue.sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
   const current=queue.shift();if(current.time!==times.get(current.id))continue;
   for(const edge of model.edges.filter(e=>e.from===current.id)){
    if(edge.barrier&&active.has(edge.barrier)){blocked.push({from:edge.from,to:edge.to,barrier:edge.barrier});continue}
    const arrival=current.time+edge.delay;
    if(arrival < (times.get(edge.to)??Infinity)){
     times.set(edge.to,arrival);previous.set(edge.to,edge.from);queue.push({id:edge.to,time:arrival});
    }
   }
  }
  const timeline=model.nodes.map(node=>({
    ...node,hour:times.get(node.id)??null,visible:(times.get(node.id)??Infinity)<=timeLimit,
    possible:times.has(node.id),from:previous.get(node.id)||null,evidence:"SYNTHETIC_MODEL"
  })).sort((a,b)=>(a.hour??Infinity)-(b.hour??Infinity)||a.id.localeCompare(b.id));
  return {id:model.id,name:model.name,horizon:timeLimit,activeSafeguards:[...active],
   timeline,blocked,mode:"SYNTHETIC_ONLY",originalEventDataUsed:false,
   visibleCount:timeline.filter(n=>n.visible&&n.kind!=="trigger").length,
   possibleCount:timeline.filter(n=>n.possible&&n.kind!=="trigger").length};
 }
 function compare(id,enabledSafeguards=[],horizon=24){
  const baseline=simulate(id,{enabledSafeguards:[],horizon}),mitigated=simulate(id,{enabledSafeguards,horizon});
  return {...mitigated,baselineCount:baseline.visibleCount,avoidedCount:Math.max(0,baseline.visibleCount-mitigated.visibleCount)};
 }
 return Object.freeze({SCENARIOS:Object.freeze(MODELS),get,validate,simulate,compare});
});
