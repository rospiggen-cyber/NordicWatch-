// A single durable owner coordinates each manifest. KV read/modify/write indexes
// would lose concurrent subscriptions; isolate-local caches cannot coordinate them.
export class KVCatalog {
  constructor(ctx, env) {
    this.storage = ctx.storage;
    this.env = env;
    this.queue = Promise.resolve();
    this.keys = null;
  }
  fetch(request) {
    const result = this.queue.then(() => this.handle(request));
    this.queue = result.catch(() => {});
    return result;
  }
  async handle(request) {
    const {namespace, action, caller, key, value} = await request.json();
    const prefix = namespace === 'EVENTS' ? 'event:' : namespace === 'SUBSCRIPTIONS' ? 'sub:' : null;
    if (!prefix || !this.env[namespace]) return Response.json({error:'invalid_namespace'}, {status:400});
    const kv = this.env[namespace], day = new Date().toISOString().slice(0,10);
    const metricKey = 'diagnostics:' + day;
    const metrics = await this.storage.get(metricKey) || {day, callers:{}};
    const label = String(caller || 'unknown').slice(0,100);
    const counter = metrics.callers[label] ||= {invocations:0, listCalls:0, listFailures:0, manifestCacheHits:0};
    counter.invocations++;
    try {
      if (action === 'diagnostics') {
        const days = [];
        for (let i=0;i<7;i++) {
          const date = new Date(Date.now()-i*86400000).toISOString().slice(0,10);
          days.push(await this.storage.get('diagnostics:'+date) || {day:date,callers:{}});
        }
        return Response.json({namespace, targetListCallsPerDay:100, days, migration:await this.storage.get('migration') || null});
      }
      // Migration checkpoints every complete page. A failed page never publishes
      // a partial manifest; retries resume from the last durable cursor.
      let migration = await this.storage.get('migration');
      while (!migration?.complete) {
        counter.listCalls++;
        // Persist the attempt before KV I/O, including calls that subsequently fail.
        await this.storage.put(metricKey, metrics);
        console.log(JSON.stringify({type:'kv_list',namespace,caller:label,reason:'manifest_migration',day}));
        let page;
        try { page = await kv.list({prefix, limit:1000, ...(migration?.cursor ? {cursor:migration.cursor} : {})}); }
        catch (error) { counter.listFailures++; throw error; }
        if (!page.list_complete && (!page.cursor || page.cursor === migration?.cursor)) throw new Error('invalid_kv_cursor');
        for (let offset=0;offset<page.keys.length;offset+=100) {
          await this.storage.put(Object.fromEntries(page.keys.slice(offset,offset+100).map(k=>['member:'+k.name,true])));
        }
        migration = {complete:page.list_complete, cursor:page.list_complete ? null : page.cursor, updatedAt:new Date().toISOString()};
        await this.storage.put('migration',migration);
      }
      if (this.keys) counter.manifestCacheHits++;
      else {
        // This is Durable Object SQLite storage, NOT a Workers KV list operation.
        const members = await this.storage.list({prefix:'member:'});
        this.keys = new Set([...members.keys()].map(k=>k.slice(7)));
      }
      if (action === 'put' || action === 'delete') {
        if (typeof key !== 'string' || !key.startsWith(prefix)) throw new Error('invalid_record_key');
        if (action === 'put') {
          // Index first: a failed record write leaves a harmless missing record,
          // never a successfully written but undiscoverable subscription/event.
          if (!this.keys.has(key)) { await this.storage.put('member:'+key,true); this.keys.add(key); }
          await kv.put(key,value);
        } else {
          await kv.delete(key);
          await this.storage.delete('member:'+key);
          this.keys.delete(key);
        }
        return Response.json({ok:true});
      }
      if (action !== 'keys') throw new Error('invalid_catalog_action');
      return Response.json({keys:[...this.keys].sort()});
    } finally {
      await this.storage.put(metricKey,metrics);
      // Fixed-key retention; diagnostics must never enumerate KV themselves.
      await this.storage.delete('diagnostics:'+new Date(Date.now()-7*86400000).toISOString().slice(0,10));
    }
  }
}

export async function catalog(env, namespace, action, caller, extra={}) {
  if (!env.KV_CATALOG) throw new Error('KV_CATALOG binding required; deploy the accompanying Wrangler configuration');
  const stub = env.KV_CATALOG.get(env.KV_CATALOG.idFromName(namespace));
  const response = await stub.fetch('https://kv-catalog.internal/', {method:'POST',body:JSON.stringify({namespace,action,caller,...extra})});
  if (!response.ok) throw new Error('kv_catalog_'+response.status);
  return response.json();
}

export async function indexedRecords(env,namespace,caller) {
  const {keys} = await catalog(env,namespace,'keys',caller), records=[];
  // Retain native KV caching/freshness for values; only immutable membership is
  // cached in the durable owner and is invalidated synchronously on mutations.
  for (let offset=0;offset<keys.length;offset+=50) {
    records.push(...await Promise.all(keys.slice(offset,offset+50).map(async key=>({key,value:await env[namespace].get(key,'json')}))));
  }
  return records.filter(record=>record.value);
}

export const indexedPut = (env,namespace,key,value,caller) => catalog(env,namespace,'put',caller,{key,value});
export const indexedDelete = (env,namespace,key,caller) => catalog(env,namespace,'delete',caller,{key});
