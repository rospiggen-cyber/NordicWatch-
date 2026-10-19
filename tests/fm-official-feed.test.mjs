import assert from 'node:assert/strict';
import {test} from 'node:test';
import {officialSource,configuredSources,parseFeed,discoverTimed} from '../cloudflare/event-discovery-core.mjs';
import R from '../news-routing.js';

const rss='https://www.mynewsdesk.com/se/rss/current_news/441';
const article='https://www.mynewsdesk.com/se/forsvarsmakten/pressreleases/sverige-oevar-med-usa-och-finland-i-bottenhavet-3471549';
const news='https://www.mynewsdesk.com/se/forsvarsmakten/news/foersvarsmakten-foerbereder';
const xml='<rss><channel><item><title>Sverige övar med USA och Finland i Bottenhavet</title><description><![CDATA[Visbykorvetten HMS Karlstad har övat med den finska minläggaren FNS Hämeenmaa och amerikanska jagaren USS Paul Ignatius i Bottenhavet.]]></description><link>'+article+'</link><pubDate>Thu, 08 Oct 2026 15:09:14 +0200</pubDate></item></channel></rss>';

test('publisher-specific Mynewsdesk RSS is allowlisted without trusting other tenants',()=>{
 assert.equal(officialSource(rss)?.id,'se');
 assert.equal(officialSource(article)?.id,'se');
 assert.equal(officialSource(news)?.id,'se');
 for(const url of ['https://www.mynewsdesk.com/se/other-organisation/pressreleases/attack-123',
  'https://www.mynewsdesk.com/se/rss/current_news/442',
  'https://www.mynewsdesk.com/se/forsvarsmakten',
  'http://www.mynewsdesk.com/se/rss/current_news/441',
  'https://mynewsdesk.com.evil.example/se/rss/current_news/441',
  'https://www.mynewsdesk.com/se/forsvarsmakten/pressreleases/x/y']){
  assert.equal(officialSource(url),null,url);
 }
 assert(configuredSources().some(x=>x.url===rss&&x.source.id==='se'));
});

test('real October 8 original source parses as Swedish naval exercise with original timestamp',()=>{
 const parsed=parseFeed(xml,rss);
 assert.equal(parsed.length,1);
 assert.equal(parsed[0].sourceId,'se');
 assert.equal(parsed[0].url,article);
 assert.equal(new Date(parsed[0].publishedAt).toISOString(),'2026-10-08T13:09:14.000Z');
 const at=Date.parse('2026-10-08T15:00:00Z');
 const event=discoverTimed(parsed[0],at);
 assert(event,'Swedish naval report must become discoverable official event');
 assert.equal(event.confidence,'CONFIRMED');
 assert.equal(event.eventType,'naval_exercise');
 assert.equal(event.areaName,'Bothnian Sea');
 const routed=R.route(parsed,{now:at});
 assert.equal(routed.articles.length,1);
 assert.equal(routed.events[0].evidenceType,'CONFIRMED_EXTERNAL');
 const late=R.route(parsed,{now:Date.parse('2026-10-19T18:00:00Z')});
 assert.equal(late.articles.length,0,'old article must not masquerade as a fresh Oct 19 incident');
});

test('other Mynewsdesk tenants cannot become official articles via feed parser',()=>{
 const bad=xml.replace(article,'https://www.mynewsdesk.com/se/other-organisation/pressreleases/fake-123');
 assert.equal(parseFeed(bad,rss).length,0);
 assert.equal(parseFeed(xml,'https://www.mynewsdesk.com/se/rss/current_news/442').length,0);
 const direct=R.route([{title:'Sverige övar med USA och Finland i Bottenhavet',description:'Försvarsövning med fartyg',url:'https://www.mynewsdesk.com/se/other-organisation/pressreleases/fake-123',publishedAt:'2026-10-08T13:09:14Z'}],{now:Date.parse('2026-10-08T15:00:00Z')});
 assert.equal(direct.articles[0]?.evidenceType,'INFERRED');
});
