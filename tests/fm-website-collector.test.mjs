import assert from "node:assert/strict";
import {test} from "node:test";
import {FM_NEWS_INDEX,linksFromOfficialNewsIndex,parseOfficialNewsArticle} from "../cloudflare/fm-website-collector.mjs";
import {configuredSources,discoverTimed} from "../cloudflare/event-discovery-core.mjs";
import R from "../news-routing.js";
import {runDiscovery} from "../cloudflare/event-feed-worker.js";
import {withCatalog} from "./helpers/kv-catalog.mjs";
const articleUrl="https://www.forsvarsmakten.se/aktuellt/nyheter/marinen-testar-obemannade-havsdronare-for-sjoovervakning/";
const title="Marinen testar obemannade havsdrönare för sjöövervakning";
const html='<html><head><meta name="description" content="Försvarsmakten och FMV har avtal om fyra obemannade sjödrönare från Saildrone."></head><body><main><h1>'+title+'</h1><div>Publiceringsdatum: 23 oktober 2026 kl. 09:57</div><p>Marinen använder farkosterna för sjöövervakning i Östersjön.</p><p>Satsningen stödjer Natos Task Force X Baltic och NORDEFCO.</p></main></body></html>';
const index='<a href="/aktuellt/nyheter/marinen-testar-obemannade-havsdronare-for-sjoovervakning/">Nyhet</a><a href="https://evil.example/aktuellt/nyheter/fake/">Fake</a><a href="/aktuellt/nyheter/marinen-testar-obemannade-havsdronare-for-sjoovervakning/?track=foo">Duplicate</a>';
test("official website collector is configured alongside the existing Mynewsdesk source",()=>{
 const configured=configuredSources();
 assert(configured.some(s=>s.url===FM_NEWS_INDEX&&s.format==="official-html"));
 assert(configured.some(s=>s.url==="https://www.mynewsdesk.com/se/rss/current_news/441"));
});
test("official source links are bounded, verified and deduplicated",()=>{
 assert.deepEqual(linksFromOfficialNewsIndex(index),[articleUrl]);
 assert.deepEqual(linksFromOfficialNewsIndex('<a href="https://evil.example/aktuellt/nyheter/fake/">Fake</a>'),[]);
});
test("Saildrone article preserves original date and is relevant, not a hostile drone incident",()=>{
 const item=parseOfficialNewsArticle(html,articleUrl);
 assert(item);
 assert.equal(item.publishedAt,"2026-10-23T07:57:00.000Z");
 assert.equal(item.sourceChannel,"official-website");
 const now=Date.parse("2026-10-24T06:15:00Z");
 const relevant=R.route([item],{now});
 assert.equal(relevant.articles.length,1,JSON.stringify(relevant.diagnostics));
 assert(relevant.articles[0].briefEligible);
 const event=discoverTimed(item,now);
 assert(event,"Swedish marine report must be a discoverable official event");
 assert.equal(event.areaName,"Baltic Sea");
 assert.equal(event.eventType,"official_defence_announcement");
 assert.notEqual(event.eventType,"drone_incident");
});
test("missing publication evidence is dropped; no fetch time substituted",()=>{
 const bad=html.replace("Publiceringsdatum: 23 oktober 2026 kl. 09:57","");
 assert.equal(parseOfficialNewsArticle(bad,articleUrl),null);
});
class KV{
 constructor(){this.data=new Map()}
 async list({prefix=""}={}){return {keys:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true}}
 async get(k,type){const v=this.data.get(k);return type==="json"&&v?JSON.parse(v):v}
 async put(k,v){this.data.set(k,v)}
}
test("scheduled Worker routes a fresh official-website article even if Mynewsdesk is not updated",async()=>{
 const initial=globalThis.fetch,kv=new KV();
 const requested=[];
 globalThis.fetch=async input=>{
  const url=String(input);requested.push(url);
  if(url===FM_NEWS_INDEX||url===articleUrl)return {ok:true,status:200,url,headers:new Headers({"content-type":"text/html"}),text:async()=>url===FM_NEWS_INDEX?index:html};
  return {ok:false,status:404,url,headers:new Headers(),text:async()=>""};
 };
 try{
  const now=Date.parse("2026-10-24T06:15:00Z");
  const run=await runDiscovery(withCatalog({EVENTS:kv,APP_ORIGIN:"https://example.github.io",SOURCE_URLS:"",EVENT_ALERT_THRESHOLD:"100"}),now);
  assert(requested.includes(FM_NEWS_INDEX));
  assert(requested.includes(articleUrl));
  assert(run.sourceHealth.some(s=>s.id==="se-website"&&s.ok),"original website must be healthy");
  const signal=await kv.get("signals:archive","json");
  assert(signal.some(x=>x.url.includes("/marinen-testar-obemannade-havsdronare-for-sjoovervakning")&&x.title===title),"should ingest Saildrone");
  const routed=await kv.get("routing:events","json");
  assert(routed.some(x=>x.title===title&&x.briefEligible),"should be displayed in /news");
 }finally{globalThis.fetch=initial}
});
