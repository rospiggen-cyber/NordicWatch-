import {test} from "node:test";
import assert from "node:assert/strict";
import {SNAPSHOT_KEY,collectInfrastructureWatch,readInfrastructureWatch} from "../cloudflare/infrastructure-watch-collector.mjs";

const now=Date.parse("2026-11-02T10:00:00Z");
const records=[
  {title:"ICA frysar hackade i Sverige",url:"https://n1.se/ica",seendate:"20261102T084500Z"},
  {title:"Coop rapporterar driftstörningar i Sverige",url:"https://n2.se/coop",seendate:"20261102T084000Z"},
  {title:"Des frigos Delhaize belges chauffent, cyberattaque ?",url:"https://n3.be/delhaize",seendate:"20261102T081800Z"}
];
function fakeKV(){
  const items=new Map();
  return {items,async get(key,type){const value=items.get(key);return type==="json"&&value?JSON.parse(value):value||null},
    async put(key,value){items.set(key,value)}};
}
function gdelt(list=records){
  return async()=>({ok:true,url:"https://api.gdeltproject.org/api/v2/doc/doc",headers:{get:()=>null},
    text:async()=>JSON.stringify({articles:list})});
}
test("scheduled collection stores only source-linked reports and serves a cross-border WATCH",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  const collected=await collectInfrastructureWatch(env,{now,fetcher:gdelt()});
  assert.equal(collected.coverage.status,"HEALTHY");
  assert.equal(collected.diagnostics.retained,3);
  assert(kv.items.has(SNAPSHOT_KEY));
  const snap=await readInfrastructureWatch(env,now+60_000);
  assert.equal(snap.degraded,false);
  assert.equal(snap.sourceHealth.source.id,"gdelt-doc2");
  assert.equal(snap.watch.incidents.length,3);
  assert(snap.watch.watches.some(w=>w.scope==="CROSS_BORDER"));
  assert(snap.watch.watches.every(w=>w.trace.actor==="UNKNOWN"));
  assert(snap.watch.incidents.every(i=>i.url.startsWith("https://")));
});
test("upstream failure retains evidence but exposes explicit degraded status",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  await collectInfrastructureWatch(env,{now,fetcher:gdelt()});
  const failed=await collectInfrastructureWatch(env,{now:now+15*60_000,fetcher:async()=>{throw Error("upstream unavailable")}});
  assert.equal(failed.coverage.status,"DEGRADED");
  assert.equal(failed.lastSuccessfulAt,new Date(now).toISOString());
  const snap=await readInfrastructureWatch(env,now+16*60_000);
  assert.equal(snap.degraded,true);
  assert.equal(snap.watch.incidents.length,3);
  assert.equal(snap.sourceHealth.status,"DEGRADED");
});
test("staleness and 72-hour expiry are separate from successful polling",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  await collectInfrastructureWatch(env,{now,fetcher:gdelt()});
  assert.equal((await readInfrastructureWatch(env,now+50*60_000)).sourceHealth.status,"STALE");
  const muchLater=await readInfrastructureWatch(env,now+73*60*60_000);
  assert.equal(muchLater.watch.incidents.length,0);
  assert.equal(muchLater.degraded,true);
});
test("empty startup and disabled flag cannot masquerade as live coverage",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  const first=await readInfrastructureWatch(env,now);
  assert.equal(first.sourceHealth.status,"NOT_YET_CHECKED");
  assert.equal(first.degraded,true);
  let called=false;
  const disabled={EVENTS:kv,INFRA_WATCH_ENABLED:"false"};
  await collectInfrastructureWatch(disabled,{now,fetcher:async()=>{called=true;return gdelt()()}});
  assert.equal(called,false);
  assert.equal((await readInfrastructureWatch(disabled,now)).enabled,false);
});
test("reject invalid transport and fail closed on malformed provider data",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  const invalid=[...records,{title:"ICA frysar hackade Sverige",url:"http://bad.se/a",seendate:"20261102T081800Z"}];
  await collectInfrastructureWatch(env,{now,fetcher:gdelt(invalid)});
  assert.equal((await readInfrastructureWatch(env,now)).watch.incidents.length,3);
  const failed=await collectInfrastructureWatch(env,{now:now+15*60_000,fetcher:async()=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({wrong:[]})})});
  assert.equal(failed.coverage.status,"DEGRADED");
});
