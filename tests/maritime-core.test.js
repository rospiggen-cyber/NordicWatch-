const assert=require("node:assert/strict");
const M=require("../maritime-core.js");
const now=Date.parse("2026-09-02T06:00:00Z");
const source={name:"NordicWatch fixture",publisher:"InionX",license:"Mock/test only",retrievedAt:now,allowedUse:"test",quality:"mock"};
const base={id:"evt-1",type:"navigation_warning",evidence:"confirmed",title:"Test warning",description:"Synthetic fixture",lat:59.4,lon:19.2,timestamp:now-30*60000,source};

{
 const out=M.importDataset({name:"fixture.json",content:JSON.stringify([base,{...base}]),now});
 assert.equal(out.accepted.length,1);assert.equal(out.summary.duplicates,1);assert.equal(out.quarantine.length,1);
}
{
 const bad=M.importDataset({name:"bad.json",content:JSON.stringify([{...base,lat:90,source:{...source,license:""}}]),now});
 assert.equal(bad.accepted.length,0);assert.match(bad.quarantine[0].errors.join(" "),/coordinates/);assert.match(bad.quarantine[0].errors.join(" "),/license/);
}
{
 const huge=M.importDataset({name:"huge.csv",content:"x",size:M.MAX_IMPORT_BYTES+1,now});
 assert.equal(huge.accepted.length,0);assert.match(huge.quarantine[0].errors[0],/2 MiB/);
}
{
 const csv='id,type,evidence,title,description,lat,lon,timestamp,source_name,publisher,license,retrieved_at,allowed_use,source_quality\n'+
 'csv-1,authority_notice,confirmed,"Port, restriction",Synthetic,57.7,11.9,2026-09-02T05:00:00Z,Authority,Agency,Mock/test only,2026-09-02T05:01:00Z,test,mock';
 const out=M.importDataset({name:"fixture.csv",content:csv,now});assert.equal(out.accepted.length,1);assert.equal(out.accepted[0].title,"Port, restriction");
}
{
 const geo={type:"FeatureCollection",features:[{type:"Feature",geometry:{type:"Point",coordinates:[18.5,57.5]},properties:{...base,id:"geo-1",lat:undefined,lon:undefined}}]};
 const out=M.importDataset({name:"fixture.geojson",content:JSON.stringify(geo),now});assert.equal(out.accepted.length,1);assert.equal(out.accepted[0].lon,18.5);
}
{
 const record=M.normalizeRecord(base,0,now).record;
 const correlations=M.correlate(record,{hotspots:[{id:"Gotland",lat:57.5,lon:18.5}],news:[{id:"news-1",lat:59.45,lon:19.25,timestamp:now-20*60000,source:"Independent newsroom"}]},{distanceKm:300,timeHours:24});
 assert.ok(correlations.length>=2);
 const risk=M.riskScore({...record,source:{...record.source,quality:"official"}},correlations,now);
 assert.deepEqual(Object.keys(risk.components),["geography","temporal","independentSources","sourceQuality","freshness"]);
 assert.ok(risk.total>0&&risk.total<=100);
}
{
 const adapter=new M.StaticDatasetAdapter("mock",[base]);adapter.load().then(x=>assert.equal(x.length,1));
 assert.equal(M.httpsUrl("javascript:alert(1)"),null);
}
{
 const vesselSource={...source,quality:"verified"},positions=[[57.55,19.10,2.1,90],[57.56,19.28,1.7,270],[57.55,19.12,1.4,92],[57.57,19.30,1.2,272],[57.56,19.11,0.9,88],[57.55,19.27,0.8,268],[57.56,19.13,0.7,90]].map((x,i)=>M.normalizeRecord({id:"sarmat-track",type:"vessel_position",evidence:"observation",title:"SARMAT synthetic regression track",description:"Synthetic Russian tug behavior test; no hostile classification.",vesselName:"SARMAT",imo:"8027133",mmsi:"273000001",flag:"Russian Federation",vesselType:"tug / auxiliary",operator:"state auxiliary association",lat:x[0],lon:x[1],speed:x[2],course:x[3],status:"restricted manoeuvrability",restrictedManeuverability:true,timestamp:now-(6-i)*60*60000,source:vesselSource},i,now).record);
 assert(positions.every(Boolean));const latest=positions.at(-1),correlations=[{kind:"hotspot",id:"Gotland / Central Baltic",distanceKm:40,source:"NordicWatch hotspot"},{kind:"military_exercise",id:"Allied naval exercise",distanceKm:75,source:"Official event"},{kind:"allied_warship",id:"Swedish warship",distanceKm:60,source:"AIS"},{kind:"critical_infrastructure",id:"Gotland cable corridor",distanceKm:30,source:"NordicWatch context"},{kind:"news",id:"Credible maritime report",distanceKm:50,source:"Newsroom"}],behavior=M.behaviorAnomaly(latest,positions,correlations,now);
 assert(behavior);assert.equal(behavior.eventType,"MARITIME_BEHAVIOR_ANOMALY");assert.equal(behavior.category,"Maritime behavioral anomaly");assert.equal(behavior.severity,"HIGH");assert.equal(behavior.confidence,"MEDIUM-HIGH");assert.equal(behavior.region,"Gotland / Central Baltic");for(const tag of ["Russia","tug","loitering","restricted-manoeuvrability","Gotland / Central Baltic","naval-activity","correlation"])assert(behavior.tags.includes(tag),`missing maritime anomaly tag ${tag}`);assert(behavior.evidence.observed.length);assert(behavior.evidence.inferred.length);assert.deepEqual(behavior.evidence.external,["Credible maritime report"]);assert.match(behavior.statement,/not classified as hostile/i);assert.equal(M.behaviorEventKey(latest,behavior),M.behaviorEventKey({...latest,timestamp:latest.timestamp+60000},behavior),"position updates with unchanged behavior must deduplicate");
 const flagOnly=M.behaviorAnomaly({...latest,status:null,restrictedManeuverability:false,towing:false,speed:12},[{...latest,status:null,restrictedManeuverability:false,towing:false,speed:12}],[],now);assert.equal(flagOnly,null,"Russian flag alone must not create an anomaly");
}
console.log("maritime-core tests: PASS");
