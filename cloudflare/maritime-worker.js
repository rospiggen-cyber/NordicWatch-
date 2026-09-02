// NordicWatch v0.7 Maritime Signals — intentionally disconnected Worker placeholder.
// No provider, endpoint, token exchange or API credential is configured in this file.
// A future licensed source requires a reviewed adapter and a separate deployment decision.

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==="/health")return json({ok:true,maritimeProvider:null,connected:false,storage:"none"});
  return json({error:"maritime_provider_not_configured",connected:false},503);
 }
};
