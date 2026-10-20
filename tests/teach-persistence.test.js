const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../teach-persistence.js');
const T=require('../teach-nordicwatch.js');
const sample=(sourceUrl)=>({
 sourceUrl,title:'Radar near Gvardeysk, Kaliningrad',description:'An OTH radar antenna array is reported near Kaliningrad',
 label:'DIRECT_AOI',freshness:'NEW_DEVELOPMENT',decision:'APPROVED_FOR_TESTING',
 reason:'Sensor infrastructure in a core NordicWatch area'
});
test('localStorage quota failure persists teaching examples to IndexedDB fallback',async()=>{
 const memory=new Map(),store={
 getItem:key=>memory.get(key)||null,
 setItem:(key,value)=>{memory.set(key,value);return false},
 degraded:true
 };
 let idbRows=[];
 const idb={async read(){return idbRows},async write(rows){idbRows=structuredClone(rows);return true}};
 const p=P.create(T,store,idb);assert.deepEqual(await p.load(),[]);
 const first=T.submit(p.rows(),sample('https://thetimes.com/article/gvardeysk'),'2026-10-20T08:45:00Z');
 const result=await p.save(first.rows);
 assert.equal(result.saved,true);
 assert.equal(result.backend,'IndexedDB');
 assert.equal(result.needsBackup,false);
 assert.equal(idbRows.length,1);
 const next=P.create(T,{getItem:()=>null,setItem:()=>false},idb);
 assert.equal((await next.load()).length,1,'IndexedDB record survives new app session');
 assert.equal(next.rows()[0].currentRevision,1);
});
test('both storage providers blocked keeps data available for backup but does not claim durable save',async()=>{
 const store={getItem:()=>null,setItem:()=>false};
 const unavailable={async read(){throw Error('idb blocked')},async write(){throw Error('idb blocked')}};
 const p=P.create(T,store,unavailable);await p.load();
 const item=T.submit(p.rows(),sample('https://thetimes.com/article/baltic'),'2026-10-20T08:45:00Z');
 const result=await p.save(item.rows);
 assert.equal(result.saved,false);
 assert.equal(result.needsBackup,true);
 assert.equal(p.backupRequired(),true);
 assert.equal(p.rows().length,1,'unsaved item still available to JSON backup');
});
test('successful legacy storage remains usable even if IndexedDB is denied',async()=>{
 const data=new Map(),store={getItem:k=>data.get(k)||null,setItem:(k,v)=>{data.set(k,v);return true}};
 const idb={async read(){throw Error('access denied')},async write(){throw Error('access denied')}};
 const p=P.create(T,store,idb);await p.load();
 const created=T.submit(p.rows(),sample('https://thetimes.com/article/another'),'2026-10-20T08:45:00Z');
 const result=await p.save(created.rows);
 assert.equal(result.saved,true);
 assert.equal(result.backend,'localStorage');
 assert.equal(T.read(store).length,1);
});
test('migrate/reconcile stored revisions without losing longer history',async()=>{
 const old=T.submit([],sample('https://thetimes.com/article/radar'),'2026-10-20T08:45:00Z');
 const newer=T.submit(old.rows,{...sample('https://thetimes.com/article/radar'),reason:'New reviewed evidence with correct location'},'2026-10-20T09:00:00Z');
 const store={getItem:()=>JSON.stringify(old.rows),setItem:()=>true};
 const idb={async read(){return newer.rows},async write(){return true}};
 const p=P.create(T,store,idb);
 const rows=await p.load();
 assert.equal(rows.length,1);assert.equal(rows[0].history.length,2);
 const opposite=P.mergeRows(newer.rows,old.rows);
 assert.equal(opposite[0].history.length,2);
});
test('cannot save before async persistence has loaded',async()=>{
 const p=P.create(T,{getItem:()=>null,setItem:()=>true},{async read(){return []},async write(){return true}});
 await assert.rejects(p.save([]),/still loading/i);
});

test('do not overwrite unreadable prior IndexedDB history after migration failure',async()=>{
 let writes=0;
 const brokenRead={async read(){throw Error('db read fails')},async write(){writes++;return true}};
 const p=P.create(T,{getItem:()=>null,setItem:()=>false},brokenRead);
 await p.load();
 const item=T.submit(p.rows(),sample('https://thetimes.com/article/retain'),'2026-10-20T08:45:00Z');
 const result=await p.save(item.rows);
 assert.equal(result.saved,false);
 assert.equal(writes,0,'unknown IndexedDB state must not be overwritten');
 assert.equal(p.rows().length,1,'new data remain exportable as JSON');
});
