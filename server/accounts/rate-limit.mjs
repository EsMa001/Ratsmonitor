// Grenzen im Arbeitsspeicher des Prozesses (je IP oder Konto). Nach einem Neustart leer; die Grenzen je Adresse
// liegen dagegen in der Kontendatei (login_requests, login_flows) und überstehen Neustarts.
const windows=new Map();
/** true, wenn der Schlüssel in diesem Fenster schon max-mal gezählt wurde; sonst zählen */
export function limited(name,key,{max,windowMs,now=Date.now()}){
 const id=name+'\u0000'+key;
 const list=(windows.get(id)||[]).filter(t=>now-t<windowMs);
 if(list.length>=max){windows.set(id,list);return true;}
 list.push(now);windows.set(id,list);
 if(windows.size>20000)for(const [k,v] of windows)if(!v.some(t=>now-t<86400000))windows.delete(k);
 return false;
}
/** Mehrere Fenster zugleich (z. B. 5 in 15 min und 20 am Tag) */
export const limitedAll=(name,key,rules,now=Date.now())=>rules.some((r,i)=>limited(name+':'+i,key,{...r,now}));
/** Nur für Tests */
export const resetLimits=()=>windows.clear();
