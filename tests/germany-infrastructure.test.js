// Fabricated inputs below are deterministic unit cases only. Never loaded by the app.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../germany-infrastructure'),NR=require('../news-routing'),SE=require('../situational-engine');
const now=Date.parse('2026-09-08T12:00:00Z');
const report=(title,extra={})=>({title,publishedAt:'2026-09-08T09:00:00Z',sourceName:'Unit test newsroom',url:'https://example.test/'+encodeURIComponent(title),...extra});
const sample=()=>[
 report('Unexplained power grid outage in Berlin, Germany'),
 report('Suspicious transformer fire in Leipzig, Germany'),
 report('Drone sighting near Rostock port and rail infrastructure, Germany')
];
const signals=rows=>G.accumulate([],rows,{now});
test('every required Baltic AOI passes security news geography, including accents and hyphens',()=>{
 for(const name of ['Schleswig-Holstein','Mecklenburg-Vorpommern','Kiel','Lübeck','Luebeck','Rostock','Rügen','Ruegen','Fehmarn','Greifswald','Stralsund','German Baltic ports']){
  const r=NR.safeRelevance(report(`${name}: naval exercise protects coastal infrastructure`));assert(r.relevant,name);assert(r.directGeographicRelevance,name);assert(G.geography({title:name}).directGeographicRelevance,name);
 }
});
test('generic German politics, sports, crime and foreign incidents do not pass',()=>{
 for(const title of ['German election campaign in Berlin','Kiel football club wins match','Rostock local robbery: police discuss security','Germany local budget debate','Lübeck sports festival'])assert.equal(NR.safeRelevance(report(title)).relevant,false,title);
 assert.equal(G.detect(report('German power grid outage in France',{country:'France'})),null);
});
test('single routine outage stays low; multiple routine outages never become a pattern',()=>{
 const rows=signals(['Berlin','Rostock','Leipzig'].map(p=>report(`Scheduled power grid outage for maintenance in ${p}, Germany`)));
 assert.equal(rows.length,3);assert(rows.every(s=>s.severity==='LOW'));assert.deepEqual(G.correlate(rows,{now}),[]);
 assert.deepEqual(G.correlate(signals([sample()[0]]),{now}),[]);
});
test('all infrastructure categories are recognized; geographic evaluation is independent of timestamp validation',()=>{
 for(const type of ['power plant','substation','transformer','electricity grid','energy infrastructure','telecommunications','rail infrastructure','port','pipeline','subsea cable landing','military logistics node']){
  const a=report(`Suspicious fire at ${type} in Rostock, Germany`);assert(G.detect(a),type);assert(NR.safeRelevance({...a,publishedAt:null}).relevant,type);
 }
 for(const event of ['unauthorized access','unexplained outage','drone sighting','suspicious explosion'])assert(G.detect(report(`${event} at Kiel power plant`)),event);
});
test('distributed unusual incidents, a Baltic anchor and drone activity create a traceable pattern',()=>{
 const rows=signals(sample()),before=JSON.stringify(rows),hs=G.correlate(rows,{now});assert.equal(hs.length,1);const h=hs[0];assert.equal(h.incidentCount,3);assert.equal(h.signalCount,3);assert.equal(h.level,'WATCH');assert(h.correlatedStrategicRelevance);assert(h.directGeographicRelevance);assert(h.patternRelevance>=60);assert.equal(JSON.stringify(rows),before);
 for(const s of h.signals){assert.equal(s.sourceUrl,s.originalRecord.url);assert.equal(s.title,s.originalRecord.title);assert(s.source);assert(s.timestamp);assert(s.reason);assert.equal(s.suspectedCause,'UNKNOWN');for(const k of ['eventType','location','coordinates','entities','infrastructureType','severity','confidence','suspectedCause'])assert(k in s,k)}
 assert(h.signals.find(s=>s.location==='Berlin').reason.includes('Correlated strategic relevance'));
 assert(h.signals.find(s=>s.location==='Rostock').reason.includes('Direct Baltic relevance'));
});
test('no strategic anchor, duplicate articles, unknown times or expired evidence cannot create hotspots',()=>{
 assert.deepEqual(G.correlate(signals(sample().map(a=>({...a,title:a.title.replace('Rostock','Dresden')}))),{now}),[]);
 const story=sample()[2],duplicates=signals([story,{...story,url:'https://another.test/story'},{...story,url:'https://third.test/story'}]);assert.equal(duplicates.length,3);assert.deepEqual(G.correlate(duplicates,{now}),[]);
 assert.equal(G.detect(report('Rostock power grid outage',{publishedAt:null,ingestedAt:new Date(now).toISOString()})),null);
 assert.deepEqual(G.correlate(signals(sample()),{now:now+73*3600000}),[]);
 for(const flag of ['mock','seed','testOnly'])assert.equal(G.detect({...story,[flag]:true}),null);
 const differentDescriptions=['Suspicious fire at Rostock power plant','Unexplained Rostock power grid outage','Suspicious transformer explosion in Rostock'];assert.deepEqual(G.correlate(signals(differentDescriptions.map(title=>report(title))),{now}),[]);
});
test('URL dedup does not renew time; signal count equals evidence list on update',()=>{
 const initial=signals(sample()),updated=G.accumulate(initial,sample().map(a=>({...a,publishedAt:new Date(now).toISOString()})),{now});assert.equal(updated.length,3);assert.equal(updated[0].timestamp,initial[0].timestamp);assert.equal(G.correlate(initial,{now})[0].id,G.correlate(updated,{now})[0].id);
 const more=G.accumulate(updated,[report('Suspicious telecom fire in Hamburg, Germany')],{now});const h=G.correlate(more,{now})[0];assert.equal(h.signalCount,h.signals.length);assert.equal(h.incidentCount,4);
});
test('source-supported cause, negation, missing/unsafe URLs and coordinate uncertainty are explicit',()=>{
 const denied=G.detect(report('Rostock power grid outage. No evidence of sabotage; technical fault'));assert.equal(denied.suspectedCause,'SOURCE_REPORTS_ROUTINE_OR_TECHNICAL_CAUSE');assert.equal(denied.unusual,false);
 assert.equal(G.detect(report('Police suspect sabotage at Rostock port after fire')).suspectedCause,'SOURCE_REPORTS_SABOTAGE_OR_ARSON');
 const missing=G.detect(report('Suspicious power plant fire in Greifswald',{url:'javascript:alert(1)'}));assert.equal(missing.sourceUrl,null);assert.equal(missing.coordinatePrecision,'PLACE_CENTROID');
 assert.equal(G.detect(report('Planned drone inspection of Rostock port')),null);
});
test('unknown or syndicated source relationships never count as independent corroboration',()=>{
 const plain=G.correlate(signals(sample()),{now})[0];assert.equal(plain.cic.independentGroups,0);assert.equal(plain.cic.independentIncidentCorroboration,false);
 const rows=sample().map(a=>({...a,independenceGroup:'wire-service'}));rows.push({...rows[0],url:'https://syndication.test/one'});assert.equal(G.correlate(signals(rows),{now})[0].cic.independentGroups,1);
 rows.push({...rows[0],url:'https://independent.test/one',independenceGroup:'independent-observation'});assert(G.correlate(signals(rows),{now})[0].cic.independentIncidentCorroboration);
});
test('new pattern layer cannot change legacy hotspot score for the same runtime snapshot',()=>{
 const html=fs.readFileSync('index.html','utf8'),score=html.split(/\r?\n/).find(l=>l.startsWith('function hotspotScore('));
 const signal={id:'news-original',domain:'NEWS',evidence:'OBSERVATION',timestamp:new Date(now).toISOString(),lat:54.7,lon:20.5,region:'Kaliningrad / Baltijsk'};
 const h=['Kaliningrad / Baltijsk',54.71,20.51,82],assessment=SE.hotspotAssessment({name:h[0],lat:h[1],lon:h[2]},{signals:[signal]});
 const ctx={hotspotSituation:()=>assessment,UI:{hotspotImpact:()=>({scoreDelta:0})},uavIncidents:[]};vm.createContext(ctx);vm.runInContext(score,ctx);assert.equal(ctx.hotspotScore(h),83);G.correlate(signals(sample()),{now});assert.equal(ctx.hotspotScore(h),83);assert.equal(assessment.correlatedSignals.length,1);
 const fixed=JSON.parse(html.match(/hotspots:(\[[\s\S]*?\]),\r?\nchanges:/)[1]);ctx.hotspotSituation=h=>SE.hotspotAssessment({name:h[0],lat:h[1],lon:h[2]},{signals:[signal]});const scores=fixed.map(h=>ctx.hotspotScore(h));G.correlate(signals(sample()),{now});assert.deepEqual(fixed.map(h=>ctx.hotspotScore(h)),scores);
 const ui=fs.readFileSync('germany-ui.js','utf8');assert(!ui.includes('NORDICWATCH_SIGNAL_ARCHIVE'));assert(!ui.includes('situationalState='));assert(!ui.includes('D.hotspots.push'));assert(ui.includes('hotspotSignalMarkup'));
});
test('Worker exposes inland candidates through the dedicated route before normal geographic routing',async(t)=>{
 t.mock.method(Date,'now',()=>now);
 const worker=(await import('../cloudflare/event-feed-worker.js')).default;
 const data=sample(),env={EVENTS:{get:async key=>key==='signals:archive'?data:key==='discovery:last-run'?{coverage:{status:'HEALTHY'}}:null}};
 const response=await worker.fetch(new Request('https://worker.test/germany-infrastructure'),env);assert.equal(response.status,200);const body=await response.json();assert.equal(body.signals.length,3);assert.equal(body.hotspots.length,1);assert.equal(body.coverage.status,'HEALTHY');
});
test('real fetched retirement report is rejected without fabricating a current infrastructure pattern',()=>{
 const audit=require('../GERMANY_RUNTIME_AUDIT.json');assert.equal(audit.feeds[0].status,200);assert.equal(audit.feeds[0].count,44);
 const raw=audit.germanRecords[0].originalRecord;assert.equal(G.detect(raw),null);assert.deepEqual(G.correlate(G.accumulate([],[raw],{now:Date.parse(audit.capturedAt)}),{now:Date.parse(audit.capturedAt)}),[]);
});
test('threat-only reports, negated drones, and undated ingestion timestamps are not incidents',()=>{
 for(const title of ['Rostock port strengthens protection against sabotage','Germany warns of fire risk at Kiel power plant','Rostock port: no drone sightings'])assert.equal(G.detect(report(title)),null,title);
 assert.equal(G.detect({...sample()[0],publishedAt:null,eventTime:new Date(now).toISOString(),timeStatus:'TIME_UNCERTAIN'}),null);
});
test('German Baltic place coordinates propagate into official event extraction',async()=>{
 const {extractEntities}=await import('../cloudflare/event-discovery-core.mjs');
 for(const place of ['Kiel','Lübeck','Rostock','Rügen','Fehmarn','Greifswald','Stralsund','Schleswig-Holstein','Mecklenburg-Vorpommern']){
  const e=extractEntities({title:`Naval exercise in ${place}`,summary:'Coastal security activity'});assert(e.places.some(p=>p.country==='Germany'&&Number.isFinite(p.latitude)),place);
 }
});
test('a disconnected older anchor does not hide a supported Baltic pattern',()=>{
 const old=report('Suspected sabotage attack on Kiel pipeline',{publishedAt:'2026-09-06T00:00:00Z'});
 assert.equal(G.correlate(signals([old,...sample()]),{now}).length,1);
});
test('dynamic evidence UI renders every counted signal through the existing source renderer',()=>{
 const html=fs.readFileSync('index.html','utf8'),renderer=html.split(/\r?\n/).find(l=>l.startsWith('function hotspotSignalMarkup(')),ui=fs.readFileSync('germany-ui.js','utf8');
 const context={esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')};vm.createContext(context);vm.runInContext(renderer+'\n'+ui,context);
 const h=G.correlate(signals(sample()),{now})[0],markup=context.germanyHotspotContent(h);assert.equal((markup.match(/<article /g)||[]).length,h.signalCount);assert.equal((markup.match(/View source ↗/g)||[]).length,h.signalCount);
 for(const s of h.signals){assert(markup.includes(context.esc(s.sourceUrl)));assert(markup.includes(context.esc(s.title)));assert(markup.includes(context.esc(s.reason)));assert(markup.includes(s.timestamp));}
 const missing={...h,signals:h.signals.map(s=>({...s,sourceUrl:null}))};assert.equal((context.germanyHotspotContent(missing).match(/Source link unavailable/g)||[]).length,h.signalCount);
});
