// Live source verification. No writes, no persistent cache, no secrets.
import {FM_NEWS_INDEX,linksFromOfficialNewsIndex,parseOfficialNewsArticle} from "../cloudflare/fm-website-collector.mjs";
import R from "../news-routing.js";
import {discoverTimed} from "../cloudflare/event-discovery-core.mjs";
const fetchHtml=async url=>{
 const r=await fetch(url,{headers:{"accept":"text/html","user-agent":"NordicWatch-OriginalSourceVerification/1.0"},signal:AbortSignal.timeout(18000)});
 const final=new URL(r.url);
 if(final.hostname!=="www.forsvarsmakten.se"||!r.ok)throw Error("Official website not readable: HTTP "+r.status+" "+r.url);
 const html=await r.text();
 if(html.length>2_000_000)throw Error("Oversized HTML response");
 return html;
};
const index=await fetchHtml(FM_NEWS_INDEX);
const links=linksFromOfficialNewsIndex(index);
console.log("Official index links:",links.length,links.slice(0,5));
if(links.length===0)throw Error("Official index has no parseable links; production coverage would fail");
const results=[];
for(const url of links.slice(0,7)){
 try{
  const h=await fetchHtml(url),article=parseOfficialNewsArticle(h,url);
  const visible=h.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ");
  const metas=[...h.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).filter(m=>/title|description|date|publish|time/i.test(m));
  results.push({url,article:article&&{title:article.title,date:article.publishedAt,summaryLength:article.summary.length,relevance:R.diagnose(article).result,relevanceReason:R.diagnose(article).rejectionReason,eventType:discoverTimed(article,Date.parse("2026-10-24T06:15:00Z"))?.eventType},inspect:article?undefined:{
   title:h.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0],
   metas:metas.slice(0,12),
   visibleMarkers:[...visible.matchAll(/(?:publicer|2026|oktober|<time|sjöövervakning)/gi)].slice(0,14).map(m=>visible.slice(Math.max(0,m.index-90),m.index+200)),
   end:visible.slice(-800)
  }});
 }catch(error){results.push({url,error:String(error)})}
}
console.log(JSON.stringify(results,null,2));
if(!results.some(x=>x.article))throw Error("No dated article extracted from original site; do not deploy");
if(!results.some(x=>x.article?.relevance==="PASS"&&x.article.eventType==="official_defence_announcement"))throw Error("Official USV article not safely routed as a defence announcement");
