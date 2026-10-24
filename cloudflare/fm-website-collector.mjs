// Bounded original-publisher website collector. No search/social fallback and no invented timestamps.
export const FM_NEWS_INDEX = "https://www.forsvarsmakten.se/aktuellt/nyheter/";
const HOST = "www.forsvarsmakten.se";
const MONTHS = {"januari":1,"februari":2,"mars":3,"april":4,"maj":5,"juni":6,"juli":7,"augusti":8,"september":9,"oktober":10,"november":11,"december":12};
const named = {"amp":"&","quot":"\"","apos":"'","lt":"<","gt":">","nbsp":" ","aring":"å","auml":"ä","ouml":"ö","Aring":"Å","Auml":"Ä","Ouml":"Ö","ndash":"–","mdash":"—"};
function decode(s){return String(s||"").replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/g,(_,k)=>{if(k[0]==="#"){const n=k[1].toLowerCase()==="x"?parseInt(k.slice(2),16):Number(k.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):" "}return Object.hasOwn(named,k)?named[k]:" "})}
function plain(html){return decode(String(html||"").replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim()}
function attribute(tag,key){const m=tag.match(new RegExp("(?:\\s|^)"+key+"\\s*=\\s*([\"'])([\\s\\S]*?)\\1","i"));return decode(m?.[2]||"")}
function meta(html,key){const tag=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]).find(t=>attribute(t,"property")===key||attribute(t,"name")===key);return tag?attribute(tag,"content"):""}
function trustedArticle(raw){try{const u=new URL(raw,FM_NEWS_INDEX);if(u.protocol!=="https:"||u.hostname!==HOST||u.port||!/^\/aktuellt\/nyheter\/[a-z0-9-]+\/?$/i.test(u.pathname))return null;return u.origin+u.pathname.replace(/\/?$/,"/")}catch{return null}}
export function linksFromOfficialNewsIndex(html){
 if(typeof html!=="string"||html.length>2_000_000)return[];
 return [...new Set([...html.matchAll(/<a\b[^>]*>/gi)].map(x=>attribute(x[0],"href")).map(trustedArticle).filter(Boolean))].slice(0,12);
}
function localSwedishDate(date,time){
 const m=String(date).match(/(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})/i);
 if(!m)return null;
 const mm=MONTHS[m[2].toLowerCase()],d=Number(m[1]),y=Number(m[3]),clock=String(time||"").match(/(\d{1,2}):(\d{2})/);
 if(!clock||d<1||d>31||y<2000)return null;
 const h=Number(clock[1]),minutes=Number(clock[2]);if(h>23||minutes>59)return null;
 const local=Date.UTC(y,mm-1,d,h,minutes);
 const tz=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Stockholm",timeZoneName:"shortOffset"}).formatToParts(new Date(local)).find(x=>x.type==="timeZoneName")?.value||"GMT+1";
 const offset=tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/),mins=offset?(offset[1]==="-"?-1:1)*(Number(offset[2])*60+Number(offset[3]||0)):60;
 const utc=new Date(local-mins*60000);
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Stockholm",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(utc).map(x=>[x.type,x.value]));
 if(+parts.year!==y||+parts.month!==mm||+parts.day!==d||+parts.hour!==h||+parts.minute!==minutes)return null;
 return utc.toISOString();
}
export function parseOfficialNewsArticle(html,url){
 const canonical=trustedArticle(url);if(!canonical||typeof html!=="string"||html.length>2_000_000)return null;
 const h1=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i),title=plain(h1?.[1])||meta(html,"og:title")||meta(html,"twitter:title");
 const summary=meta(html,"description")||meta(html,"og:description")||plain(html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
 let published=meta(html,"article:published_time")||meta(html,"datePublished")||html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1]||"";
 if(published&&!/[zZ]|[+-]\d{2}:?\d{2}$/.test(published))published="";
 if(published&&!Number.isFinite(Date.parse(published)))published="";
 if(!published){const match=plain(html).match(/(?:Publiceringsdatum|Publicerad)\s*:\s*(\d{1,2}\s+[a-zåäö]+\s+\d{4})\s*(?:kl\.?\s*)?(\d{1,2}:\d{2})/i);if(match)published=localSwedishDate(match[1],match[2])||""}
 if(!title||!published||!summary)return null;
 return {title:title.slice(0,240),summary:summary.slice(0,1200),url:canonical,publishedAt:new Date(published).toISOString(),sourceId:"se",sourceName:"Swedish Armed Forces",sourceChannel:"official-website"};
}
