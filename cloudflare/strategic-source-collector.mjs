/* Server-side strategic RSS adapter, independently isolated from military Event Engine. */
import "../strategic-early-warning.js";
import "../source-coverage-engine.js";
const engine = globalThis.NordicWatchStrategic;
const MAX_FEED = 1000000;
const DAY = 86400000;

export const REGISTRY = Object.freeze([
  {id:'eu-council',publisher:'Council of the EU',host:'consilium.europa.eu',
   defaultUrl:'https://www.consilium.europa.eu/en/rss/pressreleases.ashx',
   actor:'EU',domain:'ALLIANCE'},
  {id:'nato',publisher:'NATO',host:'nato.int',
   defaultUrl:null,
   actor:'NATO',domain:'ALLIANCE'},
  {id:'white-house',publisher:'The White House',host:'whitehouse.gov',
   defaultUrl:'https://www.whitehouse.gov/news/feed/',
   supplementalFeeds:['https://www.whitehouse.gov/presidential-actions/feed/'],actor:'US',domain:'POLICY'},
  {id:'state',publisher:'U.S. Department of State',host:'state.gov',
   defaultUrl:null,actor:'US',domain:'POLICY'},
  {id:'congress',publisher:'U.S. Congress',host:'congress.gov',
   defaultUrl:null,actor:'US',domain:'DOMESTIC'}
]);

function approved(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    return REGISTRY.find(s=>u.hostname===s.host || u.hostname.endsWith('.'+s.host))||null;
  } catch { return null; }
}
export function sourceFeeds(extra = '') {
  const base = REGISTRY.flatMap(s=>[s.defaultUrl,...(s.supplementalFeeds||[])].filter(Boolean).map(url=>({source:s,url})));
  // Strict hostname allowlist. URL/config alone never counts as verified content.
  const supplied = String(extra).split(/[\s,]+/).filter(Boolean).slice(0,12)
    .map(url=>({url,source:approved(url)})).filter(x=>x.source);
  return [...new Map([...base,...supplied].map(x=>[x.url,x])).values()];
}
function decode(value) {
  return String(value||'')
    .replace(/<!\[CDATA\[|\]\]>/g,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' ','&#39;':"'",'&#x27;':"'"}[m.toLowerCase()]||' '))
    .replace(/\s+/g,' ').trim().slice(0,1400);
}
function tag(block, name) {
  const pattern = new RegExp('<(?:[\\w-]+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+name+'>','i');
  return decode(block.match(pattern)?.[1]);
}
function link(block) {
  const body = tag(block,'link');
  if (body) return body;
  const attr = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i);
  return attr?.[1]||'';
}
export function parseOfficialFeed(xml, feedUrl) {
  const owner = approved(feedUrl);
  if (!owner || typeof xml !== 'string' || xml.length > MAX_FEED) return [];
  const items = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)||[];
  return items.slice(0,50).flatMap(item=>{
    let itemUrl;
    try { itemUrl = new URL(link(item),feedUrl).href; } catch {return [];}
    // Article URL must stay on *same organization* as original feed.
    if (approved(itemUrl)?.id !== owner.id) return [];
    const title = tag(item,'title');
    const description = tag(item,'description')||tag(item,'summary')||tag(item,'content');
    const date = tag(item,'pubDate')||tag(item,'published')||tag(item,'date')||tag(item,'updated');
    if (!title || !Number.isFinite(Date.parse(date))) return [];
    return [{title,description,url:itemUrl,publishedAt:new Date(date).toISOString(),source:owner}];
  });
}
const TOPICS = Object.freeze({
  UKRAINE_SUPPORT: /\b(ukrain(?:e|ian)|kyiv|military aid to ukraine|support for ukraine)\b/i,
  RUSSIA_SANCTIONS: /\b(russian sanctions?|sanctions? (?:against|on) russia|sanctioning russia|russia.{0,35}sanctions?|sanctions?.{0,35}russia)\b/i,
  NATO_COMMITMENTS: /\b(nato|north atlantic alliance|article 5|collective defen[cs]e)\b/i,
  ENERGY_SECURITY: /\b(energy security|gas supplies|oil supplies|energy imports|energy sanctions)\b/i,
  BALTIC_SECURITY: /\b(baltic sea|gulf of finland|gotland|kaliningrad|suwa.lki|estonia|latvia|lithuania)\b/i,
  DEFENCE_POSTURE: /\b(readiness|military deployment|troop movements?|defen[cs]e posture|force posture)\b/i
});
const AOI = /\b(sweden|swedish|finland|finnish|norway|norwegian|denmark|danish|estonia|estonian|latvia|latvian|lithuania|lithuanian|baltic sea|gulf of finland|gotland|kaliningrad|suwa.lki|svalbard|north(?:ern)? europe)\b/i;
const ACTION = /\b(adopted|approved|signed|decided|announced|agreement|sanction|deployed|deployment|statement|remarks|press release)\b/i;
const DOMESTIC = /\b(congress|election|midterm|campaign|approval rating|inflation|gas prices|fuel prices|unemployment|consumer prices)\b/i;

