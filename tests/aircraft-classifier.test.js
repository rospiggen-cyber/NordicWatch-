const assert=require("node:assert/strict");
const A=require("../aircraft-classifier.js");

const classify=x=>A.classifyAircraft(x);
assert.equal(classify({operator:"SAS",t:"A320"}).base,"CIVILIAN");
assert.equal(classify({operator:"Swedish Coast Guard",t:"DHC8"}).governmentRole,"COAST_GUARD");
for(const aircraft of [
  {operator:"Swedish Coast Guard",t:"DH8C"},{operator:"Kustbevakningen",t:"Q300"},{r:"SE-MAA"},{r:"SE-MAB"},{r:"SE-MAC"},
  {flight:"KBV501"},{flight:"KBV502"},{flight:"KBV503"},{hex:"4AB421"},{hex:"4AB422"},{hex:"4AB423"},{military:true,r:"SE-MAA",t:"DHC8"}
]){
 const result=classify(aircraft);assert.equal(result.base,"STATE");assert.equal(result.governmentRole,"COAST_GUARD");assert.equal(result.role,null);assert.equal(A.isMilitaryActivity(result),false)
}
assert.equal(classify({t:"A320",flight:"ABC123"}).base,"UNKNOWN");
assert.equal(classify({t:"KC135"}).base,"UNKNOWN","military type alone is not enough");
assert.equal(classify({flight:"RCH123"}).base,"UNKNOWN","one callsign indicator is not enough");

const confirmed=classify({military:true,t:"E3A"});
assert.equal(confirmed.base,"MILITARY");assert.equal(confirmed.confidence,"CONFIRMED");assert.equal(confirmed.role,"AWACS");
const probable=classify({flight:"RCH123",t:"C17"});
assert.equal(probable.base,"MILITARY");assert.equal(probable.confidence,"PROBABLE");assert.equal(probable.role,"TRANSPORT");
const korpen=classify({flight:"SVF666",t:"GLF4"});
assert.equal(korpen.base,"MILITARY");assert.equal(korpen.confidence,"PROBABLE");assert.equal(korpen.role,"ISR");
assert.equal(classify({operator:"USAF",t:"A320"}).role,"OTHER");

for(const [t,role] of [["E3A","AWACS"],["KC135","TANKER"],["RC135","ISR"],["C17","TRANSPORT"],["F35","FIGHTER"]])assert.equal(classify({military:true,t}).role,role);
for(const aircraft of [{t:"RC135"},{t:"RC-135W"},{t:"R135"},{model:"Rivet Joint"},{description:"Boeing RC-135W"}]){
 const result=classify({...aircraft,operator:"United States Air Force"});
 assert.equal(result.base,"MILITARY");assert.equal(result.role,"ISR");assert.equal(result.subrole,"SIGINT / ELINT");assert.equal(result.platformFamily,"RC-135");assert.equal(result.platformVariant,"RC-135W");assert.equal(result.platformName,"RC-135W RIVET JOINT");assert.equal(result.interestClass,"HIGH_VALUE_ISR");assert.equal(result.specialMission,true)
}
for(const [metadata,role] of [[{t:"RC135S"},"ISR"],[{model:"Combat Sent"},"ISR"],[{t:"P8A"},"ASW"],[{t:"E3A"},"AWACS"],[{model:"E-7 Wedgetail"},"AWACS"],[{description:"GlobalEye"},"AWACS"],[{t:"EA37B"},"EW"],[{t:"IL20"},"ISR"],[{t:"IL38"},"ASW"],[{t:"TU142"},"ASW"]]){const result=classify({...metadata,military:true});assert.equal(result.role,role);assert.notEqual(result.role,"OTHER");assert.equal(result.specialMission,true)}
assert.equal(classify({flight:"NJE7AB",t:"E55P",operator:"NetJets Europe"}).specialMission,undefined,"partial callsign text must not identify an E-7");

const fixture=[];
for(let i=0;i<100;i++)fixture.push({civilian:true,t:"A320",hex:`c${i}`});
for(let i=0;i<8;i++)fixture.push({state:true,t:"DHC8",hex:`s${i}`});
for(let i=0;i<40;i++)fixture.push({t:"A320",hex:`u${i}`});
[[3,"KC135"],[2,"RC135"],[4,"C17"],[3,"A320"]].forEach(([n,t])=>{for(let i=0;i<n;i++)fixture.push({military:true,t})});
const summary=A.summarize(fixture);
assert.deepEqual(summary.base,{CIVILIAN:100,MILITARY:12,STATE:8,UNKNOWN:40});
assert.deepEqual(summary.roles,{AWACS:0,TANKER:3,ISR:2,EW:0,ASW:0,TRANSPORT:4,FIGHTER:0,OTHER:3});
assert.equal(summary.nonMilitary,148);
assert.equal(summary.roles.OTHER,3,"OTHER contains identified military aircraft only");
assert.equal(fixture.filter(x=>classify(x).base!=="MILITARY"&&classify(x).role==="OTHER").length,0);
console.log("aircraft classifier tests passed");
