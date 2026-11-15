// Isolated NordicWatch gateway for Fintraffic's CC BY 4.0 public AIS feed.
// Fixed allowlisted endpoints: never a generic fetch proxy, no credentials.
const UPSTREAM="https://meri.digitraffic.fi";
const PATHS=["/api/ais/v1/locations","/api/ais/v1/vessels"];
const DEFAULT_ORIGIN="https://rospiggen-cyber.github.io";
const MAX_BYTES=3*1024*1024;
function headers(env){
  const allowed=env?.APP_ORIGIN||DEFAULT_ORIGIN;
  return {"content-type":"application/json; charset=utf-8","cache-control":"no-store",
    "access-control-allow-origin":allowed,
    "access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"Content-Type",
    "vary":"Origin","x-content-type-options":"nosniff"};
}
function json(value,status,env){return new Response(JSON.stringify(value),{status,headers:headers(env)})}
async function getJson(path,requestFetch){
  const response=await requestFetch(UPSTREAM+path,{
    headers:{"accept":"application/json","accept-encoding":"gzip","Digitraffic-User":"NordicWatch maritime analysis github.com/rospiggen-cyber/NordicWatch-"},
    signal:AbortSignal.timeout(12000),cf:{cacheEverything:true,cacheTtl:60}
  });
  if(!response.ok)throw new Error(`Fintraffic upstream HTTP ${response.status}`);
  const len=Number(response.headers.get("content-length"));
  if(Number.isFinite(len)&&len>MAX_BYTES)throw new Error("Fintraffic payload exceeds size limit");
  const data=await response.text();
  if(new TextEncoder().encode(data).length>MAX_BYTES)throw new Error("Fintraffic payload exceeds size limit");
  return JSON.parse(data);
}
// Cloudflare invokes fetch(request, env, executionContext). In tests, the third
// argument may instead be an injected fetch function.
async function handle(request,env={},ctxOrFetch=fetch){
  const requestFetch=typeof ctxOrFetch==="function"?ctxOrFetch:fetch;
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:headers(env)});
  if(request.method!=="GET")return json({error:"method_not_allowed"},405,env);
  if(url.pathname==="/health")return json({ok:true,provider:"Fintraffic / Digitraffic",configured:true,
    licensedUse:"CC BY 4.0",scope:"Finnish AIS; incomplete terrestrial reception",liveDataChecked:false},200,env);
  if(url.pathname!=="/fintraffic/ais")return json({error:"not_found"},404,env);
  try{
    const [positions,metadata]=await Promise.allSettled(PATHS.map(path=>getJson(path,requestFetch)));
    if(positions.status!=="fulfilled")
      throw new Error("Fintraffic AIS positions: "+String(positions.reason?.message||"request failed").slice(0,75));
    if(positions.value?.type!=="FeatureCollection"||!Array.isArray(positions.value.features))
      throw new Error("Fintraffic AIS positions schema invalid");
    const ships=metadata.status==="fulfilled"&&Array.isArray(metadata.value)?metadata.value:null;
    return json({locations:positions.value,vessels:ships,metadataAvailable:ships!==null,
      provider:"Fintraffic / Digitraffic",license:"CC BY 4.0"},200,env);
  }catch(error){
    return json({error:"fintraffic_unavailable",detail:String(error.message||"upstream error").slice(0,100)},503,env);
  }
}
export default {fetch:handle};
export {handle};
