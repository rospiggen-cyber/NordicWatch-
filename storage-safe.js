/* Persistence is optional: a full/disabled browser store must never stop live UI. */
(function(root){
  const memory=new Map();
  const api={
    getItem(key){if(memory.has(key))return memory.get(key);try{return root.localStorage.getItem(key)}catch{return null}},
    setItem(key,value){value=String(value);memory.set(key,value);try{root.localStorage.setItem(key,value);memory.delete(key);return true}catch{api.degraded=true;return false}},
    removeItem(key){memory.delete(key);try{root.localStorage.removeItem(key)}catch{api.degraded=true}},
    degraded:false
  };
  root.NordicWatchStorage=api;
})(globalThis);
