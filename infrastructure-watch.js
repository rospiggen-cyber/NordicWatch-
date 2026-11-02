/* NordicWatch Civil Infrastructure Watch — reported observations, not attribution. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.NordicWatchInfrastructureWatch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const WINDOW_MS=72*3600000;
  const normalize=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const retail=/\b(ica|coop|delhaize|intermarche|carrefour|leclerc|willys|hemkop|city gross|axfood|kesko|k-?market|s-?market|rema 1000|matbutik\w*|mataffar\w*|supermarket\w*|grocery stores?)\b/i;
  const cold=/\b(frys\w*|kyl\w*|fridge\w*|freezer\w*|refrigerat\w*|frigo\w*|surgelat\w*|refrigerateur\w*|cold[- ]?storage|cold[- ]?chain|defrost\w*|livsmedelskyla)\b/i;
  const energy=/\b(elavbrott\w*|elnat\w*|kraftnat\w*|elcentral\w*|power grid|power outages?|electricity grid|district heating|fjarrvarme|transformer\w*)\b/i;
  const water=/\b(dricksvatten\w*|vattenverk\w*|vattenforsorjning\w*|water supply|water treatment|wastewater|reningsverk\w*)\b/i;
  const transport=/\b(jarnvag\w*|railway\w*|train traffic|tunnelbana\w*|transportkedja\w*|logistiksystem\w*|port terminal\w*|hamnterminal\w*)\b/i;
  const health=/\b(sjukhus\w*|hospital\w*|patient data|vardsystem\w*|lakemedelslager\w*|medical cold chain)\b/i;
  const telecom=/\b(telekom\w*|telecommunications?|mobile network|mobilnat\w*|internet backbone)\b/i;
  const interruption=/\b(hack\w*|cyber\w*|intrang\w*|sabotage\w*|storn\w*|driftstorn\w*|avbrott\w*|ur funktion|utsla\w*|outage\w*|panne\w*|disrupt\w*|compromis\w*|attack\w*|manipulat\w*|failure\w*|malfunction\w*|felaktig temperatur|systemfel\w*|problem\w*)\b/i;
  const cyber=/\b(hack\w*|cyber\w*|intrang\w*|ransomware|compromis\w*|malware|data breach)\b/i;
  const operators=[["ICA",/\bica\b/i],["Coop",/\bcoop\b/i],["Delhaize",/\bdelhaize\b/i],["Intermarché",/\bintermarche\b/i],["Carrefour",/\bcarrefour\b/i],["Leclerc",/\bleclerc\b/i],["Willys",/\bwillys\b/i],["Axfood",/\baxfood\b/i],["Danfoss",/\bdanfoss\b/i],["Copeland",/\bcopeland\b/i],["Dixell",/\bdixell\b/i]];
  function parseDate(raw){
    if(!raw)return NaN;
    const v=String(raw);
    const match=v.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
    return match?Date.parse(match[1]+"-"+match[2]+"-"+match[3]+"T"+match[4]+":"+match[5]+":"+match[6]+"Z"):Date.parse(v);
  }
  function countryOf(content,sourceCountry,host){
    // GDELT sourcecountry is the publisher location, never the incident location.
    // Ignore it to avoid placing foreign stories in the Nordic AOI.
    const nordicMention=/\b(sweden|swedish|sverige|svensk\w*|norge|norway|danmark|denmark|suomi|finland|estonia|latvia|lithuania)\b/.test(content);
    const belgian=/\b(belgium|belgian|belgien|belgique|belges?|belgische|belgie)\b/.test(content);
    const french=/\b(france|french|francais|francaise|frankrike)\b/.test(content);
    if(!nordicMention&&belgian&&!french)return"Belgium";
    if(!nordicMention&&french&&!belgian)return"France";
    if((belgian||french)&&nordicMention)return null; // Cross-country context is not an incident coordinate.
    if(/\b(usa|u\.s\.|united states|russia|russian|spain|spanish|germany|german)\b/.test(content)&&!nordicMention)return null;
    if(/\b(sweden|swedish|sverige|svensk\w*|stockholm|uppsala|gotland|goteborg|malmo)\b/.test(content))return"Sweden";
    if(/\b(norway|norwegian|norge|oslo)\b/.test(content))return"Norway";
    if(/\b(denmark|danish|danmark|copenhagen|kopenhamn)\b/.test(content))return"Denmark";
    if(/\b(finland|finnish|suomi|helsinki)\b/.test(content))return"Finland";
    if(/\b(estonia|estland|tallinn)\b/.test(content))return"Estonia";
    if(/\b(latvia|lettland|riga)\b/.test(content))return"Latvia";
    if(/\b(lithuania|litauen|vilnius)\b/.test(content))return"Lithuania";
    // A Nordic publisher and a named Swedish retail operator provide weak geographical context only.
    if(host.endsWith(".se")&&/\b(ica|coop|willys|axfood|hemkop)\b/.test(content))return"Sweden";
    return null;
  }
  function classify(article,now=Date.now()){
    if(!article||typeof article!=="object")return null;
    const title=String(article.title||"").trim().slice(0,300);
    if(!title)return null;
    let url,host;
    try{url=new URL(article.url||article.sourceUrl);if(url.protocol!=="https:")return null;host=url.hostname.toLowerCase()}catch{return null}
    const body=normalize([title,article.description,article.summary].filter(Boolean).join(" "));
    const operator=operators.find(([name,rx])=>rx.test(body)&&!["Danfoss","Copeland","Dixell"].includes(name))?.[0]||null;
    const isRetail=retail.test(body);
    const isCold=cold.test(body);
    const category=isCold?"COLD_CHAIN":energy.test(body)?"ENERGY":water.test(body)?"WATER":health.test(body)?"HEALTH":telecom.test(body)?"TELECOM":transport.test(body)?"TRANSPORT":isRetail?"RETAIL_OPERATIONS":null;
    if(!category||!interruption.test(body))return null;
    const country=countryOf(body,article.sourcecountry||article.country,host);
    if(!country)return null;
    const seenAt=parseDate(article.publishedAt||article.seendate||article.date||article.indexedAt);
    if(!Number.isFinite(seenAt)||seenAt>now+3600000||now-seenAt>WINDOW_MS)return null;
    const label=isCold?"Cold chain / refrigeration":category==="RETAIL_OPERATIONS"?"Retail operations":category==="ENERGY"?"Energy supply":category==="WATER"?"Water systems":category==="HEALTH"?"Healthcare":category==="TELECOM"?"Telecom": "Transport / logistics";
    const status=cyber.test(body)?"CYBER_REPORTED":"DISRUPTION_REPORTED";
    const family=(category==="COLD_CHAIN"||category==="RETAIL_OPERATIONS")?"FOOD_SUPPLY":category;
    // These are publisher claims, not verified equipment inventories or forensic artifacts.
    const systems=["Danfoss","Copeland","Dixell"].filter(name=>new RegExp("\\b"+name+"\\b","i").test(body));
    const methods=[];
    if(/\b(defrost\w*|avfrost\w*)\b/.test(body)&&/\b(manipulat\w*|andra\w*|andrat|changed|altered|hack\w*|attack\w*)\b/.test(body))methods.push("DEFROST_SETTINGS_REPORTED");
    if(/\b(setpoint\w*|borvarde\w*|temperature settings?|temperaturinstallning\w*)\b/.test(body)&&/\b(manipulat\w*|andra\w*|andrat|changed|altered|hack\w*|attack\w*)\b/.test(body))methods.push("SETPOINT_CHANGE_REPORTED");
    return {id:url.origin+url.pathname,title,url:url.href,host,seenAt:new Date(seenAt).toISOString(),country,operator,category,family,label,status,sourceName:host,scope:country==="Belgium"||country==="France"?"EUROPE_CONTEXT":"NORDIC",systems,methods};
  }
  function tracePattern(rows){
    // Require separate named affected operators for a shared indicator; repeat press coverage is not enough.
    const shared=(field)=>{
      const owners=new Map();
      for(const row of rows){
        if(!row.operator)continue;
        for(const value of row[field]||[]){
          if(!owners.has(value))owners.set(value,new Set());
          owners.get(value).add(row.operator);
        }
      }
      return [...owners.entries()].filter(([,ops])=>ops.size>=2).map(([value])=>value);
    };
    const sharedSystems=shared("systems"),sharedMethods=shared("methods");
    const hypothesis=sharedSystems.length&&sharedMethods.length?"COMMON_METHOD_AND_SYSTEM_REPORTED":sharedSystems.length?"COMMON_SYSTEM_MENTIONED":sharedMethods.length?"COMMON_METHOD_REPORTED":"SECTOR_AND_REPORTING_WINDOW_ONLY";
    return {hypothesis,sharedSystems,sharedMethods,networkOrigin:"UNKNOWN",entryPoint:"UNKNOWN",actor:"UNKNOWN",evidenceLevel:sharedSystems.length&&sharedMethods.length?"REPORTED_OVERLAP":"PRELIMINARY",missingEvidence:["Victim-side access and audit logs","Verified controller models and firmware","Authorized incident-response indicators","Independent authority confirmation"]};
  }
  function assess(articles,now=Date.now()){
    const uniq=new Map();
    for(const row of Array.isArray(articles)?articles:[]){
      const incident=classify(row,now);
      if(!incident)continue;
      if(!uniq.has(incident.id))uniq.set(incident.id,incident);
    }
    const incidents=[...uniq.values()].sort((a,b)=>Date.parse(b.seenAt)-Date.parse(a.seenAt));
    const groups=new Map(),familyGroups=new Map();
    for(const item of incidents){
      const key=item.country+"|"+item.family;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(item);
      if(!familyGroups.has(item.family))familyGroups.set(item.family,[]);
      familyGroups.get(item.family).push(item);
    }
    const watches=[];
    for(const rows of groups.values()){
      const operatorsFound=[...new Set(rows.map(r=>r.operator).filter(Boolean))];
      // Two separate incident reports naming different operators: watch, never a confirmed relationship.
      if(rows.length>=2&&operatorsFound.length>=2){
        watches.push({status:"BEVAKA",country:rows[0].country,family:rows[0].family,operatorCount:operatorsFound.length,operators:operatorsFound,reportCount:rows.length,sourceCount:new Set(rows.map(r=>r.host)).size,latestAt:rows[0].seenAt,trace:tracePattern(rows),explanation:"Sector overlap and reporting within 72 hours only; occurrence times and a shared cause are not established."});
      }
    }
    for(const rows of familyGroups.values()){
      const countries=[...new Set(rows.map(r=>r.country))];
      const nordicRows=rows.filter(r=>r.scope==="NORDIC"),externalRows=rows.filter(r=>r.scope==="EUROPE_CONTEXT");
      if(!nordicRows.length||!externalRows.length)continue;
      const operatorsFound=[...new Set(rows.map(r=>r.operator).filter(Boolean))];
      if(operatorsFound.length<2)continue;
      const trace=tracePattern(rows);
      watches.push({status:"BEVAKA",scope:"CROSS_BORDER",country:countries.join(" / "),countries,family:rows[0].family,operatorCount:operatorsFound.length,operators:operatorsFound,reportCount:rows.length,sourceCount:new Set(rows.map(r=>r.host)).size,latestAt:rows[0].seenAt,trace,explanation:"Cross-border reports share a sector and indexing window; common method, cause and actor remain unverified."});
    }
    watches.sort((a,b)=>Date.parse(b.latestAt)-Date.parse(a.latestAt));
    return {incidents:incidents.slice(0,30),watches,assessedAt:new Date(now).toISOString(),windowHours:72};
  }
  function endpoint(){
    const url=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.search=new URLSearchParams({
      query:'(("Belgium" OR "Belgique" OR "Belgien" OR "Delhaize" OR "France" OR "French" OR "Sweden" OR "Sverige" OR "Norway" OR "Norge" OR "Denmark" OR "Danmark" OR "Finland" OR "Suomi" OR "Baltic" OR "ICA" OR "Coop") ("cyberattack" OR "cyberattaque" OR "piratage" OR "cyberangrepp" OR "hackade" OR "hackats" OR "hacked" OR "driftstörningar" OR "avbrott" OR "disruption" OR "outage" OR "malfunction") ("frysar" OR "frysdiskar" OR "frigos" OR "surgélateurs" OR "kylsystem" OR "freezers" OR "refrigeration" OR "cold storage" OR "elnät" OR "power grid" OR "vattenverk" OR "water supply" OR "sjukhus" OR "hospital" OR "railway" OR "telecom"))',
      mode:"ArtList",maxrecords:"75",format:"json",sort:"DateDesc",timespan:"3d"
    });
    return url.href;
  }
  function mount(container,options={}){
    if(!container||typeof document==="undefined")return null;
    let previous=null,lastDirectFallback=0;
    const source=options.fetcher||fetch;
    function node(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e}
    function render(result,coverage,details={}){
      container.replaceChildren();
      const state=details.sourceStatus||"UNKNOWN";
      const last=details.lastSuccessfulAt?new Date(details.lastSuccessfulAt).toLocaleString():"not yet available";
      const label=coverage==="OK"?"LIVE · 24/7 Worker monitoring · last source check "+last:coverage==="FALLBACK"?"DEGRADED · local browser fallback only; 24/7 backend not verified":"DEGRADED · source/Worker status "+state+" · last successful check "+last;
      const meta=node("div","meta",label+" · 72 h window · "+result.incidents.length+" qualifying reports");
      container.append(meta);
      for(const watch of result.watches){
        const block=node("div","news-item");
        block.append(node("div","risk med","BEVAKA · potential pattern"));
        block.append(node("div","title",watch.country+" · "+watch.operators.join(" + ")));
        block.append(node("div","meta",watch.reportCount+" reports · "+watch.sourceCount+" source domains · "+watch.family.replaceAll("_"," ")));
        block.append(node("div","meta","Same sector/reporting window; no verified common cause or attribution."));
        const details=node("details","meta"),summary=node("summary",null,"Spåra samband · källanalys");
        details.append(summary);
        details.append(node("div","meta","Hypothesis: "+watch.trace.hypothesis.replaceAll("_"," ")+" · evidence: "+watch.trace.evidenceLevel));
        details.append(node("div","meta","Equipment mentioned by different operators: "+(watch.trace.sharedSystems.join(", ")||"none established")));
        details.append(node("div","meta","Reported common method: "+(watch.trace.sharedMethods.join(", ")||"none established")));
        details.append(node("div","meta","Entry point: UNKNOWN · network origin: UNKNOWN · actor: UNKNOWN"));
        details.append(node("div","meta","To go further: authorized controller/access logs, verified device and firmware data, published IOCs, CERT findings."));
        details.append(node("div","meta","This is passive source comparison. No scans or attribution from headlines."));
        block.append(details);
        container.append(block);
      }
      for(const item of result.incidents.slice(0,6)){
        const box=node("div","news-item");
        box.append(node("div","meta",(item.status==="CYBER_REPORTED"?"CYBER CLAIM REPORTED":"OPERATIONAL DISRUPTION REPORTED")+" · "+item.label+" · "+item.country));
        const link=node("a","news-title",item.title);link.href=item.url;link.target="_blank";link.rel="noopener noreferrer nofollow";link.referrerPolicy="no-referrer";
        box.append(link,node("div","meta",item.host+" · indexed "+new Date(item.seenAt).toLocaleString()));
        container.append(box);
      }
      if(!result.incidents.length)container.append(node("div","meta","No matching current reports. This does not establish that no incidents occurred."));
      container.append(node("div","meta","Reports and patterns are not proof of a cyberattack. No actor attribution or automatic FLASH."));
      const attribution=node("a","meta","Discovery source: GDELT Project");attribution.href="https://www.gdeltproject.org/";attribution.target="_blank";attribution.rel="noopener noreferrer";container.append(attribution);
    }
    async function refresh(){
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),14000);
      try{
        const workerUrl=String(options.workerUrl||"").replace(/\\/$/,"");
        if(!workerUrl)throw Error("Worker endpoint not configured");
        const response=await source(workerUrl+"/infra-watch",{signal:controller.signal,headers:{accept:"application/json"}});
        if(!response.ok)throw Error("Worker HTTP "+response.status);
        const body=await response.json();
        if(!body.enabled||!body.watch||!Array.isArray(body.watch.incidents)||!Array.isArray(body.watch.watches))throw Error("Invalid Worker snapshot");
        previous=body.watch;
        render(previous,body.degraded?"DEGRADED":"OK",{sourceStatus:body.sourceHealth?.status,lastSuccessfulAt:body.lastSuccessfulAt});
      }catch{
        // Only a visibly degraded, rate-limited browser fallback is allowed.
        // Browser discovery is never presented as unattended 24/7 coverage.
        if(Date.now()-lastDirectFallback>=15*60*1000){
          lastDirectFallback=Date.now();
          try{
            const response=await source(endpoint(),{signal:controller.signal,headers:{accept:"application/json"}});
            if(!response.ok)throw Error("GDELT HTTP "+response.status);
            const body=await response.json();
            if(!Array.isArray(body.articles))throw Error("Invalid GDELT response");
            previous=assess(body.articles);
            render(previous,"FALLBACK");
            return;
          }catch{}
        }
        const retained=previous?assess(previous.incidents.map(x=>({...x,publishedAt:x.seenAt}))):assess([]);
        previous=retained;
        render(retained,"DEGRADED",{sourceStatus:"WORKER_UNAVAILABLE"});
      }finally{clearTimeout(timeout)}
    }
    refresh();
    const timer=setInterval(refresh,5*60*1000);
    return {refresh,stop:()=>clearInterval(timer)};
  }
  return Object.freeze({parseDate,classify,tracePattern,assess,endpoint,mount});
});
