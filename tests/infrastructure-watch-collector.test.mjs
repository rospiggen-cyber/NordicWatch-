import {test} from "node:test";
import assert from "node:assert/strict";
import {SNAPSHOT_KEY,FEEDS,parseSyndication,collectInfrastructureWatch,readInfrastructureWatch} from "../cloudflare/infrastructure-watch-collector.mjs";

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
  const collected=await collectInfrastructureWatch(env,{feeds:[],now,fetcher:gdelt()});
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
  await collectInfrastructureWatch(env,{feeds:[],now,fetcher:gdelt()});
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
  await collectInfrastructureWatch(env,{feeds:[],now,fetcher:gdelt()});
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
  await collectInfrastructureWatch(disabled,{feeds:[],now,fetcher:async()=>{called=true;return gdelt()()}});
  assert.equal(called,false);
  assert.equal((await readInfrastructureWatch(disabled,now)).enabled,false);
});
test("reject invalid transport and fail closed on malformed provider data",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  const invalid=[...records,{title:"ICA frysar hackade Sverige",url:"http://bad.se/a",seendate:"20261102T081800Z"}];
  await collectInfrastructureWatch(env,{feeds:[],now,fetcher:gdelt(invalid)});
  assert.equal((await readInfrastructureWatch(env,now)).watch.incidents.length,3);
  const failed=await collectInfrastructureWatch(env,{now:now+15*60_000,fetcher:async()=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({wrong:[]})})});
  assert.equal(failed.coverage.status,"DEGRADED");
});

test("broadcast RSS recovers usable monitoring while GDELT rate-limits",async()=>{
  const kv=fakeKV(),env={EVENTS:kv,INFRA_WATCH_ENABLED:"true"};
  const feed=FEEDS.find(f=>f.id==="rtbf");
  const xml='<?xml version="1.0"?><rss><channel><item><title>Les frigos de supermarchés touchés par une cyberattaque en Belgique et Suède</title><link>https://www.rtbf.be/article/frigos-cyberattaque</link><description>Belgique et Suède : signalements de froid perturbé</description><pubDate>Mon, 02 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>';
  let gdeltCalls=0,feedCalls=0;
  const fetcher=async url=>{
    if(url.includes("gdeltproject.org")){gdeltCalls++;return {ok:false,status:429}}
    feedCalls++;return {ok:true,url:feed.url,headers:{get:()=>null},text:async()=>xml};
  };
  const first=await collectInfrastructureWatch(env,{now,feeds:[feed],fetcher});
  assert.equal(first.coverage.status,"PARTIAL");
  assert.equal(first.diagnostics.sourcesSuccessful,1);
  assert.equal(first.diagnostics.retained,1);
  assert(Date.parse(first.gdeltBackoffUntil)>now+60*60_000);
  const snap=await readInfrastructureWatch(env,now+1000);
  assert.equal(snap.degraded,true);
  assert.equal(snap.sourceHealth.status,"PARTIAL");
  assert.equal(snap.watch.incidents[0].scope,"CROSS_BORDER_CONTEXT");
  assert.equal(snap.watch.incidents[0].country,"Cross-border report");
  assert.equal(gdeltCalls,1);
  await collectInfrastructureWatch(env,{now:now+15*60_000,feeds:[feed],fetcher});
  assert.equal(gdeltCalls,1,"GDELT requests are paused during retry backoff");
  assert.equal(feedCalls,2);
});
test("RSS and Atom parsing only accept HTTPS article links from the declared publisher",()=>{
  const rtbf=FEEDS.find(f=>f.id==="rtbf");
  const rss='<?xml version="1.0"?><rss><channel><item><title><![CDATA[Delhaize frigos hackés Belgique]]></title><link>https://www.rtbf.be/article/test</link><pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate></item><item><title>Bad host</title><link>https://evil.example/t</link><pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>';
  const parsed=parseSyndication(rss,rtbf);
  assert.equal(parsed.length,1);
  assert.match(parsed[0].title,/Delhaize/);
  const sr=FEEDS.find(f=>f.id==="sr-ekot");
  const atom='<?xml version="1.0"?><feed><entry><title type="text">Coop frysar hackade i Sverige</title><link rel="alternate" href="https://www.sverigesradio.se/artikel/coop"/><published>2026-11-02T08:00:00Z</published></entry></feed>';
  assert.equal(parseSyndication(atom,sr)[0].url,"https://www.sverigesradio.se/artikel/coop");
});
