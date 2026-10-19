const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const T=require('../teach-nordicwatch.js'),NR=require('../news-routing.js');
const date='2026-10-19T20:30:00.000Z';
const sample={
 sourceUrl:'https://www.dn.se/sverige/usas-ovanliga-drag-krigsfartyg-utanfor-sundsvall/?utm_source=x#article',
 title:'USA:s ovanliga drag: Krigsfartyg utanför Sundsvall',
 description:'USS Paul Ignatius övade i Bottenhavet med svenska och finska fartyg',
 publishedAt:'2026-10-18',eventOccurredAt:'2026-10-08',metadataOrigin:'MANUAL',
 label:'DIRECT_AOI',freshness:'HISTORICAL_REPORT',decision:'APPROVED_FOR_TESTING',
 reason:'Known Nordic naval operation; original event predates later news coverage.'
};
test('safe canonical news links strip trackers without fetching article text',()=>{
 assert.equal(T.url('https://www.dn.se/a/b?utm_source=social&ref=abc#part'),'https://www.dn.se/a/b?ref=abc');
 for(const v of ['http://www.dn.se/a','javascript:alert(1)','file:///etc/hosts','https://localhost/news','https://127.0.0.1/news','https://x.local/news','https://x.example/news','https://user:password@www.dn.se/a','https://[::1]/'])assert.throws(()=>T.url(v),undefined,v);
});
test('only matching archived articles supply metadata; unknown URLs remain manual',()=>{
 const records=[{url:'https://www.dn.se/a?a=1&utm_campaign=x',title:'Known article',publishedAt:'2026-10-18T12:00:00Z'}];
 assert.equal(T.localMatch('https://www.dn.se/a?a=1#sub',records).title,'Known article');
 assert.equal(T.localMatch('https://www.svd.se/a/other',records),null);
});
test('Teach uses real routing rules but does not confirm truth or attribution',()=>{
 const dn=T.suggestion({title:sample.title,description:sample.description},x=>NR.safeRelevance(x));
 assert.equal(dn.label,'DIRECT_AOI');
 assert(dn.matchedRegions.includes('Baltic Sea'));
 const negative=T.suggestion({title:'Sundsvall autumn food festival'},x=>NR.safeRelevance(x));
 assert.equal(negative.label,'NOT_RELEVANT');
 const spill=T.suggestion({title:'Drone attack on cargo vessels in Black Sea near Romania',description:'Bulgaria asks NATO for assistance after maritime shipping attack'},x=>NR.safeRelevance(x));
 assert.equal(spill.label,'STRATEGIC_SPILLOVER');
 const uncertain=T.suggestion({title:''},x=>NR.safeRelevance(x));
 assert.equal(uncertain.label,'NEEDS_REVIEW');
});
test('approved review saves only a test label, not a live situation or verified report',()=>{
 const r=T.submit([],sample,date);
 assert.equal(r.rows.length,1);
 assert.equal(r.entry.history.length,1);
 assert.equal(r.revision.revision,1);
 assert.equal(r.revision.label,'DIRECT_AOI');
 assert.equal(r.revision.sourceConfidence,'UNVERIFIED_BY_TEACH');
 assert.equal(r.revision.ruleImpact,'NONE');
 assert.equal(r.revision.publicationDateStatus,'DAY_ONLY');
 assert.equal(r.revision.eventDateStatus,'DAY_ONLY');
 assert.equal(r.revision.articlePublishedAt,'2026-10-18T00:00:00.000Z');
 assert.equal(r.revision.eventOccurredAt,'2026-10-08T00:00:00.000Z');
 assert.equal(r.entry.canonicalUrl,'https://www.dn.se/sverige/usas-ovanliga-drag-krigsfartyg-utanfor-sundsvall/');
});
test('corrections append an auditable revision, deduplicate URL and do not mutate prior record',()=>{
 const first=T.submit([],sample,date),before=JSON.stringify(first.rows);
 const corrected=T.submit(first.rows,{...sample,sourceUrl:T.url(sample.sourceUrl),label:'NEEDS_REVIEW',decision:'NEEDS_REVIEW',reason:'Need stronger event date evidence before test approval'},'2026-10-19T20:32:00Z');
 assert.equal(first.rows.length,1);
 assert.equal(corrected.rows.length,1);
 assert.equal(corrected.entry.history.length,2);
 assert.equal(corrected.entry.history[0].decision,'APPROVED_FOR_TESTING');
 assert.equal(corrected.entry.history[1].revision,2);
 assert.equal(corrected.entry.history[1].decision,'NEEDS_REVIEW');
 assert.equal(corrected.entry.history[1].reviewedAt,'2026-10-19T20:32:00.000Z');
 assert.equal(JSON.stringify(first.rows),before,'prior revisions must not mutate');
 assert.equal(T.exportReviewed(corrected.rows,date).approvedCount,0,'superseded approval must not export');
});
test('rejected and pending examples are excluded from approved test export',()=>{
 const a=T.submit([],sample,date);
 const b=T.submit(a.rows,{...sample,sourceUrl:'https://www.svd.se/a/sundsvall-food',title:'Sundsvall food fair',label:'NOT_RELEVANT',freshness:'UNKNOWN',decision:'REJECTED',reason:'Non-military local festival'},date);
 const c=T.submit(b.rows,{...sample,sourceUrl:'https://www.svt.se/nyheter/external',title:'Unknown report',label:'NEEDS_REVIEW',freshness:'UNKNOWN',decision:'NEEDS_REVIEW',reason:'Need credible source context'},date);
 const result=T.exportReviewed(c.rows,date);
 assert.equal(result.approvedCount,1);
 assert.equal(result.entries.length,1);
 assert.equal(result.entries[0].currentRevision,1);
 assert.equal(result.automaticRuleChange,false);
 assert.equal(result.isLiveEvidence,false);
});
test('labels, date and rationale are validated before saving any revision',()=>{
 for(const change of [
  {label:'CONFIRMED_OFFICIAL'},{freshness:'ACTIVE_OPERATION'},{decision:'AUTO_DEPLOY'},
  {title:''},{reason:'short'},{publishedAt:'invalid'},{eventOccurredAt:'unknown'},{metadataOrigin:'SCRAPED_UNVERIFIED'}
 ])assert.throws(()=>T.submit([],{...sample,...change},date),undefined,JSON.stringify(change));
});
test('local browser store degrades explicitly, does not claim successful persistence',()=>{
 const cache=new Map(),store={getItem:key=>cache.get(key)||null,setItem:(key,value)=>{cache.set(key,value);return true}};
 const r=T.submit([],sample,date);T.write(store,r.rows);
 assert.equal(T.read(store)[0].history.length,1);
 assert.throws(()=>T.write({setItem:()=>false},r.rows),/storage unavailable/i);
 assert.deepEqual(T.read({getItem:()=>'{broken'}),[]);
 assert.throws(()=>T.write(store,Array.from({length:251},()=>r.entry)),/full/i);
});
test('all controls are installed in the PWA app and offline cache',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 for(const name of ['teachOpen','teachDrawer','teachAnalyze','teachPreview','teachLabel','teachFreshness','teachDecision','teachSave','teachExport','teachReason','teachStatus'])assert(html.includes('id="'+name+'"'),name);
 for(const name of ['teach-nordicwatch.js','teach-ui.js']){assert(html.includes('<script src="'+name+'"></script>'));assert(sw.includes('"./'+name+'"'));}
 assert.match(html,/This.*does not fetch unknown articles automatically/);
});