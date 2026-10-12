const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const M=require("../maritime-patrol-analysis.js");
const A=require("../aircraft-classifier.js");

const now=Date.parse("2026-10-08T18:00:00Z");
const north={lat:57.5,lon:3.5};
const plane=(hex,t,extra={})=>({hex,t,...north,...extra});

test("single Poseidon is a WATCH without asserting submarine contact",()=>{
 const data=M.analyze([plane("a1","P8A")],now);
 assert.equal(data.observedCount,1);
 assert.equal(data.alerts.length,1);
 assert.equal(data.alerts[0].level,"WATCH");
 assert.equal(data.alerts[0].zone.name,"North Sea");
 assert.match(data.alerts[0].detail,/no submarine contact confirmed/i);
});

test("two distinct maritime patrol aircraft in one area form a bounded observation alert",()=>{
 const aircraft=[plane("a1","P8A"),plane("a2","P3C",{lat:58.2,lon:3.8})];
 const data=M.analyze(aircraft,now);
 assert.equal(data.observedCount,2);
 assert.equal(data.alerts.length,1);
 assert.equal(data.alerts[0].level,"ALERT");
 assert.equal(data.alerts[0].members.length,2);
 assert.equal(data.alerts[0].kind,"asw-aircraft-concentration");
 assert.equal(M.analyze(aircraft,now).alerts[0].key,data.alerts[0].key);
});

test("duplicates, stale aircraft, and civilian traffic cannot inflate the count",()=>{
 const data=M.analyze([
  plane("a1","P8A"),plane("a1","P8A"),
  plane("a2","ATL2",{seen:1200}),
  plane("c1","A320",{civilian:true}),
  {hex:"z1",t:"P8A",lat:12,lon:34}
 ],now);
 assert.equal(data.observedCount,1);
 assert.equal(data.alerts[0].level,"WATCH");
 assert.equal(M.analyze([plane("c1","A320",{civilian:true})],now).alerts.length,0);
});

test("aircraft in distinct patrol zones are not treated as one concentration",()=>{
 const data=M.analyze([plane("a1","P8A"),plane("a2","ATL2",{lat:70.5,lon:30})],now);
 assert.equal(data.observedCount,2);
 assert.equal(data.alerts.length,2);
 assert(data.alerts.every(a=>a.level==="WATCH"));
});

test("live UI, filters, scan card and offline asset remain wired",()=>{
 const root=path.join(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
 const collector=fs.readFileSync(path.join(root,"collector-swarm.js"),"utf8");
 const monitor=fs.readFileSync(path.join(root,"cloudflare/adsb-monitor-worker.js"),"utf8");
 assert.match(html,/<script src="maritime-patrol-analysis.js"><\/script>/);
 assert.match(html,/data-f="asw"/);
 assert.match(html,/renderMaritimePatrolSignals\(\)/);
 assert.match(collector,/id:'asw-maritime'/);
 assert.match(sw,/\.\/maritime-patrol-analysis\.js/);
 assert.match(monitor,/import "\.\.\/maritime-patrol-analysis\.js"/);
 assert.equal(A.classifyAircraft({model:"Boeing P-8A Poseidon"}).role,"ASW");
});
