// Real source records only. Clock changes exercise ageing without inventing reports.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../event-state'),U=require('../uav-incidents'),IC=require('../intelligence-core');
const raw=require('../mock/uav-incidents.json').incidents[0],followups=require('../data/verified-event-followups.json'),capture=require('../FINLAND_SOURCE_CAPTURE.json');
const now=+new Date(capture.checkedAt);
function current(){return E.reconcile(raw,null,followups.reports,{now,checked:true,checkSucceeded:true,checkMethod:followups.checkMethod})}
test('real stored Finland record reconciles two real later sources to one stale event',()=>{
 const state=current();assert.equal(state.id,raw.id);assert.equal(state.sources.length,3);assert.equal(state.status,'STALE');assert.equal(state.active,false);assert.equal(state.lastUpdated,'2026-09-04T11:17:16.000Z');assert.equal(state.lastChecked,capture.checkedAt);assert(state.latestAssessment.includes('Geoscan 701'));assert(state.latestAssessment.includes('operator was not confirmed'));assert(state.sources.some(s=>s.sourceUrl===raw.sourceUrl));assert(state.sources.every(s=>s.sourceUrl.startsWith('https:')));assert.notEqual(state.status,'RESOLVED');
 for(const key of ['status','firstSeen','lastSeen','lastUpdated','lastChecked','latestAssessment','sources','active','confidence'])assert(key in state,key);
});
test('same real evidence moves NEW to DEVELOPING to UPDATED before ageing, never auto-resolves',()=>{
 let s=E.reconcile(raw,null,[],{now:Date.parse('2026-09-02T14:00:00Z')});assert.equal(s.status,'NEW');
 s=E.reconcile(raw,s,[],{now:Date.parse('2026-09-02T15:00:00Z'),checked:true,checkSucceeded:true});assert.equal(s.status,'DEVELOPING');
 s=E.reconcile(raw,s,followups.reports,{now:Date.parse('2026-09-04T12:00:00Z'),checked:true,checkSucceeded:true});assert.equal(s.status,'UPDATED');assert(s.active);
 s=E.reconcile(raw,s,[],{now,checked:true,checkSucceeded:true});assert.equal(s.status,'STALE');assert(!s.active);assert.equal(s.lastUpdated,'2026-09-04T11:17:16.000Z');
});
test('reloading, repeated source checks and failures preserve evidence time and all history',()=>{
 const initial=current(),again=E.reconcile(raw,JSON.parse(JSON.stringify(initial)),followups.reports,{now:now+3600000,checked:true,checkSucceeded:false});assert.equal(again.sources.length,3);assert.equal(again.firstSeen,initial.firstSeen);assert.equal(again.lastSeen,initial.lastSeen);assert.equal(again.lastUpdated,initial.lastUpdated);assert.equal(again.lastSuccessfulCheck,initial.lastSuccessfulCheck);assert(again.lastChecked>initial.lastChecked);assert.equal(again.status,'STALE');
});
test('source check clock cannot roll backwards when replaying the verified capture',()=>{
 const s=E.reconcile(raw,current(),[],{now:now+3600000,checked:true,checkSucceeded:false}),replayed=E.reconcile(raw,s,followups.reports,{now,checked:true,checkSucceeded:true});assert.equal(replayed.lastChecked,s.lastChecked);assert.equal(replayed.sources.length,3);
});
test('only active status changes the real UAV hotspot contribution; underlying risk remains 35',()=>{
 const normal=U.normalize(raw),historic=U.normalize({...raw,eventState:current()});assert.equal(U.riskScore(normal).score,35);assert.equal(U.riskScore(historic).score,35);const h={latitude:60.235,longitude:25.87};assert.equal(U.hotspotImpact([normal],h).scoreDelta,7);assert.equal(U.hotspotImpact([historic],h).scoreDelta,0);assert.equal(historic.sourceUrl,raw.sourceUrl);assert.equal(IC.status({eventState:current()}),'INACTIVE');
});
test('a live registry update overrides an older active snapshot without reloading',t=>{
 const active=E.reconcile(raw,null,[],{now:Date.parse('2026-09-02T14:00:00Z')}),snapshot=U.normalize({...raw,eventState:active});const previous=globalThis.stateFor;globalThis.stateFor=()=>current();t.after(()=>{if(previous)globalThis.stateFor=previous;else delete globalThis.stateFor});assert.equal(U.hotspotImpact([snapshot],{latitude:60.235,longitude:25.87}).scoreDelta,0);assert.equal(IC.status({eventState:active}),'INACTIVE');
});
test('real no-danger and operator-unknown statements do not imply resolution or no confirmed drone',()=>{
 for(const r of followups.reports){const verdict=E.assessment(E.evidence(r));assert.equal(verdict.status,'UPDATED');assert(verdict.active)}
});
test('follow-up queries derive specific locations, drone terminology, authorities and title',()=>{
 const d=E.descriptor(raw),queries=E.searches(d);assert(queries[0].includes('Porvoo'));assert(queries[0].includes('Pellinge'));assert(queries[0].includes('UAS'));assert(queries[1].includes('Finnish Border Guard'));assert(queries[1].includes(d.title));
});
test('real later reports match without manually supplied event IDs',()=>{
 const d=E.descriptor(raw);for(const r of followups.reports)assert(E.related(d,E.evidence({...r,linkedEventId:null})));
});
test('source capture contains actual HTTP successes, exact URLs and publication metadata',()=>{
 assert(capture.sources.every(s=>s.status===200));for(const r of followups.reports){const original=capture.sources.find(s=>s.url===r.sourceUrl);assert(original);assert.equal(original.title,r.title);assert(original.dates.length)}
});
test('actual August restriction lifting resolves its own event, not the September Porvoo recovery',()=>{
 const r=require('./fixtures/finland-restrictions-real.json'),s=E.reconcile(r,null,[],{now});assert.equal(s.status,'RESOLVED');assert.equal(s.active,false);assert.equal(E.related(E.descriptor(raw),E.evidence(r)),false);
 const finland=E.reconcile(raw,current(),[r],{now});assert.equal(finland.status,'STALE');assert.equal(finland.sources.length,3);
 assert.equal(E.reconcile(r,s,[],{now:now+3600000,checked:true,checkSucceeded:true}).status,'RESOLVED');
});
test('news routing and event normalization retain inactive state and remove only current eligibility',()=>{
 const R=require('../news-routing'),state=current(),attached=E.attach({url:raw.sourceUrl,title:raw.summary,publishedAt:raw.timestamp}, {[state.id]:state});assert.equal(attached.eventId,raw.id);assert.equal(attached.eventState.status,'STALE');assert.equal(R.windowFor(attached,now).context,false);
});

