import assert from 'node:assert/strict';
import {test} from 'node:test';
import {REGISTRY,sourceFeeds,parseOfficialFeed,articleToSignal,runStrategicCollection} from '../cloudflare/strategic-source-collector.mjs';
import worker from '../cloudflare/event-feed-worker.js';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const euFeed = 'https://www.consilium.europa.eu/en/rss/pressreleases.ashx';
const euArticle = 'https://www.consilium.europa.eu/en/press/press-releases/2026/10/17/ukraine-support/';
const usFeed = 'https://www.whitehouse.gov/feed/';
const usArticle = 'https://www.whitehouse.gov/presidential-actions/2026/10/ukraine-support/';
const rss = (link,title,date='Sat, 17 Oct 2026 09:00:00 GMT') =>
  '<rss><channel><item><title>'+title+'</title><description>Ukraine and NATO support in the Baltic Sea.</description><link>'+link+'</link><pubDate>'+date+'</pubDate></item></channel></rss>';
class KV {
  constructor(){this.map=new Map()}
  async get(k,kind){let x=this.map.get(k);return kind==='json' && x ? JSON.parse(x):x}
  async put(k,v){this.map.set(k,v)}
}
test('approved list includes EU/NATO by default, US feeds opt in, rejects arbitrary and insecure hosts',()=>{
  const d=sourceFeeds();
  assert(d.some(x=>x.source.id==='eu-council'));
  assert.equal(d.some(x=>x.source.id==='nato'),false,'deprecated NATO RSS is disabled');
  assert.equal(d.filter(x=>x.source.id==='white-house').length,2);
  const custom=sourceFeeds(usFeed+' http://www.whitehouse.gov/feed/ https://whitehouse.gov.evil.net/feed/ https://random.org/rss');
  assert.equal(custom.filter(x=>x.source.id==='white-house').length,3);
  assert.equal(REGISTRY.length,5);
});
test('RSS parser restricts origin and item links to same official organisation',()=>{
  const rows=parseOfficialFeed(rss(euArticle,'Council adopts Ukraine support'),euFeed);
  assert.equal(rows.length,1);
  assert.equal(rows[0].url,euArticle);
  assert.equal(parseOfficialFeed(rss('https://evil.example/article','Fake council decision'),euFeed).length,0);
  assert.equal(parseOfficialFeed(rss(usArticle,'Another agency headline'),euFeed).length,0);
  assert.equal(parseOfficialFeed(rss(euArticle,'Title'),'http://www.consilium.europa.eu/rss').length,0);
  assert.equal(parseOfficialFeed('x'.repeat(1000001),euFeed).length,0);
  assert.equal(parseOfficialFeed(rss(euArticle,'No valid date','Invalid date'),euFeed).length,0);
});
test('official European press statement is alliance context, not a US policy decision',()=>{
  const article=parseOfficialFeed(rss(euArticle,'Council adopts Ukraine support'),euFeed)[0];
  const s=articleToSignal(article,NOW);
  assert.equal(s.domain,'ALLIANCE');
  assert.equal(s.actor,'EU');
  assert.equal(s.region,'NORDIC_BALTIC');
  assert.equal(s.evidence,'REPORTED');
  assert.equal(s.source.url,euArticle.replace(/\/$/,''));
});
test('authorized White House decision statement maps to policy with original source',()=>{
  const white=REGISTRY.find(s=>s.id==='white-house');
  const article={title:'President signs new Ukraine support agreement', description:'NATO security',source:white,url:usArticle,
    publishedAt:'2026-10-17T18:00:00Z'};
  const s=articleToSignal(article,NOW);
  assert.equal(s.domain,'POLICY');
  assert.equal(s.evidence,'OFFICIAL_RECORD');
  assert.equal(s.actor,'US');
  assert.equal(s.source.type,'OFFICIAL');
  assert.equal(articleToSignal({...article,url:'https://unknown.org/other'},NOW),null);
  assert.equal(articleToSignal({...article,publishedAt:'2025-10-17T18:00:00Z'},NOW),null);
});
test('collector fetches live-shaped EU/NATO responses, saves snapshot and degrades per source',async()=>{
  const kv=new KV(),old=globalThis.fetch,calls=[];
  globalThis.fetch=async url=>{
    url=String(url);calls.push(url);
    if(url.includes('/presidential-actions/'))throw new Error('temporarily unavailable');
    return {ok:true,status:200,url:url.includes('whitehouse.gov')?'https://www.whitehouse.gov/news/feed/':euFeed,
      headers:new Headers({'content-type':'application/rss+xml'}),
      text:async()=>rss(euArticle,'Council adopts Ukraine support')};
  };
  try {
    const summary=await runStrategicCollection({EVENTS:kv},NOW);
    const snap=await kv.get('strategic:snapshot','json');
    assert.equal(summary.sourcesHealthy,2);
    assert.equal(summary.degraded,true);
    assert.equal(snap.sourcesTotal,3);
    assert.equal(snap.signals.length,1);
    assert.equal(snap.analysis.every(x=>x.causalConclusion==='NOT_ESTABLISHED'),true);
    assert.equal(snap.analysis[0].priority,'INSUFFICIENT_EVIDENCE');
    assert.equal(snap.failures[0].id,'white-house');
    assert.equal(calls.length,3);
  } finally {globalThis.fetch=old}
});
test('GET /strategic refuses pre-enable exposure and serves stored source telemetry when enabled',async()=>{
  const kv=new KV();
  await kv.put('strategic:snapshot',JSON.stringify({signals:[{id:'sample'}],analysis:[],degraded:false,
    generatedAt:'2026-10-18T12:00:00Z'}));
  const fetchRequest = () => new Request('https://worker.example/strategic',
    {headers:{Origin:'https://rospiggen-cyber.github.io'}});
  const disabled=await worker.fetch(fetchRequest(),{EVENTS:kv,APP_ORIGIN:'https://rospiggen-cyber.github.io'});
  const disabledBody=await disabled.json();
  assert.equal(disabledBody.enabled,false);
  assert.equal(disabledBody.signals,undefined);
  const live=await worker.fetch(fetchRequest(),{EVENTS:kv,APP_ORIGIN:'https://rospiggen-cyber.github.io',STRATEGIC_ENABLED:'true'});
  const liveBody=await live.json();
  assert.equal(liveBody.enabled,true);
  assert.equal(liveBody.signals[0].id,'sample');
  const blocked=await worker.fetch(new Request('https://worker.example/strategic',
    {headers:{Origin:'https://attacker.example'}}),{EVENTS:kv,APP_ORIGIN:'https://rospiggen-cyber.github.io',STRATEGIC_ENABLED:'true'});
  assert.equal(blocked.status,403);
});
