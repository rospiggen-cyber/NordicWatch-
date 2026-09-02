const assert=require("node:assert/strict");
const CG=require("../coast-guard-analysis.js");

const start=Date.parse("2026-09-02T10:00:00Z"),center={lat:59.27,lon:13.66};
const track=Array.from({length:19},(_,i)=>{const angle=i*Math.PI/3;return {timestamp:start+i*150000,lat:center.lat+0.055*Math.sin(angle),lon:center.lon+0.105*Math.cos(angle),altitude:3075,speed:118}});
const observation=CG.analyze({operator:"Swedish Coast Guard",r:"SE-MAB",flight:"KBV502",hex:"4AB422",t:"DH8C"},track,{}, {now:start+45*60000,locationLabel:"East of Hammarö, Vänern"});
assert.ok(observation,"Hammarö track should register an observation");
assert.equal(observation.title,"Coast Guard aircraft – persistent loiter pattern.");
assert.equal(observation.classification.label,"Government / Coast Guard");
assert.equal(observation.altitudeFt,3075);assert.ok(observation.turns>=2);
assert.equal(observation.location,"East of Hammarö, Vänern");
assert.equal(observation.cause,"Unknown");assert.equal(observation.evidence.observation,"DIRECT OBSERVATION");
assert.equal(observation.evidence.interpretation,"AUTOMATIC INTERPRETATION");assert.equal(observation.evidence.operation,"NO CONFIRMED OPERATION");
assert.equal(observation.operationalWarning,false);assert.equal(observation.activityDelta,0);

const supported=CG.analyze({r:"SE-MAB",t:"DH8C"},track,{rescueOperations:[{id:"JRCC confirmed rescue",lat:59.28,lon:13.67,timestamp:start+40*60000,evidence:"confirmed"}]},{now:start+45*60000});
assert.equal(supported.operationalWarning,true);assert.equal(supported.evidence.operation,"CONFIRMED OPERATION");assert.ok(supported.activityDelta>0);
assert.equal(CG.analyze({military:true,t:"C17"},track,{}, {now:start+45*60000}),null);
console.log("coast guard analysis tests passed");
