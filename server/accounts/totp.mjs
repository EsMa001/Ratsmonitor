// Zweiter Faktor für die Administration über die öffentliche Adresse (requirements/konten-konzept.md, 6.4): zeitbasierte
// Einmalcodes nach RFC 6238 (HMAC-SHA1, 30 Sekunden, 6 Ziffern), wie sie Google Authenticator, 1Password oder Aegis
// erzeugen. Der Schlüssel liegt verschlüsselt in user_totp (AES-GCM, Schlüssel aus ACCOUNTS_SECRET); jeder Code gilt nur
// einmal (last_step), erlaubt ist eine Abweichung der Uhr um einen Schritt.
import {sealText,openText} from './crypto.mjs';

export const STEP_SECONDS=30,DIGITS=6,SEAL='totp-v1';
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes){
 let bits=0,value=0,out='';
 for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5;}}
 if(bits>0)out+=ALPHABET[(value<<(5-bits))&31];
 return out;
}
export function base32Decode(text){
 const clean=String(text).toUpperCase().replace(/[\s=-]/g,'');
 let bits=0,value=0;const out=[];
 for(const c of clean){const i=ALPHABET.indexOf(c);if(i<0)throw new Error('Ungültiger Schlüssel');value=(value<<5)|i;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}
 return new Uint8Array(out);
}
/** Code für einen Zeitschritt (RFC 4226, dynamische Kürzung) */
export async function hotp(secretBytes,counter){
 const message=new Uint8Array(8);let c=BigInt(counter);
 for(let i=7;i>=0;i--){message[i]=Number(c&255n);c>>=8n;}
 const key=await crypto.subtle.importKey('raw',secretBytes,{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,message));
 const offset=mac[mac.length-1]&15;
 const number=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];
 return String(number%10**DIGITS).padStart(DIGITS,'0');
}
export const stepOf=now=>Math.floor(now/1000/STEP_SECONDS);
/** Passender Zeitschritt (aktuell ±1), der jünger ist als lastStep; sonst null. Vergleich ohne frühen Abbruch. */
export async function matchStep(secretBytes,code,{now=Date.now(),lastStep=0}={}){
 if(!/^\d{6}$/.test(String(code)))return null;
 const current=stepOf(now);let found=null;
 for(const step of [current-1,current,current+1]){
  const expected=await hotp(secretBytes,step);
  let diff=0;for(let i=0;i<DIGITS;i++)diff|=expected.charCodeAt(i)^String(code).charCodeAt(i);
  if(diff===0&&step>lastStep&&found===null)found=step;
 }
 return found;
}
export const newSecret=()=>crypto.getRandomValues(new Uint8Array(20));
/** otpauth-Link für die Authenticator-App */
export const otpauthUri=(base32,account,issuer='Plenara')=>`otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${base32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
export const sealSecret=(accountsSecret,base32)=>sealText(accountsSecret,SEAL,base32);
export const openSecret=async(accountsSecret,sealed)=>base32Decode(await openText(accountsSecret,SEAL,sealed));
