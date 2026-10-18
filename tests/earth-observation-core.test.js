const assert=require('node:assert/strict');
const {test}=require('node:test');
const EO=require('../earth-observation-core.js');
const date='2026-10-18T09:00:00Z';
const base=(o={})=>({
 code:'EMSR888',name:'Mapped river flooding in Roslagen',
 countries:[{short_name:'Sweden'}],centroid:'POINT (18.50 59.85)',
 category:{slug:'flood',name:'Flood'},activationTime:'2026-10-17T08:00:00',
 eventTime:'2026-10-16T10:00:00',lastUpdate:'2026-10-18T07:00:00',
 n_aois:3,n_products:2,closed:false,...o
});

test('WKT validation and longitude-latitude order',()=>{
 assert.deepEqual(EO.wktPoint('POINT (18.9 59.8)'),{lon:18.9,lat:59.8});
 assert.equal(EO.wktPoint('POINT (300 92)'),null);
 assert.equal(EO.wktPoint('POLYGON ((18 60))'),null);
 assert.equal(EO.wktPoint('POINT (foo bar)'),null);
});
test('Roslagen, Hälsingland and Sweden-wide contexts remain distinct',()=>{
 const ro=EO.normalize(base());
 const ha=EO.normalize(base({code:'EMSR889',centroid:'POINT (17.05 61.31)'}));
 const out=EO.normalize(base({code:'EMSR890',centroid:'POINT (15.5 58.9)'}));
 assert.equal(ro.areaScope,'LOCAL_CENTROID');assert.deepEqual(ro.matchedAreas,['ROSLAGEN']);
 assert.equal(ha.areaScope,'LOCAL_CENTROID');assert.deepEqual(ha.matchedAreas,['HALSINGLAND']);
 assert.equal(out.areaScope,'SWEDEN_CONTEXT');assert.deepEqual(out.matchedAreas,[]);
});
test('foreign, sensitive and malformed events never masquerade as local data',()=>{
 assert.equal(EO.normalize(base({sensitive:true})),null);
 assert.equal(EO.normalize(base({code:'XYZ1'})),null);
 assert.equal(EO.normalize(base({activationTime:'invalid'})),null);
 assert.equal(EO.normalize(base({countries:['Norway'],centroid:'POINT (18.0 61.0)'})).areaScope,'LOCAL_CENTROID');
 assert.equal(EO.normalize(base({countries:['Norway'],centroid:'POINT (10.0 62.0)'})).areaScope,'OUT_OF_SCOPE');
});
test('missing centroid Sweden stays national only, never plotted locally',()=>{
 const row=EO.normalize(base({centroid:null,countries:['Sweden']}));
 assert.equal(row.areaScope,'SWEDEN_CONTEXT');assert.equal(row.centroid,null);
});
test('only Copernicus original links and catalogue interpretation are used',()=>{
 const r=EO.normalize(base({reportLink:'https://evil.example/forged',name:'<script>Fake</script>'}));
 assert.equal(r.source.url,'https://mapping.emergency.copernicus.eu/activations/api/activations/EMSR888/');
 assert(!r.title.includes('<'));assert.match(r.interpretation,/not the affected footprint/);
 assert.equal(r.evidence,'CONFIRMED_PUBLIC_MAPPING_ACTIVATION');
});
test('historical records are not automatically labeled live disasters',()=>{
 const r=EO.normalize(base({closed:false,activationTime:'2020-01-01T12:00:00'}));
 assert.equal(r.closed,false);assert.equal(r.activationAt,'2020-01-01T12:00:00.000Z');
 assert.match(r.interpretation,/live emergency/);
});
test('duplicates use freshest update; catalogue marks source and incomplete scan',()=>{
 const rows=[base(),base({lastUpdate:'2026-10-17T08:00:00'}),base({code:'EMSR889',centroid:'POINT (17.1 61.30)'})];
 const r=EO.catalogue(rows,{now:Date.parse(date),scannedPages:2,sourceCount:420});
 assert.equal(r.counts.local,2);assert.equal(r.activations.length,2);
 assert.equal(r.sourceHealth.coverageIncomplete,true);
 assert.equal(r.activations[0].source.name.includes('Copernicus'),true);
 assert.match(r.limitations[1],/centroid/);
});
test('healthy catalog with no local hits never claims absence of flooding',()=>{
 const r=EO.catalogue([base({countries:['Finland'],centroid:'POINT (24 61)'})],{now:Date.parse(date),scannedPages:1,sourceCount:1});
 assert.equal(r.counts.local,0);assert.equal(r.sourceHealth.status,'AVAILABLE');
 assert.match(r.limitations[0],/without activations/);
});
