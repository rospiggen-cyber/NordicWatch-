import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,indexedRecords,indexedPut,indexedDelete} from '../cloudflare/kv-catalog.mjs';
import {MemoryKV,withCatalog} from './helpers/kv-catalog.mjs';
import worker from '../cloudflare/event-feed-worker.js';
import pushWorker from '../cloudflare/adsb-monitor-worker.js';

test('migrates all pages, retains old keys, reads current values and survives cold starts without KV enumeration',async()=>{
  const kv=new MemoryKV(Array.from({length:1005},(_,i)=>['event:'+i,JSON.stringify({id:i})]));
  const env=withCatalog({EVENTS:kv});
  assert.equal((await indexedRecords(env,'EVENTS','collector:discovery')).length,1005);
  assert.equal(kv.listCalls,2);
  await indexedPut(env,'EVENTS','event:new',JSON.stringify({id:'new'}),'collector:discovery');
  await indexedPut(env,'EVENTS','event:0',JSON.stringify({id:0,updated:true}),'collector:discovery');
  env.KV_CATALOG.restart();
  const records=await indexedRecords(env,'EVENTS','GET /events');
  assert.equal(records.length,1006);
  assert.equal(records.find(r=>r.key==='event:0').value.updated,true);
  assert.equal(kv.listCalls,2);
});

test('one full day of endpoint polls and scheduled reads stays below 100 lists, including cold starts',async()=>{
  const kv=new MemoryKV(),env=withCatalog({EVENTS:kv,APP_ORIGIN:'https://example.org'});
  for(let minute=0;minute<1440;minute++) {
    if(minute%60===0)env.KV_CATALOG.restart();
    assert.equal((await worker.fetch(new Request('https://worker/events'),env)).status,200);
    if(minute%10===0)assert.equal((await worker.fetch(new Request('https://worker/news'),env)).status,200);
    if(minute%15===0)await indexedRecords(env,'EVENTS','collector:discovery');
  }
  assert.equal(kv.listCalls,1);
  const response=await worker.fetch(new Request('https://worker/kv-diagnostics'),env),report=await response.json();
  const counters=report.days[0].callers;
  assert.equal(counters['GET /events'].invocations,1440);
  assert.equal(counters['GET /news'].invocations,144);
  assert.equal(counters['collector:discovery'].invocations,96);
  assert.equal(counters['GET /events'].listCalls,1);
  assert.equal(counters['GET /news'].listCalls,0);
  assert.equal(kv.listCalls,1,'diagnostics must not enumerate KV');
});

test('concurrent subscriptions cannot overwrite membership; deletion never resurrects after restart',async()=>{
  const kv=new MemoryKV([['sub:legacy',JSON.stringify({endpoint:'legacy'})]]),env=withCatalog({SUBSCRIPTIONS:kv});
  await Promise.all(Array.from({length:30},(_,i)=>indexedPut(env,'SUBSCRIPTIONS','sub:'+i,JSON.stringify({endpoint:String(i)}),'POST /push/subscribe')));
  assert.equal((await indexedRecords(env,'SUBSCRIPTIONS','collector:monitor')).length,31);
  await indexedDelete(env,'SUBSCRIPTIONS','sub:legacy','DELETE /push/subscribe');
  env.KV_CATALOG.restart();
  assert.equal((await indexedRecords(env,'SUBSCRIPTIONS','collector:monitor')).length,30);
  assert.equal(kv.listCalls,1);
});

test('failed migration resumes without publishing a partial manifest and records failed list attempts',async()=>{
  const kv=new MemoryKV(Array.from({length:1001},(_,i)=>['event:'+i,JSON.stringify({id:i})])),env=withCatalog({EVENTS:kv});
  const list=kv.list.bind(kv);let fail=true;
  kv.list=async options=>{if(options.cursor&&fail){fail=false;kv.listCalls++;throw new Error('upstream failure');}return list(options)};
  await assert.rejects(indexedRecords(env,'EVENTS','GET /events'),/upstream failure/);
  env.KV_CATALOG.restart();
  assert.equal((await indexedRecords(env,'EVENTS','GET /events')).length,1001);
  assert.equal(kv.listCalls,3);
  const diagnostic=await catalog(env,'EVENTS','diagnostics','GET /kv-diagnostics');
  assert.equal(diagnostic.days[0].callers['GET /events'].listCalls,3);
  assert.equal(diagnostic.days[0].callers['GET /events'].listFailures,1);
});

test('missing record writes do not hide later successful records or create phantom subscriptions',async()=>{
  const kv=new MemoryKV(),env=withCatalog({SUBSCRIPTIONS:kv});
  const put=kv.put.bind(kv);kv.put=async()=>{throw new Error('write failed')};
  await assert.rejects(indexedPut(env,'SUBSCRIPTIONS','sub:a','{}','POST /push/subscribe'));
  assert.deepEqual(await indexedRecords(env,'SUBSCRIPTIONS','collector:monitor'),[]);
  kv.put=put;
  await indexedPut(env,'SUBSCRIPTIONS','sub:a','{"endpoint":"a"}','POST /push/subscribe');
  assert.equal((await indexedRecords(env,'SUBSCRIPTIONS','collector:monitor')).length,1);
});

test('empty KV pages with continuation cursors do not truncate migration',async()=>{
  const kv=new MemoryKV([['event:kept','{"id":"kept"}']]),env=withCatalog({EVENTS:kv});
  kv.list=async({cursor})=>{kv.listCalls++;return cursor ? {keys:[{name:'event:kept'}],list_complete:true} : {keys:[],list_complete:false,cursor:'next'}};
  assert.equal((await indexedRecords(env,'EVENTS','GET /events'))[0].value.id,'kept');
  assert.equal(kv.listCalls,2);
});

test('subscription HTTP endpoints preserve responses, validation and membership without repeated lists',async()=>{
  const env=withCatalog({SUBSCRIPTIONS:new MemoryKV(),APP_ORIGIN:'https://app.example'});
  const call=(method,endpoint)=>pushWorker.fetch(new Request('https://worker/push/subscribe',{method,headers:{Origin:env.APP_ORIGIN,'content-type':'application/json'},body:JSON.stringify({endpoint})}),env);
  assert.equal((await call('POST','https://untrusted.example/push')).status,400);
  assert.equal(env.SUBSCRIPTIONS.listCalls,0);
  assert.equal((await call('POST','https://fcm.googleapis.com/fcm/send/test')).status,201);
  assert.equal((await indexedRecords(env,'SUBSCRIPTIONS','collector:monitor')).length,1);
  assert.equal((await call('DELETE','https://fcm.googleapis.com/fcm/send/test')).status,200);
  assert.equal((await indexedRecords(env,'SUBSCRIPTIONS','collector:monitor')).length,0);
  assert.equal(env.SUBSCRIPTIONS.listCalls,1);
});