export function articleToSignal(article, now = Date.now()) {
  const source = article?.source, at = Date.parse(article?.publishedAt);
  if (!source || !approved(article.url) || approved(article.url)?.id !== source.id ||
      !Number.isFinite(at) || at > now+300000 || at < now-30*DAY) return null;
  const body = String(article.title||'')+' '+String(article.description||'');
  const topics = Object.entries(TOPICS).filter(([,re])=>re.test(body)).map(([name])=>name);
  if (!topics.length) return null;
  // Press releases establish WHAT an institution publicly said, not that any claim
  // about third parties in its article has been independently verified.
  const domain = source.actor==='US' ? (DOMESTIC.test(article.title)&&source.id==='congress'?'DOMESTIC':'POLICY') : 'ALLIANCE';
  // Never claim a Nordic connection purely because the issuing body is NATO / EU.
  const region = AOI.test(body)?'NORDIC_BALTIC':'';
  const officialDecision = domain==='POLICY' && ACTION.test(article.title||'');
  const evidence = officialDecision?'OFFICIAL_RECORD':'REPORTED';
  return engine.normalizeSignal({
    id: source.id+'|'+article.url, eventKey: article.url, title: article.title,
    description: article.description, domain, actor:source.actor,
    topics, region, eventTime:article.publishedAt, publishedAt:article.publishedAt,
    evidence, source:{publisher:source.publisher,independenceGroup:source.id,
      type:officialDecision?'OFFICIAL':'OFFICIAL_PUBLICATION',url:article.url}
  },now);
}
async function fetchOne(feed) {
  const response = await fetch(feed.url, {
    headers:{accept:'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9',
      'user-agent':'NordicWatch-Strategic/0.1'},
    redirect:'follow',cf:{cacheTtl:300,cacheEverything:true},
    signal:AbortSignal.timeout(8000)
  });
  if (!response.ok || approved(response.url)?.id!==feed.source.id) throw Error('untrusted_redirect_or_http_error');
  if (Number(response.headers.get('content-length')||0)>MAX_FEED) throw Error('feed_too_large');
  const body = await response.text();
  if (body.length>MAX_FEED) throw Error('feed_too_large');
  return parseOfficialFeed(body,response.url);
}
export async function runStrategicCollection(env,now=Date.now()) {
  if (!env.EVENTS) throw Error('EVENTS KV missing');
  const feeds=sourceFeeds(env.STRATEGIC_SOURCE_URLS), failures=[],coverage=[],incoming=[];
  for (const feed of feeds) {
    try {
      const rows=await fetchOne(feed);
      incoming.push(...rows.map(x=>articleToSignal(x,now)).filter(Boolean));
      coverage.push({id:feed.source.id,ok:true,items:rows.length,accepted:rows.filter(x=>articleToSignal(x,now)).length});
    } catch (error) {
      failures.push({id:feed.source.id,reason:String(error.message||error).slice(0,100)});
      coverage.push({id:feed.source.id,ok:false,items:0,accepted:0});
    }
  }
  const previous=await env.EVENTS.get('strategic:signals','json')||[];
  const retain = previous.filter(s=>{
    const t=Date.parse(s.eventTime);
    return Number.isFinite(t)&&t<=now&&now-t<=30*DAY;
  });
  const snapshot=engine.analyze([...retain,...incoming],{now:new Date(now).toISOString()});
  const sourceCoverage=globalThis.NordicWatchSourceCoverage.build({registry:REGISTRY,feeds,health:coverage,signals:snapshot.signals,analysis:snapshot.cards,now});
  const result={
    schemaVersion:'0.1',generatedAt:new Date(now).toISOString(),sources:coverage,
    sourcesHealthy:coverage.filter(s=>s.ok).length,sourcesTotal:coverage.length,
    degraded:coverage.length===0||coverage.some(s=>!s.ok),
    failures,signals:snapshot.signals.slice(-200),analysis:snapshot.cards,sourceCoverage,
    limitations:['Source titles and descriptions do not establish real-world event occurrence dates.',
      'Partial official-source coverage; no independent news or polling collector connected.',
      'Official publications are not independent verification of their factual claims.']
  };
  // Only accepted bounded signals, not source failure, renew retained observations.
  await env.EVENTS.put('strategic:signals',JSON.stringify(snapshot.signals.slice(-200)));
  await env.EVENTS.put('strategic:snapshot',JSON.stringify(result));
  return {generatedAt:result.generatedAt,sourceCoverage:sourceCoverage.technical,sourcesHealthy:result.sourcesHealthy,
    sourcesTotal:result.sourcesTotal,signals:result.signals.length,degraded:result.degraded,failures};
}
