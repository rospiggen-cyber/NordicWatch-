const assert=require('node:assert/strict');
const {test}=require('node:test');
const lab=require('../validation-lab.js');
const routing=require('../news-routing.js');
const freshness=require('../news-freshness.js');
const situational=require('../situational-engine.js');

test('NordicWatch Validation Lab regression suite',()=>{
  const report=lab.run({routing,freshness,situational});
  assert.equal(report.total,14);
  assert.equal(report.failed,0,report.results.filter(x=>!x.pass).map(x=>x.id+': '+x.actual+' vs '+x.expected).join('\n'));
  for(const entry of report.results)assert.equal(entry.pass,true,entry.id);
});
test('Incomplete baseline cannot display NORMAL or stable trend',()=>{
  const state=situational.baseline([],{military:0,gnss:0},{now:lab.NOW});
  assert.equal(state.baselineStatus,'INSUFFICIENT_DATA');
  const hotspot=situational.hotspotAssessment({name:'Kaliningrad / Baltijsk',lat:54.7,lon:20.5},{history:[],signals:[],events:[]});
  assert.equal(hotspot.trend,'UNKNOWN');
});
test('Article age is independent of event age',()=>{
  const now=lab.NOW;
  const old=situational.temporalContext({title:'Freshly published report about old event',publishedAt:'2026-10-26T06:00:00Z',eventOccurredAt:'2026-10-01T12:00:00Z'},now);
  assert(old.isHistoricalEvent);
  assert(old.temporalRelevance<30);
  const amended=situational.temporalContext({title:'New evidence',publishedAt:'2026-10-20T06:00:00Z',lastUpdatedAt:'2026-10-26T06:10:00Z',containsNewDevelopment:true},now);
  assert(amended.materialUpdateSupported);
  assert(amended.temporalRelevance>=95);
});
