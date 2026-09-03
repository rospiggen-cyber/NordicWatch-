const assert=require("assert"),SE=require("../situational-engine.js"),AC=require("../aircraft-classifier.js"),RP=require("../route-pattern.js");
const now=Date.parse("2026-09-03T12:00:00Z"),at=(days,hours=0)=>new Date(now-days*86400000+hours*3600000).toISOString();

// CASE 1: recurring ARTEMIS II is ISR/SIGINT and recurrence, not automatic escalation.
const artemis=AC.classifyAircraft({hex:"ae1234",t:"CL60",flight:"ARTEMIS2",operator:"Leidos / US Army",military:true});
assert.equal(artemis.role,"ISR");assert.match(artemis.subrole,/SIGINT/);assert.match(artemis.platformName,/ARTEMIS II/);
const recurrence=SE.recurrence([0,1,2].flatMap(day=>[1,2].map(n=>({timestamp:at(day,n),identity:"ae1234",platform:"Challenger 650",region:"Kaliningrad / Baltijsk",behaviour:"RACETRACK",durationMs:7200000}))),{now});
assert.equal(recurrence[0].daysObserved,3);assert(recurrence[0].recurrenceScore>50);
const routine=SE.alertDecision({eventScore:45,correlationScore:0,baselineDeviation:10,sourceConfidence:85,persistence:60,domains:["AIRCRAFT"],deepLink:"?aircraft=ae1234"});assert.equal(routine.shouldNotify,false);

// CASE 2: Korpen requires supporting type/operator/callsign data and remains an observation plus assessment.
const korpen=AC.classifyAircraft({hex:"4a0001",t:"GLF4",flight:"SVF680",operator:"Swedish Air Force",military:true});assert.equal(korpen.role,"ISR");assert.equal(korpen.subrole,"SIGINT");assert.equal(korpen.confidence,"CONFIRMED");
const straight=Array.from({length:8},(_,i)=>({timestamp:now-8*60000+i*60000,lat:69+i*.04,lon:25+i*.07,speed:350}));const behaviour=RP.detectBehavior(straight,{hotspots:[{name:"Kola / Murmansk",lat:69.2,lon:25.3,radiusKm:500}]});assert(behaviour.behaviours.includes("HOTSPOT PROXIMITY"));assert.equal(behaviour.evidence,"INFERRED");

// CASE 4: independent weak Baltic signals become materially correlated.
const signals=[
 {id:"isr",domain:"AIRCRAFT",evidence:"OBSERVATION",timestamp:at(0),lat:54.7,lon:20.5,region:"Kaliningrad / Baltijsk",capability:"ISR",kind:"REPEATED_PASS",confidence:85,sourceConfidence:"SINGLE_RELIABLE_SOURCE"},
 {id:"awacs",domain:"AIRCRAFT",evidence:"OBSERVATION",timestamp:at(0),lat:55.1,lon:20.2,region:"Kaliningrad / Baltijsk",capability:"AWACS",kind:"RACETRACK",confidence:80,sourceConfidence:"SINGLE_RELIABLE_SOURCE"},
 {id:"tanker",domain:"AIRCRAFT",evidence:"OBSERVATION",timestamp:at(0),lat:55,lon:19.9,region:"Kaliningrad / Baltijsk",capability:"TANKER",kind:"RACETRACK",confidence:78,sourceConfidence:"SINGLE_RELIABLE_SOURCE"},
 {id:"gnss",domain:"GNSS",evidence:"OBSERVATION",timestamp:at(0),lat:54.8,lon:20.3,region:"Kaliningrad / Baltijsk",capability:"GNSS",kind:"INTERFERENCE",confidence:75,sourceConfidence:"MULTIPLE_INDEPENDENT_SOURCES"}
];const correlations=SE.correlate(signals,{window:"3h",now});assert(correlations[0].correlationScore>=60);assert.match(correlations[0].correlationReason,/AIRCRAFT \+ GNSS/);assert.equal(correlations[0].evidence,"ASSESSMENT");

// CASE 5: one ordinary tanker transit does not correlate or alert.
assert.equal(SE.correlate([signals[2]],{now}).length,0);assert.equal(SE.alertDecision({eventScore:30,correlationScore:0,baselineDeviation:0,sourceConfidence:65,persistence:5,domains:["AIRCRAFT"]}).shouldNotify,false);

// CASE 6/7: publication date differs from occurrence; only genuine updates stay current.
const old=SE.temporalContext({publishedAt:at(0),eventOccurredAt:at(20),title:"Old incident republished",description:"Originally published report"},now);assert(old.isHistoricalEvent&&old.isRepublished&&!old.containsNewDevelopment);assert(old.temporalRelevance<30);
const updated=SE.temporalContext({publishedAt:at(0),eventOccurredAt:at(20),title:"Officially confirmed new development",description:"Investigation has now confirmed additional findings"},now);assert(updated.isHistoricalEvent&&updated.containsNewDevelopment);assert(updated.temporalRelevance>=90);

// CASE 8/9: social-only quality caps the score; official confirmation can raise it.
const common={geographicRelevance:95,militarySignificance:95,actorSignificance:90,noveltyScore:90,persistenceScore:70,baselineDeviation:80,crossDomainCorrelation:80,temporalRelevance:95,infrastructureRelevance:70};const social=SE.eventScore({...common,sourceConfidenceClass:"SOCIAL_MEDIA_CLAIM"}),official=SE.eventScore({...common,sourceConfidenceClass:"CONFIRMED_OFFICIAL"});assert(social.eventScore<60);assert(official.eventScore>social.eventScore);assert.equal(social.confidence,"LOW");

// Bounded baseline and safe same-origin deep links.
const history=Array.from({length:14},(_,i)=>({timestamp:now-(i+1)*86400000,military:4,isr:1,tanker:1,awacs:0,ew:0,gnss:0,events:1})),base=SE.baseline(history,{military:12,isr:4,tanker:1,awacs:1,ew:0,gnss:1,events:1},{now});assert(["UNUSUAL","HIGHLY_UNUSUAL"].includes(base.baselineStatus));assert.equal(SE.safeDeepLink("https://evil.example/steal"),"./");assert.match(SE.safeDeepLink("?event=x"),/event=x/);
console.log("situational engine tests passed");
