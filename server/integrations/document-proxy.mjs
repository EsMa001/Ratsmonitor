/**
 * Fetching an original document for /api/dokument (E4 of the code analysis of 10.10.2026). The address comes from a
 * stored report, so it names a council system; still the server must never be led to its own network: a hacked or
 * moved source, an open redirect. Therefore
 * - only https, no credentials, no internal names, no private or link-local address, also after name resolution;
 * - redirects followed by hand, at most MAX_HOPS, every target checked the same way;
 * - the timeout covers the headers only; the body is cut off when no data arrives for IDLE_MS (idleLimited).
 * What remains: a name that resolves differently for the check and for the request (DNS rebinding) is not caught;
 * such a target would still need a valid certificate for that very name (certificates are always checked).
 */
export const MAX_HOPS=3,HEADERS_MS=20000,IDLE_MS=30000,MAX_BYTES=30*1024*1024;
export const VIEWABLE=/^(application\/pdf|image\/(png|jpe?g|gif|webp))$/i;
export const USER_AGENT='Mozilla/5.0 (Plenara Dokumentenansicht)';
const isIp=host=>/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(':');
/** Whether an address belongs to the own machine or network: loopback, private, link-local, multicast, reserved. */
export function privateAddress(ip){
 const v4=ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
 if(v4){
  const [a,b]=v4.slice(1).map(Number);
  return a===0||a===10||a===127||a===100&&b>=64&&b<128||a===169&&b===254||a===172&&b>=16&&b<32||a===192&&(b===0||b===168)||a===198&&(b===18||b===19)||a>=224;
 }
 const v6=ip.toLowerCase().replace(/^\[|\]$/g,'').replace(/%.*$/,'');
 // IPv4 in IPv6: mapped (::ffff:a.b.c.d) and translated (64:ff9b::a.b.c.d), each also in the hex form that URL and
 // the resolver use (::ffff:7f00:1).
 const mapped=v6.match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/);if(mapped)return privateAddress(mapped[1]);
 const hex=v6.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);if(hex){const n=parseInt(hex[1],16),m=parseInt(hex[2],16);return privateAddress(`${n>>8}.${n&255}.${m>>8}.${m&255}`);}
 // Unspecified, loopback and the deprecated IPv4-compatible form all start with '::'.
 if(v6.startsWith('::'))return true;
 const first=v6.split(':')[0];
 return /^f[cd]/.test(first)||/^fe[89ab]/.test(first)||/^fe[c-f]/.test(first)||/^ff/.test(first);
}
/** Why an address must not be fetched by the server, or null if it may be. */
export function blockedTarget(url){
 let u;try{u=new URL(url);}catch{return 'ungültige Adresse';}
 if(u.protocol!=='https:')return 'nur https';
 if(u.username||u.password)return 'Zugangsdaten in der Adresse';
 // A final dot names the same host ("localhost." is localhost).
 const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,'').replace(/\.$/,'');
 if(isIp(host))return privateAddress(host)?'interne Adresse':null;
 if(host==='localhost'||/\.(?:localhost|local|internal|home\.arpa|onion)$/.test(host)||!host.includes('.'))return 'interner Name';
 return null;
}
/** Addresses a name resolves to (Node), or null where the runtime cannot tell (Workers; they reach no private network). */
export async function resolveAddresses(host){
 if(!globalThis.process?.versions?.node)return null;
 let dns;try{const name='node:dns/promises';dns=await import(/* @vite-ignore */ name);}catch{return null;}
 const found=await dns.lookup(host,{all:true,verbatim:true});
 return found.map(a=>a.address);
}
/**
 * Fetches the document behind `url`, following redirects by hand (see above). Resolves to {response, url} with the
 * final address; the response's body is not read. `control.abort()` cancels the transfer.
 * @param {string} url
 * @param {{request?:typeof fetch,lookup?:(host:string)=>Promise<string[]|null>}} [options]
 */
export async function fetchDocument(url,{request=fetch,lookup=resolveAddresses}={}){
 let next=url;const seen=new Set();const control=new AbortController();
 for(let hop=0;;hop++){
  const why=blockedTarget(next);if(why)throw Error('Adresse nicht erlaubt: '+why);
  const host=new URL(next).hostname;
  if(!isIp(host)){const addresses=await lookup(host);if(addresses&&(!addresses.length||addresses.some(privateAddress)))throw Error('Adresse nicht erlaubt: der Name führt auf eine interne Adresse');}
  if(seen.has(next))throw Error('Weiterleitungsschleife');seen.add(next);
  const timer=setTimeout(()=>control.abort(Error('Keine Antwort innerhalb von '+HEADERS_MS/1000+' s')),HEADERS_MS);
  let r;try{r=await request(next,{redirect:'manual',signal:control.signal,headers:{'User-Agent':USER_AGENT}});}finally{clearTimeout(timer);}
  if(r.type==='opaqueredirect'||(r.status>=300&&r.status<400)){
   const location=r.headers.get('location');await r.body?.cancel().catch(()=>{});
   if(!location)throw Error('Weiterleitung ohne Ziel');
   if(hop>=MAX_HOPS)throw Error('Zu viele Weiterleitungen');
   next=new URL(location,next).href;continue;
  }
  return {response:r,url:next,control};
 }
}
/**
 * The body, cut off when no data arrives for idleMs: `abort` is called with the reason, which ends the transfer, and
 * the stream fails by itself, whatever the runtime does with the aborted body. A slow but steady source is passed on
 * without limit.
 */
export function idleLimited(body,abort,idleMs=IDLE_MS){
 let timer;
 const arm=controller=>{clearTimeout(timer);timer=setTimeout(()=>{const reason=Error('Übertragung abgebrochen: seit '+idleMs/1000+' s keine Daten');abort(reason);try{controller.error(reason);}catch{/* already closed */}},idleMs);};
 const out=new TransformStream({start(controller){arm(controller);},transform(chunk,controller){controller.enqueue(chunk);arm(controller);},flush(){clearTimeout(timer);},cancel(){clearTimeout(timer);}});
 body.pipeTo(out.writable).catch(()=>{/* the readable side carries the failure */});
 return out.readable;
}
/** File name from Content-Disposition; a broken escape in filename* falls back to the plain name instead of failing. */
export function documentName(disposition){
 const d=String(disposition||'');
 const star=/filename\*=utf-8''([^;]+)/i.exec(d);
 if(star){try{return decodeURIComponent(star[1].trim());}catch{/* broken percent escape */}}
 return /filename="?([^";]+)"?/i.exec(d)?.[1]?.trim()||'';
}
