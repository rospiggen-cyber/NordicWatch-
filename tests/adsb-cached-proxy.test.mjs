import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSnapshot,refreshSnapshot,serveCached,SNAPSHOT_KEY,HEALTH_KEY}
  from "../cloudflare/adsb-cached-proxy.mjs";

const NOW=Date.parse("2026-11-23T12:00:00Z");
class KV {
  map=new Map(); puts=[];
  async get(k,fmt){const value=this.map.get(k);return fmt==="json" && value ? JSON.parse(value) : value ?? null;}
  async put(k,value,options){this.map.set(k,value);this.puts.push({k,options});}
}
function env(overrides={}) {
  return {ADSB_CACHE:new KV(),ADSB_CACHE_ENABLED:"true",
    ADSB_PROVIDER_APPROVED:"true",ADSB_API_KEY:"test-key-not-real",...overrides};
}
function upstream(data, opts={}) {
  return new Response(typeof data==="string"?data:JSON.stringify(data),{
    status:opts.status??200,
    headers:{"content-type":opts.type??"application/json",...opts.headers}
  });
}
const aircraft={ac:[
  {hex:"abc123",lat:59.2,lon:18.1,flight:"TEST01",seen_pos:12,seen:3,t:"P8"},
  {hex:"old",lat:57,lon:19,seen_pos:9000},
  {hex:"elsewhere",lat:42,lon:9,seen_pos:4},
  {hex:"no-pos",flight:"X",seen_pos:5}
],now:1795435200};
const req=(path="/mil",method="GET")=>new Request("https://staging.example"+path,{method});

