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
