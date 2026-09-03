(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.NordicWatchAircraft=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const BASE=Object.freeze({CIVILIAN:"CIVILIAN",MILITARY:"MILITARY",STATE:"STATE",UNKNOWN:"UNKNOWN"});
  const CONFIDENCE=Object.freeze({CONFIRMED:"CONFIRMED",PROBABLE:"PROBABLE"});
  const ROLE=Object.freeze({AWACS:"AWACS",TANKER:"TANKER",ISR:"ISR",EW:"EW",ASW:"ASW",TRANSPORT:"TRANSPORT",FIGHTER:"FIGHTER",OTHER:"OTHER"});
  const INTEREST_CLASS=Object.freeze({HIGH_VALUE_ISR:"HIGH_VALUE_ISR",HIGH_VALUE_SPECIAL_MISSION:"HIGH_VALUE_SPECIAL_MISSION"});
  const SPECIAL_MISSION_PLATFORMS=Object.freeze([
    {match:/\b(?:RC135S|RC135SCOBRABALL|COBRABALL)\b/,platformFamily:"RC-135",platformVariant:"RC-135S",platformName:"RC-135S COBRA BALL",role:ROLE.ISR,subrole:"MASINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\b(?:RC135U|RC135UCOMBATSENT|COMBATSENT)\b/,platformFamily:"RC-135",platformVariant:"RC-135U",platformName:"RC-135U COMBAT SENT",role:ROLE.ISR,subrole:"ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\b(?:RC135W|R135|RIVETJOINT|BOEINGRC135W|RC135|BOEINGRC135)\b/,platformFamily:"RC-135",platformVariant:"RC-135W",platformName:"RC-135W RIVET JOINT",role:ROLE.ISR,subrole:"SIGINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\bEP3(?:E|C)?\b/,platformFamily:"EP-3",platformVariant:"EP-3E",platformName:"EP-3",role:ROLE.ISR,subrole:"SIGINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\bP8A?\b|\bPOSEIDON\b/,platformFamily:"P-8",platformVariant:"P-8A",platformName:"P-8A POSEIDON",role:ROLE.ASW,subrole:"MARITIME ISR / ASW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bE3[ABCDF]?\b|\bSENTRY\b/,platformFamily:"E-3",platformVariant:"E-3",platformName:"E-3 SENTRY",role:ROLE.AWACS,subrole:"AIRBORNE EARLY WARNING",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/^(?:E7|E7A|E7T|E7WEDGETAIL|BOEINGE7|WEDGETAIL)$/,platformFamily:"E-7",platformVariant:"E-7",platformName:"E-7 WEDGETAIL",role:ROLE.AWACS,subrole:"AIRBORNE EARLY WARNING",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bGLOBALEYE\b|\bS100D\b/,platformFamily:"GlobalEye",platformVariant:"GlobalEye",platformName:"GLOBALEYE",role:ROLE.AWACS,subrole:"AIRBORNE EARLY WARNING / ISR",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bEA37B\b|\bCOMPASSCALL\b/,platformFamily:"EA-37",platformVariant:"EA-37B",platformName:"EA-37B COMPASS CALL",role:ROLE.EW,subrole:"ELECTRONIC WARFARE",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bIL20M?\b/,platformFamily:"IL-20",platformVariant:"IL-20",platformName:"IL-20",role:ROLE.ISR,subrole:"SIGINT / ELINT",interestClass:INTEREST_CLASS.HIGH_VALUE_ISR},
    {match:/\bIL22\b/,platformFamily:"IL-22",platformVariant:"IL-22",platformName:"IL-22",role:ROLE.EW,subrole:"COMMAND / EW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bIL38N?\b/,platformFamily:"IL-38",platformVariant:"IL-38",platformName:"IL-38",role:ROLE.ASW,subrole:"MARITIME ISR / ASW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION},
    {match:/\bTU142M?\b/,platformFamily:"TU-142",platformVariant:"TU-142",platformName:"TU-142",role:ROLE.ASW,subrole:"MARITIME ISR / ASW",interestClass:INTEREST_CLASS.HIGH_VALUE_SPECIAL_MISSION}
  ]);
  const GOVERNMENT_ROLE=Object.freeze({COAST_GUARD:"COAST_GUARD"});
  const SWEDISH_COAST_GUARD=Object.freeze({
    registrations:new Set(["SEMAA","SEMAB","SEMAC"]),
    callsigns:new Set(["KBV501","KBV502","KBV503"]),
    hexes:new Set(["4AB421","4AB422","4AB423"])
  });
  const ROLE_TYPES={
    AWACS:new Set(["E3A","E3B","E3C","E3D","E3F","E7A","E7T","A50"]),
    TANKER:new Set(["KC135","K35R","K35E","KC46","K46A"]),
    ISR:new Set(["RC135","RC135W","R135","EP3","IL20","GLF4","GLEX","CL60"]),
    EW:new Set(["EA37","EA37B","IL22"]),
    ASW:new Set(["P8","P8A","IL38","TU142"]),
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

  function specialMissionPlatform(a){
    const keys=["t","type","typeCode","icaoType","model","aircraftModel","description","desc","flight","callsign","callSign","registration","reg","r","operator","operatorName","operator_name","ownOp","owner","militaryType","militaryMetadata"];
    const values=keys.map(k=>a&&a[k]).filter(v=>typeof v==="string"&&v.trim()).map(norm);
    for(const platform of SPECIAL_MISSION_PLATFORMS)if(values.some(value=>platform.match.test(value)))return Object.freeze({...platform,match:undefined,military:true});
    return null;
  }

  function militaryRole(a){
    const special=specialMissionPlatform(a);if(special)return special.role;
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
    const special=specialMissionPlatform(a);
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
    if(special)evidence.push({signal:"known-special-mission-platform",strength:"strong"});

    if(evidence.some(x=>x.strength==="strong"))return {base:BASE.MILITARY,confidence:CONFIDENCE.CONFIRMED,role:militaryRole(a),subrole:special?.subrole||null,platformFamily:special?.platformFamily||null,platformVariant:special?.platformVariant||null,platformName:special?.platformName||null,interestClass:special?.interestClass||null,specialMission:Boolean(special),evidence};

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
    const base={CIVILIAN:0,MILITARY:0,STATE:0,UNKNOWN:0},roles={AWACS:0,TANKER:0,ISR:0,EW:0,ASW:0,TRANSPORT:0,FIGHTER:0,OTHER:0};
    for(const item of aircraft||[]){const result=classifyAircraft(item,options);base[result.base]++;if(isMilitaryActivity(result))roles[result.role]++}
    return {base,roles,military:base.MILITARY,nonMilitary:base.CIVILIAN+base.STATE+base.UNKNOWN,total:(aircraft||[]).length};
  }

  return Object.freeze({BASE,CONFIDENCE,ROLE,INTEREST_CLASS,SPECIAL_MISSION_PLATFORMS,GOVERNMENT_ROLE,SWEDISH_COAST_GUARD,specialMissionPlatform,classifyAircraft,isMilitaryActivity,isSwedishCoastGuard,summarize});
});
