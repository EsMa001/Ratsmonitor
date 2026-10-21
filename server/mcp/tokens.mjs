// Zugangstoken des Kunden-MCP. Die Web-App stellt sie nach der OAuth-Anmeldung aus (server/accounts/oauth.mjs), der
// MCP-Dienst prüft sie ohne Kontendatei: Inhalt und HMAC-Signatur mit MCP_TOKEN_SECRET (gemeinsam nur für Web-App und
// MCP-Dienst, /etc/ratsmonitor/mcp.env). Kurz gültig; zurückziehen lässt sich der Kunde sofort über die Kundendatei,
// das Konto über das Erneuerungstoken (oauth_grants).
import {b64url,hmacHex,randomToken} from '../accounts/crypto.mjs';

export const ACCESS_PREFIX='pat_';
export const ACCESS_TTL_S=1800;
export const SCOPE='reports.read';
const PURPOSE='mcp-access-v1';
const enc=new TextEncoder();
const fromB64url=text=>new TextDecoder().decode(Uint8Array.from(atob(String(text).replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));

/** Prüft das Geheimnis einmal beim Start (mindestens 32 Zeichen) */
export function tokenSecret(value){
 const secret=String(value||'');
 if(secret.length<32)throw new Error('MCP_TOKEN_SECRET fehlt oder ist zu kurz (mindestens 32 Zeichen).');
 return secret;
}

/** Zugangstoken für ein Konto und einen Kunden, gebunden an die Adresse des MCP (aud) */
export async function signAccessToken({secret,userId,customer,clientId,audience,now=Date.now(),ttl=ACCESS_TTL_S}){
 const iat=Math.floor(now/1000);
 const payload={v:1,sub:userId,cus:customer,cid:clientId,aud:audience,scope:SCOPE,iat,exp:iat+ttl,jti:randomToken(12)};
 const body=b64url(enc.encode(JSON.stringify(payload)));
 return {token:ACCESS_PREFIX+body+'.'+await hmacHex(tokenSecret(secret),PURPOSE,body),expiresIn:ttl};
}

/** Inhalt eines gültigen Tokens für diese Adresse, sonst null (falsche Signatur, abgelaufen, andere Adresse) */
export async function verifyAccessToken(token,{secret,audience,now=Date.now()}){
 const value=String(token||'');
 if(!value.startsWith(ACCESS_PREFIX)||value.length>2000)return null;
 const [body,signature]=value.slice(ACCESS_PREFIX.length).split('.');
 if(!body||!/^[a-f0-9]{64}$/.test(signature||''))return null;
 const expected=await hmacHex(tokenSecret(secret),PURPOSE,body);
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
 if(diff)return null;
 let payload;
 try{payload=JSON.parse(fromB64url(body));}catch{return null;}
 if(payload?.v!==1||payload.aud!==audience||payload.scope!==SCOPE||typeof payload.sub!=='string'||typeof payload.cus!=='string')return null;
 if(!Number.isInteger(payload.exp)||payload.exp<=Math.floor(now/1000))return null;
 return payload;
}
