import test from "node:test";
import assert from "node:assert/strict";
import {handle} from "../cloudflare/maritime-worker.js";
const origin="https://rospiggen-cyber.github.io";
const req=(path,method="GET")=>new Request("https://nordicwatch-maritime.example"+path,{method,headers:{origin}});
const locations={type:"FeatureCollection",dataUpdatedTime:"2026-11-15T12:00:00Z",features:[]};
const ships=[{mmsi:230123456,name:"Fixture"}];
const okFetch=async(url,options)=>{
 assert.equal(new URL(url).origin,"https://meri.digitraffic.fi");
 assert.match(options.headers["Digitraffic-User"],/NordicWatch/);
 return new Response(JSON.stringify(url.endsWith("/locations")?locations:ships),{status:200,headers:{"content-type":"application/json"}});
};
test("fixed endpoint returns AIS and attribution without acting as a generic proxy",async()=>{
 const res=await handle(req("/fintraffic/ais"),{},okFetch);
 assert.equal(res.status,200);
 assert.equal(res.headers.get("access-control-allow-origin"),origin);
 const data=await res.json();
 assert.deepEqual(data.locations,locations);
 assert.deepEqual(data.vessels,ships);
 assert.equal(data.license,"CC BY 4.0");
 assert.equal((await handle(req("/private"),{},okFetch)).status,404);
 assert.equal((await handle(req("/fintraffic/ais","POST"),{},okFetch)).status,405);
});
test("metadata error degrades without losing live positions",async()=>{
 const res=await handle(req("/fintraffic/ais"),{},async url=>url.endsWith("/vessels")?new Response("bad gateway",{status:502}):new Response(JSON.stringify(locations)));
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.metadataAvailable,false);
 assert.equal(data.vessels,null);
});
test("location failure is explicit, and health does not claim a successful poll",async()=>{
 const failed=await handle(req("/fintraffic/ais"),{},async()=>new Response("failed",{status:503}));
 assert.equal(failed.status,503);
 assert.equal((await failed.json()).error,"fintraffic_unavailable");
 const health=await handle(req("/health"),{},okFetch);
 assert.equal((await health.json()).liveDataChecked,false);
 assert.equal((await handle(req("/fintraffic/ais","OPTIONS"),{},okFetch)).status,204);
});
