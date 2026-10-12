(function(root,factory){
 const api=factory(typeof module==="object"&&module.exports?require("./aircraft-classifier.js"):root.NordicWatchAircraft);
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.NordicWatchMaritimePatrol=api;
})(globalThis,function(AC){
 "use strict";
 if(!AC)throw new Error("Aircraft classifier required");
 // Geographic areas describe observation coverage, not submarine positions.
 const ZONES=Object.freeze([
  {id:"north-sea",name:"North Sea",lat:57.5,lon:3.5,radiusKm:570},
  {id:"norwegian-sea",name:"Norwegian Sea",lat:64.8,lon:2.5,radiusKm:750},
  {id:"skagerrak",name:"Skagerrak / Kattegat",lat:57.6,lon:9.4,radiusKm:330},
  {id:"kaliningrad",name:"Kaliningrad / Baltijsk",lat:54.71,lon:20.51,radiusKm:400},
  {id:"baltic-sea",name:"Baltic Sea",lat:57.5,lon:18.5,radiusKm:600},
  {id:"gulf-finland",name:"Gulf of Finland",lat:59.75,lon:25.5,radiusKm:420},
  {id:"barents",name:"Barents Sea",lat:70.5,lon:30,radiusKm:750}
 ]);
 const rad=x=>x*Math.PI/180;
 function distanceKm(a,b){
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
 }
 const identity=a=>String(a.hex||a.r||a.registration||(a.flight||"").trim()||"").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,32);
 function nearestZone(a){
  if(a?.lat===undefined||a?.lon===undefined||!Number.isFinite(+a.lat)||!Number.isFinite(+a.lon))return null;
  const candidates=ZONES.map(zone=>({zone,distanceKm:distanceKm({lat:+a.lat,lon:+a.lon},zone)})).filter(x=>x.distanceKm<=x.zone.radiusKm);
  candidates.sort((a,b)=>a.distanceKm-b.distanceKm);
  return candidates[0]?.zone||null;
 }
 // A single aircraft observation is a WATCH. Multiple simultaneously visible
 // distinct ASW aircraft within one area are an ALERT about aviation only.
 // Neither classification nor clustering proves submarine contact or a NATO operation.
 function analyze(aircraft,now=Date.now()){
  const grouped=new Map(),seen=new Set();
  for(const a of aircraft||[]){
   if(!a||a.lat==null||a.lon==null||!Number.isFinite(+a.lat)||!Number.isFinite(+a.lon))continue;
   if(Number.isFinite(+a.seen)&&a.seen!=null&&(+a.seen<0||+a.seen>600))continue;
   const result=AC.classifyAircraft(a),id=identity(a),zone=nearestZone(a);
   if(!id||seen.has(id)||!zone||!AC.isMilitaryActivity(result)||result.role!=="ASW")continue;
   seen.add(id);if(!grouped.has(zone.id))grouped.set(zone.id,{zone,members:[],identities:[]});
   const group=grouped.get(zone.id);group.members.push(a);group.identities.push(id);
  }
  const alerts=[];
  for(const {zone,members,identities} of grouped.values()){
   const multiple=members.length>=2,kind=multiple?"asw-aircraft-concentration":"asw-aircraft-observation";
   const detail=members.length+" identified maritime patrol/ASW aircraft visible in "+zone.name+". Aircraft activity only; no submarine contact confirmed.";
   alerts.push({kind,level:multiple?"ALERT":"WATCH",zone,role:"ASW",members,identities,timestamp:now,title:multiple?"Multiple ASW aircraft observed":"ASW aircraft observed",detail,key:[kind,zone.id,identities.slice().sort().join("-"),Math.floor(now/(30*60000))].join(":")});
  }
  return {observedCount:alerts.reduce((n,a)=>n+a.members.length,0),alerts:alerts.sort((a,b)=>b.members.length-a.members.length||a.zone.name.localeCompare(b.zone.name))};
 }
 return Object.freeze({ZONES,identity,distanceKm,nearestZone,analyze});
});
