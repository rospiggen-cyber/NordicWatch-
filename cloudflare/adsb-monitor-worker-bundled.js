// NordicWatch v0.7.1 bundled Cloudflare Worker
// Generated from the shared classifier, background monitor core and Worker entrypoint.
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.NordicWatchAircraft=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const BASE=Object.freeze({CIVILIAN:"CIVILIAN",MILITARY:"MILITARY",STATE:"STATE",UNKNOWN:"UNKNOWN"});
  const CONFIDENCE=Object.freeze({CONFIRMED:"CONFIRMED",PROBABLE:"PROBABLE"});
  const ROLE=Object.freeze({AWACS:"AWACS",TANKER:"TANKER",ISR:"ISR",TRANSPORT:"TRANSPORT",FIGHTER:"FIGHTER",OTHER:"OTHER"});
  const GOVERNMENT_ROLE=Object.freeze({COAST_GUARD:"COAST_GUARD"});
  const SWEDISH_COAST_GUARD=Object.freeze({registrations:new Set(["SEMAA","SEMAB","SEMAC"]),callsigns:new Set(["KBV501","KBV502","KBV503"]),hexes:new Set(["4AB421","4AB422","4AB423"])});
  const ROLE_TYPES={
    AWACS:new Set(["E3A","E3B","E3C","E3D","E3F","E7A","E7T","A50"]),
    TANKER:new Set(["KC135","K35R","K35E","KC46","K46A"]),
    ISR:new Set(["RC135","R135","P8","P8A","EP3","IL20","EA37","GLF4","GLEX","CL60"]),
    TRANSPORT:new Set(["C17","C17A","C130","C30J","A400","A400M","C5","C5M","C295","CN35"]),
    FIGHTER:new Set(["F15","F16","F18","F22","F35","JAS39","EUFI","RFAL","SU27","SU30","SU35","MG29","MIG29"])
  };
  const MIL_OPERATOR=/(?:^|\b)(?:AIR FORCE|ARMED FORCES|LUFTWAFFE|FLYGVAPNET|FLYGVAPNET|ROYAL AIR FORCE|USAF|USN|US NAVY|ARMY AVIATION|MARINE CORPS|NATO)(?:\b|$)/i;
  const STATE_OPERATOR=/(?:^|\b)(?:COAST GUARD|POLICE|CUSTOMS|BORDER GUARD|GOVERNMENT|FRONTEX|MARITIME ADMINISTRATION)(?:\b|$)/i;
  const CIVIL_OPERATOR=/(?:^|\b)(?:SAS|SCANDINAVIAN AIRLINES|FINNAIR|LUFTHANSA|RYANAIR|NORWEGIAN|KLM|WIZZ AIR|EASYJET|BRITISH AIRWAYS|AIR FRANCE|DHL|FEDEX|UPS)(?:\b|$)/i;
  const MIL_CALLSIGN=/^(?:NATO|RCH|CNV|RRR|ASCOT|GAF|BAF|IAM|SVF|NOAF|DAF|FAF|PLF|TUAF)[A-Z0-9]*$/;

  const text=(a,keys)=>keys.map(k=>a&&a[k]).find(v=>typeof v==="string"&&v.trim())||"";
  const norm=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const explicitClass=a=>text(a,["aircraftClass","aircraft_class","ownership","service","classification","category"]).toUpperCase();
  const operator=a=>text(a,["operator","operatorName","operator_name","ownOp","owner"]);
  const callsign=a=>norm(text(a,["flight","callsign","callSign"]));
  const registration=a=>norm(text(a,["registration","reg","r"]));
  const hex=a=>norm(text(a,["hex","icao","icao24"]));
  const type=a=>norm(text(a,["t","type","typeCode","icaoType"]));
  const truthy=(a,keys)=>keys.some(k=>a&&a[k]===true);

  function militaryRole(a){
    const t=type(a);
    for(const [role,types] of Object.entries(ROLE_TYPES))if(types.has(t))return role;
    return ROLE.OTHER;
  }
  function isSwedishCoastGuard(a){
    const op=operator(a),reg=registration(a),cs=callsign(a),hx=hex(a),t=type(a),identity=SWEDISH_COAST_GUARD.registrations.has(reg)||SWEDISH_COAST_GUARD.callsigns.has(cs)||SWEDISH_COAST_GUARD.hexes.has(hx);
    return identity||/(?:SWEDISH\s+COAST\s+GUARD|KUSTBEVAKNING)/i.test(op)&&["DH8C","DHC8","DHC8300","Q300"].includes(t)
  }

  function classifyAircraft(a,options={}){
    const evidence=[];
    const cls=explicitClass(a),op=operator(a),cs=callsign(a),t=type(a),hx=hex(a),reg=registration(a);
    if(isSwedishCoastGuard(a))return {base:BASE.STATE,confidence:CONFIDENCE.CONFIRMED,role:null,governmentRole:GOVERNMENT_ROLE.COAST_GUARD,label:"Government / Coast Guard",evidence:[{signal:"swedish-coast-guard-identity",strength:"strong"}]};
    const knownHex=new Set((options.knownMilitaryHex||[]).map(norm));
    const knownReg=new Set((options.knownMilitaryRegistrations||[]).map(norm));
    const explicitMilitary=truthy(a,["military","isMilitary","is_military","knownMilitary","militaryHex","militaryRegistration"])||
      (Number.isInteger(a&&a.dbFlags)&&((a.dbFlags&1)===1))||/\bMILITARY\b/.test(cls);
    if(explicitMilitary)evidence.push({signal:"source-military-identity",strength:"strong"});
    if(hx&&knownHex.has(hx))evidence.push({signal:"known-military-icao",strength:"strong"});
    if(reg&&knownReg.has(reg))evidence.push({signal:"known-military-registration",strength:"strong"});
    if(MIL_OPERATOR.test(op))evidence.push({signal:"military-operator",strength:"strong"});
    if(MIL_CALLSIGN.test(cs))evidence.push({signal:"military-callsign",strength:"weak"});
    if(Object.values(ROLE_TYPES).some(types=>types.has(t)))evidence.push({signal:"military-role-type",strength:"weak"});

    if(evidence.some(x=>x.strength==="strong"))return {base:BASE.MILITARY,confidence:CONFIDENCE.CONFIRMED,role:militaryRole(a),evidence};

    const stateExplicit=truthy(a,["state","isState","is_state"])||/\b(?:STATE|GOVERNMENT)\b/.test(cls)||STATE_OPERATOR.test(op);
    if(stateExplicit)return {base:BASE.STATE,confidence:null,role:null,evidence:[{signal:"state-identity",strength:"strong"}]};
    const civilianExplicit=truthy(a,["civilian","isCivilian","is_civilian"])||/\bCIVILIAN\b/.test(cls)||CIVIL_OPERATOR.test(op);
    if(civilianExplicit)return {base:BASE.CIVILIAN,confidence:null,role:null,evidence:[{signal:"civilian-identity",strength:"strong"}]};

    const weakKinds=new Set(evidence.filter(x=>x.strength==="weak").map(x=>x.signal));
    if(weakKinds.size>=2)return {base:BASE.MILITARY,confidence:CONFIDENCE.PROBABLE,role:militaryRole(a),evidence};
    return {base:BASE.UNKNOWN,confidence:null,role:null,evidence};
  }

  function isMilitaryActivity(result){return result&&result.base===BASE.MILITARY&&(result.confidence===CONFIDENCE.CONFIRMED||result.confidence===CONFIDENCE.PROBABLE)}
  function summarize(aircraft,options){
    const base={CIVILIAN:0,MILITARY:0,STATE:0,UNKNOWN:0},roles={AWACS:0,TANKER:0,ISR:0,TRANSPORT:0,FIGHTER:0,OTHER:0};
    for(const item of aircraft||[]){const result=classifyAircraft(item,options);base[result.base]++;if(isMilitaryActivity(result))roles[result.role]++}
    return {base,roles,military:base.MILITARY,nonMilitary:base.CIVILIAN+base.STATE+base.UNKNOWN,total:(aircraft||[]).length};
  }

  return Object.freeze({BASE,CONFIDENCE,ROLE,GOVERNMENT_ROLE,SWEDISH_COAST_GUARD,classifyAircraft,isMilitaryActivity,isSwedishCoastGuard,summarize});
});

