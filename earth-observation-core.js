/* NordicWatch Earth Observation v0.1 — publicly published Copernicus Mapping activations.
 * This is an activation catalogue and provenance tool, NOT raw satellite processing.
 * No mapping footprint, flooded road, live fire or local risk is inferred from a centroid.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NordicWatchEarthObservation=api;
})(globalThis,function(){
 'use strict';
 const AREAS=Object.freeze([
  {id:'ROSLAGEN',name:'Uppsala / Roslagen / Vätö',bounds:{south:59.35,north:60.55,west:16.9,east:19.65}},
  {id:'HALSINGLAND',name:'Hälsingland / Söderhamn',bounds:{south:60.55,north:62.5,west:14.9,east:18.8}}
 ]);
 const CATEGORY_ALLOW=new Set(['flood','wildfire','forest_fire','forest_fire_wild_fire','storm','wind_storm','mass_movement','landslide','industrial_accident','other','earthquake']);
 const text=(v,n=240)=>String(v??'').replace(/[\u0000-\u001f\u007f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
 const iso=v=>{if(!v)return null;const date=new Date(v);return Number.isFinite(+date)?date.toISOString():null};
 const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
 function wktPoint(value){
  if(typeof value!=='string')return null;
  const m=/^POINT\s*\(\s*(-?\d{1,3}(?:\.\d+)?)\s+(-?\d{1,2}(?:\.\d+)?)\s*\)$/i.exec(value.trim());
  if(!m)return null;const lon=+m[1],lat=+m[2];
  return lon>=-180&&lon<=180&&lat>=-90&&lat<=90?{lat,lon}:null;
 }
 function areaMatch(point){
  if(!point)return[];
  return AREAS.filter(a=>point.lat>=a.bounds.south&&point.lat<=a.bounds.north&&point.lon>=a.bounds.west&&point.lon<=a.bounds.east).map(a=>a.id);
 }
 function normalize(raw){
  if(!raw||typeof raw!=='object'||raw.sensitive===true)return null;
  const code=text(raw.code,24).toUpperCase();
  if(!/^EMS(?:R|N)\d{2,6}$/.test(code))return null;
  const point=wktPoint(raw.centroid);
  const countryNames=(Array.isArray(raw.countries)?raw.countries:[])
    .map(v=>typeof v==='string'?v:v?.short_name||v?.name).map(v=>text(v,60)).filter(Boolean);
  const sweden=countryNames.some(c=>/^(sweden|sverige)$/i.test(c));
  const matched=areaMatch(point);
  const areaScope=matched.length?'LOCAL_CENTROID':sweden?'SWEDEN_CONTEXT':'OUT_OF_SCOPE';
  const category=text(typeof raw.category==='object'?raw.category?.name||raw.category?.slug:raw.category,70);
  const catSlug=text(typeof raw.category==='object'?raw.category?.slug:raw.category,70).toLowerCase().replace(/[\s-]+/g,'_');
  const activationAt=iso(raw.activationTime);
  if(!activationAt||!text(raw.name))return null;
  const eventAt=iso(raw.eventTime);
  const updatedAt=iso(raw.lastUpdate)||activationAt;
  return {
   id:code,code,title:text(raw.name,210),category:category||'Unspecified',
   categoryTag:CATEGORY_ALLOW.has(catSlug)?catSlug:'unclassified',
   activationAt,eventAt,updatedAt,closed:raw.closed===true,
   countryNames:countryNames.slice(0,10),centroid:point,matchedAreas:matched,areaScope,
   nAois:Number.isFinite(+raw.n_aois)?Math.max(0,Math.floor(+raw.n_aois)):null,
   nProducts:Number.isFinite(+raw.n_products)?Math.max(0,Math.floor(+raw.n_products)):null,
   source:{name:'Copernicus Emergency Management Service / On-Demand Mapping',
    url:'https://mapping.emergency.copernicus.eu/activations/api/activations/'+encodeURIComponent(code)+'/',
    catalogue:'https://mapping.emergency.copernicus.eu/activations/'},
   evidence:'CONFIRMED_PUBLIC_MAPPING_ACTIVATION',
   interpretation:'Mapping activation metadata; location is only a catalogue centroid. Do not assume the centroid is the affected footprint, a live emergency or a verified road closure.'
  };
 }
 function catalogue(raw,{now=Date.now(),scannedPages=0,sourceCount=null,fetchFailures=[]}={}){
  const seen=new Map();
  for(const item of Array.isArray(raw)?raw:[]){
   const r=normalize(item);if(!r||r.areaScope==='OUT_OF_SCOPE')continue;
   const prior=seen.get(r.code);if(!prior||r.updatedAt>prior.updatedAt)seen.set(r.code,r);
  }
  const events=[...seen.values()].sort((a,b)=>b.activationAt.localeCompare(a.activationAt));
  const local=events.filter(e=>e.areaScope==='LOCAL_CENTROID');
  const national=events.filter(e=>e.areaScope==='SWEDEN_CONTEXT');
  const healthy=scannedPages>0;
  return {
   schemaVersion:'0.1',generatedAt:new Date(now).toISOString(),
   sourceHealth:{id:'CEMS_MAPPING_CATALOGUE',status:healthy?(fetchFailures.length?'PARTIAL':'AVAILABLE'):'UNAVAILABLE',
    lastSuccessfulScan:healthy?new Date(now).toISOString():null,pagesScanned:scannedPages,
    totalAdvertised:sourceCount,scope:'Copernicus published mapping activations only',
    coverageIncomplete:sourceCount==null||sourceCount>scannedPages*100,
    errors:fetchFailures.slice(0,6).map(String)},
   counts:{local:local.length,nationalContext:national.length,visible:events.length},
   areas:AREAS,activations:events.slice(0,150),
   limitations:[
    'Copernicus Mapping activations are not a continuous satellite survey; areas without activations may still be affected.',
    'The point is an activation catalogue centroid, not the mapped event boundary; overlap can be missed.',
    'Catalogue publication time differs from real-world event and satellite acquisition times.',
    'No live hazard severity, road closure, infrastructure damage or forecast is inferred from activation metadata.'
   ]
  };
 }
 return {AREAS,wktPoint,areaMatch,normalize,catalogue,safeUrl};
});
