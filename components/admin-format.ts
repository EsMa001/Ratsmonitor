/* Zahlen- und Datumsformate der Administration, an einer Stelle (vorher je Datei kopiert). Ohne Wert: „–“. */
const de=(v:number,digits?:number,fixed=false)=>v.toLocaleString('de-DE',digits===undefined?undefined:{maximumFractionDigits:digits,minimumFractionDigits:fixed?digits:0});
/** Zahl; ohne Wert 0. digits: feste Nachkommastellen */
export const n=(v?:number|null,digits?:number)=>de(v??0,digits,digits!==undefined);
/** Zahl; ohne Wert oder nicht endlich „–“ */
export const nOr=(v?:number|null,digits?:number)=>v===null||v===undefined||!Number.isFinite(v)?'–':de(v,digits,digits!==undefined);
/** Anteil a von b in Prozent, höchstens digits Nachkommastellen (fixed: immer so viele) */
export const pct=(a:number,b:number,{digits=1,fixed=false}:{digits?:number;fixed?:boolean}={})=>b?de(100*a/b,digits,fixed)+' %':'–';
/** Einwohner und große Zahlen: ab 1 Mio. in Mio. (ab 100 Mio. ohne Nachkommastelle) */
export const mio=(v:number)=>v>=1e6?de(v/1e6,v>=1e8?0:1,true)+' Mio.':n(v);
/** Bytes in GB (Basis 1024, wie df) */
export const gb=(b?:number|null)=>b==null?'–':de(b/1073741824,1)+' GB';
/** Größe mit passender Einheit (KB, MB, GB), für kleine Dateien neben großen */
export const size=(b?:number|null)=>b==null?'–':b<1048576?`${de(Math.max(1,Math.round(b/1024)))} KB`:b<1073741824?`${de(b/1048576,1)} MB`:gb(b);
/** Tag als TT.MM.JJ aus „JJJJ-MM-TT…“ */
export const day=(d?:string|null)=>d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(2,4):'–';
/** Monat als MM.JJ aus „JJJJ-MM…“ */
export const mm=(d?:string|null)=>d?d.slice(5,7)+'.'+d.slice(2,4):'–';
/** Zeitpunkt als TT.MM.JJ, HH:MM (Berliner Zeit) */
export const when=(d?:string|null)=>d?new Date(d).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'–';
/** Uhrzeit HH:MM (Berliner Zeit) */
export const clock=(d?:string|null)=>d?new Date(d).toLocaleTimeString('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}):'–';
/** Dauer in Sekunden als s, min oder h */
export const dur=(s?:number|null)=>s==null?'–':s<90?`${s} s`:s<5400?`${Math.round(s/60)} min`:`${de(s/3600,1)} h`;
