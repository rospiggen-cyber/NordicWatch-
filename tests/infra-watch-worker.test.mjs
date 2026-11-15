import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/infra-watch-worker.mjs";

test("dedicated Worker scheduled event writes its own KV snapshot and serves live endpoint",async()=>{
  const values=new Map();
  const env={APP_ORIGIN:"https://rospiggen-cyber.github.io",INFRA_WATCH_ENABLED:"true",
    EVENTS:{async get(key,type){const v=values.get(key);return type==="json"&&v?JSON.parse(v):null},
      async put(key,value){values.set(key,value)}}};
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(String(url).includes("gdeltproject.org"))return {ok:false,status:429};
    const isRTBF=String(url).includes("rss.rtbf.be");
    // Keep the fixture inside the collector's freshness window as time advances.
    const recentDate=new Date(Date.now()-60*60000).toUTCString();
    const xml=isRTBF?`<?xml version="1.0"?><rss><channel><item><title>Les frigos touchés par une cyberattaque en Belgique et Suède</title><link>https://www.rtbf.be/article/attack-report</link><pubDate>${recentDate}</pubDate></item></channel></rss>`:'<?xml version="1.0"?><rss><channel></channel></rss>';
    return {ok:true,url:String(url),headers:{get:()=>null},text:async()=>xml};
  };
  try{
    const context={promises:[],waitUntil(p){this.promises.push(p)}};
    await worker.scheduled(null,env,context);
    assert.equal(context.promises.length,1);
    await Promise.all(context.promises);
    const response=await worker.fetch(new Request("https://collector.example/infra-watch",{headers:{Origin:env.APP_ORIGIN}}),env);
    assert.equal(response.status,200);
    const payload=await response.json();
    assert.equal(payload.sourceHealth.status,"PARTIAL");
    assert.equal(payload.diagnostics.sourcesSuccessful,4);
    assert.equal(payload.watch.incidents.length,1);
    assert.equal(payload.watch.incidents[0].scope,"CROSS_BORDER_CONTEXT");
    assert(payload.lastSuccessfulAt);
    const health=await worker.fetch(new Request("https://collector.example/health"),env);
    assert.equal((await health.json()).collectorDegraded,true);
  }finally{globalThis.fetch=originalFetch}
});
