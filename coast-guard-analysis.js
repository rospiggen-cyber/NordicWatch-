(function(root,factory){
  const api=factory(typeof module!=="undefined"&&module.exports?require("./aircraft-classifier.js"):root.NordicWatchAircraft);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.NordicWatchCoastGuard=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(AC){
  "use strict";
  if(!AC)throw new Error("aircraft classifier required");
  const OBSERVATION="Coast Guard aircraft – persistent loiter pattern.";
  const MAX_TRACK_AGE_MS=24*60*60*1000;

  const number=value=>Number.isFinite(Number(value))?Number(value):null;
  const timestamp=point=>number(point.timestamp??point.seenAt??point.time);
  const identity=a=>String(a.r||a.registration||a.flight||a.callsign||a.hex||"coastguard").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,24);
  function km(a,b){const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
  function bearing(a,b){const r=x=>x*Math.PI/180,d=x=>x*180/Math.PI,y=Math.sin(r(b.lon-a.lon))*Math.cos(r(b.lat)),x=Math.cos(r(a.lat))*Math.sin(r(b.lat))-Math.sin(r(a.lat))*Math.cos(r(b.lat))*Math.cos(r(b.lon-a.lon));return (d(Math.atan2(y,x))+360)%360}
  const turnDelta=(a,b)=>((b-a+540)%360)-180;
  function normalizeTrack(points,now=Date.now()){
    const seen=new Set();return (points||[]).map(p=>({lat:number(p.lat),lon:number(p.lon),timestamp:timestamp(p),altitude:number(p.altitude??p.alt_baro),speed:number(p.speed??p.gs),track:number(p.track)})).filter(p=>p.lat!==null&&p.lon!==null&&p.timestamp!==null&&p.timestamp<=now+60000&&now-p.timestamp<=MAX_TRACK_AGE_MS).sort((a,b)=>a.timestamp-b.timestamp).filter(p=>{const key=p.timestamp+"|"+p.lat.toFixed(5)+"|"+p.lon.toFixed(5);if(seen.has(key))return false;seen.add(key);return true})
  }
  function correlate(position,at,context={},config={}){
    const distanceKm=number(config.distanceKm)??50,timeMs=(number(config.timeHours)??12)*3600000,out=[];
    const add=(kind,item,itemAt)=>{if(!Number.isFinite(+item.lat)||!Number.isFinite(+item.lon))return;const distance=km(position,{lat:+item.lat,lon:+item.lon}),delta=itemAt===null?null:Math.abs(at-itemAt);if(distance<=distanceKm&&(delta===null||delta<=timeMs))out.push({kind,id:String(item.id||item.title||item.name||kind).slice(0,120),distanceKm:distance,timeDeltaMs:delta,evidence:item.evidence||"context",source:item.source?.name||item.source||""})};
    (context.vessels||[]).forEach(x=>add("vessel",x,timestamp(x)));
    (context.emissionReports||[]).forEach(x=>add("emission-report",x,timestamp(x)));
    (context.rescueOperations||[]).forEach(x=>add("rescue-operation",x,timestamp(x)));
    (context.navigationWarnings||[]).forEach(x=>add("navigation-warning",x,timestamp(x)));
    (context.infrastructure||[]).forEach(x=>add("protected-infrastructure",x,null));
    return out.sort((a,b)=>a.distanceKm-b.distanceKm)
  }
  function analyze(aircraft,points,context={},config={}){
    const classification=AC.classifyAircraft(aircraft);if(classification.governmentRole!==AC.GOVERNMENT_ROLE.COAST_GUARD)return null;
    const track=normalizeTrack(points,number(config.now)??Date.now());if(track.length<4)return null;
    const first=track[0],last=track.at(-1),durationMs=last.timestamp-first.timestamp;
    const center={lat:track.reduce((s,p)=>s+p.lat,0)/track.length,lon:track.reduce((s,p)=>s+p.lon,0)/track.length};
    const radiusKm=Math.max(...track.map(p=>km(center,p))),pathKm=track.slice(1).reduce((s,p,i)=>s+km(track[i],p),0);
    const headings=track.slice(1).map((p,i)=>bearing(track[i],p));let turnDegrees=0;for(let i=1;i<headings.length;i++)turnDegrees+=Math.abs(turnDelta(headings[i-1],headings[i]));
    const turns=turnDegrees/360,speeds=track.map(p=>p.speed).filter(Number.isFinite),avgSpeed=speeds.length?speeds.reduce((a,b)=>a+b,0)/speeds.length:null;
    const confined=radiusKm<=(number(config.maxRadiusKm)??25),longEnough=durationMs>=(number(config.minDurationMs)??20*60000);
    const loiterSignal=turns>=1||avgSpeed!==null&&avgSpeed<=150||durationMs>=45*60000;
    if(!confined||!longEnough||!loiterSignal)return null;
    const correlations=correlate(last,last.timestamp,context,config),supporting=correlations.filter(x=>x.kind!=="protected-infrastructure"),confirmed=supporting.find(x=>x.evidence==="confirmed"&&(x.kind==="rescue-operation"||x.kind==="emission-report"));
    const operationalWarning=durationMs>=90*60000||durationMs>=30*60000&&supporting.length>0;
    return {id:identity(aircraft)+":"+first.timestamp,aircraftId:identity(aircraft),classification,title:OBSERVATION,evidence:{observation:"DIRECT OBSERVATION",interpretation:"AUTOMATIC INTERPRETATION",operation:confirmed?"CONFIRMED OPERATION":"NO CONFIRMED OPERATION"},cause:confirmed?confirmed.id:"Unknown",location:String(config.locationLabel||`${last.lat.toFixed(3)}, ${last.lon.toFixed(3)}`).slice(0,120),position:{lat:last.lat,lon:last.lon},altitudeFt:last.altitude,durationMs,turns:Math.round(turns*10)/10,avgSpeedKt:avgSpeed===null?null:Math.round(avgSpeed),radiusKm:Math.round(radiusKm*10)/10,pathKm:Math.round(pathKm*10)/10,track,correlations,operationalWarning,activityDelta:operationalWarning?Math.min(12,4+supporting.length*3):0}
  }
  return Object.freeze({OBSERVATION,MAX_TRACK_AGE_MS,identity,km,normalizeTrack,correlate,analyze});
});
