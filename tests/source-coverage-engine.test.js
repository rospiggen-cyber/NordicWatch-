const {test}=require('node:test');
const assert=require('node:assert/strict');
const coverage=require('../source-coverage-engine.js');
const clock=Date.parse('2026-10-18T10:00:00Z');
const registry=[
  {id:'white-house',publisher:'The White House',domain:'POLICY',actor:'US'},
  {id:'eu-council',publisher:'Council of the EU',domain:'ALLIANCE',actor:'EU'},
  {id:'nato',publisher:'NATO',domain:'ALLIANCE',actor:'NATO'},
  {id:'congress',publisher:'U.S. Congress',domain:'DOMESTIC',actor:'US'}
];
const feeds=[
  {source:registry[0],url:'https://www.whitehouse.gov/news/feed/'},
  {source:registry[0],url:'https://www.whitehouse.gov/presidential-actions/feed/'},
  {source:registry[1],url:'https://www.consilium.europa.eu/rss'}
];
const health=[
  {id:'white-house',ok:true,items:25,accepted:2},
  {id:'white-house',ok:true,items:20,accepted:1},
  {id:'eu-council',ok:true,items:20,accepted:4}
];
const analysis=[
  {id:'US_DOMESTIC_POLICY',title:'US domestic pressure and external policy',links:[]},
  {id:'US_POLICY_NORDIC_SECURITY',title:'US policy and Nordic–Baltic security',links:[]}
];
const signals=[
  {id:'us',title:'US policy statement',actor:'US',domain:'POLICY',eventTime:'2026-10-17T10:00:00Z',
   source:{publisher:'The White House',independenceGroup:'WHITE_HOUSE',url:'https://www.whitehouse.gov/news/1'}},
  {id:'eu',title:'EU regional response',actor:'EU',domain:'ALLIANCE',region:'NORDIC_BALTIC',
   eventTime:'2026-10-17T10:00:00Z',
   source:{publisher:'Council of the EU',independenceGroup:'EU_COUNCIL',url:'https://www.consilium.europa.eu/en/press/1'}}
];
const run=(extra={})=>coverage.build({registry,feeds,health,analysis,signals,now:clock,...extra});
const dim=(r,h,id)=>r.hypotheses.find(x=>x.id===h).dimensions.find(x=>x.id===id);

test('two White House feeds count as one original source group',()=>{
  const r=run();
  assert.equal(r.technical.configuredFeeds,3);
  assert.equal(r.technical.respondingFeeds,3);
  assert.equal(r.technical.connectedOrganizations,2);
  assert.equal(r.technical.independentOrganizations,2);
  assert.equal(r.providers.find(x=>x.id==='white-house').recentSignals,1);
});
test('technical all-green does not mark US domestic hypothesis as complete',()=>{
  const r=run();
  assert.equal(dim(r,'US_DOMESTIC_POLICY','US_DOMESTIC').status,'NOT_MONITORED');
  assert.equal(dim(r,'US_DOMESTIC_POLICY','US_POLICY').status,'SIGNALS_PRESENT');
  assert.equal(r.hypotheses[0].status,'COVERAGE_GAPS');
  assert.equal(r.hypotheses[0].validCrossDomainLinks,0);
  assert.equal(r.providers.find(x=>x.id==='congress').status,'NOT_CONFIGURED');
});
test('US policy and Nordic regional signals cover two dimensions but do not establish links',()=>{
  const r=run();
  const h=r.hypotheses[1];
  assert.equal(h.status,'DIMENSIONS_OBSERVED');
  assert.equal(h.validCrossDomainLinks,0);
  assert.equal(h.observedIndependentGroups,2);
  assert.equal(dim(r,'US_POLICY_NORDIC_SECURITY','NORDIC_SECURITY').respondingProviders,1);
});
test('a general European press statement without direct Nordic linkage is not a Nordic security signal',()=>{
  const r=run({signals:[signals[0],{...signals[1],region:''}]});
  assert.equal(dim(r,'US_POLICY_NORDIC_SECURITY','NORDIC_SECURITY').status,'NO_MATCHING_EVIDENCE');
});
test('failed official-source feed is not disguised as no relevant event',()=>{
  const r=run({health:health.map(x=>({...x,ok:false,accepted:0,items:0})),signals:[]});
  assert.equal(r.technical.respondingFeeds,0);
  assert.equal(dim(r,'US_POLICY_NORDIC_SECURITY','US_POLICY').status,'FEEDS_UNAVAILABLE');
  assert.equal(dim(r,'US_POLICY_NORDIC_SECURITY','NORDIC_SECURITY').status,'FEEDS_UNAVAILABLE');
  assert.equal(r.providers.find(x=>x.id==='eu-council').status,'UNAVAILABLE');
});
test('partial provider outage remains visible even if the other White House feed works',()=>{
  const r=run({health:[health[0],{...health[1],ok:false,accepted:0},health[2]]});
  assert.equal(r.providers.find(x=>x.id==='white-house').status,'PARTIAL_FAILURE');
  assert.equal(dim(r,'US_DOMESTIC_POLICY','US_POLICY').status,'SIGNALS_PRESENT');
});
test('old, synthetic, unverified and contradictory items cannot satisfy a dimension',()=>{
  const altered=[
    {...signals[0],eventTime:'2026-09-01T00:00:00Z'},
    {...signals[1],synthetic:true},
    {...signals[1],synthetic:false,lead:true},
    {...signals[0],stance:'COUNTER'}
  ];
  const r=run({signals:altered});
  assert.equal(dim(r,'US_DOMESTIC_POLICY','US_POLICY').signals,0);
  assert.equal(dim(r,'US_POLICY_NORDIC_SECURITY','NORDIC_SECURITY').signals,0);
  assert.equal(r.providers.find(x=>x.id==='eu-council').recentSignals,0);
});
test('a configured but irrelevant source produces NO_MATCHING_EVIDENCE, not NOT_MONITORED',()=>{
  const r=run({signals:[]});
  assert.equal(dim(r,'US_POLICY_NORDIC_SECURITY','US_POLICY').status,'NO_MATCHING_EVIDENCE');
  assert.equal(dim(r,'US_DOMESTIC_POLICY','US_DOMESTIC').status,'NOT_MONITORED');
});
test('empty/no-feed state does not imply no events or zero risk',()=>{
  const r=coverage.build({registry,analysis,now:clock});
  assert.equal(r.technical.configuredFeeds,0);
  assert.equal(r.technical.respondingFeeds,0);
  assert.equal(dim(r,'US_DOMESTIC_POLICY','US_POLICY').status,'NOT_MONITORED');
  assert.match(r.caveat,/No-news is not no-event/);
});
