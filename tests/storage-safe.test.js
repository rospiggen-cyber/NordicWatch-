const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../storage-safe.js'),'utf8');
test('quota exceeded preserves persisted history and keeps new evidence readable in memory',()=>{
 const original=new Map([['history','old evidence']]);
 const ctx=vm.createContext({localStorage:{getItem:k=>original.get(k)||null,setItem(){throw Object.assign(new Error('full'),{name:'QuotaExceededError'})},removeItem(){throw Error('blocked')}}});vm.runInContext(source,ctx);
 const store=ctx.NordicWatchStorage;assert.equal(store.getItem('history'),'old evidence');assert.equal(store.setItem('history','new evidence'),false);assert.equal(store.getItem('history'),'new evidence');assert.equal(original.get('history'),'old evidence');assert(store.degraded);
});
test('healthy storage persists normally and inaccessible storage remains usable',()=>{
 const data=new Map(),ctx=vm.createContext({localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}});vm.runInContext(source,ctx);assert(ctx.NordicWatchStorage.setItem('a','b'));assert.equal(data.get('a'),'b');
 const blocked=vm.createContext({});vm.runInContext(source,blocked);assert.equal(blocked.NordicWatchStorage.getItem('missing'),null);blocked.NordicWatchStorage.setItem('a','b');assert.equal(blocked.NordicWatchStorage.getItem('a'),'b');
});
test('Scan snapshot tolerates null coverage and storage controller loads before consumers',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert(!html.includes('briefNewsCoverage.available'));assert(html.indexOf('src="storage-safe.js"')<html.indexOf('src="situation-ui.js"'));
 for(const file of ['index.html','situation-ui.js','event-state-ui.js','germany-ui.js'])assert(!fs.readFileSync(require.resolve('../'+file),'utf8').includes('localStorage.setItem('));
});
