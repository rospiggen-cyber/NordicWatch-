const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../news-source-health.js');

test('GDELT requests are sequential with a 6-second completion gap',async()=>{
 const steps=[];
 const out=await S.sequence([
  async()=>{steps.push('first-start');await Promise.resolve();steps.push('first-done');return {articles:[{title:'Nordic'}]}},
  async()=>{steps.push('second-start');return {articles:[{title:'Black Sea'}]}}
 ],{sleep:async ms=>{steps.push('sleep-'+ms)}});
 assert.deepEqual(steps,['first-start','first-done','sleep-6000','second-start']);
 assert.deepEqual(out.map(r=>r.status),['fulfilled','fulfilled']);
});

test('failed first request does not suppress second GDELT source',async()=>{
 const steps=[];
 const out=await S.sequence([
  async()=>{steps.push('first');throw Error('HTTP 429')},
  async()=>{steps.push('second');return {articles:[]}}
 ],{sleep:async ms=>steps.push('gap-'+ms)});
 assert.deepEqual(steps,['first','gap-6000','second']);
 assert.deepEqual(out.map(r=>r.status),['rejected','fulfilled']);
 const rows=S.summarize([...out,{status:'fulfilled',value:{articles:[1,2,3],available:8,total:11,coverage:{status:'DEGRADED'},telemetry:{failures:[{source:'nato',error:'HTTP 404'}]}}}]);
 assert.equal(rows[0].name,'GDELT · Nordic/Baltic');
 assert.match(rows[0].reason,/429/);
 assert.equal(rows[1].ok,true);
 assert.equal(rows[2].fetched,3);
 assert.equal(rows[2].available,8);
 assert.equal(rows[2].total,11);
 assert.equal(rows[2].sourceFailures[0].source,'nato');
});

test('malformed successful source responses are not misreported as healthy',()=>{
 const rows=S.summarize([{status:'fulfilled',value:{bad:true}},{status:'rejected',reason:'timeout'},null]);
 assert(rows.every(r=>r.ok===false));
 assert.equal(rows[0].available,0);
 assert.match(rows[1].reason,/timeout/);
});
