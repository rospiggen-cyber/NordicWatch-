// Live source verification. No writes, no persistent cache, no secrets.
import {FM_NEWS_INDEX,linksFromOfficialNewsIndex,parseOfficialNewsArticle} from "../cloudflare/fm-website-collector.mjs";
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
 try{const article=parseOfficialNewsArticle(await fetchHtml(url),url);results.push({url,article:article&&{title:article.title,date:article.publishedAt,summaryLength:article.summary.length}});}
 catch(error){results.push({url,error:String(error)})}
}
console.log(JSON.stringify(results,null,2));
if(!results.some(x=>x.article))throw Error("No dated article extracted from original site; do not deploy");
