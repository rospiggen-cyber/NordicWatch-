(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.NordicWatchSpecialMission=api})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";
const STRATEGIC_AREAS=Object.freeze([
 {name:"Kola / Murmansk region",lat:68.97,lon:33.07,radiusKm:650},
 {name:"Severomorsk / Barents Sea",lat:69.08,lon:36.00,radiusKm:650},
 {name:"Finnmark / Northern Norway",lat:70.10,lon:25.50,radiusKm:520},
 {name:"Norwegian Sea",lat:67.00,lon:2.00,radiusKm:650}
]);
const rad=x=>x*Math.PI/180;
function distanceKm(a,b){const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))}
function bearing(a,b){const dLon=rad(b.lon-a.lon),p1=rad(a.lat),p2=rad(b.lat);return (Math.atan2(Math.sin(dLon)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dLon))*180/Math.PI+360)%360}
const angleDelta=(a,b)=>Math.abs(((a-b+540)%360)-180);
function strategicContext(aircraft){if(!Number.isFinite(+aircraft?.lat)||!Number.isFinite(+aircraft?.lon))return null;let best=null;for(const area of STRATEGIC_AREAS){const distance=distanceKm({lat:+aircraft.lat,lon:+aircraft.lon},area);if(distance<=area.radiusKm&&(!best||distance<best.distanceKm))best={...area,distanceKm:distance}}return best}
function roleOf(item,classify){return String(classify(item)?.role||"").toUpperCase()}
function assess(aircraft,all,classify,pattern,options={}){
 const classification=classify(aircraft);if(!classification?.specialMission)return null;
 const strategic=strategicContext(aircraft),points=pattern?.metrics?.points||[],trackBearing=points.length>1?bearing(points[0],points.at(-1)):null,parallel=Boolean(strategic&&/Kola|Finnmark/.test(strategic.name)&&pattern?.pattern==="TRANSIT"&&(pattern?.confidence||0)>=60&&(pattern?.metrics?.durationMs||0)>=15*60000&&(pattern?.metrics?.distanceKm||0)>=80&&(angleDelta(trackBearing,35)<=28||angleDelta(trackBearing,215)<=28)),patternName=parallel?"BORDER PARALLEL TRACK":String(pattern?.pattern||"UNKNOWN"),patternConfidence=Number(pattern?.confidence)||0;
 const unusualPattern=["RACETRACK","ORBIT","LOITER","REPEATED PASS","BORDER PARALLEL TRACK"].includes(patternName)&&patternConfidence>=55;
 const nearby=(all||[]).filter(other=>other!==aircraft&&Number.isFinite(+other.lat)&&Number.isFinite(+other.lon)&&distanceKm({lat:+aircraft.lat,lon:+aircraft.lon},{lat:+other.lat,lon:+other.lon})<=450);
 const roles=new Set(nearby.map(item=>roleOf(item,classify)));
 let score=25,reasons=["known high-value special-mission platform"];
 if(options.firstAppearance){score+=10;reasons.push("first appearance in current watch period")}
 if(/SIGINT|ELINT/.test(classification.subrole||"")){score+=15;reasons.push("SIGINT/ELINT platform")}
 if(strategic){score+=15;reasons.push("strategic Nordic relevance")}
 if(unusualPattern){score+=10;reasons.push(`${patternName.toLowerCase()} geometry`)}
 if(roles.has("FIGHTER")){score+=10;reasons.push("fighter activity nearby")}
 if(roles.has("TANKER")){score+=8;reasons.push("tanker activity nearby")}
 if(roles.has("AWACS")){score+=8;reasons.push("AWACS activity nearby")}
 if(nearby.some(item=>roleOf(item,classify)==="ISR"&&classify(item)?.platformName!==classification.platformName)){score+=6;reasons.push("other ISR activity nearby")}
 score=Math.min(99,score);
 const supported=[...roles].some(role=>["FIGHTER","TANKER","AWACS"].includes(role));
 return {score,level:score>=50?"HIGH":score>=35?"MEDIUM":"ROUTINE",eligible:Boolean(options.firstAppearance||strategic||unusualPattern||supported),strategic,pattern:patternName,patternConfidence,nearbyRoles:[...roles],reasons,evidence:{observed:"OBSERVED",assessment:"INFERRED"},inference:supported?"Possible supported ISR mission":"Mission geometry and location assessed from live aircraft data",signature:[strategic?.name||"none",patternConfidence>=55?patternName:"UNKNOWN",[...roles].filter(x=>["FIGHTER","TANKER","AWACS","ISR"].includes(x)).sort().join("+"),score>=70?"HIGH":"BASE"].join("|")};
}
function rarity(history,platformFamily,now=Date.now()){
 const rows=(Array.isArray(history)?history:[]).filter(x=>Number.isFinite(+x.t)&&now-x.t<=31*86400000).sort((a,b)=>a.t-b.t);if(rows.length<8||rows.at(-1).t-rows[0].t<86400000)return null;
 const matches=rows.filter(x=>(x.specialPlatforms||[]).includes(platformFamily));if(!matches.length)return {claim:`${platformFamily} not present in ${rows.length} stored regional snapshots`,confidence:"MEDIUM",days:null};
 const days=Math.floor((now-matches.at(-1).t)/86400000);return days>=1?{claim:`${platformFamily} not observed in this region for ${days} day${days===1?"":"s"}`,confidence:"MEDIUM",days}:null
}
return Object.freeze({STRATEGIC_AREAS,distanceKm,bearing,strategicContext,assess,rarity});
});
