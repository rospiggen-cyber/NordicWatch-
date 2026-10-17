/* Live upstream probe: no secrets, no storage, no operational deployment.
 * Explicit CI diagnostic, not an assertion that a URL seen in docs works.
 */
import {sourceFeeds,parseOfficialFeed,articleToSignal} from '../cloudflare/strategic-source-collector.mjs';
const sources=sourceFeeds();
let passed=0;
for(const item of sources){
  try {
    const response=await fetch(item.url,{signal:AbortSignal.timeout(12000),redirect:'follow',
      headers:{'accept':'application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9',
               'user-agent':'NordicWatch-Strategic/0.2 (source-health test)'}});
    const text=await response.text();
    const rows=parseOfficialFeed(text,response.url);
    const accepted=rows.map(x=>articleToSignal(x,Date.now())).filter(Boolean);
    const host=new URL(response.url).hostname;
    console.log(JSON.stringify({
      id:item.source.id, httpStatus:response.status,host,format:response.headers.get('content-type'),
      bodyBytes:text.length,items:rows.length,topicRelevant:accepted.length,
      firstDate:rows[0]?.publishedAt||null,
      result:response.ok && rows.length > 0 ? 'PASS':'FAIL'
    }));
    if(response.ok && rows.length>0)passed++;else process.exitCode=1;
  }catch(error){
    console.error(JSON.stringify({id:item.source.id,result:'FAIL',reason:String(error?.message||error).slice(0,140)}));
    process.exitCode=1;
  }
}
console.log('Official feeds verified:',passed+'/'+sources.length);
