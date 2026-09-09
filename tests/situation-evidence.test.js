const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../situation-engine');
const now=Date.parse('2026-09-09T18:27:00Z'),H=3600000;
// Controlled unit inputs, not fabricated production incidents. The actual
// screenshot's captured fields and algebra are documented separately in the audit.
const input=(id,extra={})=>({id,incidentId:id,domain:'INFRASTRUCTURE',timestamp:now-H,lat:54,lon:12,region:'Northern Germany',title:'Energy infrastructure outage',themes:['ENERGY'],source:'source-'+id,quality:70,eventScore:40,evidence:'DIRECT OBSERVATION',...extra});
const spaced=()=>[72,48,9,3].map((hours,i)=>input('s'+i,{timestamp:now-hours*H,source:['a','b','b','c'][i],domain:i?'NEWS':'AVIATION'}));

test('missing baseline is null/excluded, never a measured zero deviation',()=>{
  const s=S.build(spaced(),{now})[0];
  assert.equal(s.baseline.sampleDays,0);assert.equal(s.baseline.available,false);
  assert.equal(s.baseline.status,'BASELINE NOT AVAILABLE');assert.equal(s.baseline.deviation,null);
  assert.equal(s.components.baselineDeviation,null);
  assert.equal(s.acceleration.score,0);assert.equal(s.level,'POSSIBLE PATTERN');assert.equal(s.confidence,'MEDIUM');
  assert.doesNotMatch(s.summary,/something is developing|multiple anomalies|accelerating|within baseline/i);
  assert.equal(s.contributionTrace.accumulation.count,4);assert.equal(s.components.accumulation,24);
  assert.equal(s.contributionTrace.sourceSupport.count,3);assert.equal(s.components.sourceSupport,15);
});

test('unknown distances retain thematic hypotheses but receive no geographic CIC credit',()=>{
  const rows=spaced().map(s=>({...s,lat:null,lon:null})),s=S.build(rows,{now})[0];
  assert.equal(s.observations.length,4);assert(s.links.length>0);
  assert(s.links.every(p=>p.distanceKm===null&&!p.proximityConfirmed));
  assert.equal(s.cic.interaction,0);assert.equal(s.components.cic,0);
  assert.equal(s.level,'POSSIBLE PATTERN');assert.equal(s.relationship,'POSSIBLE RELATIONSHIP');
  assert.equal(s.confidence,'LOW');assert.match(s.summary,/insufficient baseline and geographic data/);
});

test('generic Regional label cannot connect an unlocated news item to arbitrary aircraft',()=>{
  const a=S.normalize(input('a',{domain:'NEWS',lat:null,lon:null,region:'Regional'})),b=S.normalize(input('b',{domain:'AVIATION',region:'Regional',themes:[],title:'EH10'}));
  assert.equal(S.pair(a,b).related,false);assert.equal(S.pair(a,b).proximityConfirmed,false);
});

test('unknown-distance historical records cannot manufacture a regional baseline',()=>{
  const rows=[...spaced(),...[10,12,14].map(day=>input('old'+day,{timestamp:now-day*24*H,lat:null,lon:null}))];
  const s=S.build(rows,{now})[0];assert.equal(s.baseline.sampleDays,0);assert.equal(s.baseline.deviation,null);
});

test('strong independent located cross-domain evidence may retain HIGH without a baseline',()=>{
  const rows=['NEWS','AVIATION','INFRASTRUCTURE'].map((domain,i)=>input('cross'+i,{domain,timestamp:now-i*H}));
  const s=S.build(rows,{now})[0];assert.equal(s.crossDomainSupport.strong,true);assert.equal(s.confidence,'HIGH');
  const reports=S.build(rows.map((s,i)=>({...s,domain:i?'OFFICIAL':'NEWS'})),{now})[0];
  assert.equal(reports.crossDomainSupport.strong,false);assert.equal(reports.confidence,'MEDIUM');
  const unlocated=S.build(rows.map(s=>({...s,lat:null,lon:null})),{now})[0];
  assert.equal(unlocated.crossDomainSupport.strong,false);assert.equal(unlocated.confidence,'LOW');
});

test('a baseline-supported actual zero remains a measured value and numerical thresholds stay fixed',()=>{
  const history=Array.from({length:8},(_,i)=>input('old'+i,{timestamp:now-(10+i)*24*H}));
  const s=S.build([input('current'),...history],{now})[0];
  assert.equal(s.baseline.available,true);assert.equal(s.baseline.deviation,0);assert.equal(s.components.baselineDeviation,0);
  for(const row of S.build(spaced(),{now}))assert.equal(row.scoreBand,row.situationScore>=80?'HIGH':row.situationScore>=65?'ELEVATED':row.situationScore>=45?'DEVELOPING':'WATCH');
});

test('UI renders unavailable baseline safely and exposes source/observation trace',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),rendered=[];
  const element=()=>({append(){},className:'',textContent:'',set href(v){assert.match(v,/^https:/)}});
  const context={window:{NordicWatchSituations:S,NordicWatchBrief:{}},document:{createElement:element},console};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../situation-ui.js'),'utf8'),context);
  context.openExplanation=()=>element();context.explanationText=(_parent,title,value)=>rendered.push({title,value});
  context.showSituation(S.build(spaced().map(s=>({...s,lat:null,lon:null})),{now})[0]);
  assert(rendered.some(r=>r.value.includes('BASELINE NOT AVAILABLE')&&r.value.includes('deviation not assessable')));
  assert(rendered.some(r=>r.value.includes('NOT AVAILABLE (excluded)')));
  assert(rendered.some(r=>r.title==='Source support audit'&&r.value.includes('3 source labels')));
});
