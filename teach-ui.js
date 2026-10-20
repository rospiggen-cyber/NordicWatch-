/* Teach NordicWatch local review panel. It does not fetch arbitrary remote URLs.
 * No training record is automatically injected into situations, scoring or alerts.
 */
(function(root){
 'use strict';
 function init(){
  const T=root.NordicWatchTeach,NR=root.NordicWatchNewsRouting,store=root.NordicWatchStorage;
  if(!T||!NR||!store||!root.NordicWatchTeachPersistence)return;
  const persistence=root.NordicWatchTeachPersistence.create(T,store);
  const el=id=>document.getElementById(id);
  const drawer=el('teachDrawer'),status=el('teachStatus'),preview=el('teachPreview');
  if(!drawer||!status||!preview)return;
  let lastMatch=null,previousUrl=null;
  el('teachSave').disabled=true;
  const currentRows=()=>persistence.rows();
  const setStatus=(value,isError=false)=>{status.textContent=value;status.dataset.error=isError?'1':'0'};
  const history=()=>{
    const rows=currentRows(),approved=rows.filter(r=>r.history.at(-1)?.decision==='APPROVED_FOR_TESTING').length;
    el('teachHistory').textContent=rows.length+' reviewed links · '+approved+' approved for tests (local on this device)';
    el('teachExport').disabled=approved===0;
    el('teachBackup').disabled=rows.length===0;
  };
  const clean=v=>String(v||'').trim();
  const loadCandidates=()=>{
   try{const arr=JSON.parse(store.getItem('NORDICWATCH_SIGNAL_ARCHIVE')||'[]');return Array.isArray(arr)?arr:[]}catch{return []}
  };
  const suggestionText=r=>{
   const rows=[
    'Suggested relevance: '+r.label.replaceAll('_',' '),
    'Reason: '+r.reason,
    r.matchedRegions?.length?'Areas: '+r.matchedRegions.join(', '):'Area: not established',
    r.matchedTopics?.length?'Topics: '+r.matchedTopics.join(', '):'Security topic: not established',
    r.urlHints?.regions?.length?'URL hint (unverified, not article evidence): '+r.urlHints.regions.join(', '):null,
    'This is an automated relevance suggestion, NOT verified news evidence.'
   ];
   preview.replaceChildren();
   for(const line of rows.filter(Boolean)){const p=document.createElement('p');p.textContent=line;preview.append(p)}
  };
  function evaluate(){
   let sourceUrl;try{sourceUrl=T.url(el('teachUrl').value)}catch(e){setStatus(e.message,true);return null}
   const rows=loadCandidates();
   const match=T.localMatch(sourceUrl,rows);
   if(match&&previousUrl!==sourceUrl){
    if(!clean(el('teachTitle').value))el('teachTitle').value=match.title||'';
    if(!clean(el('teachDescription').value))el('teachDescription').value=match.description||match.summary||'';
    if(!clean(el('teachPublished').value)){
     const when=match.articlePublishedAt||match.publishedAt||match.timestamp;
     if(when&&!Number.isNaN(+new Date(when)))el('teachPublished').value=new Date(when).toISOString().slice(0,10);
    }
   }
   previousUrl=sourceUrl;
   const feedDate=match?.articlePublishedAt||match?.publishedAt||match?.timestamp||'';
   const dateOnly=feedDate&&!Number.isNaN(+new Date(feedDate))?new Date(feedDate).toISOString().slice(0,10):'';
   const originalFields=Boolean(match&&el('teachTitle').value===(match.title||'')&&el('teachDescription').value===(match.description||match.summary||'')&&el('teachPublished').value===dateOnly);
   lastMatch=originalFields?{url:sourceUrl,title:el('teachTitle').value,description:el('teachDescription').value,published:el('teachPublished').value}:null;
   const r=T.suggestion({sourceUrl,title:el('teachTitle').value,description:el('teachDescription').value},x=>NR.safeRelevance(x));
   suggestionText(r);
   el('teachLabel').value=r.label;
   setStatus(match?'Matched a news record already stored in NordicWatch. Check original dates and correct any fields.':'URL not found in current NordicWatch archive. Add a headline/date manually; full article text has NOT been fetched.');
   return r;
  }
  function close(){drawer.classList.remove('show');el('teachOpen').setAttribute('aria-expanded','false')}
  el('teachOpen').addEventListener('click',()=>{
   drawer.classList.add('show');el('teachOpen').setAttribute('aria-expanded','true');history();el('teachUrl').focus()
  });
  el('teachClose').onclick=close;
  drawer.addEventListener('click',e=>{if(e.target===drawer)close()});
  el('teachAnalyze').onclick=evaluate;
  el('teachUrl').addEventListener('change',()=>{lastMatch=null;previousUrl=null});
  el('teachSave').onclick=async()=>{
   try{
    const sourceUrl=T.url(el('teachUrl').value);
    const matchProvenance=lastMatch&&lastMatch.url===sourceUrl&&lastMatch.title===el('teachTitle').value&&lastMatch.description===el('teachDescription').value&&lastMatch.published===el('teachPublished').value;
    const data={
      sourceUrl,title:el('teachTitle').value,description:el('teachDescription').value,
      publishedAt:el('teachPublished').value,eventOccurredAt:el('teachEventDate').value,
      metadataOrigin:matchProvenance?'MATCHED_LOCAL_FEED':'MANUAL',
      label:el('teachLabel').value,freshness:el('teachFreshness').value,
      decision:el('teachDecision').value,reason:el('teachReason').value
    };
    const result=T.submit(currentRows(),data);
    const saved=await persistence.save(result.rows);
    history();
    if(saved.saved){
      setStatus('Saved revision '+result.entry.currentRevision+' in '+saved.backend+'. Local teaching example only; no live rules or alerts changed.');
    }else{
      setStatus('NOT SAVED permanently. Data remain in this open page only. Tap Download backup JSON before closing or refreshing the app.',true);
    }
   }catch(e){setStatus(e.message,true)}
  };
  const downloadJson=(data,prefix)=>{
    const json=JSON.stringify(data,null,2),blob=new Blob([json],{type:'application/json'});
    const href=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=href;a.download=prefix+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  el('teachExport').onclick=()=>{
   try{
    const data=T.exportReviewed(currentRows());
    if(!data.approvedCount)throw Error('No approved examples to export yet');
    downloadJson(data,'nordicwatch-teach-approved-');
    setStatus('Exported '+data.approvedCount+' approved examples for private GitHub review. No automatic rule changes.');
   }catch(e){setStatus(e.message,true)}
  };
  el('teachBackup').onclick=()=>{
    try{
      const rows=currentRows();
      if(!rows.length)throw Error('No teaching examples to back up');
      const content={schemaVersion:'nordicwatch-teach-backup/1',exportedAt:new Date().toISOString(),isLiveEvidence:false,automaticRuleChange:false,entries:rows};
      downloadJson(content,'nordicwatch-teach-backup-');
      setStatus('Backup downloaded. Keep this JSON file until durable saving has been verified.');
    }catch(e){setStatus(e.message,true)}
  };
  setStatus('Loading saved teaching examples...');
  persistence.load().then(()=>{
    history();el('teachSave').disabled=false;
    if(store.degraded)setStatus('Browser local storage is degraded; IndexedDB backup will be attempted for new saves.');
    else setStatus('Teaching examples loaded. Saving uses persistent storage when available.');
  }).catch(e=>{setStatus('Teaching storage unavailable: '+e.message,true);});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})(globalThis);