const {test}=require('node:test'),assert=require('node:assert/strict');const R=require('../news-routing.js'),B=require('../brief-engine.js');
const now=Date.parse('2026-09-07T10:00:00Z'),H=3600000;
const report=(title,more={})=>({title,publishedAt:new Date(now-40*H).toISOString(),url:'https://www.nato.int/report',...more});
test('NAMEJS official report routes to both consumers with external evidence',()=>{const routed=R.route([report('NAMEJS 2026')],{now});assert.equal(routed.articles.length,1);assert.equal(routed.events[0].eventType,'MILITARY_EXERCISE');assert.equal(routed.events[0].evidenceType,'CONFIRMED_EXTERNAL');assert(routed.events[0].relevance.matchedRegions.includes('Latvia'));const brief=B.build({articles:routed.articles,now});assert.equal(brief.relevantStoredNewsEvaluated,1);assert.equal(brief.developments[0].evidence,'CONFIRMED EXTERNAL REPORT');assert(routed.diagnostics[0].includedInWhatChanged)});
for(const title of ['The U.S. Arrives to Showcase Unparalleled Defense at Egypt International Airshow 2026','Exercise Phoenix Express 2026 in Tunisia','Super Garuda Shield 26','Freedom Edge 2026'])test('exclude global control: '+title,()=>{const r=R.route([report(title)],{now});assert.equal(r.articles.length,0);assert.equal(r.events.length,0);assert.match(r.diagnostics[0].exclusionReason,/No explicit/)});
test('deployment destination qualifies while NATO identity alone does not',()=>{assert(R.evaluateNordicRelevance(report('US troops depart Texas',{destination:'Latvia',description:'Military deployment'})).relevant);assert(!R.evaluateNordicRelevance(report('NATO delegation attends Egypt airshow')).relevant)});
test('Nordic company or participant mentions do not relocate foreign events into the AOI',()=>{
 const bangladesh=report('MAURIC to Design Riverine Patrol Vessels for the Bangladesh Coast Guards',{description:'A Norwegian company was selected for a commercial naval design project in South Asia.'});
 const ramstein=report('LRMC and Ramstein Host Danish Flyver Ruck March',{description:'A Danish Air Force ceremonial ruck march took place at Landstuhl in Kaiserslautern.'});
 for(const item of [bangladesh,ramstein]){const result=R.route([item],{now});assert.equal(result.articles.length,0);assert.match(result.diagnostics[0].exclusionReason,/outside the AOI/)}
});
test('four NAMEJS articles form one event with four sources and stable lifecycle',()=>{const rows=Array.from({length:4},(_,i)=>report('NAMEJS 2026 report '+i,{id:'a'+i,url:'https://source'+i+'.example/report'}));const first=R.route(rows,{now});assert.equal(first.events.length,1);assert.equal(first.events[0].sourceCount,4);const repeat=R.route(rows,{now:now+H,previous:first.events});assert.equal(repeat.events[0].lifecycle,'developing');assert.equal(repeat.counters.whatChanged,0);assert.equal(repeat.counters.dailyBriefEvaluated,1);const revised=R.route([...rows,report('NAMEJS 2026 new deployment',{url:'https://new.example/report',lastUpdatedAt:new Date(now+H).toISOString()})],{now:now+H,previous:repeat.events});assert.equal(revised.events[0].lifecycle,'updated');assert.equal(revised.events[0].firstSeen,now)});
test('relevance failure is closed and reduces brief confidence',()=>{const routed=R.route([report('NAMEJS 2026'),report('Egypt airshow')],{now,evaluate:()=>{throw Error('broken geo stage')}});assert(routed.degraded);assert.equal(routed.events.length,0);assert(routed.diagnostics.every(d=>d.exclusionReason==='Relevance processing degraded'));assert.equal(B.build({articles:routed.articles,now}).coverageStatus,'INSUFFICIENT')});
test('ongoing seven day context is retained without using polls to renew evidence',()=>{const r=R.route([report('NAMEJS 2026',{ongoing:true,publishedAt:new Date(now-100*H).toISOString(),lastChecked:new Date(now).toISOString()})],{now});assert.equal(r.events.length,1);assert.equal(r.articles.length,0);assert.match(r.diagnostics[0].exclusionReason,/lastChecked/)});
test('official event and same URL article share one normalized event',()=>{const r=R.route([report('Latvia military exercise',{id:'article'}),report('Latvia military exercise',{id:'event',eventType:'military_exercise',sourceUrl:'https://www.nato.int/report'})],{now});assert.equal(r.events.length,1);assert.equal(r.articles.length,1)});
test('worker routing metadata does not refresh a stale report on re-ingestion',()=>{const first=R.route([report('NAMEJS 2026')],{now});const later=R.route(first.articles,{now:now+50*H});assert.equal(later.articles.length,0)});
test('explicit source signal associations connect distinct report titles',()=>{const r=R.route([report('Baltic Il-20 interception',{signalId:'s1',eventId:'one'}),report('Polish fighters over Baltic Sea',{signalId:'s2',eventId:'two',url:'https://other.example/story'}),report('Baltic intercept event',{eventId:'intercept',sourceSignals:['s1','s2'],url:'https://third.example/story'})],{now});assert.equal(r.events.length,1);assert.equal(r.events[0].sourceCount,3)});
test('Danish and Lithuanian local-language incidents reach What changed and Daily Brief',()=>{
 const incidentNow=Date.parse('2026-09-15T06:31:00Z');
 const rows=[
  {title:'Russisk fregat affyrede flares mod dansk militærhelikopter ved Gedser',description:'Forsvaret oplyser, at en russisk fregat affyrede to flares mod en dansk helikopter under overvågning syd for Gedser.',publishedAt:'2026-09-14T21:02:00Z',url:'https://www.dr.dk/nyheder/indland/russisk-fregat-affyrede-flares'},
  {title:'NATO naikintuvai sunaikino į Lietuvos oro erdvę įskridusį droną Kauno rajone',description:'Dronas įskrido į Lietuvos oro erdvę, o NATO naikintuvai jį sunaikino Kauno rajone.',publishedAt:'2026-09-14T22:13:00Z',url:'https://www.lrt.lt/naujienos/lietuvoje/drone-kauno'}
 ];
 const routed=R.route(rows,{now:incidentNow});
 assert.equal(routed.articles.length,2);
 assert.equal(routed.counters.dailyBriefEvaluated,2);
 assert.equal(routed.counters.whatChanged,2);
 assert(routed.events.some(e=>e.relevance.matchedRegions.includes('Denmark')));
 assert(routed.events.some(e=>e.relevance.matchedRegions.includes('Lithuania')));
 const brief=B.build({articles:routed.articles,now:incidentNow});
 assert.equal(brief.relevantStoredNewsEvaluated,2);
});

