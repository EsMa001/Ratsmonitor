// Zugangssperre im Einladungsmodus (RM_ACCESS=invite, requirements/konten-konzept.md 6.5): ohne gültige Sitzung leiten
// Seiten auf /anmelden um, /api/* antwortet 401. Frei bleiben Anmeldung, Rechtstexte, interne Aufrufe (Bearer) und
// Kalender-Abos (Token). Ohne Einladungsmodus (open) und im Dev-Server lässt die Sperre alles durch.
import {accountsConfig} from './config.mjs';
import {context,currentSession} from './login.mjs';
import {validBearer} from '../integrations/prepared-access.mjs';

const FREE=[/^\/anmelden(\/|$)/,/^\/registrieren$/,/^\/api\/auth\//,/^\/api\/me$/,/^\/(impressum|datenschutz|agb|widerruf|kontakt)$/,
 /^\/api\/internal\//,/^\/api\/calendar\/feed\//,/^\/api\/dev\//];
/** Statische Dateien (Bündel, Schriften, Kartendaten, Symbole) prüft die Sperre nicht */
export const STATIC=/^\/(_next\/|fonts\/|data\/|geo\/|branchen\/|videos\/|favicon|apple-touch-icon|icon-|manifest\.webmanifest$|sw\.js$|og\.png$|robots\.txt$)/;

/** {allow:true} | {status:401} | {redirect:'/anmelden?weiter=…'} */
export async function accessDecision(request,env,{cfg=accountsConfig(env)}={}){
 if(cfg.dev||cfg.access!=='invite')return {allow:true};
 const url=new URL(request.url),path=url.pathname;
 if(STATIC.test(path)||FREE.some(r=>r.test(path)))return {allow:true};
 if(await validBearer(request.headers.get('authorization'),env?.IMPORT_TOKEN,16))return {allow:true};
 if(cfg.db&&cfg.secret){
  try{if(await currentSession(context(request,env,{cfg})))return {allow:true};}
  catch{/* Prüfung gescheitert: zu */}
 }
 if(path.startsWith('/api/'))return {status:401};
 const target=path.replace(/\.rsc$/,'')+url.search;
 return {redirect:'/anmelden?weiter='+encodeURIComponent(target)};
}