test('an explicit corrected exercise end date repairs a stored lifecycle descriptor',()=>{
 const start='2026-09-01T00:00:00.000Z',wrongEnd='2026-09-19T00:00:00.000Z',correctEnd='2026-09-03T23:59:59.999Z';
 const exercise={id:'exercise-dates',eventId:'exercise-dates',title:'Exercise Masurian Patrol in Poland',eventType:'military_exercise',description:'Exercise Masurian Patrol from Sept. 1 to 3.',sourceUrl:'https://www.dvidshub.net/news/exercise-dates',publishedAt:'2026-09-05T07:00:00Z',startTime:start,endTime:wrongEnd};
 const old=E.reconcile(exercise,null,[],{now:Date.parse('2026-09-05T08:00:00Z')});
 const repaired=E.reconcile({...exercise,endTime:correctEnd},old,[],{now:Date.parse('2026-09-12T12:00:00Z')});
 assert.equal(repaired.descriptor.endTime,correctEnd);assert.equal(repaired.status,'STALE');assert.equal(repaired.active,false);
});
test('scheduled Worker follow-up preserves the real event across repeat polling',async(t)=>{
 const {reconcileWorkerEvents}=await import('../cloudflare/event-state-followup.mjs');require('../news-routing');const records=new Map(),env={EVENTS:{get:async key=>records.get(key)||null,put:async(key,value)=>records.set(key,JSON.parse(value))}};
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({articles:followups.reports}),{status:200})});
 const states=await reconcileWorkerEvents(env,[],followups.reports,now,true);assert.equal(states[raw.id].status,'STALE');assert.equal(states[raw.id].sources.length,3);const updated=states[raw.id].lastUpdated;
 const again=await reconcileWorkerEvents(env,[],followups.reports,now+60000,true);assert.equal(again[raw.id].lastUpdated,updated);assert.equal(again[raw.id].sources.length,3);assert.equal(calls,1);assert(again[raw.id].lastChecked>states[raw.id].lastChecked);
});