test('NATO Black Sea shipping strikes are strategic spillover, not Nordic geographic incidents',()=>{
 const date=Date.parse('2026-10-19T13:00:00Z');
 const rows=[
  {title:'Drone strikes hit merchant vessels near Romanian coast in Black Sea',description:'Bulgaria requests NATO anti-drone systems after attacks on cargo ships.',url:'https://www.reuters.com/world/sample',publishedAt:'2026-10-19T09:00:00Z'},
  {title:'Ukraina: Dödsattacker i Svarta havet – ber om Nato-hjälp',description:'Fartyg har angripits av drönare i Svarta havet.',url:'https://www.aftonbladet.se/nyheter/a/example',publishedAt:'2026-10-19T10:00:00Z'}
 ];
 const routed=R.route(rows,{now:date});
 assert.equal(routed.articles.length,2);
 assert.equal(routed.counters.aoiRelevant,2);
 for(const e of routed.events){
  assert.equal(e.relevance.directGeographicRelevance,false);
  assert.equal(e.relevance.correlatedStrategicRelevance,true);
  assert(e.relevance.matchedRegions.includes('Black Sea / NATO southeastern flank'));
  assert(e.relevance.matchedTopics.includes('MARITIME_SECURITY'));
 }
 assert.equal(B.build({articles:routed.articles,now:date}).relevantStoredNewsEvaluated,2);
});
test('strategic spillover does not open generic world news or ordinary Black Sea news',()=>{
 const samples=[
  'Merchant ship attacked by drones near Strait of Hormuz; Iran warns shipping',
  'NATO fleet completes routine Black Sea maritime exercise near Bulgaria',
  'Romanian drone company wins new NATO commercial contract',
  'Drone strikes hit cargo vessels near Odesa in Black Sea',
  'Romania hosts NATO summit on technology and innovation'
 ];
 for(const title of samples){
  const relevance=R.evaluateNordicRelevance({title});
  assert.equal(relevance.relevant,false,title);
  assert.equal(relevance.correlatedStrategicRelevance,false,title);
 }
});

