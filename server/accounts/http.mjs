// Antworten, Cookies, Herkunftsprüfung und Client-Adresse für die Kontorouten.
export class AccountError extends Error{constructor(status,message,extra){super(message);this.status=status;this.extra=extra;}}
export const NO_STORE={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};

/** JSON-Antwort ohne Zwischenspeicher; mehrere Set-Cookie-Zeilen bleiben getrennt */
export function respond(data,{status=200,cookies=[],headers={}}={}){
 const h=new Headers({'Content-Type':'application/json; charset=utf-8',...NO_STORE,...headers});
 for(const c of cookies)h.append('Set-Cookie',c);
 return new Response(data===null?null:JSON.stringify(data),{status,headers:h});
}
export const failure=error=>error instanceof AccountError
 ?respond({error:error.message,...(error.extra||{})},{status:error.status})
 :(console.error('[konten]',error instanceof Error?error.message:String(error)),respond({error:'Das hat gerade nicht geklappt. Bitte erneut versuchen.'},{status:503}));

/** Ändernde Anfragen nur von der eigenen Seite, nur als JSON (CSRF, Abschnitt 11) */
export function requireSameOrigin(request){
 const origin=request.headers.get('origin');
 if(!origin||origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new AccountError(403,'Diese Aktion muss direkt auf der Seite ausgelöst werden.');
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AccountError(415,'JSON-Anfrage erforderlich.');
}
/** JSON-Körper mit Größengrenze; leerer Körper ergibt {} */
export async function readJson(request,maxBytes=16384){
 const text=await readText(request,maxBytes);
 if(!text.trim())return {};
 try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}
 catch{throw new AccountError(400,'Ungültige Anfrage.');}
}
/** Körper als Text mit Größengrenze, unverändert (Signaturprüfung der Stripe-Meldungen) */
export async function readText(request,maxBytes=16384){
 if(Number(request.headers.get('content-length')||0)>maxBytes)throw new AccountError(413,'Anfrage zu groß.');
 // Ohne Content-Length (chunked): stückweise lesen und abbrechen, sobald die Grenze überschritten ist
 let size=0;const parts=[];
 if(request.body){
  const reader=request.body.getReader();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel().catch(()=>{});throw new AccountError(413,'Anfrage zu groß.');}parts.push(value);}
 }
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.byteLength;}
 return new TextDecoder().decode(bytes);
}
export function parseCookies(header){
 const out=new Map();
 for(const part of String(header||'').split(';')){
  const i=part.indexOf('=');if(i<1)continue;
  const name=part.slice(0,i).trim(),value=part.slice(i+1).trim();
  if(!out.has(name))out.set(name,value);
 }
 return out;
}
/** Cookie-Namen je Protokoll: über https nur __Host- (geteilte Domain sslip.io), im Tunnel ohne Secure, im Dev-Server eigene */
export function cookieNames({protocol='https:',dev=false}={}){
 if(dev)return {session:'rm_dev_session',flow:'rm_dev_flow',secure:false};
 return protocol==='https:'?{session:'__Host-rm_session',flow:'__Host-rm_flow',secure:true}:{session:'rm_session',flow:'rm_flow',secure:false};
}
export function setCookie(name,value,{maxAge,secure,sameSite='Lax'}){
 return `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${Math.max(0,Math.floor(maxAge))}${secure?'; Secure':''}`;
}
/**
 * Client-Adresse für Grenzen. Node hinter Caddy: der letzte Eintrag in X-Forwarded-For (setzt Caddy selbst);
 * cf-connecting-ip nur auf Cloudflare, sonst ließe er sich fälschen. IPv6 auf das /64-Präfix gekürzt.
 */
export function clientIp(request){
 const onCloudflare=globalThis.navigator?.userAgent==='Cloudflare-Workers';
 let ip=onCloudflare?request.headers.get('cf-connecting-ip'):null;
 if(!ip){const list=String(request.headers.get('x-forwarded-for')||'').split(',').map(s=>s.trim()).filter(Boolean);ip=list.at(-1)||null;}
 if(!ip)return 'unbekannt';
 if(ip.includes(':')){
  const groups=ip.replace(/^\[|\]$/g,'').split('::');
  const head=groups[0].split(':').filter(Boolean),tail=groups.length>1?groups[1].split(':').filter(Boolean):[];
  const full=[...head,...Array(Math.max(0,8-head.length-tail.length)).fill('0'),...tail];
  return full.slice(0,4).map(g=>g.toLowerCase()).join(':')+'::/64';
 }
 return ip;
}
/** Grobe Gerätebeschreibung ohne vollen User-Agent, z. B. „Firefox · Windows“ */
export function deviceLabel(userAgent){
 const ua=String(userAgent||'');
 const browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Browser';
 const os=/Windows/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Mac OS X/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'unbekannt';
 return browser+' · '+os;
}
