(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NordicWatchFreshness=api})(globalThis,function(){
  'use strict';
  const H=3600000,WINDOW_HOURS=72,SKEW_HOURS=2;
  function parse(value){
    if(value==null||value==='')return null;
    let ms;
    if(value instanceof Date)ms=value.getTime();
    else if(typeof value==='number'||/^\d{10}(?:\.\d+)?$|^\d{13}$/.test(String(value).trim())){const n=Number(value);ms=Math.abs(n)<1e11?n*1000:n;}
    else {let s=String(value).trim();const compact=s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);if(compact)s=`${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`;
      // An ISO wall-clock value without an offset is interpreted as UTC, never machine-local time.
      if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(s))s=s.replace(' ','T')+'Z';
      const calendar=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(calendar){const [,y,m,d]=calendar.map(Number);const check=new Date(Date.UTC(y,m-1,d));if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;}
      ms=Date.parse(s);
    }
    return Number.isFinite(ms)&&ms>=Date.UTC(1990,0,1)&&ms<Date.UTC(2100,0,1)?new Date(ms).toISOString():null;
  }
  function dates(item){
    const pubFields=['publishedAt','articlePublishedAt','published','pubDate','date','dc:date','seendate','timestamp'],updFields=['updatedAt','updated','lastUpdatedAt'];
    const pick=fields=>{for(const field of fields){if(field==='lastUpdatedAt'&&(item.timestampStatus==='UNKNOWN'||item.timeStatus==='TIME_UNCERTAIN')&&!parse(item.rawUpdatedAt))continue;const value=parse(item[field]);if(value)return {field,value}}return null};
    const pub=pick(pubFields),upd=pick(updFields),fallback=pub||upd;
    return {publishedAt:pub?.value||null,updatedAt:upd?.value||null,timestamp:fallback?.value||null,timestampSource:fallback?.field||null,timestampStatus:fallback?'KNOWN':'UNKNOWN',rawPublishedAt:pubFields.map(k=>item[k]).find(v=>v!=null&&v!=='')??null,rawUpdatedAt:updFields.map(k=>item[k]).find(v=>v!=null&&v!=='')??null};
  }
  function assess(item,now=Date.now()){
    const d=dates(item),ageHours=d.timestamp?(now-Date.parse(d.timestamp))/H:null,valid=d.timestamp!==null,pass=valid&&ageHours>=-SKEW_HOURS&&ageHours<=WINDOW_HOURS;
    return {sourceName:item.sourceName||item.domain||item.sourceId||null,title:item.title||'',rawPublishedAt:item.rawPublishedAt??d.rawPublishedAt,rawUpdatedAt:item.rawUpdatedAt??d.rawUpdatedAt,normalizedPublishedAt:d.publishedAt,normalizedUpdatedAt:d.updatedAt,now:new Date(now).toISOString(),ageHours,windowHours:WINDOW_HOURS,skewToleranceHours:SKEW_HOURS,timestampSource:d.timestampSource,timestampStatus:d.timestampStatus,freshnessResult:pass?'PASS':'FAIL',reason:!valid?'Missing or invalid timestamp':ageHours < -SKEW_HOURS?'Future timestamp exceeds 2h tolerance':ageHours>WINDOW_HOURS?`Article age ${ageHours.toFixed(1)}h > 72h`:ageHours<0?'Future timestamp within 2h tolerance':'Within 72h',futureSkewed:valid&&ageHours<0};
  }
  function inspect(items,now=Date.now()){const records=items.map(a=>assess(a,now));return {records,counters:{fetched:items.length,validTimestamps:records.filter(r=>r.timestampStatus==='KNOWN').length,fresh:records.filter(r=>r.freshnessResult==='PASS').length,stale:records.filter(r=>r.ageHours>WINDOW_HOURS).length,invalid:records.filter(r=>r.timestampStatus==='UNKNOWN').length,futureSkewed:records.filter(r=>r.futureSkewed).length}}}
  return {parse,dates,assess,inspect,WINDOW_HOURS,SKEW_HOURS};
});
