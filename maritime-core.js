(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.NordicWatchMaritime=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const VERSION="0.7";
  const MAX_IMPORT_BYTES=2*1024*1024;
  const MAX_RECORDS=10000;
  const BOUNDS={west:-12,south:53,east:34.5,north:72.5};
  const TYPES=new Set(["vessel_position","maritime_event","navigation_warning","restriction","authority_notice","manual_event"]);
  const EVIDENCE=new Set(["observation","indicator","confirmed"]);
  const ALLOWED_USE=new Set(["test","display","analysis","alerts","commercial"]);
  const QUALITY={official:1,verified:0.9,licensed:0.8,community:0.55,unknown:0.3,mock:0.2};

  class MaritimeAdapter{
    constructor(id){if(!id)throw new Error("adapter id required");this.id=id}
    async load(){throw new Error("adapter must implement load()")}
  }
  class StaticDatasetAdapter extends MaritimeAdapter{
    constructor(id,records){super(id);this.records=records}
    async load(){return this.records}
  }

  function text(value,max=300){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max)}
  function httpsUrl(value){
    if(!value)return null;
    try{const u=new URL(String(value));return u.protocol==="https:"?u.href:null}catch{return null}
  }
  function timestamp(value){
    const numeric=Number(value);
    const ms=Number.isFinite(numeric)?(numeric<1e12?numeric*1000:numeric):Date.parse(String(value));
    return Number.isFinite(ms)?ms:null
  }
  function coordinates(lat,lon){
    lat=Number(lat);lon=Number(lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    if(lat<BOUNDS.south||lat>BOUNDS.north||lon<BOUNDS.west||lon>BOUNDS.east)return null;
    return {lat,lon}
  }
  function normalizeSource(raw,now){
    raw=raw&&typeof raw==="object"?raw:{};
    const retrievedAt=timestamp(raw.retrievedAt??raw.retrieved_at??now);
    const allowedUse=text(raw.allowedUse??raw.allowed_use,30).toLowerCase();
    const quality=text(raw.quality,20).toLowerCase()||"unknown";
    return {
      name:text(raw.name,100),
      publisher:text(raw.publisher,100),
      license:text(raw.license,120),
      url:httpsUrl(raw.url),
      retrievedAt,
      allowedUse:ALLOWED_USE.has(allowedUse)?allowedUse:null,
      quality:Object.hasOwn(QUALITY,quality)?quality:"unknown"
    }
  }
  function normalizeRecord(raw,index=0,now=Date.now()){
    const errors=[];
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return {record:null,errors:["record must be an object"]};
    const type=text(raw.type??raw.record_type,40).toLowerCase();
    if(!TYPES.has(type))errors.push("unsupported type");
    const id=text(raw.id??raw.event_id??raw.mmsi,100);
    if(!id)errors.push("id required");
    const at=timestamp(raw.timestamp??raw.time??raw.start);
    if(at===null)errors.push("valid timestamp required");
    const pos=coordinates(raw.lat??raw.latitude??raw.geometry?.coordinates?.[1],raw.lon??raw.lng??raw.longitude??raw.geometry?.coordinates?.[0]);
    if(!pos)errors.push("coordinates outside NordicWatch bounds");
    const source=normalizeSource(raw.source??{
      name:raw.source_name,publisher:raw.publisher,license:raw.license,url:raw.source_url,
      retrievedAt:raw.retrieved_at,allowedUse:raw.allowed_use,quality:raw.source_quality
    },now);
    if(!source.name)errors.push("source.name required");
    if(!source.license)errors.push("source.license required");
    if(!source.retrievedAt)errors.push("source.retrievedAt required");
    if(!source.allowedUse)errors.push("source.allowedUse invalid");
    const evidence=text(raw.evidence??raw.evidence_class,30).toLowerCase();
    if(!EVIDENCE.has(evidence))errors.push("evidence must be observation, indicator or confirmed");
    const title=text(raw.title??raw.name??"Maritime signal",160);
    const description=text(raw.description??raw.details,800);
    const end=timestamp(raw.end??raw.end_time);
    const record={
      schemaVersion:"0.7",id,type,evidence,title,description,
      lat:pos?.lat,lon:pos?.lon,timestamp:at,end:end&&end>=at?end:null,
      mmsi:text(raw.mmsi,9).replace(/\D/g,"").slice(0,9)||null,
      speed:Number.isFinite(Number(raw.speed??raw.sog))?Number(raw.speed??raw.sog):null,
      course:Number.isFinite(Number(raw.course??raw.cog))?Number(raw.course??raw.cog):null,
      status:text(raw.status,80)||null,link:httpsUrl(raw.link),source,
      tags:(Array.isArray(raw.tags)?raw.tags:String(raw.tags??"").split(/[|;]/)).map(x=>text(x,40)).filter(Boolean).slice(0,20),
      importedAt:now,importIndex:index
    };
    if(record.mmsi&&!/^\d{9}$/.test(record.mmsi))errors.push("mmsi must contain 9 digits");
    if(record.speed!==null&&(record.speed<0||record.speed>100))errors.push("speed outside 0–100 kt");
    if(record.course!==null&&(record.course<0||record.course>=360))errors.push("course outside 0–359.999");
    return {record:errors.length?null:record,errors}
  }

  function parseCsv(input){
    const rows=[];let row=[],cell="",quote=false;
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(quote){
        if(ch==='"'&&input[i+1]==='"'){cell+='"';i++}
        else if(ch==='"')quote=false;else cell+=ch
      }else if(ch==='"')quote=true;
      else if(ch===","){row.push(cell);cell=""}
      else if(ch==="\n"){row.push(cell);rows.push(row);row=[];cell=""}
      else if(ch!=="\r")cell+=ch
    }
    if(quote)throw new Error("unterminated CSV quote");
    if(cell||row.length){row.push(cell);rows.push(row)}
    if(rows.length<2)return [];
    const headers=rows.shift().map(x=>text(x,80));
    if(new Set(headers).size!==headers.length)throw new Error("duplicate CSV headers");
    return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])))
  }
  function geoJsonRecords(value){
    if(!value||value.type!=="FeatureCollection"||!Array.isArray(value.features))throw new Error("GeoJSON FeatureCollection required");
    return value.features.map((feature,i)=>{
      if(feature?.type!=="Feature"||feature.geometry?.type!=="Point")return {__invalid:"only Point features are supported",__index:i};
      return {...(feature.properties||{}),geometry:feature.geometry}
    })
  }
  function importDataset({name="import",mime="",content,size,now=Date.now()}){
    const bytes=Number(size??(typeof TextEncoder!=="undefined"?new TextEncoder().encode(content).length:String(content).length));
    if(!Number.isFinite(bytes)||bytes<=0)return {accepted:[],quarantine:[{index:-1,errors:["empty file"]}],summary:{accepted:0,quarantined:1,duplicates:0}};
    if(bytes>MAX_IMPORT_BYTES)return {accepted:[],quarantine:[{index:-1,errors:["file exceeds 2 MiB limit"]}],summary:{accepted:0,quarantined:1,duplicates:0}};
    let raw;
    try{
      const lower=name.toLowerCase();
      if(lower.endsWith(".csv")||mime.includes("csv"))raw=parseCsv(String(content));
      else{
        const parsed=typeof content==="string"?JSON.parse(content):content;
        raw=parsed?.type==="FeatureCollection"?geoJsonRecords(parsed):(Array.isArray(parsed)?parsed:[parsed])
      }
    }catch(error){return {accepted:[],quarantine:[{index:-1,errors:["parse error: "+text(error.message,160)]}],summary:{accepted:0,quarantined:1,duplicates:0}}}
    if(raw.length>MAX_RECORDS)return {accepted:[],quarantine:[{index:-1,errors:["record count exceeds 10000"]}],summary:{accepted:0,quarantined:1,duplicates:0}};
    const accepted=[],quarantine=[],seen=new Set();let duplicates=0;
    raw.forEach((item,index)=>{
      if(item?.__invalid){quarantine.push({index,errors:[item.__invalid],raw:item});return}
      const out=normalizeRecord(item,index,now);
      if(!out.record){quarantine.push({index,errors:out.errors,raw:item});return}
      const key=out.record.type+"|"+out.record.id+"|"+out.record.timestamp;
      if(seen.has(key)){duplicates++;quarantine.push({index,errors:["duplicate record"],raw:item});return}
      seen.add(key);accepted.push(out.record)
    });
    return {accepted,quarantine,summary:{accepted:accepted.length,quarantined:quarantine.length,duplicates}}
  }

  function km(a,b){
    const R=6371,toRad=x=>x*Math.PI/180,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);
    const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(q))
  }
  function correlate(record,context={},config={}){
    const distanceKm=Number(config.distanceKm)||100,timeMs=(Number(config.timeHours)||24)*3600000;
    const candidates=[];
    const add=(kind,item,at)=>{
      if(!Number.isFinite(+item.lat)||!Number.isFinite(+item.lon))return;
      const distance=km(record,item),delta=at==null?null:Math.abs(record.timestamp-at);
      if(distance<=distanceKm&&(delta===null||delta<=timeMs))candidates.push({kind,id:text(item.id??item.title??item.name,100),distanceKm:distance,timeDeltaMs:delta,source:text(item.source?.name??item.source,100)})
    };
    (context.hotspots||[]).forEach(x=>add("hotspot",x,null));
    (context.aircraft||[]).forEach(x=>add("aircraft",x,timestamp(x.timestamp??x.seenAt??Date.now())));
    (context.gnss||[]).forEach(x=>add("gnss",x,timestamp(x.timestamp)));
    (context.news||[]).forEach(x=>add("news",x,timestamp(x.timestamp??x.date)));
    (context.maritime||[]).forEach(x=>{if(x!==record)add("maritime",x,timestamp(x.timestamp))});
    return candidates.sort((a,b)=>a.distanceKm-b.distanceKm)
  }
  function riskScore(record,correlations=[],now=Date.now()){
    const nearest=correlations[0]?.distanceKm;
    const geography=nearest==null?0:nearest<=5?30:nearest<=20?22:nearest<=50?14:nearest<=100?7:0;
    const timed=correlations.filter(x=>x.timeDeltaMs!==null);
    const minTime=timed.length?Math.min(...timed.map(x=>x.timeDeltaMs)):null;
    const temporal=minTime===null?0:minTime<=3600000?20:minTime<=6*3600000?14:minTime<=24*3600000?7:0;
    const sources=new Set([record.source.name,...correlations.map(x=>x.source).filter(Boolean)]);
    const independentSources=Math.min(20,Math.max(0,sources.size-1)*7);
    const sourceQuality=Math.round(20*(QUALITY[record.source.quality]??QUALITY.unknown));
    const age=Math.max(0,now-record.timestamp),freshness=age<=3600000?10:age<=6*3600000?7:age<=24*3600000?4:age<=7*86400000?1:0;
    const total=Math.min(100,geography+temporal+independentSources+sourceQuality+freshness);
    return {total,components:{geography,temporal,independentSources,sourceQuality,freshness},confidence:sourceQuality>=18&&sources.size>=2?"HIGH":sourceQuality>=11?"MEDIUM":"LOW"}
  }
  function eventKey(record){return record.type+"|"+record.id+"|"+record.timestamp}

  return {VERSION,MAX_IMPORT_BYTES,MAX_RECORDS,BOUNDS,TYPES:[...TYPES],EVIDENCE:[...EVIDENCE],
    MaritimeAdapter,StaticDatasetAdapter,normalizeRecord,parseCsv,geoJsonRecords,importDataset,
    correlate,riskScore,eventKey,km,httpsUrl};
});
