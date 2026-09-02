const assert=require("node:assert/strict");
const B=require("../background-monitor-core.js");
const now=Date.parse("2026-09-02T12:00:00Z");
const gotland={lat:57.5,lon:18.5};
const civil=Array.from({length:160},(_,i)=>({...gotland,hex:"c"+i,civilian:true,t:"A320"}));
assert.equal(B.analyze(civil,now).militaryCount,0);
assert.equal(B.analyze(civil,now).alerts.length,0,"civil traffic must never create background alerts");
const packageAircraft=[
 {...gotland,hex:"a1",military:true,t:"RC135"},
 {...gotland,hex:"a2",military:true,t:"F35"},
 {...gotland,hex:"a3",military:true,t:"E3A"},
 {...gotland,hex:"a4",military:true,t:"KC135"}
];
const result=B.analyze(packageAircraft,now);
assert.equal(result.militaryCount,4);
assert.equal(result.alerts.find(x=>x.kind==="support-cluster").level,"FLASH");
assert.ok(result.alerts.every(x=>x.key&&x.identities.length));
const korpen=B.analyze([{...gotland,flight:"SVF666",t:"GLF4"}],now);
assert.equal(korpen.militaryCount,1);assert.equal(korpen.alerts[0].role,"ISR");
console.log("background monitor tests passed");
