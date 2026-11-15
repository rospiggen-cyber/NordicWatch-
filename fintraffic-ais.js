// Fintraffic/Digitraffic open AIS adapter. No MarineTraffic/Kpler data is used.
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.NordicWatchFintraffic=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const ID="fintraffic-ais",LICENSE="CC BY 4.0";
  const SOURCE_URL="https://www.digitraffic.fi/en/marine-traffic/";
  const LICENSE_URL="https://creativecommons.org/licenses/by/4.0/";
  const DEFAULT_ENDPOINT="https://nordicwatch-maritime.rospiggen.workers.dev/fintraffic/ais";
  const MAX_AGE_MS=30*60*1000,MAX_FUTURE_MS=5*60*1000,MAX_VESSELS=300;
  // A deliberately limited pilot region, not a claim of coverage across the Baltic.
  const PILOT={south:58.5,north:61.5,west:19,east:31};
  const NAV_STATUS={0:"under way",1:"at anchor",2:"not under command",3:"restricted manoeuvrability",4:"constrained by draught",5:"moored",6:"aground",7:"fishing",8:"under sail",15:"undefined"};
  function validTime(value){
    if(typeof value!=="number"||!Number.isFinite(value))return null;
    const ms=value<1e12?value*1000:value;
    return ms>1e12&&ms<1e14?ms:null;
  }
  function inPilot(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=PILOT.south&&lat<=PILOT.north&&lon>=PILOT.west&&lon<=PILOT.east}
  function name(value){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,90)}
  function metadataIndex(value){
    const map=new Map();
    for(const ship of Array.isArray(value)?value:[]){
      const mmsi=String(ship?.mmsi??"");
      if(/^\d{9}$/.test(mmsi))map.set(mmsi,ship);
    }
    return map;
  }
  function transform(payload,now=Date.now(),limit=MAX_VESSELS){
    const locations=payload?.locations,features=locations?.features;
    if(locations?.type!=="FeatureCollection"||!Array.isArray(features))throw new Error("Fintraffic AIS locations schema invalid");
    const max=Math.max(1,Math.min(MAX_VESSELS,Math.floor(Number(limit)||MAX_VESSELS)));
    const metadata=metadataIndex(payload?.vessels);
    const eligible=[];let stale=0,outside=0,invalid=0;
    for(const feature of features){
      const mmsi=String(feature?.mmsi??feature?.properties?.mmsi??"");
      const coord=feature?.geometry?.coordinates,lon=Number(coord?.[0]),lat=Number(coord?.[1]);
      const timestamp=validTime(feature?.properties?.timestampExternal);
      if(!/^\d{9}$/.test(mmsi)||feature?.geometry?.type!=="Point"||!timestamp||!Number.isFinite(lat)||!Number.isFinite(lon)){invalid++;continue}
      if(timestamp<now-MAX_AGE_MS||timestamp>now+MAX_FUTURE_MS){stale++;continue}
      if(!inPilot(lat,lon)){outside++;continue}
      eligible.push({feature,mmsi,lat,lon,timestamp});
    }
    eligible.sort((a,b)=>b.timestamp-a.timestamp);
    const dedup=new Set(),records=[];
    for(const item of eligible){
      if(records.length>=max)break;
      if(dedup.has(item.mmsi))continue;
      dedup.add(item.mmsi);
      const p=item.feature.properties||{},ship=metadata.get(item.mmsi)||{};
      const speed=Number(p.sog),course=Number(p.cog),nav=Number(p.navStat);
      const shipName=name(ship.name),label=shipName||`AIS ${item.mmsi}`;
      const type=Number.isInteger(Number(ship.shipType))?Number(ship.shipType):null;
      const status=Object.hasOwn(NAV_STATUS,nav)?NAV_STATUS[nav]:"unknown AIS status";
      records.push({
        id:`fi-${item.mmsi}`,mmsi:item.mmsi,type:"vessel_position",evidence:"observation",
        title:`${label} · AIS position`,vesselName:shipName||null,
        description:"AIS-transmitted position, not independently verified. Incomplete reception, stale transmissions and identity errors are possible.",
        lat:item.lat,lon:item.lon,timestamp:item.timestamp,
        speed:Number.isFinite(speed)&&speed>=0&&speed<=100?speed:null,
        course:Number.isFinite(course)&&course>=0&&course<360?course:null,
        status,vesselType:type===null?null:`AIS ship type ${type}`,
        imo:ship.imo??null,
        restrictedManeuverability:nav===3,
        link:SOURCE_URL,
        tags:["ais","fintraffic","finnish-waters","pilot-coverage"],
        source:{name:"Fintraffic AIS",publisher:"Fintraffic / Digitraffic",license:LICENSE,url:SOURCE_URL,retrievedAt:now,allowedUse:"commercial",quality:"official"}
      });
    }
    const reportedAt=Date.parse(locations.dataUpdatedTime||"");
    return {records,coverage:{provider:ID,license:LICENSE,licenseUrl:LICENSE_URL,sourceUrl:SOURCE_URL,
      scope:"Gulf of Finland pilot (58.5–61.5°N, 19–31°E)",
      received:features.length,eligible:eligible.length,selected:records.length,
      stale,outside,invalid,omitted:Math.max(0,eligible.length-records.length),
      metadataAvailable:Array.isArray(payload.vessels),updatedAt:Number.isFinite(reportedAt)?reportedAt:null,
      fetchedAt:now,maxAgeMinutes:MAX_AGE_MS/60000,complete:false}};
  }
  class FintrafficAdapter {
    // Browser fetch requires its Window receiver. Storing the bare function on
    // an adapter and invoking it as this.request(...) causes Illegal invocation.
    constructor(endpoint=DEFAULT_ENDPOINT,request=(...args)=>fetch(...args),now=Date.now){this.id=ID;this.endpoint=endpoint;this.request=request;this.now=now;this.lastCoverage=null}
    async load(){
      const response=await this.request(this.endpoint,{cache:"no-store"});
      if(!response.ok)throw new Error(`Fintraffic gateway HTTP ${response.status}`);
      const result=transform(await response.json(),this.now());
      this.lastCoverage=result.coverage;
      if(!result.records.length)throw new Error("No fresh AIS observations in pilot coverage");
      return result.records;
    }
  }
  return {ID,LICENSE,SOURCE_URL,LICENSE_URL,DEFAULT_ENDPOINT,MAX_AGE_MS,MAX_VESSELS,PILOT,transform,FintrafficAdapter};
});
