/* Teach-specific durable storage with IndexedDB fallback.
 * Never represent an in-memory write as a persistent save.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==="object"&&module.exports)module.exports=api;
 root.NordicWatchTeachPersistence=api;
})(globalThis,function(root){
 "use strict";
 const DB="NordicWatchTeach",OBJECT="records",RECORD="approved-examples-v1";
 function indexedDBDriver(idb=root.indexedDB){
  const open=()=>new Promise((resolve,reject)=>{
   if(!idb?.open)return reject(Error("indexeddb_unavailable"));
   let request;try{request=idb.open(DB,1)}catch(e){reject(e);return}
   request.onupgradeneeded=()=>{
    if(!request.result.objectStoreNames.contains(OBJECT))request.result.createObjectStore(OBJECT);
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error||Error("indexeddb_open_failed"));
   request.onblocked=()=>reject(Error("indexeddb_blocked"));
  });
  async function run(mode,value){
   const db=await open();
   return new Promise((resolve,reject)=>{
    let tx;try{tx=db.transaction(OBJECT,mode)}catch(e){db.close();reject(e);return}
    const request=mode==="readonly"?tx.objectStore(OBJECT).get(RECORD):tx.objectStore(OBJECT).put(value,RECORD);
    let result=null;
    request.onsuccess=()=>{result=request.result};
    request.onerror=()=>{try{tx.abort()}catch{}};
    tx.oncomplete=()=>{db.close();resolve(result)};
    tx.onerror=()=>{db.close();reject(tx.error||request.error||Error("indexeddb_failed"))};
    tx.onabort=()=>{db.close();reject(tx.error||Error("indexeddb_aborted"))};
   });
  }
  return {
   async read(){const value=await run("readonly");return Array.isArray(value?.rows)?value.rows:[]},
   async write(rows){await run("readwrite",{rows,savedAt:new Date().toISOString()});return true}
  };
 }
 function mergeRows(local,other){
  const records=new Map();
  for(const row of [...(Array.isArray(local)?local:[]),...(Array.isArray(other)?other:[])]){
   if(!row||typeof row.canonicalUrl!=="string"||!Array.isArray(row.history))continue;
   const prior=records.get(row.canonicalUrl),rev=row.history.length,old=prior?.history.length||0;
   if(!prior||rev>old||rev===old&&String(row.history.at(-1)?.reviewedAt||"")>String(prior.history.at(-1)?.reviewedAt||""))records.set(row.canonicalUrl,row);
  }
  return [...records.values()];
 }
 function create(teach,store,driver=indexedDBDriver()){
  let rows=teach.read(store),initialized=false,needsBackup=false,idbReadable=false;
  async function load(){
   try{rows=mergeRows(rows,await driver.read());idbReadable=true}catch{/* Do not overwrite an unreadable IndexedDB containing unknown previous history. */}
   initialized=true;
   return rows;
  }
  async function save(next){
   if(!initialized)throw Error("Teach storage is still loading");
   rows=next;let local=false,idb=false;
   try{teach.write(store,next);local=true}catch{/* memory fallback does not count as durable */}
   if(idbReadable)try{idb=await driver.write(next)!==false}catch{/* unavailable or quota */}
   needsBackup=!(local||idb);
   return {saved:!needsBackup,backend:local?"localStorage":idb?"IndexedDB":null,needsBackup,rows};
  }
  return {load,save,rows:()=>rows,backupRequired:()=>needsBackup,initialized:()=>initialized};
 }
 return {create,indexedDBDriver,mergeRows};
});
