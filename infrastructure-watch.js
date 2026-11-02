/* NordicWatch Civil Infrastructure Watch — reported observations, not attribution. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.NordicWatchInfrastructureWatch=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const WINDOW_MS=72*3600000;
  const normalize=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const retail=/\b(ica|coop|willys|hemkop|city gross|axfood|kesko|k-?market|s-?market|rema 1000|matbutik\w*|mataffar\w*|supermarket\w*|grocery stores?)\b/i;
  const cold=/\b(frys\w*|kyl\w*|fridge\w*|freezer\w*|refrigerat\w*|cold[- ]?storage|cold[- ]?chain|defrost\w*|livsmedelskyla)\b/i;
  const energy=/\b(elavbrott\w*|elnat\w*|kraftnat\w*|elcentral\w*|power grid|power outages?|electricity grid|district heating|fjarrvarme|transformer\w*)\b/i;
  const water=/\b(dricksvatten\w*|vattenverk\w*|vattenforsorjning\w*|water supply|water treatment|wastewater|reningsverk\w*)\b/i;
  const transport=/\b(jarnvag\w*|railway\w*|train traffic|tunnelbana\w*|transportkedja\w*|logistiksystem\w*|port terminal\w*|hamnterminal\w*)\b/i;
  const health=/\b(sjukhus\w*|hospital\w*|patient data|vardsystem\w*|lakemedelslager\w*|medical cold chain)\b/i;
  const telecom=/\b(telekom\w*|telecommunications?|mobile network|mobilnat\w*|internet backbone)\b/i;
  const interruption=/\b(hack\w*|cyber\w*|intrang\w*|sabotage\w*|storn\w*|driftstorn\w*|avbrott\w*|ur funktion|utsla\w*|outage\w*|disrupt\w*|compromis\w*|attack\w*|manipulat\w*|failure\w*|malfunction\w*|felaktig temperatur|systemfel\w*|problem\w*)\b/i;
  const cyber=/\b(hack\w*|cyber\w*|intrang\w*|ransomware|compromis\w*|malware|data breach)\b/i;
  const operators=[["ICA",/\bica\b/i],["Coop",/\bcoop\b/i],["Willys",/\bwillys\b/i],["Axfood",/\baxfood\b/i],["Danfoss",/\bdanfoss\b/i],["Copeland",/\bcopeland\b/i],["Dixell",/\bdixell\b/i]];
  function parseDate(raw){
    if(!raw)return NaN;
    const v=String(raw);
    const match=v.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/);
    return match?Date.parse(match[1]+"-"+match[2]+"-"+match[3]+"T"+match[4]+":"+match[5]+":"+match[6]+"Z"):Date.parse(v);
  }
  function countryOf(content,sourceCountry,host){
    // GDELT sourcecountry is the publisher location, never the incident location.
    // Ignore it to avoid placing foreign stories in the Nordic AOI.
    if(/\b(france|french|usa|u\.s\.|united states|russia|russian|spain|spanish|germany|german)\b/.test(content)&&!/(sweden|swedish|sverige|svensk|norge|norway|danmark|denmark|suomi|finland|estonia|latvia|lithuania)/.test(content))return null;
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
    return {id:url.origin+url.pathname,title,url:url.href,host,seenAt:new Date(seenAt).toISOString(),country,operator,category,family,label,status,sourceName:host};
  }
  function assess(articles,now=Date.now()){
    const uniq=new Map();
    for(const row of Array.isArray(articles)?articles:[]){
      const incident=classify(row,now);
      if(!incident)continue;
      if(!uniq.has(incident.id))uniq.set(incident.id,incident);
    }
    const incidents=[...uniq.values()].sort((a,b)=>Date.parse(b.seenAt)-Date.parse(a.seenAt));
    const groups=new Map();
    for(const item of incidents){
      const key=item.country+"|"+item.family;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(item);
    }
    const watches=[];
    for(const rows of groups.values()){
      const operatorsFound=[...new Set(rows.map(r=>r.operator).filter(Boolean))];
      // Two separate incident reports naming different operators: watch, never a confirmed relationship.
      if(rows.length>=2&&operatorsFound.length>=2){
        watches.push({status:"BEVAKA",country:rows[0].country,family:rows[0].family,operatorCount:operatorsFound.length,operators:operatorsFound,reportCount:rows.length,sourceCount:new Set(rows.map(r=>r.host)).size,latestAt:rows[0].seenAt,explanation:"Temporal and sector overlap only. A shared cause or cyberattack is not established."});
      }
    }
    watches.sort((a,b)=>Date.parse(b.latestAt)-Date.parse(a.latestAt));
    return {incidents:incidents.slice(0,30),watches,assessedAt:new Date(now).toISOString(),windowHours:72};
  }
  function endpoint(){
    const url=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    url.search=new URLSearchParams({
      query:'(("Sweden" OR "Sverige" OR "Norway" OR "Norge" OR "Denmark" OR "Danmark" OR "Finland" OR "Suomi" OR "Baltic" OR "ICA" OR "Coop") ("cyberattack" OR "cyberangrepp" OR "hackade" OR "hackats" OR "hacked" OR "driftstörningar" OR "avbrott" OR "disruption" OR "outage" OR "malfunction") ("frysar" OR "frysdiskar" OR "kylsystem" OR "freezers" OR "refrigeration" OR "cold storage" OR "elnät" OR "power grid" OR "vattenverk" OR "water supply" OR "sjukhus" OR "hospital" OR "railway" OR "telecom"))',
      mode:"ArtList",maxrecords:"75",format:"json",sort:"DateDesc",timespan:"3d"
    });
    return url.href;
  }
  function mount(container,options={}){
    if(!container||typeof document==="undefined")return null;
    let previous=null;
    const source=options.fetcher||fetch;
    function node(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e}
    function render(result,coverage){
      container.replaceChildren();
      const meta=node("div","meta",coverage==="OK"?"GDELT news discovery · last 72 h · " + result.incidents.length + " qualifying reports":"Source unavailable or incomplete · last verified observations only");
      container.append(meta);
      for(const watch of result.watches){
        const block=node("div","news-item");
        block.append(node("div","risk med","BEVAKA · potential pattern"));
        block.append(node("div","title",watch.country+" · "+watch.operators.join(" + ")));
        block.append(node("div","meta",watch.reportCount+" reports · "+watch.sourceCount+" source domains · "+watch.family.replaceAll("_"," ")));
        block.append(node("div","meta","Same sector/time window; no verified common cause or attribution."));
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
    }
    async function refresh(){
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),14000);
      try{
        const response=await source(endpoint(),{signal:controller.signal,headers:{accept:"application/json"}});
        if(!response.ok)throw Error("HTTP "+response.status);
        const body=await response.json();
        if(!Array.isArray(body.articles))throw Error("Malformed source response");
        previous=assess(body.articles);
        render(previous,"OK");
      }catch{
        if(previous)render(assess(previous.incidents.map(x=>({...x,publishedAt:x.seenAt}))),"DEGRADED");
        else render(assess([]),"DEGRADED");
      }finally{clearTimeout(timeout)}
    }
    refresh();
    const timer=setInterval(refresh,15*60*1000);
    return {refresh,stop:()=>clearInterval(timer)};
  }
  return Object.freeze({parseDate,classify,assess,endpoint,mount});
});
