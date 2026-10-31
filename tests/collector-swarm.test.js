const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../collector-swarm');
const now=Date.parse('2026-09-12T12:00:00Z'),row=(id,extra={})=>({id,timestamp:now-3600000,title:id,source:'source-'+id,score:20,...extra});
test('default swarm emits stable scan cards for every specialist',()=>{const cards=C.defaults().run({air:[row('a',{kind:'AWACS'})],coverage:{'air-activity':{checked:true}}},{now});assert.equal(cards.length,11);assert(cards.every(x=>x.id==='scan-'+x.collectorId));assert.equal(cards.find(x=>x.collectorId==='air-activity').status,'ACTIVE')});
test('collectors distinguish quiet, unavailable and degraded states',()=>{const swarm=C.createSwarm([{id:'quiet',select:()=>[]},{id:'missing',select:()=>[]},{id:'broken',select:()=>{throw new Error('feed failed')}}]),cards=swarm.run({coverage:{quiet:{checked:true}}},{now});assert.equal(cards.find(x=>x.collectorId==='quiet').status,'QUIET');assert.equal(cards.find(x=>x.collectorId==='missing').status,'NO DATA');assert.equal(cards.find(x=>x.collectorId==='broken').status,'DEGRADED')});
test('evidence is deduplicated, time bounded and source traceable',()=>{const swarm=C.createSwarm([{id:'trace',windowMs:2*3600000,select:s=>s.rows}]),card=swarm.run({rows:[row('same'),row('same',{timestamp:now-1000,source:'new'}),row('old',{timestamp:now-3*3600000})]},{now})[0];assert.equal(card.observationCount,1);assert.equal(card.evidence[0].source,'new');assert.deepEqual(card.sources,['new'])});
test('one failed collector cannot stop the rest of the swarm',()=>{const cards=C.createSwarm([{id:'bad',select:()=>{throw Error('bad')}},{id:'good',select:()=>[row('ok')]}]).run({}, {now});assert.equal(cards.find(x=>x.collectorId==='bad').health.ok,false);assert.equal(cards.find(x=>x.collectorId==='good').status,'ACTIVE')});
test('ASW Scan Card selects ASW without treating other aircraft as patrol assets',()=>{
 const cards=C.defaults().run({air:[row('poseidon',{kind:'ASW',region:'North Sea'}),row('fighter',{kind:'FIGHTER'})],coverage:{'asw-maritime':{checked:true}}},{now});
 const card=cards.find(x=>x.collectorId==='asw-maritime');assert.equal(card.status,'ACTIVE');assert.equal(card.observationCount,1);assert.match(card.description,/not evidence of a submarine contact/);
});
test('ISR and High North collectors select only their own evidence',()=>{const cards=C.defaults().run({air:[row('awacs',{kind:'AWACS'}),row('transport',{kind:'TRANSPORT'})],all:[row('kola',{region:'Kola / Murmansk'}),row('south',{region:'Germany'})]},{now});assert.equal(cards.find(x=>x.collectorId==='isr-ew').observationCount,1);assert.equal(cards.find(x=>x.collectorId==='high-north').observationCount,1)});
test('external trigger raises a bounded watch card without becoming an AOI event',()=>{const trigger=row('ukraine-wave',{directAoiEvent:false,watchAreas:['Kaliningrad','Kola'],watchTargets:['EW','AEW','FIGHTER_CAP'],evidenceType:'CONFIRMED_EXTERNAL',score:55}),card=C.defaults().run({upstreamTriggers:[trigger]},{now}).find(x=>x.collectorId==='upstream-triggers');assert.equal(card.status,'ACTIVE');assert.equal(card.priority,'ELEVATED');assert.equal(card.evidence[0].directAoiEvent,false);assert.deepEqual(card.evidence[0].watchTargets,['EW','AEW','FIGHTER_CAP'])});
test('Scan Card assets are loaded by the page and retained by the offline shell',()=>{const fs=require('node:fs'),html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');for(const file of ['collector-swarm.js','scan-cards.js']){assert.match(html,new RegExp('<script src="'+file.replace('.','\\.')+'"></script>'));assert.match(sw,new RegExp('"\\./'+file.replace('.','\\.')+'"'))}assert.match(html,/id="scanCards"/)});

test('outage after polling is DEGRADED, never falsely QUIET',()=>{
 const swarm=C.createSwarm([{id:'outage',select:s=>s.rows||[]}]);
 const card=swarm.run({rows:[],coverage:{outage:{checked:true,available:false,message:'ADS-B feed unavailable'}}},{now})[0];
 assert.equal(card.status,'DEGRADED');assert.equal(card.observationCount,0);assert.equal(card.health.checked,true);assert.equal(card.health.available,false);
 assert.match(card.health.message,/unavailable/);
});
test('no AIS adapter means NO DATA even if local collector exists',()=>{
 const card=C.defaults().run({maritime:[],coverage:{maritime:{checked:false,available:false,message:'No external AIS'}}},{now}).find(x=>x.collectorId==='maritime');
 assert.equal(card.status,'NO DATA');assert.equal(card.observationCount,0);
});
test('genuinely checked healthy zero observations may be QUIET',()=>{
 const card=C.defaults().run({air:[],coverage:{'air-activity':{checked:true,available:true,message:'ADS-B feed available'}}},{now}).find(x=>x.collectorId==='air-activity');
 assert.equal(card.status,'QUIET');
});

test('maritime-security Scan Card watches reporting without claiming an AIS contact',()=>{
 const news=row('gotland-police-boarding',{kind:'MARITIME_SECURITY',domain:'NEWS',region:'Gotland',source:'SVT',score:38});
 const other=row('ferry-time',{kind:'MARITIME_TRANSPORT',domain:'NEWS',region:'Gotland'});
 const cards=C.defaults().run({news:[news,other],maritime:[],coverage:{'maritime-security':{checked:true,available:true}}},{now});
 const watch=cards.find(x=>x.collectorId==='maritime-security'),ais=cards.find(x=>x.collectorId==='maritime');
 assert.equal(watch.status,'ACTIVE');
 assert.equal(watch.observationCount,1);
 assert.equal(watch.evidence[0].domain,'NEWS');
 assert.match(watch.description,/not AIS observations or confirmed hostile activity/);
 assert.equal(ais.observationCount,0);
});
