const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../regional-delta.js');
const now=Date.parse('2026-09-30T18:00:00Z'),H=3600000,DAY=24*H;
const row=(id,hoursAgo,extra={})=>({id,timestamp:now-hoursAgo*H,region:'Gotland',domain:'AVIATION',source:'source-'+id,...extra});

test('Regional Delta detects an increase against the previous 24 h',()=>{
  const signals=[row('n1',1),row('n2',3,{domain:'GNSS'}),row('n3',5,{domain:'AIS'}),row('n4',8),row('old',30)];
  const d=R.snapshot(signals,[],{now}).regions[0];
  assert.equal(d.current24h,4);assert.equal(d.previous24h,1);assert.equal(d.delta24h,3);assert.equal(d.direction,'UP');
  assert.deepEqual(d.drivers.map(x=>x.domain).sort(),['AIS','AVIATION','GNSS'].sort());
  assert.match(d.coverageNote,/not a threat or escalation rating/);
});

test('Regional Delta uses a historical reference only when enough reference days exist',()=>{
  const reference=[2,3,4,5,6].map((day,i)=>row('ref'+i,day*24+2,{domain:'NEWS'}));
  const d=R.snapshot([row('now',2),...reference],[],{now}).regions[0];
  assert.equal(d.baselineAvailable,true);assert(Number.isFinite(d.baselineDaily));assert(d.baselineDaily>0);
  const thin=R.snapshot([row('now',2),row('old',3*24)],[],{now}).regions[0];
  assert.equal(thin.baselineAvailable,false);assert.equal(thin.baselineDaily,null);
});

test('Regional Delta reports new observations since the previous viewed snapshot',()=>{
  const first=R.snapshot([row('a',2),row('b',4)],[],{now});
  const second=R.snapshot([row('a',2),row('b',4),row('c',1)],[],{now,previous:first.state});
  assert.equal(second.regions[0].newSinceViewed,1);assert.deepEqual(second.regions[0].newSignalIds,['c']);
});

test('Regional Delta carries SituationScore change separately from activity direction',()=>{
  const signals=[row('a',2),row('b',4)],s1={situationScore:40,observations:signals},first=R.snapshot(signals,[s1],{now});
  const s2={situationScore:55,observations:signals},second=R.snapshot(signals,[s2],{now,previous:first.state});
  assert.equal(second.regions[0].situationScoreDelta,15);
  assert.equal(second.regions[0].direction,'UP');
});