test('DN Sundsvall destroyer headline and Swedish synopsis route to both briefs',()=>{
 const now=Date.parse('2026-10-19T18:30:00Z');
 const article={title:'USA:s ovanliga drag: Krigsfartyg utanför Sundsvall',description:'Den amerikanska robotjagaren USS Paul Ignatius har övat utanför Sundsvall. Att USA går in med krigsfartyg i Bottenhavet är ovanligt.',publishedAt:'2026-10-18T16:27:00Z',url:'https://www.dn.se/sverige/usas-ovanliga-drag-krigsfartyg-utanfor-sundsvall/'};
 const routed=R.route([article],{now});
 assert.equal(routed.articles.length,1,'new DN coverage must appear as current reporting');
 assert.equal(routed.counters.whatChanged,1);
 assert.equal(routed.counters.dailyBriefEvaluated,1);
 assert.equal(routed.events[0].relevance.directGeographicRelevance,true);
 assert(routed.events[0].relevance.matchedRegions.includes('Baltic Sea'));
 assert(routed.events[0].relevance.matchedTopics.includes('MILITARY_ACTIVITY'));
 assert(routed.events[0].relevance.matchedEntities.includes('uss paul ignatius'));
 assert.equal(B.build({articles:routed.articles,now}).relevantStoredNewsEvaluated,1);
 assert(R.evaluateNordicRelevance({title:article.title}).relevant,'short DN-only headlines must still route');
});
test('official Swedish/Finnish naval exercise qualifies when fresh, but old source does not resurrect as news',()=>{
 const original={title:'Sverige övar med USA och Finland i Bottenhavet',description:'HMS Karlstad och FNS Hämeenmaa övar med USS Paul Ignatius.',url:'https://www.mynewsdesk.com/se/forsvarsmakten/pressreleases/sverige-oevar-med-usa-och-finland-i-bottenhavet-3471549',publishedAt:'2026-10-08T13:09:00Z'};
 assert.equal(R.route([original],{now:Date.parse('2026-10-08T18:00:00Z')}).articles.length,1);
 const late=R.route([original],{now:Date.parse('2026-10-19T18:30:00Z')});
 assert.equal(late.articles.length,0,'publication timestamp is never reset to ingestion time');
 assert.match(late.diagnostics[0].exclusionReason,/Outside evidence window/);
});
test('Bothnian locality alone does not admit unrelated Swedish news',()=>{
 for(const title of ['Sundsvall hosts autumn food festival','Hotels in Härnösand open for the season','Färjor i Bottenhavet: sommarens tidtabell','Swedish boat show in Sundsvall']){
   const r=R.evaluateNordicRelevance({title});
   assert.equal(r.relevant,false,title);
 }
 assert.equal(R.evaluateNordicRelevance({title:'US Navy destroyer drills off Sundsvall in Bothnian Sea'}).relevant,true);
});


test('new OTH radar near Gvardeysk is a NordicWatch regional sensor-infrastructure signal',()=>{
 const article={title:'Russia builds giant radar on Nato’s eastern flank',description:'Satellite images by ICEYE show an over-the-horizon radar at Gvardeysk in Kaliningrad, with three 500m antenna arrays.',publishedAt:'2026-10-19T14:30:00Z',url:'https://www.thetimes.com/world/europe/article/russia-builds-radar-kaliningrad-exclave-nato-eastern-europe-w933w3blq?utm_source=chatgpt.com'};
 const result=R.evaluateNordicRelevance(article);
 assert.equal(result.relevant,true);
 assert(result.matchedRegions.includes('Kaliningrad / Baltijsk'));
 assert(result.matchedTopics.includes('MILITARY_SENSOR_INFRASTRUCTURE'));
 const routed=R.route([article],{now:Date.parse('2026-10-20T06:30:00Z')});
 assert.equal(routed.articles.length,1);
 assert.equal(routed.counters.whatChanged,1);
});
test('military sensor relevance does not introduce general radar and local food false positives',()=>{
 for(const title of ['Weather radar added at a US airport','Technology fair unveils new radar in South Korea','Gvardeysk hosts annual harvest festival']){
  assert.equal(R.evaluateNordicRelevance({title}).relevant,false,title);
 }
});


