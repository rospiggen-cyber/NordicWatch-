/* Teach NordicWatch v0.1. Local feedback only: never changes event rules or pushes alerts.
 * The application does not crawl URLs. Source excerpts must be from a known app
 * record or manually supplied, with provenance explicitly retained.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.NordicWatchTeach=api;
})(globalThis,function(){
 'use strict';
 const VERSION='teach-example/1', KEY='NORDICWATCH_TEACH_EXAMPLES_V1';
 const LABELS=['DIRECT_AOI','STRATEGIC_SPILLOVER','NOT_RELEVANT','NEEDS_REVIEW'];
 const FRESHNESS=['NEW_DEVELOPMENT','HISTORICAL_REPORT','UNKNOWN'];
 const DECISIONS=['APPROVED_FOR_TESTING','REJECTED','NEEDS_REVIEW'];
 const clean=(v,n)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
 const stamp=v=>{if(!v)return null;const n=Date.parse(String(v));return Number.isFinite(n)?new Date(n).toISOString():null};
 const checksum=v=>{let h=2166136261;for(const c of v){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')};
 function url(value){
  const raw=String(value||'').trim();
  if(raw.length>2048)throw Error('URL too long (max 2048 characters)');
  let u;try{u=new URL(raw)}catch{throw Error('Enter a valid HTTPS news URL')}
  if(u.protocol!=='https:'||u.username||u.password)throw Error('Only public HTTPS links without credentials are allowed');
  const h=u.hostname.toLowerCase();
  if(!h||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.test')||h.endsWith('.example')||h.endsWith('.invalid')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||h.includes(':'))throw Error('Enter a publicly hosted HTTPS news URL');
  u.hash='';
  for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$)/i.test(k))u.searchParams.delete(k);
  return u.href;
 }
 function localMatch(link,articles=[]){
  const canonical=url(link);
  return (Array.isArray(articles)?articles:[]).find(x=>{
   try{return url(x.url||x.sourceUrl)===canonical}catch{return false}
  })||null;
 }
 // URL slugs are user-controlled hints only. Never treat them as fetched article evidence.
 function urlHints(link){
  if(!link)return {regions:[],topics:[]};
  let pathname;try{pathname=decodeURIComponent(new URL(url(link)).pathname).toLowerCase().replace(/[_-]+/g,' ')}catch{return {regions:[],topics:[]}}
  const regions=[],topics=[];
  if(/\b(?:kaliningrad|konigsberg|koenigsberg|gvardeysk|gvardeisk|baltijsk|baltiysk)\b/.test(pathname))regions.push('Kaliningrad / Baltijsk');
  if(/\b(?:radar|radars|sensor|sensors|surveillance|electronic warfare|oth)\b/.test(pathname))topics.push('Military sensors / radar (URL hint)');
  return {regions,topics};
 }
 function suggestion(article,evaluate){
  if(typeof evaluate!=='function')throw Error('Routing evaluator unavailable');
  const title=clean(article.title,300),description=clean(article.description,800),hints=urlHints(article.sourceUrl||article.url);
  if(!title)return {label:'NEEDS_REVIEW',reason:hints.regions.length?'Article not fetched. URL suggests '+hints.regions.join(', ')+', but this is NOT verified article content. Enter the actual headline and a sourced summary.':'Headline missing; the URL was not fetched. Enter the actual headline and a sourced summary.',matchedRegions:[],matchedTopics:[],urlHints:hints,directGeographicRelevance:false,correlatedStrategicRelevance:false};
  let r;try{r=evaluate({title,description})}catch{r=null}
  if(!r||typeof r.relevant!=='boolean')return {label:'NEEDS_REVIEW',reason:'Relevance engine unavailable',matchedRegions:[],matchedTopics:[],directGeographicRelevance:false,correlatedStrategicRelevance:false};
  const incomplete=!(r.relevant)&&hints.regions.length>0;
  return {label:r.correlatedStrategicRelevance?'STRATEGIC_SPILLOVER':r.directGeographicRelevance?'DIRECT_AOI':r.relevant?'NEEDS_REVIEW':incomplete?'NEEDS_REVIEW':'NOT_RELEVANT',reason:incomplete?'URL suggests '+hints.regions.join(', ')+' (unverified location hint). Add the article-supported location and security details to assess relevance.':Array.isArray(r.reason)?r.reason.join(' · '):'Review suggested classification',matchedRegions:(r.matchedRegions||[]).map(x=>clean(x,100)),matchedTopics:(r.matchedTopics||[]).map(x=>clean(x,90)),urlHints:hints,directGeographicRelevance:Boolean(r.directGeographicRelevance),correlatedStrategicRelevance:Boolean(r.correlatedStrategicRelevance)};
 }
 function read(store){
  try{const data=JSON.parse(store?.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(x=>x?.schemaVersion===VERSION&&typeof x.canonicalUrl==='string'&&Array.isArray(x.history)).slice(-250):[]}catch{return []}
 }
 function write(store,rows){
  if(!Array.isArray(rows)||rows.length>250)throw Error('Local training collection full; export before adding more');
  const ok=store?.setItem(KEY,JSON.stringify(rows));
  if(ok===false||!store)throw Error('Device storage unavailable. Export your existing examples before continuing.');
  return rows;
 }
 function submit(rows,{sourceUrl,title,description,publishedAt,eventOccurredAt,metadataOrigin='MANUAL',label,freshness,decision,reason},now=new Date().toISOString()){
  if(!Array.isArray(rows))throw Error('Existing examples must be an array');
  const canonical=url(sourceUrl),when=stamp(now);
  if(!when)throw Error('Invalid review timestamp');
  if(!LABELS.includes(label)||!FRESHNESS.includes(freshness)||!DECISIONS.includes(decision))throw Error('Invalid classification or decision');
  const t=clean(title,300),desc=clean(description,800),note=clean(reason,600),published=stamp(publishedAt),occurred=stamp(eventOccurredAt);
  if(!t)throw Error('Enter a headline before saving');
  if(note.length<8)throw Error('Explain your assessment (at least 8 characters)');
  if(publishedAt&&!published)throw Error('Invalid article publication date');
  if(eventOccurredAt&&!occurred)throw Error('Invalid event date');
  if(metadataOrigin!=='MANUAL'&&metadataOrigin!=='MATCHED_LOCAL_FEED')throw Error('Invalid metadata provenance');
  // An approval labels relevance only; it never validates the news claim.
  const index=rows.findIndex(r=>r.canonicalUrl===canonical);
  if(index<0&&rows.length>=250)throw Error('Local collection full; export before adding more');
  const entry=index<0?{schemaVersion:VERSION,exampleId:'NW-TCH-'+checksum(canonical),canonicalUrl:canonical,publisher:new URL(canonical).hostname,createdAt:when,history:[]}:JSON.parse(JSON.stringify(rows[index]));
  if(!Array.isArray(entry.history)||entry.history.length>=100)throw Error('Example has too many revisions; export the history');
  const revision=entry.history.length+1;
  const revisionData={revision,reviewedAt:when,title:t,description:desc,articlePublishedAt:published,eventOccurredAt:occurred,publicationDateStatus:published?(/^\d{4}-\d{2}-\d{2}$/.test(String(publishedAt))?'DAY_ONLY':'PROVIDED_TIMESTAMP'):'UNKNOWN',eventDateStatus:occurred?(/^\d{4}-\d{2}-\d{2}$/.test(String(eventOccurredAt))?'DAY_ONLY':'PROVIDED_TIMESTAMP'):'UNKNOWN',metadataOrigin,label,freshness,decision,reason:note,sourceConfidence:'UNVERIFIED_BY_TEACH',ruleImpact:'NONE',ruleVersion:'manual-review-v0.1'};
  entry.history.push(revisionData);
  entry.currentRevision=revision;
  const next=rows.slice();if(index>=0)next[index]=entry;else next.push(entry);
  return {rows:next,entry,revision:revisionData};
 }
 function exportReviewed(rows,now=new Date().toISOString()){
  const entries=rows.filter(r=>r.history?.at(-1)?.decision==='APPROVED_FOR_TESTING');
  return {schemaVersion:'nordicwatch-teach-export/1',exportedAt:stamp(now),purpose:'REVIEWED_TEST_EXAMPLES_ONLY',isLiveEvidence:false,automaticRuleChange:false,approvedCount:entries.length,entries};
 }
 return {VERSION,KEY,LABELS,FRESHNESS,DECISIONS,url,localMatch,suggestion,submit,read,write,exportReviewed};
});