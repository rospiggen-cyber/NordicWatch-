/* NordicWatch Validation Lab. Synthetic cases model publicly reported scenarios.
 * A green test is a software assertion, not confirmation of a real-world event. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  root.NordicWatchValidationLab=api;
})(globalThis,function(){
'use strict';
const NOW=Date.parse('2026-10-26T06:40:00Z');
const cases=Object.freeze([
  {id:'NEWS-SPORT',group:'Relevance',title:'Ceremonial NATO sports contest must not enter the threat feed',
   expected:'EXCLUDED',input:{title:'NATO Battle Group celebrates Armed Forces Day with sports competition',description:'Military sports competition near Gdansk, Poland'}},
  {id:'NEWS-MEDICAL',group:'Relevance',title:'Civilian helicopter hospital fuel facility is not military activity',
   expected:'EXCLUDED',input:{title:'Tankanlæg til helikopter øger lighed i sundhed på Bornholm',description:'Hospital helicopter healthcare at Bornholm'}},
  {id:'NEWS-EDITORIAL',group:'Relevance',title:'Finland-model naval commentary is not a regional incident',
   expected:'EXCLUDED',input:{title:'Coast Guard Icebreakers and the Finland Model: A Blueprint for the U.S. Navy?',description:'Naval opinion on Finnish shipping'}},
  {id:'LV-UAS-REOPEN',group:'Reference incident',title:'Latvian UAV wreck can be classified as operational reporting',
   expected:'RELEVANT',input:{title:'Latvia drone wreck recovered after earlier unexplained explosion',description:'Military drone incident investigated near the Latvian border',region:'Latvia'}},
  {id:'LT-BALLOON-AIRPORT',group:'Reference incident',title:'Lithuanian balloon incursion affecting air traffic is operational',
   expected:'RELEVANT',input:{title:'Drone and balloon intrusion disrupts Kaunas airport in Lithuania',description:'Airport airspace security interference and flights diverted',region:'Lithuania'}},
  {id:'LV-BORDER-SABOTAGE',group:'Reference incident',title:'Sabotage of Latvian border surveillance is operational',
   expected:'RELEVANT',input:{title:'Sabotage against border surveillance cameras in Latvia',description:'Military border security infrastructure attacked near Latvia Belarus frontier',region:'Latvia'}},
  {id:'LT-DECLARED-EXERCISE',group:'Reference exercise',title:'Official Baltic military exercises stay visible as context',
   expected:'RELEVANT',input:{title:'Lithuania military exercise Budri pelėda begins',description:'NATO forces train during military exercise Lithuania',region:'Lithuania'}}
]);
function run({routing,freshness,situational,now=NOW}={}){
  if(!routing?.evaluateNordicRelevance||!freshness?.assess||!situational?.temporalContext)
    throw new Error('Required routing, freshness and situational modules missing');
  const results=[];
  const test=(id,group,title,expected,actual,pass,notes='')=>results.push({id,group,title,expected,actual,pass:Boolean(pass),notes});
  for(const item of cases){
    const assessment=routing.evaluateNordicRelevance(item.input);
    const actual=assessment.relevant?'RELEVANT':'EXCLUDED';
    test(item.id,item.group,item.title,item.expected,actual,actual===item.expected,assessment.reason.join('; '));
  }
  const stale=situational.temporalContext({title:'Old naval article',publishedAt:'2026-10-23T06:40:00Z'},now);
  test('TIME-STALE','Temporal evidence','72h-old report must not score as just published','< 30',String(stale.temporalRelevance),stale.temporalRelevance<30,
    'Publication and event timestamps must be separate');
  const recent=situational.temporalContext({title:'New maritime warning',publishedAt:'2026-10-26T06:10:00Z'},now);
  test('TIME-RECENT','Temporal evidence','Current publication can score fresh','>= 95',String(recent.temporalRelevance),recent.temporalRelevance>=95);
  const recycled=situational.temporalContext({title:'Originally published: old incident',publishedAt:'2026-10-26T06:10:00Z',eventOccurredAt:'2026-10-01T06:10:00Z',description:'From the archives'},now);
  test('TIME-RECYCLED','Temporal evidence','Newly published archive without new evidence must be discounted','< 30',String(recycled.temporalRelevance),recycled.temporalRelevance<30);
  const renewed=situational.temporalContext({title:'Officially confirmed new evidence',publishedAt:'2026-10-20T06:10:00Z',lastUpdatedAt:'2026-10-26T06:10:00Z',eventOccurredAt:'2026-10-01T06:10:00Z',containsNewDevelopment:true},now);
  test('TIME-UPDATE','Temporal evidence','Genuine material follow-up restores temporal relevance','>= 95',String(renewed.temporalRelevance),renewed.temporalRelevance>=95);
  const gap=situational.baseline([],{military:0,gnss:0},{now});
  test('COVERAGE-NO-BASELINE','Coverage','No observations must not produce NORMAL','INSUFFICIENT_DATA',gap.baselineStatus,gap.baselineStatus==='INSUFFICIENT_DATA');
  const hot=situational.hotspotAssessment({name:'Kaliningrad / Baltijsk',lat:54.7,lon:20.5},{history:[],signals:[],events:[]});
  test('COVERAGE-NO-TREND','Coverage','Zero-history hotspot must not produce STABLE','UNKNOWN',hot.trend,hot.trend==='UNKNOWN');
  const unknown=freshness.assess({title:'Untimestamped observation'},now);
  test('COVERAGE-NO-DATE','Coverage','Missing article timestamp must be excluded from fresh news','FAIL',unknown.freshnessResult,unknown.freshnessResult==='FAIL');
  return {generatedAt:new Date(now).toISOString(),results,total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,
    caveat:'Synthetic regression data are test fixtures only. Passing tests do not independently verify any reported incident or confirm live collector coverage.'};
}
return Object.freeze({run,cases,NOW});
});
