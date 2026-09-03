const assert=require("assert");
const E=require("../event-engine.js");
const seed=require("../mock/events.json").events[0];

const normalized=E.normalizeEvent(seed);
assert(normalized,"NAMEJS seed must validate");
assert.equal(normalized.evidence,"CONFIRMED");
assert.equal(normalized.seed,true);
assert(normalized.expectedActivity.includes("FIGHTER"));
assert(normalized.expectedActivity.includes("AIR_DEFENCE"));
assert.equal(E.statusAt(normalized,"2026-09-02T12:00:00Z"),"ACTIVE");

for(const eventType of E.EVENT_TYPES)assert(E.normalizeEvent({...seed,id:"event-"+eventType,eventType}),eventType+" must be supported");
assert.equal(E.normalizeEvent({...seed,sourceUrl:"http://example.com/event"}),null,"HTTP source links must be rejected");
assert(E.normalizeEvent({...seed,id:"dvids-event",sourceUrl:"https://www.dvidshub.net/news/123/example",seed:false}),"official US defence sources must validate");
const discovered=E.normalizeEvent({...seed,id:"discovery",sourceUrl:"https://www.defense.gov/News/Releases/1",seed:false,discovery:{temporaryWatchZone:true,score:85,scoreReasons:["strategic weapon","new location"],scoreExplanation:"CONFIRMED deployment + strategic weapon + new location",exerciseKey:"operation-atlantic-city-26",relatedEventIds:["jan-mayen"]},evidence:{confirmed:{sourceUrl:"https://www.defense.gov/News/Releases/1",sourceName:"DoD",text:"Official release"},observed:[{hex:"abc",callsign:"RCH1",type:"C17"}],inferred:[{text:"related military airlift observed"}]}});assert.equal(discovered.discovery.score,85);assert.equal(discovered.evidenceDetail.observed[0].evidence,"OBSERVED");assert.equal(discovered.discovery.relatedEventIds[0],"jan-mayen");
const external=E.normalizeEvent({...seed,id:"external-il20",eventType:"intercept",sourceUrl:"https://www.rtve.es/noticias/20260831/example.shtml",confidence:"CONFIRMED_EXTERNAL",externalReport:{aircraftType:"IL-20",aircraftRole:"ISR",locationConfidence:"APPROXIMATE",interestScore:95,trackObserved:false,sources:[{sourceName:"RTVE",sourceUrl:"https://www.rtve.es/noticias/20260831/example.shtml",sourceType:"MAJOR_NEWS_AGENCY"}]}});assert.equal(external.evidence,"CONFIRMED_EXTERNAL");assert.equal(external.externalReport.trackObserved,false);
const capability=E.normalizeEvent({...seed,id:"capability-de-lora",title:"German Navy LORA trial",eventType:"MILITARY_CAPABILITY_CHANGE",startTime:"2026-09-03T08:00:00Z",endTime:"2026-09-06T08:00:00Z",latitude:51.17,longitude:10.45,radiusKm:300,areaName:"Germany / North Atlantic",countries:["Germany"],organisations:["NATO"],description:"Official capability trial.",sourceUrl:"https://www.bundeswehr.de/en/news/lora",sourceName:"Bundeswehr",confidence:"CONFIRMED",severity:"HIGH",expectedActivity:["NAVAL"],tags:["naval","ballistic-missile","procurement"]});assert(capability);assert.equal(capability.eventType,"military_capability_change");assert.deepEqual(capability.tags,["naval","ballistic-missile","procurement"]);assert.equal(capability.confidence,"CONFIRMED");
const escalationEvent=E.normalizeEvent({...seed,id:"germany-response",eventType:"TARGETING_SUPPORT",sourceUrl:"https://www.bundeswehr.de/en/news/response",escalation:{qualifies:true,eventTypes:["targeting_support","intelligence_sharing"],escalationScore:92,escalationLevel:"CRITICAL",responseMultiplier:1.3,scoreBreakdown:[{reason:"Target coordinates / targeting support",value:25}],sourceConfidence:"CONFIRMED_OFFICIAL",observation:"Official response announced.",assessment:"Material state behavior change.",isNewDecision:true,secondaryHotspots:["Baltic Sea","Gotland"],eventChainId:"chain-germany-russia"},eventChain:[{id:"sabotage",timestamp:"2026-09-01T08:00:00Z",title:"Sabotage attempt",eventType:"sabotage_attempt",isBackground:false,isNewChange:true,sourceConfidence:"CONFIRMED_OFFICIAL"}]});assert(escalationEvent);assert.equal(escalationEvent.eventType,"targeting_support");assert.equal(escalationEvent.escalation.escalationScore,92);assert.equal(escalationEvent.escalation.sourceConfidence,"CONFIRMED_OFFICIAL");assert.equal(escalationEvent.eventChain.length,1);

const live={...seed,seed:false,description:"Updated live official record"};
const imported=E.importEvents([seed,live,{...seed,id:"other-id"}]);
assert.equal(imported.events.length,1,"same event ID or source URL must deduplicate");
assert.equal(imported.events[0].seed,false,"live record must replace its seed snapshot");

const classify=ac=>({role:ac.role});
const allied=E.assessEvent(normalized,[{lat:56.95,lon:24.3,role:"FIGHTER",country:"Latvia",hex:"abc"}],{now:"2026-09-02T12:00:00Z",classify});
assert.equal(allied.observed[0].evidence,"OBSERVED");
assert.equal(allied.explained.length,1);
assert(allied.scoreDelta<0,"expected allied activity should lower anomaly context");
assert.equal(allied.deviations.length,0);

const russian=E.assessEvent(normalized,[{lat:57,lon:24.5,role:"ISR",country:"Russia",registration:"RA-12345",hex:"def"}],{now:"2026-09-02T12:00:00Z",classify});
assert.equal(russian.deviations[0].evidence,"INFERRED");
assert.equal(russian.deviations[0].kind,"RUSSIAN_ISR");
assert(russian.scoreDelta>=30,"Russian ISR must increase interest near the exercise");

const unknown=E.assessEvent(normalized,[{lat:57,lon:24.5,role:"FIGHTER",hex:"ghi"}],{now:"2026-09-02T12:00:00Z",classify});
assert.equal(unknown.scoreDelta,0,"unattributed traffic must not receive an expected-allied reduction");

const previous=[{...normalized,snapshotStatus:"UPCOMING"}];
assert.equal(E.diffEvents(previous,[normalized],"2026-09-02T12:00:00Z")[0].kind,"STARTED");
const ended={...normalized,endTime:"2026-09-02T10:00:00.000Z"};
assert.equal(E.diffEvents([{...normalized,snapshotStatus:"ACTIVE"}],[ended],"2026-09-02T12:00:00Z")[0].kind,"ENDED");

console.log("event-engine tests passed");
