/* Dedicated low-volume Civil Infrastructure Watch Worker.
   Intentionally separate from the legacy event-discovery cron (CPU/subrequest limits). */
import {collectInfrastructureWatch,readInfrastructureWatch} from "./infrastructure-watch-collector.mjs";
const headers=origin=>({"content-type":"application/json; charset=utf-8","access-control-allow-origin":origin,"vary":"Origin","x-content-type-options":"nosniff","cache-control":"public, max-age=60"});
const send=(value,status,origin)=>new Response(JSON.stringify(value),{status,headers:headers(origin)});
export default {
  async fetch(request,env){
    const url=new URL(request.url),allowed=String(env.APP_ORIGIN||"https://rospiggen-cyber.github.io"),origin=request.headers.get("Origin")||"";
    if(origin&&origin!==allowed)return send({error:"origin_not_allowed"},403,allowed);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{...headers(allowed),"access-control-allow-methods":"GET, OPTIONS"}});
    if(request.method!=="GET")return send({error:"method_not_allowed"},405,allowed);
    if(url.pathname==="/infra-watch")return send(await readInfrastructureWatch(env),200,allowed);
    if(url.pathname==="/health"){
      const snapshot=await readInfrastructureWatch(env);
      return send({ok:true,enabled:snapshot.enabled,coverage:snapshot.sourceHealth,collectorDegraded:snapshot.degraded,lastAttemptAt:snapshot.lastAttemptAt,lastSuccessfulAt:snapshot.lastSuccessfulAt},200,allowed);
    }
    return send({error:"not_found"},404,allowed);
  },
  async scheduled(_event,env,ctx){
    ctx.waitUntil(collectInfrastructureWatch(env));
  }
};