test("collector is disabled by default, never fetches or writes without approval/key/binding",async()=>{
  for(const e of [env({ADSB_CACHE_ENABLED:"false"}),
    env({ADSB_PROVIDER_APPROVED:"false"}),
    env({ADSB_API_KEY:""}),
    env({ADSB_CACHE:null})]){
    let calls=0;const x=await refreshSnapshot(e,{nowMs:NOW,fetcher:async()=>{calls++;throw Error("not expected")}});
    assert.equal(x.status,"DISABLED_OR_UNAUTHORIZED");
    assert.equal(calls,0);
  }
});
test("source normalization keeps valid Nordic positioned records only",()=>{
  const d=normalizeSnapshot(aircraft,NOW);
  assert.equal(d.sourceTotal,4);
  assert.equal(d.ac.length,1);
  assert.equal(d.ac[0].hex,"abc123");
  assert.equal(d.ac[0].seen_pos,12);
  assert.throws(()=>normalizeSnapshot({aircraft:[]},NOW),/INVALID_SCHEMA/);
});
test("scheduled fetch saves one cached, dated Nordic subset; browser GET makes no upstream requests",async()=>{
  const e=env();let calls=0;
  const fresh=await refreshSnapshot(e,{nowMs:NOW,fetcher:async(url,options)=>{
    calls++;assert.equal(url,"https://api.adsb.lol/v2/mil");
    assert.equal(options.headers["x-api-key"],"test-key-not-real");
    assert.equal(options.redirect,"manual");
    return upstream(aircraft);
  }});
  assert.equal(fresh.status,"OK");assert.equal(fresh.records,1);
  assert.equal(calls,1);
  assert.equal(e.ADSB_CACHE.puts.filter(x=>x.k===SNAPSHOT_KEY).length,1);
  assert.equal(e.ADSB_CACHE.puts.filter(x=>x.k===HEALTH_KEY).length,1);
  const response=await serveCached(req(),e,NOW+120_000);
  assert.equal(response.status,200);
  const parsed=await response.json();
  assert.equal(parsed.source,"adsb.lol");
  assert.equal(parsed.license,"ODbL-1.0");
  assert.equal(parsed.live,false);
  assert.equal(parsed.snapshotAgeSeconds,120);
  assert.equal(parsed.ac[0].seen_pos,132);
  assert.equal(parsed.ac[0].seen,123);
  assert.equal(parsed.total,1);
  assert.equal(calls,1);
  assert.equal(response.headers.get("cache-control"),"no-store");
});
test("stale cached snapshots return 503 and no aircraft, not silently claim live data",async()=>{
  const e=env();await e.ADSB_CACHE.put(SNAPSHOT_KEY,JSON.stringify(normalizeSnapshot(aircraft,NOW)));
  const r=await serveCached(req("/"),e,NOW+601_000);
  assert.equal(r.status,503);
  const data=await r.json();assert.equal(data.status,"STALE_SNAPSHOT");
  assert.deepEqual(data.ac,[]);
});
test("unapproved GET refuses even a previously cached snapshot; no provider call",async()=>{
  const e=env({ADSB_PROVIDER_APPROVED:"false"});
  await e.ADSB_CACHE.put(SNAPSHOT_KEY,JSON.stringify(normalizeSnapshot(aircraft,NOW)));
  const r=await serveCached(req(),e,NOW);
  assert.equal(r.status,503);
  assert.equal((await r.json()).status,"SOURCE_NOT_AUTHORIZED");
});
test("missing snapshot, health, invalid route, invalid method, CORS",async()=>{
  const e=env();
  assert.equal((await serveCached(req(),e,NOW)).status,503);
  const health=await (await serveCached(req("/health"),e,NOW)).json();
  assert.equal(health.snapshotAvailable,false);
  assert.equal(health.configured,true);
  assert.equal((await serveCached(req("/oops"),e,NOW)).status,404);
  assert.equal((await serveCached(req("/mil","POST"),e,NOW)).status,405);
  assert.equal((await serveCached(req("/mil","OPTIONS"),e,NOW)).status,204);
});
test("429 respected with zero retries; snapshots are not overwritten",async()=>{
  const e=env();const previous=normalizeSnapshot(aircraft,NOW-60_000);
  await e.ADSB_CACHE.put(SNAPSHOT_KEY,JSON.stringify(previous));
  let calls=0;
  const x=await refreshSnapshot(e,{nowMs:NOW,fetcher:async()=>{
    calls++;return upstream("{}",{status:429,headers:{"retry-after":"600"}});
  }});
  assert.deepEqual(x,{status:"RATE_LIMITED",httpStatus:429});
  assert.equal(calls,1);
  assert.equal((await e.ADSB_CACHE.get(SNAPSHOT_KEY,"json")).snapshotAt,previous.snapshotAt);
});
test("HTML, broken JSON, missing schema, HTTP 403, redirect and oversize are handled",async()=>{
  const tests=[
    [upstream("<html>no</html>",{type:"text/html"}),"NOT_JSON"],
    [upstream("{"),"INVALID_PAYLOAD"],
    [upstream({foo:[]}),"INVALID_PAYLOAD"],
    [upstream("{}",{status:403}),"UPSTREAM_ERROR"],
    [upstream("{}",{status:301,headers:{location:"https://elsewhere/"}}),"UNEXPECTED_REDIRECT"],
    [upstream("{}",{headers:{"content-length":"7000000"}}),"TOO_LARGE"]
  ];
  for(const [r,expected] of tests){
    const e=env();const outcome=await refreshSnapshot(e,{nowMs:NOW,fetcher:async()=>r});
    assert.equal(outcome.status,expected);
    assert.equal(await e.ADSB_CACHE.get(SNAPSHOT_KEY),null);
  }
});
test("freshly cached aircraft older than max positional window are omitted",async()=>{
  const e=env(),snapshot=normalizeSnapshot(aircraft,NOW);
  await e.ADSB_CACHE.put(SNAPSHOT_KEY,JSON.stringify(snapshot));
  const r=await serveCached(req(),e,NOW+598_000);
  assert.equal(r.status,200);
  assert.equal((await r.json()).ac.length,0);
});
