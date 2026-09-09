import {KVCatalog} from '../../cloudflare/kv-catalog.mjs';

export class MemoryKV {
  constructor(entries=[]) { this.data=new Map(entries); this.listCalls=0; }
  async get(key,type) { const value=this.data.get(key); return type==='json'&&value ? JSON.parse(value) : value ?? null; }
  async put(key,value) { this.data.set(key,value); }
  async delete(key) { this.data.delete(key); }
  async list({prefix,cursor,limit=1000}) {
    this.listCalls++;
    const keys=[...this.data.keys()].filter(k=>k.startsWith(prefix)).sort(), start=Number(cursor)||0;
    return {keys:keys.slice(start,start+limit).map(name=>({name})),list_complete:start+limit>=keys.length,cursor:String(start+limit)};
  }
}

class MemoryStorage {
  constructor() {this.data=new Map();}
  async get(key) {return structuredClone(this.data.get(key));}
  async put(key,value) {
    if(typeof key==='object')for(const [k,v] of Object.entries(key))this.data.set(k,structuredClone(v));
    else this.data.set(key,structuredClone(value));
  }
  async delete(key) {return this.data.delete(key);}
  async list({prefix}) {return new Map([...this.data].filter(([key])=>key.startsWith(prefix)));}
}

export function withCatalog(env) {
  const stores=new Map(),instances=new Map();
  env.KV_CATALOG={
    idFromName:name=>name,
    get(name) {
      if(!stores.has(name))stores.set(name,new MemoryStorage());
      if(!instances.has(name))instances.set(name,new KVCatalog({storage:stores.get(name)},env));
      return {fetch:(url,options)=>instances.get(name).fetch(new Request(url,options))};
    },
    restart:()=>instances.clear()
  };
  return env;
}
