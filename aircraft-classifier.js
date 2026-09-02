(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.NordicWatchAircraft=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const BASE=Object.freeze({CIVILIAN:"CIVILIAN",MILITARY:"MILITARY",STATE:"STATE",UNKNOWN:"UNKNOWN"});
  const CONFIDENCE=Object.freeze({CONFIRMED:"CONFIRMED",PROBABLE:"PROBABLE"});
  const ROLE=Object.freeze({AWACS:"AWACS",TANKER:"TANKER",ISR:"ISR",TRANSPORT:"TRANSPORT",FIGHTER:"FIGHTER",OTHER:"OTHER"});
  const GOVERNMENT_ROLE=Object.freeze({COAST_GUARD:"COAST_GUARD"});
  const SWEDISH_COAST_GUARD=Object.freeze({
    registrations:new Set(["SEMAA","SEMAB","SEMAC"]),
    callsigns:new Set(["KBV501","KBV502","KBV503"]),
    hexes:new Set(["4AB421","4AB422","4AB423"])
  });
  const ROLE_TYPES={
    AWACS:new Set(["E3A","E3B","E3C","E3D","E3F","E7A","E7T","A50"]),
    TANKER:new Set(["KC135","K35R","K35E","KC46","K46A"]),
    ISR:new Set(["RC135","R135","P8","P8A","EP3","IL20","EA37","GLF4","GLEX","CL60"]),
    TRANSPORT:new Set(["C17","C17A","C130","C30J","A400","A400M","C5","C5M","C295","CN35"]),
    FIGHTER:new Set(["F15","F16","F18","F22","F35","JAS39","EUFI","RFAL","SU27","SU30","SU35","MG29","MIG29"])
  };
  const MIL_OPERATOR=/(?:^|\b)(?:AIR FORCE|ARMED FORCES|LUFTWAFFE|FLYGVAPNET|FLYGVAPNET|ROYAL AIR FORCE|USAF|USN|US NAVY|ARMY AVIATION|MARINE CORPS|NATO)(?:\b|$)/i;
  const STATE_OPERATOR=/(?:^|\b)(?:COAST GUARD|POLICE|CUSTOMS|BORDER GUARD|GOVERNMENT|FRONTEX|MARITIME ADMINISTRATION)(?:\b|$)/i;
  const CIVIL_OPERATOR=/(?:^|\b)(?:SAS|SCANDINAVIAN AIRLINES|FINNAIR|LUFTHANSA|RYANAIR|NORWEGIAN|KLM|WIZZ AIR|EASYJET|BRITISH AIRWAYS|AIR FRANCE|DHL|FEDEX|UPS)(?:\b|$)/i;
  const MIL_CALLSIGN=/^(?:NATO|RCH|CNV|RRR|ASCOT|GAF|BAF|IAM|SVF|NOAF|DAF|FAF|PLF|TUAF)[A-Z0-9]*$/;

  const text=(a,keys)=>keys.map(k=>a&&a[k]).find(v=>typeof v==="string"&&v.trim())||"";
  const norm=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const explicitClass=a=>text(a,["aircraftClass","aircraft_class","ownership","service","classification","category"]).toUpperCase();
  const operator=a=>text(a,["operator","operatorName","operator_name","ownOp","owner"]);
  const callsign=a=>norm(text(a,["flight","callsign","callSign"]));
  const registration=a=>norm(text(a,["registration","reg","r"]));
  const hex=a=>norm(text(a,["hex","icao","icao24"]));
  const type=a=>norm(text(a,["t","type","typeCode","icaoType"]));
  const truthy=(a,keys)=>keys.some(k=>a&&a[k]===true);

  function militaryRole(a){
    const t=type(a);
    for(const [role,types] of Object.entries(ROLE_TYPES))if(types.has(t))return role;
    return ROLE.OTHER;
  }

  function isSwedishCoastGuard(a){
    const op=operator(a),reg=registration(a),cs=callsign(a),hx=hex(a),t=type(a);
    const identity=SWEDISH_COAST_GUARD.registrations.has(reg)||SWEDISH_COAST_GUARD.callsigns.has(cs)||SWEDISH_COAST_GUARD.hexes.has(hx);
    const operatorMatch=/(?:SWEDISH\s+COAST\s+GUARD|KUSTBEVAKNING)/i.test(op);
    return identity||(operatorMatch&&["DH8C","DHC8","DHC8300","Q300"].includes(t))
  }

  function classifyAircraft(a,options={}){
    const evidence=[];
    const cls=explicitClass(a),op=operator(a),cs=callsign(a),t=type(a),hx=hex(a),reg=registration(a);
    if(isSwedishCoastGuard(a))return {base:BASE.STATE,confidence:CONFIDENCE.CONFIRMED,role:null,governmentRole:GOVERNMENT_ROLE.COAST_GUARD,label:"Government / Coast Guard",evidence:[{signal:"swedish-coast-guard-identity",strength:"strong"}]};
    const knownHex=new Set((options.knownMilitaryHex||[]).map(norm));
    const knownReg=new Set((options.knownMilitaryRegistrations||[]).map(norm));
    const explicitMilitary=truthy(a,["military","isMilitary","is_military","knownMilitary","militaryHex","militaryRegistration"])||
      (Number.isInteger(a&&a.dbFlags)&&((a.dbFlags&1)===1))||/\bMILITARY\b/.test(cls);
    if(explicitMilitary)evidence.push({signal:"source-military-identity",strength:"strong"});
    if(hx&&knownHex.has(hx))evidence.push({signal:"known-military-icao",strength:"strong"});
    if(reg&&knownReg.has(reg))evidence.push({signal:"known-military-registration",strength:"strong"});
    if(MIL_OPERATOR.test(op))evidence.push({signal:"military-operator",strength:"strong"});
    if(MIL_CALLSIGN.test(cs))evidence.push({signal:"military-callsign",strength:"weak"});
    if(Object.values(ROLE_TYPES).some(types=>types.has(t)))evidence.push({signal:"military-role-type",strength:"weak"});

    if(evidence.some(x=>x.strength==="strong"))return {base:BASE.MILITARY,confidence:CONFIDENCE.CONFIRMED,role:militaryRole(a),evidence};

    const stateExplicit=truthy(a,["state","isState","is_state"])||/\b(?:STATE|GOVERNMENT)\b/.test(cls)||STATE_OPERATOR.test(op);
    if(stateExplicit)return {base:BASE.STATE,confidence:null,role:null,evidence:[{signal:"state-identity",strength:"strong"}]};
    const civilianExplicit=truthy(a,["civilian","isCivilian","is_civilian"])||/\bCIVILIAN\b/.test(cls)||CIVIL_OPERATOR.test(op);
    if(civilianExplicit)return {base:BASE.CIVILIAN,confidence:null,role:null,evidence:[{signal:"civilian-identity",strength:"strong"}]};

    const weakKinds=new Set(evidence.filter(x=>x.strength==="weak").map(x=>x.signal));
    if(weakKinds.size>=2)return {base:BASE.MILITARY,confidence:CONFIDENCE.PROBABLE,role:militaryRole(a),evidence};
    return {base:BASE.UNKNOWN,confidence:null,role:null,evidence};
  }

  function isMilitaryActivity(result){return result&&result.base===BASE.MILITARY&&(result.confidence===CONFIDENCE.CONFIRMED||result.confidence===CONFIDENCE.PROBABLE)}
  function summarize(aircraft,options){
    const base={CIVILIAN:0,MILITARY:0,STATE:0,UNKNOWN:0},roles={AWACS:0,TANKER:0,ISR:0,TRANSPORT:0,FIGHTER:0,OTHER:0};
    for(const item of aircraft||[]){const result=classifyAircraft(item,options);base[result.base]++;if(isMilitaryActivity(result))roles[result.role]++}
    return {base,roles,military:base.MILITARY,nonMilitary:base.CIVILIAN+base.STATE+base.UNKNOWN,total:(aircraft||[]).length};
  }

  return Object.freeze({BASE,CONFIDENCE,ROLE,GOVERNMENT_ROLE,SWEDISH_COAST_GUARD,classifyAircraft,isMilitaryActivity,isSwedishCoastGuard,summarize});
});