(function(root,factory){
 const api=factory(typeof module!=="undefined"&&module.exports?require("./aircraft-classifier.js"):root.NordicWatchAircraft);
 if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.NordicWatchBackground=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(AC){
 "use strict";
 if(!AC)throw new Error("aircraft classifier required");
 const ZONES=[
  {id:"kaliningrad",name:"Kaliningrad / Baltijsk",lat:54.71,lon:20.51,radiusKm:430},
  {id:"suwalki",name:"Suwałki corridor",lat:54.10,lon:23.20,radiusKm:350},
  {id:"gotland",name:"Gotland",lat:57.47,lon:18.49,radiusKm:350},
  {id:"gulf-finland",name:"Gulf of Finland",lat:59.75,lon:25.50,radiusKm:420},
  {id:"kola",name:"Kola / Murmansk",lat:68.97,lon:33.07,radiusKm:500},
  {id:"leipzig-logistics",name:"Leipzig logistics watch",lat:51.4239,lon:12.2364,radiusKm:180}
 ];
 function km(a,b){const R=6371,r=x=>x*Math.PI/180,dLat=r(b.lat-a.lat),dLon=r(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
 function identity(a){return String(a.hex||(a.flight||"").trim()||a.r||"unknown").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,32)}
 function alertKey(alert,bucketMs=30*60*1000){return [alert.kind,alert.zone.id,alert.role,alert.identities.slice().sort().join("-"),Math.floor(alert.timestamp/bucketMs)].join(":")}
 function analyze(aircraft,now=Date.now(),zones=ZONES){
  const military=(aircraft||[]).map(a=>({aircraft:a,result:AC.classifyAircraft(a)})).filter(x=>AC.isMilitaryActivity(x.result));
  const alerts=[];
  for(const zone of zones){
   const members=military.filter(x=>Number.isFinite(+x.aircraft.lat)&&Number.isFinite(+x.aircraft.lon)&&km({lat:+x.aircraft.lat,lon:+x.aircraft.lon},zone)<=zone.radiusKm);
   const roles=Object.groupBy?Object.groupBy(members,x=>x.result.role):members.reduce((o,x)=>((o[x.result.role]??=[]).push(x),o),{});
   const support=["ISR","FIGHTER","AWACS","TANKER"].filter(r=>roles[r]?.length);
   if(support.length>=3)alerts.push({kind:"support-cluster",level:support.length===4?"FLASH":"ALERT",zone,role:support.join("+"),members,identities:members.map(x=>identity(x.aircraft)),timestamp:now,title:"Military support cluster",detail:support.join(" + ")});
   const transports=roles.TRANSPORT||[];
   if(transports.length>=3)alerts.push({kind:"transport-concentration",level:transports.length>=5?"FLASH":"ALERT",zone,role:"TRANSPORT",members:transports,identities:transports.map(x=>identity(x.aircraft)),timestamp:now,title:"Military transport concentration",detail:transports.length+" positively identified military transports"});
   for(const x of members.filter(x=>x.result.role==="ISR"||x.result.role==="AWACS")){
    alerts.push({kind:"high-interest-aircraft",level:"WATCH",zone,role:x.result.role,members:[x],identities:[identity(x.aircraft)],timestamp:now,title:x.result.role+" observation",detail:x.result.confidence+" military identification"});
   }
  }
  return {militaryCount:military.length,alerts:alerts.map(x=>({...x,key:alertKey(x)}))};
 }
 return Object.freeze({ZONES,km,identity,alertKey,analyze});
});

const AC=globalThis.NordicWatchAircraft,BG=globalThis.NordicWatchBackground;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64=value=>Uint8Array.from(atob(String(value).replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=")),c=>c.charCodeAt(0));
const allowedPushHost=host=>host==="fcm.googleapis.com"||host.endsWith(".push.services.mozilla.com")||host.endsWith(".notify.windows.com")||host.endsWith(".push.apple.com");
const cors=(env,request)=>request.headers.get("Origin")===env.APP_ORIGIN?{"access-control-allow-origin":env.APP_ORIGIN,"access-control-allow-methods":"GET,POST,DELETE,OPTIONS","access-control-allow-headers":"content-type,x-test-token","vary":"Origin"}:{};
const subscriptionKey=async endpoint=>"sub:"+b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(endpoint))));
async function readBody(request,max=8192){if(Number(request.headers.get("content-length")||0)>max)throw new Error("body_too_large");const text=await request.text();if(text.length>max)throw new Error("body_too_large");return JSON.parse(text)}
function validateSubscription(value){try{const u=new URL(value?.endpoint);if(u.protocol!=="https:"||!allowedPushHost(u.hostname))return null;return {endpoint:u.href,createdAt:Date.now()}}catch{return null}}
async function vapidJwt(env,endpoint){
 const audience=new URL(endpoint).origin,now=Math.floor(Date.now()/1000);
 const header=b64url(new TextEncoder().encode(JSON.stringify({typ:"JWT",alg:"ES256"})));
 const payload=b64url(new TextEncoder().encode(JSON.stringify({aud:audience,exp:now+3600,sub:env.VAPID_SUBJECT||"mailto:security@example.invalid"})));
 const key=await crypto.subtle.importKey("pkcs8",unb64(env.VAPID_PRIVATE_KEY),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(header+"."+payload)));
 return header+"."+payload+"."+b64url(sig);
}
async function sendEmptyPush(env,sub){
 const token=await vapidJwt(env,sub.endpoint);
 return fetch(sub.endpoint,{method:"POST",headers:{TTL:"120",Urgency:"high",Authorization:"vapid t="+token+", k="+env.VAPID_PUBLIC_KEY}});
}
async function publish(env,alert){
 const duplicate=await env.ALERT_STATE.get("alert:"+alert.key);if(duplicate)return {sent:0,deduplicated:true};
 await env.ALERT_STATE.put("alert:"+alert.key,JSON.stringify({at:Date.now(),level:alert.level}),{expirationTtl:86400});
 await env.ALERT_STATE.put("latest",JSON.stringify({level:alert.level,title:alert.title,detail:alert.detail,zone:alert.zone.name,at:Date.now()}),{expirationTtl:86400});
 let cursor,sent=0;do{const page=await env.SUBSCRIPTIONS.list({prefix:"sub:",cursor});for(const key of page.keys){const sub=JSON.parse(await env.SUBSCRIPTIONS.get(key.name));try{const response=await sendEmptyPush(env,sub);if(response.status===404||response.status===410)await env.SUBSCRIPTIONS.delete(key.name);else if(response.ok)sent++}catch(error){console.warn("push",error.message)}}cursor=page.list_complete?undefined:page.cursor}while(cursor);
 return {sent,deduplicated:false};
}
async function monitor(env){
 if(env.MONITOR_ENABLED!=="1")return {disabled:true};
 if(!env.ADSB_ENDPOINT_VERIFIED_AT||!env.ADSB_TERMS_VERIFIED_AT)throw new Error("provider_verification_gate");
 const response=await fetch(env.ADSB_ENDPOINT,{headers:{accept:"application/json"},cf:{cacheTtl:0}});if(!response.ok)throw new Error("adsb_http_"+response.status);
 const data=await response.json(),aircraft=(data.ac||data.aircraft||[]).filter(a=>Number.isFinite(+a.lat)&&Number.isFinite(+a.lon));
 const analysis=BG.analyze(aircraft);const published=[];for(const alert of analysis.alerts.filter(x=>x.level==="ALERT"||x.level==="FLASH"))published.push(await publish(env,alert));
 return {militaryCount:analysis.militaryCount,alerts:analysis.alerts.length,published};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),headers=cors(env,request);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(url.pathname==="/health")return json({ok:true,monitorEnabled:env.MONITOR_ENABLED==="1",providerVerified:Boolean(env.ADSB_ENDPOINT_VERIFIED_AT&&env.ADSB_TERMS_VERIFIED_AT),pushConfigured:Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY)},200,headers);
  if(request.headers.get("Origin")!==env.APP_ORIGIN)return json({error:"origin_not_allowed"},403,headers);
  if(url.pathname==="/push/public-key"&&request.method==="GET")return json({publicKey:env.VAPID_PUBLIC_KEY||null},200,headers);
  if(url.pathname==="/push/subscribe"&&request.method==="POST"){try{const sub=validateSubscription(await readBody(request));if(!sub)return json({error:"invalid_subscription"},400,headers);await env.SUBSCRIPTIONS.put(await subscriptionKey(sub.endpoint),JSON.stringify(sub));return json({ok:true},201,headers)}catch{return json({error:"invalid_request"},400,headers)}}
  if(url.pathname==="/push/subscribe"&&request.method==="DELETE"){try{const body=await readBody(request);await env.SUBSCRIPTIONS.delete(await subscriptionKey(body.endpoint));return json({ok:true},200,headers)}catch{return json({error:"invalid_request"},400,headers)}}
  if(url.pathname==="/alerts/latest"&&request.method==="GET")return json(JSON.parse(await env.ALERT_STATE.get("latest")||"null"),200,headers);
  if(url.pathname==="/test/flash"&&request.method==="POST"&&env.MOCK_MODE==="1"&&request.headers.get("x-test-token")===env.TEST_TRIGGER_TOKEN){const alert={key:"mock:"+Math.floor(Date.now()/60000),level:"FLASH",title:"NordicWatch test FLASH",detail:"Mock background notification",zone:{name:"Test zone"}};return json(await publish(env,alert),200,headers)}
  return json({error:"not_found"},404,headers);
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(monitor(env))}
};
export {monitor,validateSubscription};
