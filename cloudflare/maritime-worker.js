// NordicWatch Maritime Intelligence v0.7
// Provider-neutral Cloudflare Worker template. NOT deployed or enabled by this repository.
// Required secret: AIS_API_KEY (set with: wrangler secret put AIS_API_KEY)
// Required vars after legal/technical verification: AIS_ENABLED, AIS_PROVIDER_URL, APP_ORIGIN.

const requests=new Map();
let oauthToken={value:null,expiresAt:0};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});
function cors(env,request){
 const origin=request.headers.get("Origin")||"";
 return origin&&origin===env.APP_ORIGIN?{"access-control-allow-origin":origin,"vary":"Origin"}:{};
}
function validBBox(value){
 const p=String(value||"").split(",").map(Number);
 if(p.length!==4||p.some(x=>!Number.isFinite(x)))return null;
 const [west,south,east,north]=p;
 if(west < -12||east > 34.5||south < 53||north > 72.5||west>=east||south>=north)return null;
 if((east-west)*(north-south)>1000)return null;
 return p;
}
function limited(request){
 const ip=request.headers.get("CF-Connecting-IP")||"unknown",now=Date.now(),row=requests.get(ip)||{start:now,count:0};
 if(now-row.start>60000){row.start=now;row.count=0}
 row.count++;requests.set(ip,row);
 for(const [key,value] of requests)if(now-value.start>120000)requests.delete(key);
 return row.count>30;
}
function cleanText(v,n){return String(v??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,n)}
function normalize(raw){
 const lat=Number(raw.lat??raw.latitude??raw.LATITUDE),lon=Number(raw.lon??raw.lng??raw.longitude??raw.LONGITUDE);
 const mmsi=cleanText(raw.mmsi??raw.MMSI,9).replace(/\D/g,"");
 if(!/^\d{9}$/.test(mmsi)||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const timeRaw=raw.timestamp??raw.time??raw.TIMESTAMP??Date.now(),numeric=Number(timeRaw);
 const timestamp=Number.isFinite(numeric)?(numeric<1e12?numeric*1000:numeric):Date.parse(timeRaw);
 return {mmsi,name:cleanText(raw.name??raw.shipname??raw.SHIPNAME??"Unknown vessel",80),lat,lon,
  sog:Number.isFinite(Number(raw.sog??raw.SOG))?Number(raw.sog??raw.SOG):null,
  cog:Number.isFinite(Number(raw.cog??raw.COG))?Number(raw.cog??raw.COG):null,
  heading:Number.isFinite(Number(raw.heading??raw.HEADING))?Number(raw.heading??raw.HEADING):null,
  type:cleanText(raw.type??raw.ship_type??raw.TYPE??"unknown",50),
  timestamp:Number.isFinite(timestamp)?timestamp:Date.now(),quality:"provider-reported"};
}
function extractItems(payload){
 if(Array.isArray(payload))return payload;
 for(const key of ["vessels","ships","positions","data"]){if(Array.isArray(payload?.[key]))return payload[key]}
 return [];
}
function insideBBox(v,bbox){return v.lon>=bbox[0]&&v.lat>=bbox[1]&&v.lon<=bbox[2]&&v.lat<=bbox[3]}
async function barentsWatchToken(env){
 const now=Date.now();if(oauthToken.value&&oauthToken.expiresAt-now>60000)return oauthToken.value;
 if(!env.AIS_CLIENT_ID||!env.AIS_CLIENT_SECRET)throw new Error("barentswatch_credentials_missing");
 const body=new URLSearchParams({client_id:env.AIS_CLIENT_ID,client_secret:env.AIS_CLIENT_SECRET,scope:"ais",grant_type:"client_credentials"});
 const response=await fetch("https://id.barentswatch.no/connect/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
 if(!response.ok)throw new Error("barentswatch_token_failure");
 const data=await response.json();if(!data.access_token)throw new Error("barentswatch_token_missing");
 oauthToken={value:data.access_token,expiresAt:now+Math.max(300,Number(data.expires_in)||3600)*1000};return oauthToken.value
}
async function fetchProvider(env,bbox,signal){
 if(env.AIS_PROVIDER==="barentswatch"){
  const token=await barentsWatchToken(env);
  const response=await fetch("https://live.ais.barentswatch.no/v1/latest/combined",{headers:{Authorization:"Bearer "+token,accept:"application/json"},signal,cf:{cacheTtl:20,cacheEverything:true}});
  return {response,provider:"BarentsWatch",attribution:"Data delivered by BarentsWatch · source: Norwegian Coastal Administration"}
 }
 if(!env.AIS_PROVIDER_URL||!env.AIS_API_KEY)throw new Error("generic_provider_not_configured");
 const upstream=new URL(env.AIS_PROVIDER_URL);upstream.searchParams.set(env.AIS_BBOX_PARAMETER||"bbox",bbox.join(","));
 const authHeader=env.AIS_AUTH_HEADER||"Authorization",authPrefix=env.AIS_AUTH_PREFIX??"Bearer ";
 const response=await fetch(upstream,{headers:{[authHeader]:authPrefix+env.AIS_API_KEY,accept:"application/json"},signal,cf:{cacheTtl:20,cacheEverything:true}});
 return {response,provider:"Configured AIS provider",attribution:cleanText(env.AIS_ATTRIBUTION||"Licensed AIS provider",120)}
}
export default {
 async fetch(request,env,ctx){
  const headers=cors(env,request),url=new URL(request.url);
  if(request.method==="OPTIONS"){
   if(!headers["access-control-allow-origin"])return new Response(null,{status:403});
   return new Response(null,{status:204,headers:{...headers,"access-control-allow-methods":"GET,OPTIONS","access-control-allow-headers":"content-type","access-control-max-age":"86400"}});
  }
  if(request.method!=="GET")return json({error:"method_not_allowed"},405,headers);
  if(url.pathname==="/health")return json({ok:true,aisEnabled:env.AIS_ENABLED==="1",provider:env.AIS_PROVIDER||"generic",providerConfigured:env.AIS_PROVIDER==="barentswatch"?Boolean(env.AIS_CLIENT_ID&&env.AIS_CLIENT_SECRET):Boolean(env.AIS_PROVIDER_URL&&env.AIS_API_KEY),storage:"none"},200,headers);
  if(url.pathname!=="/ais")return json({error:"not_found"},404,headers);
  if(!headers["access-control-allow-origin"])return json({error:"origin_not_allowed"},403,headers);
  if(env.AIS_ENABLED!=="1")return json({error:"ais_not_enabled"},503,headers);
  if(env.AIS_PROVIDER==="barentswatch"&&(!env.AIS_CLIENT_ID||!env.AIS_CLIENT_SECRET))return json({error:"provider_not_configured"},503,headers);
  if(env.AIS_PROVIDER!=="barentswatch"&&(!env.AIS_PROVIDER_URL||!env.AIS_API_KEY))return json({error:"provider_not_configured"},503,headers);
  if(limited(request))return json({error:"rate_limited"},429,{...headers,"retry-after":"60"});
  const bbox=validBBox(url.searchParams.get("bbox"));if(!bbox)return json({error:"invalid_bbox"},400,headers);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  try{
   const upstream=await fetchProvider(env,bbox,ctrl.signal),response=upstream.response;
   if(!response.ok)return json({error:"upstream_failure",status:response.status},502,headers);
   const payload=await response.json(),vessels=extractItems(payload).slice(0,10000).map(normalize).filter(Boolean).filter(v=>insideBBox(v,bbox)).slice(0,5000);
   return json({vessels,meta:{receivedAt:Date.now(),count:vessels.length,provider:upstream.provider,attribution:upstream.attribution,retainedByWorker:false}},200,{...headers,"cache-control":"private, max-age=20"});
  }catch(error){return json({error:error?.name==="AbortError"?"upstream_timeout":"upstream_error"},502,headers)}
  finally{clearTimeout(timer)}
 }
};
