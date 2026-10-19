// Discovery/verification only. No production collection or persistent writes.
const source='https://www.mynewsdesk.com/se/forsvarsmakten';
const guard=u=>{const p=new URL(u);if(p.protocol!=='https:'||!['www.mynewsdesk.com','mynewsdesk.com'].includes(p.hostname))throw Error('untrusted-source-url');return p};
const download=async u=>{
  guard(u);
  const res=await fetch(u,{headers:{'accept':'text/html, application/rss+xml, application/atom+xml','user-agent':'NordicWatch source verification/1.0'},redirect:'follow',signal:AbortSignal.timeout(15000)});
  guard(res.url);
  if(!res.ok)throw Error('HTTP '+res.status);
  const body=await res.text();
  if(body.length>2e6)throw Error('Response oversized');
  return {url:res.url,body,contentType:res.headers.get('content-type')||''};
};
const page=await download(source);
const links=[...page.body.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]).filter(x=>/rss|atom|alternate/i.test(x));
const scanned=[...page.body.matchAll(/(?:https?:)?\/\/(?:www\.)?mynewsdesk\.com\/se\/rss\/(?:current_news|pressreleases|news)\/\d+/gi)].map(x=>x[0].replace(/^\/\//,'https://'));
const advertised=links.flatMap(x=>[...x.matchAll(/href=["']([^"']+)["']/gi)].map(k=>k[1])).filter(u=>/rss|atom/i.test(u));
const candidates=[...new Set([...scanned,...advertised])].filter(u=>{try{return !!guard(new URL(u,source).href)}catch{return false}});

console.log('Newsroom:',page.url,'length:',page.body.length,'content-type:',page.contentType);
console.log('RSS link tags:',links.slice(0,20));
console.log('Candidate feeds:',candidates.slice(0,12));
if(!candidates.length)throw Error('No feed URL advertised by newsroom; cannot verify direct source');
let verified=0;
for(const c of candidates.slice(0,8)){
  try{
    const url=new URL(c,source).href;
    const response=await download(url);
    const count=(response.body.match(/<item\b/gi)||[]).length;
    const articleLinks=[...response.body.matchAll(/<(?:link|guid)[^>]*>([^<]+)<\/(?:link|guid)>/gi)].map(x=>x[1]).filter(x=>/mynewsdesk\.com\/se\/forsvarsmakten\/(?:pressreleases|news)\//i.test(x));
    const titles=[...response.body.matchAll(/<item\b[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/gi)].map(m=>m[1].replace(/<[^>]+>/g,'').slice(0,140)).slice(0,5);
    const dates=[...response.body.matchAll(/<pubDate[^>]*>([^<]+)<\/pubDate>/gi)].map(x=>x[1]).slice(0,5);
    console.log(JSON.stringify({candidate:url,final:response.url,type:response.contentType,length:response.body.length,items:count,ownedArticleLinks:articleLinks.length,titles,dates}));
    if(count>0&&articleLinks.length>0){verified++;console.log('VERIFIED_FM_FEED='+url)}
  }catch(error){console.log('Candidate failed:',c,String(error))}
}
if(!verified)throw Error('No valid first-party newsroom RSS feed discovered');
