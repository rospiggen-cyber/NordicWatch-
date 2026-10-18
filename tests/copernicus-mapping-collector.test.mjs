import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectCopernicus,getCopernicusSnapshot,sourceEndpoints} from '../cloudflare/copernicus-mapping-collector.mjs';
import worker from '../cloudflare/event-feed-worker.js';
const NOW=Date.parse('2026-10-18T18:00:00Z');
const item=(options={})=>({
 code:'EMSR934',name:'Mapped flood impact in Roslagen',category:'Flood',
 centroid:'POINT (18.8 59.9)',countries:['Sweden'],
 activationTime:'2026-10-18T08:00:00',eventTime:'2026-10-17T14:00:00',
 lastUpdate:'2026-10-18T12:00:00',n_aois:1,n_products:3,...options
});
class KV {
 constructor(){this.db=new Map()}
 async get(k,kind){const a=this.db.get(k);return kind==='json'&&a?JSON.parse(a):a}
 async put(k,v){this.db.set(k,v)}
}
function mock(result,originalUrl){return {ok:true,status:200,url:originalUrl,headers:new Headers(),
 text:async()=>JSON.stringify(result)}}
test('real Copernicus URLs are the only endpoints',()=>{
 const e=sourceEndpoints();assert.equal(e.length,2);
 assert(e.every(x=>new URL(x).protocol==='https:'));
});
test('collector stores official filtered catalogue, region metadata and avoids empty-data risk claims',async()=>{
 const kv=new KV(),before=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return mock({count:2,next:null,
 results:[item(),item({code:'EMSR935',centroid:'POINT (17.0 61.3)',countries:[{short_name:'Sweden'}]})]},String(url))};
 try{
  const r=await collectCopernicus({EVENTS:kv},NOW);
  const got=await getCopernicusSnapshot({EVENTS:kv});
  assert.equal(r.status,'AVAILABLE');
  assert.equal(got.counts.local,2);
  assert.equal(got.sourceHealth.coverageIncomplete,false);
  assert.equal(got.activations[0].source.name.includes('Copernicus'),true);
  assert.equal(got.activations[0].evidence,'CONFIRMED_PUBLIC_MAPPING_ACTIVATION');
  assert.equal(calls.length,1);
  assert.equal((await collectCopernicus({EVENTS:kv},NOW+60000)).cached,true);
  assert.equal(calls.length,1,'six-hour cache prevents redundant upstream requests');
 }finally{globalThis.fetch=before}
});
test('fallback to second official Copernicus endpoint on first endpoint failure',async()=>{
 const kv=new KV(),original=globalThis.fetch;
 globalThis.fetch=async url=>{
  if(String(url).includes('rapidmapping.emergency'))throw Error('upstream temporarily unavailable');
  return mock({count:1,results:[item()],next:null},String(url));
 };
 try{
  const a=await collectCopernicus({EVENTS:kv},NOW,{force:true});
  const c=await getCopernicusSnapshot({EVENTS:kv});
  assert.equal(a.status,'AVAILABLE');assert.match(c.provider,/mapping.emergency/);
 }finally{globalThis.fetch=original}
});
test('all API failures keep old evidence but explicitly degrade the source status',async()=>{
 const kv=new KV(),original=globalThis.fetch;
 globalThis.fetch=async url=>mock({count:1,next:null,results:[item()]},String(url));
 try{await collectCopernicus({EVENTS:kv},NOW)}finally{globalThis.fetch=original}
 globalThis.fetch=async()=>{throw Error('disconnected')};
 try{
  const result=await collectCopernicus({EVENTS:kv},NOW+8*3600000,{force:true});
  const snapshot=await getCopernicusSnapshot({EVENTS:kv});
  assert.equal(result.status,'UNAVAILABLE');assert.equal(snapshot.degraded,true);
  assert.equal(snapshot.sourceHealth.status,'UNAVAILABLE');
  assert.equal(snapshot.counts.local,1,'historical evidence preserved with failure status');
 }finally{globalThis.fetch=original}
});
test('untrusted redirect never counts as a successful catalogue result',async()=>{
 const kv=new KV(),old=globalThis.fetch;
 globalThis.fetch=async url=>mock({count:1,results:[item()]},'https://attacker.example/activations/');
 try{
  const r=await collectCopernicus({EVENTS:kv},NOW,{force:true});
  assert.equal(r.status,'UNAVAILABLE');
  assert.equal((await getCopernicusSnapshot({EVENTS:kv})).counts.local,0);
 }finally{globalThis.fetch=old}
});
test('isolated EO endpoint is disabled by default and accepts only allowed app origin',async()=>{
 const kv=new KV();await kv.put('eo:latest',JSON.stringify({
  schemaVersion:'0.1',counts:{local:1},activations:[{code:'EMSR934'}],
  sourceHealth:{status:'AVAILABLE'}}));
 const target='https://example.workers.dev/earth-observation';
 const origin='https://rospiggen-cyber.github.io';
 let res=await worker.fetch(new Request(target,{headers:{Origin:origin}}),
  {EVENTS:kv,APP_ORIGIN:origin});
 assert.equal((await res.json()).enabled,false);
 res=await worker.fetch(new Request(target,{headers:{Origin:'https://evil.test'}}),
  {EVENTS:kv,APP_ORIGIN:origin,EARTH_OBSERVATION_ENABLED:'true'});
 assert.equal(res.status,403);
 res=await worker.fetch(new Request(target,{headers:{Origin:origin}}),
  {EVENTS:kv,APP_ORIGIN:origin,EARTH_OBSERVATION_ENABLED:'true'});
 const data=await res.json();assert.equal(data.enabled,true);assert.equal(data.counts.local,1);
});


test('first enabled GET bootstraps a missing catalogue snapshot without affecting military alerts',async()=>{
 const kv=new KV(),original=globalThis.fetch,origin='https://rospiggen-cyber.github.io';
 let upstreamCalls=0;
 globalThis.fetch=async url=>{
  upstreamCalls++;
  return mock({count:1,results:[item()],next:null},String(url));
 };
 try{
  const req=new Request('https://worker.example/earth-observation',{headers:{Origin:origin}});
  const response=await worker.fetch(req,{EVENTS:kv,APP_ORIGIN:origin,EARTH_OBSERVATION_ENABLED:'true'});
  const payload=await response.json();
  assert.equal(payload.enabled,true);assert.equal(payload.sourceHealth.status,'AVAILABLE');
  assert.equal(payload.counts.local,1);assert.equal(upstreamCalls,1);
  const again=await worker.fetch(req,{EVENTS:kv,APP_ORIGIN:origin,EARTH_OBSERVATION_ENABLED:'true'});
  assert.equal((await again.json()).counts.local,1);
  assert.equal(upstreamCalls,1,'subsequent GET is cached');
 }finally{globalThis.fetch=original}
});
