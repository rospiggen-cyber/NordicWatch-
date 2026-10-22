const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const C=require("../cascade-engine.js");
test("cascade scenarios validate and remain synthetic without live evidence",()=>{
 for(const id of Object.keys(C.SCENARIOS)){
  assert(C.validate(C.get(id)));
  const result=C.simulate(id,{horizon:24});
  assert.equal(result.mode,"SYNTHETIC_ONLY");
  assert.equal(result.originalEventDataUsed,false);
  assert.equal(result.timeline.length,C.get(id).nodes.length);
  assert(result.timeline.every(x=>x.evidence==="SYNTHETIC_MODEL"));
  assert.equal(result.visibleCount,C.get(id).nodes.length-1);
 }
});
test("PHP scenario: chosen independent safeguard interrupts exactly one modeled branch",()=>{
 const base=C.simulate("cyber",{horizon:24});
 const mitigated=C.simulate("cyber",{enabledSafeguards:["authBackup"],horizon:24});
 assert.equal(base.visibleCount,5);
 assert.equal(mitigated.visibleCount,2);
 assert.equal(mitigated.timeline.find(n=>n.id==="teaching").possible,false);
 assert.equal(mitigated.timeline.find(n=>n.id==="research").possible,false);
 assert.equal(mitigated.timeline.find(n=>n.id==="portal").possible,true);
 assert.equal(C.compare("cyber",["authBackup"],24).avoidedCount,3);
});
test("industrial process: standby pump can interrupt synthetic cascade",()=>{
 const r=C.compare("industry",["standbyPump"],24);
 assert.equal(r.baselineCount,5);
 assert.equal(r.visibleCount,0);
 assert.equal(r.avoidedCount,5);
 assert(r.blocked.some(x=>x.barrier==="standbyPump"));
});
test("timeline honors illustrative delays rather than just counts",()=>{
 const at0=C.simulate("cyber",{horizon:0}),at1=C.simulate("cyber",{horizon:1}),at3=C.simulate("cyber",{horizon:3});
 assert.equal(at0.visibleCount,0);
 assert.equal(at1.visibleCount,2);
 assert.equal(at3.visibleCount,3);
 assert.equal(at0.timeline.find(n=>n.id==="service").visible,true);
});
test("unknown barrier cannot disable unrelated edge or turn a false report into evidence",()=>{
 const bogus=C.simulate("cyber",{enabledSafeguards:["NOT_A_REAL_CONTROL"],horizon:24});
 assert.equal(bogus.visibleCount,5);
 assert.throws(()=>C.simulate("unknown",{horizon:24}),/Unknown scenario/);
 const bad=JSON.parse(JSON.stringify(C.get("cyber")));bad.edges[0].to="DOES_NOT_EXIST";
 assert.throws(()=>C.validate(bad),/Invalid graph edge/);
});
test("Cascade Lab is linked from NordicWatch and cached offline, but not wired to live alert handling",()=>{
 const base=path.resolve(__dirname,".."),app=fs.readFileSync(path.join(base,"index.html"),"utf8"),
  sw=fs.readFileSync(path.join(base,"sw.js"),"utf8"),
  demo=fs.readFileSync(path.join(base,"cascade-lab.html"),"utf8"),
  ui=fs.readFileSync(path.join(base,"cascade-lab.js"),"utf8");
 assert(app.includes('href="./cascade-lab.html"'));
 for(const file of ["cascade-lab.html","cascade-engine.js","cascade-lab.js"])assert(sw.includes('"./'+file+'"'),"offline: "+file);
 assert(demo.includes("Alla exempel är syntetiska"));
 assert(demo.includes("inte en formell HAZOP"));
 assert(!/NORDICWATCH_(?:ALERT|SITUATION|SIGNAL)/.test(ui));
 assert(!/fetch\s*\(/.test(ui),"no external fetch or live adapter is permitted in demo");
});
