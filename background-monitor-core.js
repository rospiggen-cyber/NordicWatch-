(function(root,factory){
 const api=factory(typeof module!=="undefined"&&module.exports?require("./aircraft-classifier.js"):root.NordicWatchAircraft);
 if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.NordicWatchBackground=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(AC){
 "use strict";
 if(!AC)throw new Error("aircraft classifier required");
 const ZONES=[
  {id:"kaliningrad",name:"Kaliningrad / Baltijsk",lat:54.71,lon:20.51,radiusKm:430},
  {id:"suwalki",name:"Suwałki corridor",lat:54.10,lon:23.20,radiusKm:350},
  {id:"gotland",name:"Gotland",lat:57.47,lon:18.49,radiusKm:350},
  {id:"gulf-finland",name:"Gulf of Finland",lat:59.75,lon:25.50,radiusKm:420},
  {id:"kola",name:"Kola / Murmansk",lat:68.97,lon:33.07,radiusKm:500},
  {id:"leipzig-logistics",name:"Leipzig logistics watch",lat:51.4239,lon:12.2364,radiusKm:180}
 ];
 function km(a,b){const R=6371,r=x=>x*Math.PI/180,dLat=r(b.lat-a.lat),dLon=r(b.lon-a.lon),q=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
 function identity(a){return String(a.hex||(a.flight||"").trim()||a.r||"unknown").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,32)}
 function alertKey(alert,bucketMs=30*60*1000){return [alert.kind,alert.zone.id,alert.role,alert.identities.slice().sort().join("-"),Math.floor(alert.timestamp/bucketMs)].join(":")}
 function analyze(aircraft,now=Date.now(),zones=ZONES){
  const military=(aircraft||[]).map(a=>({aircraft:a,result:AC.classifyAircraft(a)})).filter(x=>AC.isMilitaryActivity(x.result));
  const alerts=[];
  for(const zone of zones){
   const members=military.filter(x=>Number.isFinite(+x.aircraft.lat)&&Number.isFinite(+x.aircraft.lon)&&km({lat:+x.aircraft.lat,lon:+x.aircraft.lon},zone)<=zone.radiusKm);
   const roles=Object.groupBy?Object.groupBy(members,x=>x.result.role):members.reduce((o,x)=>((o[x.result.role]??=[]).push(x),o),{});
   const support=["ISR","FIGHTER","AWACS","TANKER"].filter(r=>roles[r]?.length);
   if(support.length>=3)alerts.push({kind:"support-cluster",level:support.length===4?"FLASH":"ALERT",zone,role:support.join("+"),members,identities:members.map(x=>identity(x.aircraft)),timestamp:now,title:"Military support cluster",detail:support.join(" + ")});
   const transports=roles.TRANSPORT||[];
   if(transports.length>=3)alerts.push({kind:"transport-concentration",level:transports.length>=5?"FLASH":"ALERT",zone,role:"TRANSPORT",members:transports,identities:transports.map(x=>identity(x.aircraft)),timestamp:now,title:"Military transport concentration",detail:transports.length+" positively identified military transports"});
   for(const x of members.filter(x=>x.result.role==="ISR"||x.result.role==="AWACS")){
    alerts.push({kind:"high-interest-aircraft",level:"WATCH",zone,role:x.result.role,members:[x],identities:[identity(x.aircraft)],timestamp:now,title:x.result.role+" observation",detail:x.result.confidence+" military identification"});
   }
  }
  return {militaryCount:military.length,alerts:alerts.map(x=>({...x,key:alertKey(x)}))};
 }
 return Object.freeze({ZONES,km,identity,alertKey,analyze});
});
