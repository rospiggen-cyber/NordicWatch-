const test=require("node:test");
const assert=require("node:assert/strict");
const FT=require("../fintraffic-ais.js");
const MC=require("../maritime-core.js");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const now=Date.parse("2026-11-15T12:00:00Z");
const feature=(mmsi,lat,lon,at=now)=>({mmsi,type:"Feature",geometry:{type:"Point",coordinates:[lon,lat]},properties:{mmsi,sog:4.5,cog:128.4,navStat:3,timestamp:25,timestampExternal:at}});
const payload={locations:{type:"FeatureCollection",dataUpdatedTime:new Date(now).toISOString(),features:[
 feature(230123456,59.41,24.9),feature(230123457,59.6,26.3,now-40*60000),feature(230123458,55.0,24.0),feature(230123459,59.4,25.5,now+10*60000),feature(230123456,59.41,24.9)
]},vessels:[{mmsi:230123456,name:"TEST SHIP",imo:1234567,shipType:70}]};
test("normalizes actual Fintraffic GeoJSON shape and AIS millisecond timestamp",()=>{
 const result=FT.transform(payload,now);
 assert.equal(result.records.length,1);
 assert.equal(result.coverage.received,5);
 assert.equal(result.coverage.stale,2);
 assert.equal(result.coverage.outside,1);
 assert.equal(result.records[0].timestamp,now);
 assert.equal(result.records[0].vesselName,"TEST SHIP");
 assert.equal(result.records[0].status,"restricted manoeuvrability");
 const validated=MC.importDataset({name:"fintraffic.json",content:JSON.stringify(result.records),now});
 assert.equal(validated.accepted.length,1);
 assert.equal(validated.accepted[0].source.license,"CC BY 4.0");
 assert.equal(validated.accepted[0].evidence,"observation");
 assert.equal(validated.accepted[0].source.quality,"official");
});
test("metadata outage retains valid positional observations without invented identity",()=>{
 const out=FT.transform({locations:{...payload.locations,features:[feature(636123456,59.4,25.0)]},vessels:null},now);
 assert.equal(out.records.length,1);
 assert.equal(out.records[0].vesselName,null);
 assert.equal(out.records[0].title,"AIS 636123456 · AIS position");
 assert.equal(out.coverage.metadataAvailable,false);
});
test("rejects invalid records, keeps scope explicitly partial and caps selection",()=>{
 const raw={locations:{type:"FeatureCollection",features:[feature("bad",59.4,25),feature(230123456,59.4,25),feature(230123457,59.5,25.1)]},vessels:[]};
 const out=FT.transform(raw,now,1);
 assert.equal(out.coverage.invalid,1);
 assert.equal(out.coverage.omitted,1);
 assert.equal(out.coverage.complete,false);
 assert.equal(out.records.length,1);
 assert.throws(()=>FT.transform({locations:[]},now),/schema invalid/);
});
test("adapter loads only through configured proxy and does not modify on upstream failure",async()=>{
 let requested;
 const adapter=new FT.FintrafficAdapter("https://worker.example/fintraffic/ais",async url=>{requested=url;return {ok:true,json:async()=>payload}},()=>now);
 const records=await adapter.load();
 assert.equal(requested,"https://worker.example/fintraffic/ais");
 assert.equal(records.length,1);
 assert.equal(adapter.lastCoverage.selected,1);
 const unavailable=new FT.FintrafficAdapter("https://worker.example",async()=>({ok:false,status:503}));
 await assert.rejects(unavailable.load(),/HTTP 503/);
});

test("default browser fetch is called with global receiver, never as an adapter method",async()=>{
 const source=fs.readFileSync(path.join(__dirname,"../fintraffic-ais.js"),"utf8");
 let requestReceiver;
 const browser={fetch:function(){requestReceiver=this;return Promise.resolve({ok:true,json:async()=>payload})}};
 vm.runInNewContext(source,browser);
 const adapter=new browser.NordicWatchFintraffic.FintrafficAdapter("https://worker.example/fintraffic/ais",undefined,()=>now);
 const records=await adapter.load();
 assert.equal(records.length,1);
 assert.notEqual(requestReceiver,adapter);
 assert.ok(requestReceiver.NordicWatchFintraffic);
});
