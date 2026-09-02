const OFFICIAL_SOURCES = Object.freeze([
  { id: "nato", name: "NATO", hosts: ["nato.int"] },
  { id: "se", name: "Swedish Armed Forces", hosts: ["forsvarsmakten.se"] },
  { id: "fi", name: "Finnish Defence Forces", hosts: ["puolustusvoimat.fi"] },
  { id: "ee", name: "Estonian Defence Forces", hosts: ["mil.ee"] },
  { id: "lv", name: "Latvian National Armed Forces / Ministry of Defence", hosts: ["mil.lv", "mod.gov.lv"] },
  { id: "lt", name: "Lithuanian Armed Forces", hosts: ["kariuomene.lt"] },
  { id: "no", name: "Norwegian Armed Forces", hosts: ["forsvaret.no"] },
  { id: "pl", name: "Polish Ministry of National Defence", hosts: ["gov.pl"] },
  { id: "jef", name: "Joint Expeditionary Force", hosts: ["joint-expeditionary-force.com", "gov.uk"] }
]);
const TYPES = new Set(["military_exercise","deployment","air_policing_activity","readiness_increase","drone_incident","border_incident","naval_exercise","official_defence_announcement"]);
const clean = (value, max = 1000) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cors = origin => ({"content-type":"application/json; charset=utf-8","access-control-allow-origin":origin,"vary":"Origin","cache-control":"public, max-age=300","x-content-type-options":"nosniff"});
const safeOfficialUrl = value => { try { const u = new URL(String(value)); return u.protocol === "https:" && OFFICIAL_SOURCES.some(s => s.hosts.some(h => u.hostname === h || u.hostname.endsWith("." + h))) ? u.href : null; } catch { return null; } };
function normalize(raw) {
  const sourceUrl=safeOfficialUrl(raw?.sourceUrl),start=new Date(raw?.startTime),end=new Date(raw?.endTime),latitude=Number(raw?.latitude),longitude=Number(raw?.longitude),radiusKm=Number(raw?.radiusKm),eventType=clean(raw?.eventType,60).toLowerCase();
  if(!clean(raw?.id,120)||!clean(raw?.title,200)||!TYPES.has(eventType)||!sourceUrl||Number.isNaN(+start)||Number.isNaN(+end)||end<start||!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(radiusKm))return null;
  return {id:clean(raw.id,120),title:clean(raw.title,200),eventType,startTime:start.toISOString(),endTime:end.toISOString(),latitude,longitude,radiusKm:Math.max(1,Math.min(1000,radiusKm)),areaName:clean(raw.areaName,120),countries:(Array.isArray(raw.countries)?raw.countries:[]).map(x=>clean(x,80)).slice(0,30),organisations:(Array.isArray(raw.organisations)?raw.organisations:[]).map(x=>clean(x,80)).slice(0,30),description:clean(raw.description,1200),sourceUrl,sourceName:clean(raw.sourceName,120),confidence:"CONFIRMED",severity:clean(raw.severity,30)||"INFO",expectedActivity:(Array.isArray(raw.expectedActivity)?raw.expectedActivity:[]).map(x=>clean(x,40)).slice(0,20),participants:Number.isFinite(+raw.participants)?Math.max(0,Math.round(+raw.participants)):null,updatedAt:new Date(raw.updatedAt||Date.now()).toISOString()};
}
async function readEvents(env) {
  if(!env.EVENTS)return [];
  const listing=await env.EVENTS.list({prefix:"event:",limit:1000});
  const rows=await Promise.all(listing.keys.map(k=>env.EVENTS.get(k.name,"json")));
  const events=[],ids=new Set(),urls=new Set();
  for(const row of rows){const event=normalize(row);if(!event||ids.has(event.id)||urls.has(event.sourceUrl))continue;ids.add(event.id);urls.add(event.sourceUrl);events.push(event)}
  return events;
}
export default { async fetch(request,env) {
  const url=new URL(request.url),allowed=clean(env.APP_ORIGIN,300),origin=request.headers.get("Origin")||"";
  if(origin&&origin!==allowed)return new Response(JSON.stringify({error:"origin_not_allowed"}),{status:403,headers:cors(allowed)});
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...cors(allowed),"access-control-allow-methods":"GET, OPTIONS"}});
  if(request.method!=="GET"||url.pathname!=="/events")return new Response(JSON.stringify({error:"not_found"}),{status:404,headers:cors(allowed)});
  try{return new Response(JSON.stringify({schemaVersion:"0.8",generatedAt:new Date().toISOString(),events:await readEvents(env),sources:OFFICIAL_SOURCES.map(({id,name})=>({id,name}))}),{headers:cors(allowed)})}
  catch{return new Response(JSON.stringify({schemaVersion:"0.8",generatedAt:new Date().toISOString(),events:[],degraded:true}),{status:200,headers:cors(allowed)})}
}};
