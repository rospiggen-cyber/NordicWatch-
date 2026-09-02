import "../aircraft-classifier.js";
import "../background-monitor-core.js";

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
