// Zufall, Hashes und abgeleitete Schlüssel für Konten. Nur WebCrypto: läuft unter Node, Miniflare und in Tests gleich.
const enc=new TextEncoder();
const hex=buffer=>[...new Uint8Array(buffer)].map(n=>n.toString(16).padStart(2,'0')).join('');
export function b64url(bytes){
 let s='';for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
/** Zufallswert mit n Byte (Standard 32 = 256 Bit), base64url */
export const randomToken=(n=32)=>b64url(crypto.getRandomValues(new Uint8Array(n)));
/** Öffentliche Kennung mit Vorsilbe, z. B. u_… für Konten */
export const randomId=(prefix,n=16)=>prefix+randomToken(n);
export const sha256hex=async text=>hex(await crypto.subtle.digest('SHA-256',enc.encode(String(text))));
/** Achtstelliger Code, gleichverteilt (Verwerfen statt Modulo-Verzerrung) */
export function randomCode(){
 const limit=4200000000; // größtes Vielfaches von 10^8 unter 2^32
 for(;;){const [x]=crypto.getRandomValues(new Uint32Array(1));if(x<limit)return String(x%100000000).padStart(8,'0');}
}
/** Code nur aus Ziffern, Leerzeichen und Bindestriche erlaubt; sonst null */
export const normalizeCode=code=>{const digits=String(code??'').replace(/[\s-]/g,'');return /^\d{8}$/.test(digits)?digits:null;};
const keys=new Map();
/** HMAC-Schlüssel für einen Zweck, abgeleitet aus ACCOUNTS_SECRET (HKDF-SHA-256) */
async function purposeKey(secret,purpose){
 const id=secret+'\u0000'+purpose;
 if(keys.has(id))return keys.get(id);
 const base=await crypto.subtle.importKey('raw',enc.encode(secret),'HKDF',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('plenara-accounts-v1'),info:enc.encode(purpose)},base,{name:'HMAC',hash:'SHA-256',length:256},false,['sign']);
 keys.set(id,key);return key;
}
export async function hmacHex(secret,purpose,text){
 if(!secret||String(secret).length<32)throw new Error('ACCOUNTS_SECRET fehlt oder ist zu kurz (mindestens 32 Zeichen).');
 return hex(await crypto.subtle.sign('HMAC',await purposeKey(secret,purpose),enc.encode(String(text))));
}
