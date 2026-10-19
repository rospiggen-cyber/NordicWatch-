import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendEvidence, readEvidence, evidencePayload, sha256, validEvidenceId} from '../cloudflare/evidence-ledger.mjs';
class KV {
  constructor() { this.map = new Map(); }
  async get(key, format) { const raw=this.map.get(key);return format==='json'&&raw ? JSON.parse(raw):raw; }
  async put(key, data) {this.map.set(key,data);}
}
const sample = () => ({
  schemaVersion:'0.1', sources:[{id:'eu-council',ok:true}],
  failures:[], degraded:false,
  signals:[{id:'s1',eventTime:'2026-10-18T10:00:00Z',source:{url:'https://example.org/a'}}],
  analysis:[{id:'hypothesis',priority:'INSUFFICIENT_EVIDENCE'}],
  sourceCoverage:{version:'1.0',generatedAt:'2026-10-18T12:00:00Z',technical:{configuredFeeds:1}},
  limitations:['Publication date is an occurrence proxy']
});
const NOW=Date.parse('2026-10-19T10:20:30.012Z');

test('ledger saves content with fingerprint and provenance, then reads with integrity check',async()=>{
  const kv=new KV(), first=await appendEvidence(kv,sample(),NOW);
  assert.equal(first.appended,true);
  assert.equal(validEvidenceId(first.id),true);
  const entry=await readEvidence(kv,first.id);
  assert.equal(entry.integrity,'MATCH');
  assert.equal(entry.payload.strategicEngine.version,'0.1.0');
  assert.equal(entry.payload.signals[0].source.url,'https://example.org/a');
  assert.equal(entry.previousId,null);
  assert.equal(entry.recordedAt,'2026-10-19T10:20:30.012Z');
});
test('identical observations and changed polling clock do not multiply archived revisions',async()=>{
  const kv=new KV();
  const first=await appendEvidence(kv,sample(),NOW);
  const later=sample();later.sourceCoverage.generatedAt='2026-10-19T11:20:00Z';
  const second=await appendEvidence(kv,later,NOW+60000);
  assert.equal(second.appended,false);
  assert.equal(second.id,first.id);
  assert.equal(kv.map.size,2);
});
test('material change creates a new linked historical record without replacing the first',async()=>{
  const kv=new KV(), first=await appendEvidence(kv,sample(),NOW);
  const changed=sample();changed.analysis[0].priority='WATCH';
  const second=await appendEvidence(kv,changed,NOW+900000);
  assert.notEqual(first.id,second.id);
  const prior=await readEvidence(kv,first.id),next=await readEvidence(kv,second.id);
  assert.equal(prior.payload.analysis[0].priority,'INSUFFICIENT_EVIDENCE');
  assert.equal(next.payload.analysis[0].priority,'WATCH');
  assert.equal(next.previousId,first.id);
  assert.equal(next.previousHash,first.sha256);
  // History links and timestamps are included in the signed fingerprint.
  const key='strategic:evidence:'+second.id;
  const edited=JSON.parse(kv.map.get(key));edited.previousId='nw-20261019T102030012Z-aaaaaaaaaaaaaaaa';
  kv.map.set(key,JSON.stringify(edited));
  assert.equal((await readEvidence(kv,second.id)).integrity,'MISMATCH');
});
test('tampering is detectable and invalid identifiers cannot reach KV',async()=>{
  const kv=new KV(), recorded=await appendEvidence(kv,sample(),NOW);
  const key='strategic:evidence:'+recorded.id;
  const entry=JSON.parse(kv.map.get(key));entry.payload.signals[0].id='altered';
  kv.map.set(key,JSON.stringify(entry));
  assert.equal((await readEvidence(kv,recorded.id)).integrity,'MISMATCH');
  assert.equal(await readEvidence(kv,'../strategic:snapshot'),null);
  assert.equal(validEvidenceId('bad'),false);
});
test('fingerprint is deterministic independent of object key order',async()=>{
  assert.equal(await sha256({b:[{z:3,a:2}],a:1}),await sha256({a:1,b:[{a:2,z:3}]}));
  assert.equal(evidencePayload(sample()).sourceCoverage.generatedAt,undefined);
});
test('storage errors fail closed rather than falsely claiming an archived revision',async()=>{
  const kv=new KV();kv.put=async(key,val)=>{if(key.startsWith('strategic:evidence:nw-'))throw Error('write failed');return KV.prototype.put.call(kv,key,val)};
  await assert.rejects(appendEvidence(kv,sample(),NOW),/write failed/);
  assert.equal(await kv.get('strategic:evidence:latest'),undefined);
});
