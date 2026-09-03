(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.NordicWatchEvents=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const EVENT_TYPES=new Set(["military_exercise","deployment","air_policing_activity","readiness_increase","readiness_change","drone_incident","border_incident","naval_exercise","naval_activity","official_defence_announcement","intercept","scramble","airspace_violation","isr_activity","ew_activity"]);
  const ACTIVITY_TYPES=new Set(["FIGHTER","TRANSPORT","HELICOPTER","UAV","AWACS","TANKER","NAVAL","GROUND_FORCES","AIR_DEFENCE","ISR"]);
  const OFFICIAL_HOSTS=["nato.int","forsvarsmakten.se","puolustusvoimat.fi","mil.ee","mil.lv","mod.gov.lv","kariuomene.lt","forsvaret.no","gov.pl","joint-expeditionary-force.com","gov.uk","dvidshub.net","defense.gov","war.gov","navy.mil","marines.mil","af.mil","army.mil"];
  const TRUSTED_EXTERNAL_HOSTS=["reuters.com","apnews.com","afp.com","pap.pl","polskieradio.pl","rtve.es"];
  const NATO_COUNTRIES=new Set(["albania","belgium","bulgaria","canada","croatia","czechia","denmark","estonia","finland","france","germany","greece","hungary","iceland","italy","latvia","lithuania","luxembourg","montenegro","netherlands","north macedonia","norway","poland","portugal","romania","slovakia","slovenia","spain","sweden","turkey","united kingdom","united states"]);
  const clean=(value,max=500)=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
  const safeUrl=value=>{try{const u=new URL(String(value));return u.protocol==="https:"?u.href:null}catch{return null}};
  const officialUrl=value=>{const url=safeUrl(value);if(!url)return false;const host=new URL(url).hostname.toLowerCase();return OFFICIAL_HOSTS.some(x=>host===x||host.endsWith("."+x))};
  const trustedExternalUrl=value=>{const url=safeUrl(value);if(!url)return false;const host=new URL(url).hostname.toLowerCase();return TRUSTED_EXTERNAL_HOSTS.some(x=>host===x||host.endsWith("."+x))};
  const list=(value,max=30)=>[...new Set((Array.isArray(value)?value:[]).map(x=>clean(x,80)).filter(Boolean))].slice(0,max);
  function activity(value){const key=clean(value,40).toUpperCase().replace(/[\s-]+/g,"_").replace(/S$/,"");const aliases={FIGHTERS:"FIGHTER",TRANSPORTS:"TRANSPORT",HELICOPTERS:"HELICOPTER",DRONES:"UAV",DRONE:"UAV",GROUND_FORCE:"GROUND_FORCES",AIR_DEFENSE:"AIR_DEFENCE"};return aliases[key]||key}
  function normalizeEvent(raw){
    if(!raw||typeof raw!=="object")return null;
    const eventType=clean(raw.eventType,60).toLowerCase().replace(/[\s-]+/g,"_");
    const sourceUrl=safeUrl(raw.sourceUrl),start=new Date(raw.startTime),end=new Date(raw.endTime);
    const latitude=Number(raw.latitude),longitude=Number(raw.longitude),radiusKm=Number(raw.radiusKm);
    if(!clean(raw.id,120)||!clean(raw.title,200)||!EVENT_TYPES.has(eventType)||!sourceUrl||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return null;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<45||latitude>75||longitude< -15||longitude>45||!Number.isFinite(radiusKm)||radiusKm<1||radiusKm>1000)return null;
    const expectedActivity=[...new Set(list(raw.expectedActivity).map(activity).filter(x=>ACTIVITY_TYPES.has(x)))];
    const confidenceValue=clean(raw.confidence,30).toUpperCase(),confirmed=officialUrl(sourceUrl)&&confidenceValue==="CONFIRMED",confirmedExternal=trustedExternalUrl(sourceUrl)&&confidenceValue==="CONFIRMED_EXTERNAL";
    const discovery=raw.discovery&&typeof raw.discovery==="object"?{temporaryWatchZone:raw.discovery.temporaryWatchZone===true,score:Math.max(0,Math.min(100,Number(raw.discovery.score)||0)),scoreReasons:list(raw.discovery.scoreReasons,20),scoreExplanation:clean(raw.discovery.scoreExplanation,500),exerciseKey:clean(raw.discovery.exerciseKey,160),memberIds:list(raw.discovery.memberIds,50),relatedEventIds:list(raw.discovery.relatedEventIds,50)}:null;
    const evidenceDetail=raw.evidence&&typeof raw.evidence==="object"?{confirmed:raw.evidence.confirmed?{sourceUrl:officialUrl(raw.evidence.confirmed.sourceUrl)?safeUrl(raw.evidence.confirmed.sourceUrl):sourceUrl,sourceName:clean(raw.evidence.confirmed.sourceName,120),text:clean(raw.evidence.confirmed.text,500)}:null,observed:(Array.isArray(raw.evidence.observed)?raw.evidence.observed:[]).slice(0,100).map(x=>({evidence:"OBSERVED",hex:clean(x.hex,20),callsign:clean(x.callsign,30),type:clean(x.type,30)})),inferred:(Array.isArray(raw.evidence.inferred)?raw.evidence.inferred:[]).slice(0,50).map(x=>({text:clean(x.text,500)}))}:null;
    const external=raw.externalReport&&typeof raw.externalReport==="object"?{evidenceType:confirmedExternal?"CONFIRMED_EXTERNAL":"INFERRED",aircraftType:clean(raw.externalReport.aircraftType,60),aircraftRole:clean(raw.externalReport.aircraftRole,40),aircraftCountry:clean(raw.externalReport.aircraftCountry,80),respondingCountry:clean(raw.externalReport.respondingCountry,80),respondingAircraft:list(raw.externalReport.respondingAircraft,20),locationText:clean(raw.externalReport.locationText,200),locationConfidence:clean(raw.externalReport.locationConfidence,30),interestScore:Math.max(0,Math.min(100,Number(raw.externalReport.interestScore)||0)),trackObserved:raw.externalReport.trackObserved===true,sources:(Array.isArray(raw.externalReport.sources)?raw.externalReport.sources:[]).slice(0,20).map(x=>({sourceName:clean(x.sourceName,120),sourceUrl:safeUrl(x.sourceUrl),sourceType:clean(x.sourceType,50)})).filter(x=>x.sourceUrl)}:null;
    return {id:clean(raw.id,120),title:clean(raw.title,200),eventType,startTime:start.toISOString(),endTime:end.toISOString(),latitude,longitude,radiusKm,areaName:clean(raw.areaName,120),countries:list(raw.countries),organisations:list(raw.organisations),description:clean(raw.description,1200),sourceUrl,sourceName:clean(raw.sourceName,120),confidence:confirmed?"CONFIRMED":confirmedExternal?"CONFIRMED_EXTERNAL":confidenceValue||"LOW",severity:clean(raw.severity,30).toUpperCase()||"INFO",expectedActivity,participants:Number.isFinite(+raw.participants)?Math.max(0,Math.round(+raw.participants)):null,evidence:confirmed?"CONFIRMED":confirmedExternal?"CONFIRMED_EXTERNAL":"INFERRED",evidenceDetail,externalReport:external,discovery,seed:raw.seed===true,updatedAt:raw.updatedAt&&!Number.isNaN(new Date(raw.updatedAt).getTime())?new Date(raw.updatedAt).toISOString():null};
  }
  function importEvents(records){
    const events=[],byId=new Map(),byUrl=new Map();let rejected=0,deduplicated=0;
    for(const raw of Array.isArray(records)?records:[]){const event=normalizeEvent(raw);if(!event){rejected++;continue}const index=byId.get(event.id)??byUrl.get(event.sourceUrl);if(index!==undefined){deduplicated++;const old=events[index];if(old.seed&&!event.seed)events[index]=event;continue}const i=events.push(event)-1;byId.set(event.id,i);byUrl.set(event.sourceUrl,i)}
    return {events,rejected,deduplicated};
  }
  function statusAt(event,now=Date.now()){const t=+new Date(now),start=+new Date(event.startTime),end=+new Date(event.endTime);return t<start?"UPCOMING":t>end?"ENDED":"ACTIVE"}
  function distanceKm(a,b,c,d){const r=Math.PI/180,p1=a*r,p2=c*r,dp=(c-a)*r,dl=(d-b)*r,x=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
  function aircraftCategory(ac,classify){const result=classify?classify(ac):{};const role=clean(result&&result.role,30).toUpperCase();if(ACTIVITY_TYPES.has(role))return role;const type=clean(ac.t||ac.type||ac.aircraft_type,30).toUpperCase();if(/^(MQ|RQ|HERON|TB2|UAV)/.test(type))return "UAV";if(/^(H|EC|AS|AW|S7|UH|CH|NH90)/.test(type))return "HELICOPTER";return role||"OTHER"}
  function actorOf(ac,event){const text=[ac.cou,ac.country,ac.operator,ac.op,ac.registration,ac.r,ac.flight].map(x=>clean(x,100).toLowerCase()).join(" ");if(/\b(russia|russian|rossiya)\b/.test(text)||/\bra-\d/.test(text))return "RUSSIA";const countries=event.countries.map(x=>x.toLowerCase());if(countries.some(x=>x&&text.includes(x)))return "PARTICIPANT";if(event.organisations.some(x=>/nato|jef/i.test(x))&&[...NATO_COUNTRIES].some(x=>text.includes(x)))return "ALLIED";return "UNKNOWN"}
  function assessEvent(event,aircraft,{now=Date.now(),classify}={}){
    if(statusAt(event,now)!=="ACTIVE")return {eventId:event.id,status:statusAt(event,now),observed:[],counts:{},explained:[],deviations:[],baselineModifier:0,interestModifier:0,scoreDelta:0};
    const observed=[];
    for(const ac of Array.isArray(aircraft)?aircraft:[]){const lat=Number(ac.lat),lon=Number(ac.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||distanceKm(event.latitude,event.longitude,lat,lon)>event.radiusKm)continue;const classified=classify?classify(ac):{};if(classified&&classified.base&&classified.base!=="MILITARY")continue;const category=aircraftCategory(ac,()=>classified),actor=actorOf(ac,event);observed.push({evidence:"OBSERVED",category,actor,lat,lon,hex:clean(ac.hex,20),callsign:clean(ac.flight||ac.callsign,30)})}
    const counts={};observed.forEach(x=>counts[x.category]=(counts[x.category]||0)+1);
    const explained=observed.filter(x=>event.expectedActivity.includes(x.category)&&(x.actor==="PARTICIPANT"||x.actor==="ALLIED"));
    const deviations=[];let interestModifier=0;
    observed.forEach(x=>{if(x.actor==="RUSSIA"&&x.category==="ISR"){interestModifier=Math.max(interestModifier,30);deviations.push({evidence:"INFERRED",kind:"RUSSIAN_ISR",text:"Russian ISR detected near active NATO exercise area.",aircraft:x})}else if(x.actor==="RUSSIA"){interestModifier=Math.max(interestModifier,18);deviations.push({evidence:"INFERRED",kind:"RUSSIAN_ACTIVITY",text:`Russian ${x.category.toLowerCase()} activity near active event area.`,aircraft:x})}});
    const baselineModifier=-Math.min(20,explained.length*4),scoreDelta=deviations.length?interestModifier:baselineModifier;
    return {eventId:event.id,status:"ACTIVE",observed,counts,explained,deviations,baselineModifier,interestModifier,scoreDelta,confirmedContext:{evidence:"CONFIRMED",title:event.title,sourceUrl:event.sourceUrl}};
  }
  const fingerprint=e=>JSON.stringify([e.title,e.eventType,e.startTime,e.endTime,e.latitude,e.longitude,e.radiusKm,e.areaName,e.countries,e.organisations,e.expectedActivity,e.confidence,e.severity]);
  function diffEvents(previous,current,now=Date.now()){
    const before=new Map((Array.isArray(previous)?previous:[]).map(x=>[x.id,x])),after=new Map((Array.isArray(current)?current:[]).map(x=>[x.id,x])),changes=[];
    for(const e of after.values()){const old=before.get(e.id),status=statusAt(e,now),oldStatus=old&&(old.snapshotStatus||statusAt(old,now));if(!old&&status==="ACTIVE")changes.push({kind:"STARTED",event:e,text:`${e.title} became active in ${e.countries[0]||"its event area"}.`});else if(old&&oldStatus==="ACTIVE"&&status==="ENDED")changes.push({kind:"ENDED",event:e,text:`${e.title} ended.`});else if(old&&oldStatus!=="ACTIVE"&&status==="ACTIVE")changes.push({kind:"STARTED",event:e,text:`${e.title} became active in ${e.countries[0]||"its event area"}.`});else if(old&&fingerprint(old)!==fingerprint(e))changes.push({kind:"CHANGED",event:e,text:`${e.title} event details changed.`})}
    return changes;
  }
  return {EVENT_TYPES:[...EVENT_TYPES],ACTIVITY_TYPES:[...ACTIVITY_TYPES],OFFICIAL_HOSTS,TRUSTED_EXTERNAL_HOSTS,clean,safeUrl,officialUrl,trustedExternalUrl,normalizeEvent,importEvents,statusAt,distanceKm,assessEvent,diffEvents};
});
