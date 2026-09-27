// Cache completed public analysis results only, never request-owned I/O promises.
const results=new Map();
const TTL=30000,MAX_ENTRIES=3;
export function cachedRead(key,now=Date.now()){
 const entry=results.get(key);
 if(!entry)return null;
 if(now>=entry.expires){results.delete(key);return null;}
 return entry.value;
}
export function rememberRead(key,value,now=Date.now()){
 if(value&&typeof value.then==='function')throw Error('Pending I/O must not be cached across requests');
 results.delete(key);results.set(key,{value,expires:now+TTL});
 while(results.size>MAX_ENTRIES)results.delete(results.keys().next().value);
 return value;
}
export function invalidateReads(){results.clear();}