test('NW-HYBRID-001: SVT Europe-wide physical hybrid investigation routes as unverified strategic context',()=>{
 const now=Date.parse('2026-10-23T08:00:00Z');
 const article={title:'Granskning: Så trappar Ryssland upp våldsamma hybridattackerna',description:'Under det senaste halvåret har över 50 fysiska hybridattacker riktats mot Europa – där spåren leder till Ryssland.',publishedAt:'2026-10-23T06:01:00Z',url:'https://www.svt.se/nyheter/inrikes/granskning-sa-trappar-ryssland-upp-valdsamma-hybridattackerna'};
 const routed=R.route([article],{now});
 assert.equal(routed.articles.length,1);
 assert.equal(routed.counters.whatChanged,1);
 assert.equal(routed.events[0].relevance.directGeographicRelevance,false,'Europe is not a verified Nordic location');
 assert.equal(routed.events[0].relevance.correlatedStrategicRelevance,true);
 assert(routed.events[0].relevance.matchedTopics.includes('HYBRID_SECURITY'));
 assert(routed.events[0].relevance.matchedRegions.includes('Europe-wide hybrid security context'));
 assert.equal(routed.events[0].evidenceType,'INFERRED','relevance does not confirm attribution');
 assert.equal(B.build({articles:routed.articles,now}).relevantStoredNewsEvaluated,1);
 assert.equal(R.route([article],{now:Date.parse('2026-11-03T00:00:00Z')}).articles.length,0,'old article must not be recycled as breaking news');
});

test('Europe-wide hybrid strategic context gate rejects general European and isolated foreign stories',()=>{
 const positive=[
  'Investigation finds Russian-linked hybrid attacks across Europe',
  'Ryssland: granskning av hybridattacker i Europa',
  'European investigation: Russian sabotage campaign uses arson across Europe'
 ];
 for(const title of positive){
  const result=R.evaluateNordicRelevance({title});
  assert.equal(result.relevant,true,title);
  assert.equal(result.directGeographicRelevance,false,title);
  assert.equal(result.correlatedStrategicRelevance,true,title);
 }
 const negative=[
  'EU summit discusses sanctions on Russia and European trade',
  'Investigation: Russian cyberattacks spread across Europe',
  'Russian sabotage attempt at a European railway station',
  'Russia invests in hybrid car technology across Europe',
  'NATO fleet completes routine Black Sea maritime exercise near Bulgaria'
 ];
 for(const title of negative){
  const result=R.evaluateNordicRelevance({title});
  assert.equal(result.correlatedStrategicRelevance,false,title);
  assert.equal(result.relevant,false,title);
 }
});

test('NW-MARITIME-001: Swedish police boarding at Gotland becomes a watchable report, not verified hostile attribution',()=>{
 const now=Date.parse('2026-10-31T15:00:00Z');
 const articles=[
  {title:'Polisen bordade fartyg utanför Gotland',description:'En gränskontroll genomfördes under natten. Resedokument utan anmärkning.',publishedAt:'2026-10-31T13:38:00Z',url:'https://www.svt.se/nyheter/inrikes/polisen-har-kontrollerat-fartyg-utanfor-gotland'},
  {title:'Nattlig räd mot rysskopplat fartyg vid Gotland',description:'Polisen genomförde en kontroll. Uppgifter om ryska kopplingar är inte bekräftade.',publishedAt:'2026-10-31T13:24:00Z',url:'https://www.tv4.se/artikel/test'},
  {title:'Gotlandsfärjan får ny tidtabell',description:'Fartyg avgår från Gotland enligt plan.',publishedAt:'2026-10-31T13:00:00Z',url:'https://www.example.org/ferry'}
 ];
 const result=R.route(articles,{now});
 assert.equal(result.articles.length,2);
 assert.equal(result.counters.dailyBriefEvaluated,2);
 assert.equal(result.counters.whatChanged,2);
 for(const article of result.articles){
  assert(article.relevance.matchedTopics.includes('MARITIME_SECURITY'));
  assert(article.relevance.matchedRegions.includes('Sweden'));
  assert.equal(article.evidenceType,'INFERRED','news reporting must not become confirmed military/hybrid activity');
 }
 const later=R.route(articles,{now:Date.parse('2026-11-04T15:00:00Z')});
 assert.equal(later.articles.length,0,'stale reporting must not reappear');
});
test('NW-MARITIME-001: vessel mention or routine police activity alone is not a maritime security signal',()=>{
 for(const title of ['Gotland ferry ship arrives on schedule','Police patrol monitors road traffic on Gotland','Cargo ship detained in Egypt; Swedish paint manufacturer comments','Polish cargo ship near Gotland']){
  const result=R.evaluateNordicRelevance({title});
  assert.equal(result.matchedTopics.includes('MARITIME_SECURITY'),false,title);
 }
});
test('NW-MARITIME-001: focused Swedish GDELT query covers Gotland vessel reports without extra polling requests',()=>{
 const fs=require('node:fs'),page=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.match(page,/"Gotland" OR "Sundsvall" OR "Bottenhavet"/);
 assert.match(page,/"krigsfartyg" OR "robotjagare" OR "fartyg"/);
});
