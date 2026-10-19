import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withCatalog} from './helpers/kv-catalog.mjs';
import {runDiscovery} from '../cloudflare/event-feed-worker.js';

const source='https://www.mynewsdesk.com/se/rss/current_news/441';
const original='https://www.mynewsdesk.com/se/forsvarsmakten/pressreleases/sverige-oevar-med-usa-och-finland-i-bottenhavet-3471549';
const oldItem='<item><title>Sverige övar med USA och Finland i Bottenhavet</title><description>USS Paul Ignatius och HMS Karlstad övar i Bottenhavet</description><link>'+original+'</link><pubDate>Thu, 08 Oct 2026 15:09:14 +0200</pubDate></item>';
class KV {
 constructor(){this.data=new Map()}
 async list({prefix=''}){return {keys:[...this.data.keys()].filter(x=>x.startsWith(prefix)).map(name=>({name})),list_complete:true}}
 async get(k,type){let v=this.data.get(k);return type==='json'&&v?JSON.parse(v):v}
 async put(k,v){this.data.set(k,v)}
}
async function runWith(items){
 const kv=new KV(),initial=globalThis.fetch,calls=[];
 globalThis.fetch=async(url)=>{
  url=String(url);calls.push(url);
  if(url===source)return {ok:true,status:200,url,headers:new Headers({'content-type':'application/rss+xml'}),text:async()=>'<rss><channel>'+items+'</channel></rss>'};
  return {ok:false,status:404,url,headers:new Headers(),text:async()=>''};
 };
 try{
  const result=await runDiscovery(withCatalog({EVENTS:kv,APP_ORIGIN:'https://example.github.io',SOURCE_URLS:'',EVENT_ALERT_THRESHOLD:'100'}),Date.parse('2026-10-19T18:30:00Z'));
  return {result,kv,calls};
 }finally{globalThis.fetch=initial}
}
test('scheduled worker obtains the actual official RSS path, even if other sources are down',async()=>{
 const fresh='<item><title>Sverige övar med USA och Finland i Bottenhavet</title><description>Test fixture: svensk jagare övar i Bottenhavet.</description><link>https://www.mynewsdesk.com/se/forsvarsmakten/pressreleases/syntetisk-ovning-123</link><pubDate>Mon, 19 Oct 2026 17:07:01 +0200</pubDate></item>';
 const {result,kv,calls}=await runWith(fresh);
 assert(calls.includes(source));
 assert(result.sourceHealth.some(x=>x.id==='se'&&x.ok===true),'first-party source should be counted as healthy');
 assert(result.sourceHealth.some(x=>!x.ok),'other outages should remain visible');
 const archive=await kv.get('signals:archive','json');
 assert(archive.some(x=>x.url.includes('/se/forsvarsmakten/pressreleases/syntetisk-ovning-123')));
 const routing=await kv.get('routing:events','json');
 assert(routing.some(x=>x.title.includes('Sverige övar med USA')&&x.briefEligible));
});
test('October 8 official publication is not freshly reintroduced on October 19',async()=>{
 const {kv}=await runWith(oldItem);
 const routing=await kv.get('routing:events','json');
 assert(!routing.some(x=>x.title.includes('Sverige övar med USA')&&x.briefEligible));
});
