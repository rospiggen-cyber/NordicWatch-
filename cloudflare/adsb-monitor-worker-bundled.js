// NordicWatch v1.1 bundled Cloudflare Worker
// Generated from shared classifier, background core and Worker entrypoint.
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.NordicWatchAircraft=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const BASE=Object.freeze({CIVILIAN:"CIVILIAN",MILITARY:"MILITARY",STATE:"STATE",UNKNOWN:"UNKNOWN"});
  const CONFIDENCE=Object.freeze({CONFIRMED:"CONFIRMED",PROBABLE:"PROBABLE"});
  const ROLE=Object.freeze({AWACS:"AWACS",TANKER:"TANKER",ISR:"ISR",SIGINT:"SIGINT",EW:"EW",ASW:"ASW",MARITIME_PATROL:"MARITIME_PATROL",TRANSPORT:"TRANSPORT",FIGHTER:"FIGHTER",BOMBER:"BOMBER",TRAINER:"TRAINER",HELICOPTER:"HELICOPTER",SPECIAL_MISSION:"SPECIAL_MISSION",OTHER_MILITARY:"OTHER_MILITARY",OTHER:"OTHER",UNKNOWN:"UNKNOWN"});
  const INTEREST_CLASS=Object.freeze({HIGH_VALUE_ISR:"HIGH_VALUE_ISR",HIGH_VALUE_SPECIAL_MISSION:"HIGH_VALUE_SPECIAL_MISSION"});
  const SPECIAL_MISSION_PLATFORMS=Object.freeze([
    {match:/\b(?:RC135S|RC135SCOBRABALL|COBRABALL)\b/,platformFamily:"RC-135",platformVariant:"RC-135S",platformName:"RC-135S COBRA BALL",role:ROLE.ISR,subrole:"MASINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\b(?:RC135U|RC135UCOMBATSENT|COMBATSENT)\b/,platformFamily:"RC-135",platformVariant:"RC-135U",platformName:"RC-135U COMBAT SENT",role:ROLE.ISR,subrole:"ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\b(?:RC135W|R135|RIVETJOINT|BOEINGRC135W|RC135|BOEINGRC135)\b/,platformFamily:"RC-135",platformVariant:"RC-135W",platformName:"RC-135W RIVET JOINT",role:ROLE.ISR,subrole:"SIGINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\bEP3(?:E|C)?\b/,platformFamily:"EP-3",platformVariant:"EP-3E",platformName:"EP-3",role:ROLE.ISR,subrole:"SIGINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\bP8A?\b|\bPOSEIDON\b/,platformFamily:"P-8",platformVariant:"P-8A",platformName:"P-8A POSEIDON",role:ROLE.ASW,subrole:"MARITIME ISR / ASW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bE3[ABCDF]?\b|\bSENTRY\b/,platformFamily:"E-3",platformVariant:"E-3",platformName:"E-3 SENTRY",role:ROLE.AWACS,subrole:"AIRBORNE EARLY WARNING",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/^(?:E7|E7A|E7T|E7WEDGETAIL|BOEINGE7|WEDGETAIL)$/,platformFamily:"E-7",platformVariant:"E-7",platformName:"E-7 WEDGETAIL",role:ROLE.AWACS,subrole:"AIRBORNE EARLY WARNING",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bGLOBALEYE\b|\bS100D\b/,platformFamily:"GlobalEye",platformVariant:"GlobalEye",platformName:"GLOBALEYE",role:ROLE.AWACS,subrole:"AIRBORNE EARLY WARNING / ISR",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bEA37B\b|\bCOMPASSCALL\b/,platformFamily:"EA-37",platformVariant:"EA-37B",platformName:"EA-37B COMPASS CALL",role:ROLE.EW,subrole:"ELECTRONIC WARFARE",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bIL20M?\b/,platformFamily:"IL-20",platformVariant:"IL-20",platformName:"IL-20",role:ROLE.ISR,subrole:"SIGINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\bIL22\b/,platformFamily:"IL-22",platformVariant:"IL-22",platformName:"IL-22",role:ROLE.EW,subrole:"COMMAND / EW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bIL38N?\b/,platformFamily:"IL-38",platformVariant:"IL-38",platformName:"IL-38",role:ROLE.ASW,subrole:"MARITIME ISR / ASW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bTU142M?\b/,platformFamily:"TU-142",platformVariant:"TU-142",platformName:"TU-142",role:ROLE.ASW,subrole:"MARITIME ISR / ASW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION}
  ]);
  const GOVERNMENT_ROLE=Object.freeze({COAST_GUARD:"COAST_GUARD"});
  const SWEDISH_COAST_GUARD=Object.freeze({
    registrations:new Set(["SEMAA","SEMAB","SEMAC"]),
    callsigns:new Set(["KBV501","KBV502","KBV503"]),
    hexes:new Set(["4AB421","4AB422","4AB423"])
  });
  const ROLE_TYPES={
    AWACS:new Set(["E3A","E3B","E3C","E3D","E3F","E7A","E7T","A50"]),
    TANKER:new Set(["KC135","K35R","K35E","KC46","K46A"]),
    ISR:new Set(["RC135","RC135W","R135","EP3","IL20","GLF4","GLEX","CL60"]),
    EW:new Set(["EA37","EA37B","IL22"]),
    ASW:new Set(["P8","P8A","IL38","TU142"]),
    TRANSPORT:new Set(["E121","EMB121","EMB121AA","C17","C17A","C130","C30J","A400","A400M","C5","C5M","C295","CN35"]),
    FIGHTER:new Set(["F15","F16","F18","F22","F35","JAS39","EUFI","RFAL","SU27","SU30","SU35","MG29","MIG29"])
  };
  const MIL_OPERATOR=/(?:^|\b)(?:AIR FORCE|ARMED FORCES|LUFTWAFFE|FLYGVAPNET|FLYGVAPNET|ROYAL AIR FORCE|USAF|USN|US NAVY|FRANCE[ -]+NAVY|FRENCH NAVY|MARINE NATIONALE|ROYAL NAVY|ARMY AVIATION|MARINE CORPS|NATO)(?:\b|$)/i;
  const STATE_OPERATOR=/(?:^|\b)(?:COAST GUARD|POLICE|CUSTOMS|BORDER GUARD|GOVERNMENT|FRONTEX|MARITIME ADMINISTRATION)(?:\b|$)/i;
  const CIVIL_CALLSIGN=/^(?:SAS|FIN|DLH|RYR|NAX|KLM|WZZ|EZY|BAW|AFR)[0-9][A-Z0-9]{1,5}$/;
  const CIVIL_AIRLINER=/^(?:A3(?:18|19|20|21|30|32|33|38|39)|B7(?:37|38|39|44|48|52|63|64|72|73|77|78|88|89)|E(?:170|175|190|195)|BCS[13])$/;
  const CIVIL_OPERATOR=/(?:^|\b)(?:SAS|SCANDINAVIAN AIRLINES|FINNAIR|LUFTHANSA|RYANAIR|NORWEGIAN|KLM|WIZZ AIR|EASYJET|BRITISH AIRWAYS|AIR FRANCE|DHL|FEDEX|UPS)(?:\b|$)/i;
  const MIL_CALLSIGN=/^(?:NATO|CTM|RCH|CNV|RRR|ASCOT|GAF|BAF|IAM|SVF|NOAF|DAF|FAF|PLF|TUAF)[A-Z0-9]*$/;

  const text=(a,keys)=>keys.map(k=>a&&a[k]).find(v=>typeof v==="string"&&v.trim())||"";
  const norm=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const explicitClass=a=>text(a,["aircraftClass","aircraft_class","ownership","service","classification","category"]).toUpperCase();
  const operator=a=>text(a,["operator","operatorName","operator_name","ownOp","owner"]);
  const callsign=a=>norm(text(a,["flight","callsign","callSign"]));
  const registration=a=>norm(text(a,["registration","reg","r"]));
  const hex=a=>norm(text(a,["hex","icao","icao24"]));
  const type=a=>norm(text(a,["t","type","typeCode","icaoType"]));
  const truthy=(a,keys)=>keys.some(k=>a&&a[k]===true);

  function specialMissionPlatform(a){
    const keys=["t","type","typeCode","icaoType","model","aircraftModel","description","desc","flight","callsign","callSign","registration","reg","r","operator","operatorName","operator_name","ownOp","owner","militaryType","militaryMetadata"];
    const values=keys.map(k=>a&&a[k]).filter(v=>typeof v==="string"&&v.trim()).map(norm),t=type(a),cs=callsign(a),op=norm(operator(a)),model=norm(text(a,["model","aircraftModel","description","desc"]));
    if(["CL60","CL650","C650"].includes(t)&&(/ARTEMIS/.test(cs)||/LEIDOS|USARMY|AERIALRECONNAISSANCE/.test(op+model)))return Object.freeze({platformFamily:"Challenger 650",platformVariant:"ARTEMIS II",platformName:"ARTEMIS II CHALLENGER 650",role:ROLE.ISR,subrole:"ISR / SIGINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR,military:true});
    if((t==="S102B"||["GLF4","GIV","G4"].includes(t))&&(/SVF680|KORPEN/.test(cs)||/S102B|SWEDISHARMEDFORCES|SWEDISHAIRFORCE/.test(t+op+model)))return Object.freeze({platformFamily:"S102B",platformVariant:"S102B Korpen",platformName:"S102B KORPEN",role:ROLE.ISR,subrole:"SIGINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR,military:true});
    for(const platform of SPECIAL_MISSION_PLATFORMS)if(values.some(value=>platform.match.test(value)))return Object.freeze({...platform,match:undefined,military:true});
    return null;
  }

  function militaryRole(a){
    const special=specialMissionPlatform(a);if(special)return special.role;
    const t=type(a);
    for(const [role,types] of Object.entries(ROLE_TYPES))if(types.has(t))return role;
    return ROLE.OTHER;
  }

  function isSwedishCoastGuard(a){
    const op=operator(a),reg=registration(a),cs=callsign(a),hx=hex(a),t=type(a);
    const identity=SWEDISH_COAST_GUARD.registrations.has(reg)||SWEDISH_COAST_GUARD.callsigns.has(cs)||SWEDISH_COAST_GUARD.hexes.has(hx);
    const operatorMatch=/(?:SWEDISH\s+COAST\s+GUARD|KUSTBEVAKNING)/i.test(op);
    return identity||(operatorMatch&&["DH8C","DHC8","DHC8300","Q300"].includes(t))
  }

  function classifyAircraft(a,options={}){
    const evidence=[];
    const cls=explicitClass(a),op=operator(a),cs=callsign(a),t=type(a),hx=hex(a),reg=registration(a);
    if(isSwedishCoastGuard(a))return {base:BASE.STATE,confidence:CONFIDENCE.CONFIRMED,role:null,governmentRole:GOVERNMENT_ROLE.COAST_GUARD,label:"Government / Coast Guard",evidence:[{signal:"swedish-coast-guard-identity",strength:"strong"}]};
    const special=specialMissionPlatform(a);
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
    if(special)evidence.push({signal:"known-special-mission-platform",strength:"strong"});

    if(evidence.some(x=>x.strength==="strong"))return {base:BASE.MILITARY,confidence:CONFIDENCE.CONFIRMED,role:militaryRole(a),subrole:special?.subrole||null,platformFamily:special?.platformFamily||null,platformVariant:special?.platformVariant||null,platformName:special?.platformName||null,interestClass:special?.interestClass||null,specialMission:Boolean(special),evidence};

    const stateExplicit=truthy(a,["state","isState","is_state"])||/\b(?:STATE|GOVERNMENT)\b/.test(cls)||STATE_OPERATOR.test(op);
    if(stateExplicit)return {base:BASE.STATE,confidence:null,role:null,evidence:[{signal:"state-identity",strength:"strong"}]};
    const civilianExplicit=truthy(a,["civilian","isCivilian","is_civilian"])||/\bCIVILIAN\b/.test(cls)||CIVIL_OPERATOR.test(op);
    if(civilianExplicit)return {base:BASE.CIVILIAN,confidence:null,role:null,evidence:[{signal:"civilian-identity",strength:"strong"}]};

    if(CIVIL_CALLSIGN.test(cs)&&CIVIL_AIRLINER.test(t))return {base:BASE.CIVILIAN,confidence:CONFIDENCE.PROBABLE,role:null,evidence:[{signal:"airline-callsign-and-airliner-type",strength:"weak"}]};
    const weakKinds=new Set(evidence.filter(x=>x.strength==="weak").map(x=>x.signal));
    if(weakKinds.size>=2)return {base:BASE.MILITARY,confidence:CONFIDENCE.PROBABLE,role:militaryRole(a),evidence};
    return {base:BASE.UNKNOWN,confidence:null,role:null,evidence};
  }

  function isMilitaryActivity(result){return result&&result.base===BASE.MILITARY&&(result.confidence===CONFIDENCE.CONFIRMED||result.confidence===CONFIDENCE.PROBABLE)}
  function summarize(aircraft,options){
    const base={CIVILIAN:0,MILITARY:0,STATE:0,UNKNOWN:0},roles={AWACS:0,TANKER:0,ISR:0,EW:0,ASW:0,TRANSPORT:0,FIGHTER:0,OTHER:0};
    for(const item of aircraft||[]){const result=classifyAircraft(item,options);base[result.base]++;if(isMilitaryActivity(result))roles[Object.hasOwn(roles,result.role)?result.role:"OTHER"]++}
    return {base,roles,military:base.MILITARY,nonMilitary:base.CIVILIAN+base.STATE+base.UNKNOWN,total:(aircraft||[]).length};
  }

  return Object.freeze({BASE,CONFIDENCE,ROLE,INTEREST_CLASS,SPECIAL_MISSION_PLATFORMS,GOVERNMENT_ROLE,SWEDISH_COAST_GUARD,specialMissionPlatform,classifyAircraft,isMilitaryActivity,isSwedishCoastGuard,summarize});
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
