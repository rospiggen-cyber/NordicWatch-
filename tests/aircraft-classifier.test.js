const assert=require("node:assert/strict");
const A=require("../aircraft-classifier.js");

const classify=x=>A.classifyAircraft(x);
assert.equal(classify({operator:"SAS",t:"A320"}).base,"CIVILIAN");
assert.deepEqual(classify({operator:"Swedish Coast Guard",t:"DHC8"}),{base:"STATE",confidence:null,role:null,evidence:[{signal:"state-identity",strength:"strong"}]});
assert.equal(classify({t:"A320",flight:"ABC123"}).base,"UNKNOWN");
assert.equal(classify({t:"KC135"}).base,"UNKNOWN","military type alone is not enough");
assert.equal(classify({flight:"RCH123"}).base,"UNKNOWN","one callsign indicator is not enough");

const confirmed=classify({military:true,t:"E3A"});
assert.equal(confirmed.base,"MILITARY");assert.equal(confirmed.confidence,"CONFIRMED");assert.equal(confirmed.role,"AWACS");
const probable=classify({flight:"RCH123",t:"C17"});
assert.equal(probable.base,"MILITARY");assert.equal(probable.confidence,"PROBABLE");assert.equal(probable.role,"TRANSPORT");
assert.equal(classify({operator:"USAF",t:"A320"}).role,"OTHER");

for(const [t,role] of [["E3A","AWACS"],["KC135","TANKER"],["RC135","ISR"],["C17","TRANSPORT"],["F35","FIGHTER"]])assert.equal(classify({military:true,t}).role,role);

const fixture=[];
for(let i=0;i<100;i++)fixture.push({civilian:true,t:"A320",hex:`c${i}`});
for(let i=0;i<8;i++)fixture.push({state:true,t:"DHC8",hex:`s${i}`});
for(let i=0;i<40;i++)fixture.push({t:"A320",hex:`u${i}`});
[[3,"KC135"],[2,"RC135"],[4,"C17"],[3,"A320"]].forEach(([n,t])=>{for(let i=0;i<n;i++)fixture.push({military:true,t})});
const summary=A.summarize(fixture);
assert.deepEqual(summary.base,{CIVILIAN:100,MILITARY:12,STATE:8,UNKNOWN:40});
assert.deepEqual(summary.roles,{AWACS:0,TANKER:3,ISR:2,TRANSPORT:4,FIGHTER:0,OTHER:3});
assert.equal(summary.nonMilitary,148);
assert.equal(summary.roles.OTHER,3,"OTHER contains identified military aircraft only");
assert.equal(fixture.filter(x=>classify(x).base!=="MILITARY"&&classify(x).role==="OTHER").length,0);
console.log("aircraft classifier tests passed");
