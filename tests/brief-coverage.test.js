const test=require('node:test'),assert=require('node:assert/strict'),B=require('../brief-engine.js'),IC=require('../intelligence-core.js');
const now=Date.parse('2026-09-07T08:00:00Z'),H=3600000;
const articles=Array.from({length:15},(_,i)=>({id:'a'+i,eventId:'e'+i,title:'Baltic report '+i,url:'https://source'+i+'.example/report',domain:'source'+i+'.example',publishedAt:new Date(now-H).toISOString(),lastUpdatedAt:new Date(now-H).toISOString()}));
const coverage={newsChecked:true,externalChecked:true};
test('observations and zero reporting cannot support a negative assessment',()=>{const b=B.build({now,signals:[{id:'x',timestamp:now-H,domain:'AVIATION'}],coverage});assert.equal(b.coverageStatus,'INSUFFICIENT');assert.equal(b.confidence,'LOW');assert.equal(b.newsCoverage.articlesEvaluated,0);assert.notEqual(b.assessment,'No new significant development')});
test('15 checked unchanged reports support a negative assessment',()=>{const first=B.build({articles,coverage,now});const b=B.build({articles,coverage,previous:first.snapshot,now:now+1000});assert.equal(b.coverageStatus,'SUFFICIENT');assert.equal(b.developments.length,0);assert.equal(b.assessment,'No new significant development');assert.equal(b.relevantStoredNewsEvaluated,15)});
test('failed refresh preserves stored evidence but reduces confidence',()=>{const b=B.build({articles,now,coverage:{newsChecked:false,externalChecked:false}});assert.equal(b.news.articles.length,15);assert.equal(b.coverageStatus,'PARTIAL');assert.equal(b.confidence,'LIMITED');assert.notEqual(b.assessment,'No new significant development')});
test('event lifecycle preserves first seen, tracks real updates, resolution and staleness',()=>{const first=B.build({articles:[articles[0]],now});const updated=B.build({articles:[{...articles[0],title:'Updated Baltic report'}],now:now+1000,previous:first.snapshot});assert.equal(updated.events[0].status,'updated');assert.equal(updated.events[0].firstSeen,now);assert.equal(updated.events[0].lastUpdated,now+1000);const resolved=B.build({articles:[{...articles[0],resolved:true}],now:now+2000,previous:updated.snapshot});assert.equal(resolved.developments.length,0);assert.equal(resolved.events[0].status,'resolved');assert.equal(B.build({previous:resolved.snapshot,now:now+3000}).events[0].status,'stale')});
test('same incident reports contribute one development with source count',()=>{const b=B.build({articles:[articles[0],{...articles[1],eventId:articles[0].eventId}],now});assert.equal(b.developments.length,1);assert.equal(b.events[0].sourceCount,2)});
test('stale and out of region evidence cannot provide sufficient coverage',()=>{assert.equal(B.build({articles,coverage,now:now+80*H}).coverageStatus,'INSUFFICIENT');assert.equal(B.build({articles,coverage,now,geographic:()=>false}).coverageStatus,'INSUFFICIENT')});
test('requested standalone regional aliases remain in coverage',()=>{for(const title of ['Königsberg','Baltijsk','Narva','Finnmark','Polish Baltic coast'])assert.equal(IC.perimeter({title}).visible,true,title)});
test('Morning and Evening UI await failed refreshes and still render insufficient coverage',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 for(const kind of ['morning','evening']){
 const rendered=[];const node=()=>({append(){},prepend(){},firstChild:null,set textContent(v){rendered.push(v)}});
 const context=vm.createContext({window:{NordicWatchBrief:B,NordicWatchSituations:{}},document:{getElementById:()=>node(),createElement:()=>node()},routeNewsEvidence:()=>({articles:[],degraded:false}),NR:require('../news-routing.js'),IC:{perimeter:()=>({visible:true})},briefNewsCoverage:null,briefExternalCoverage:false,readArray:()=>[],maritimeRead:()=>null,localStorage:{setItem(){}},loadNews:async()=>{throw Error('network failure')},initEventEngine:async()=>{throw Error('parser failure')},generateBriefLiveDetails(){},briefItem:()=>node()});
 vm.runInContext(fs.readFileSync(require.resolve('../situation-ui.js'),'utf8'),context);
 vm.runInContext('refreshSituations=()=>{};',context);
 await vm.runInContext('generateBrief('+JSON.stringify(kind)+')',context);
 assert(rendered.includes('⚠ News coverage insufficient'));assert(!rendered.includes('No new significant development'));assert(rendered.some(t=>t.includes('confidence: LOW')));
 }
});
