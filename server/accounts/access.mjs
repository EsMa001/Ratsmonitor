// Zugangssperre im Einladungsmodus (RM_ACCESS=invite, requirements/konten-konzept.md 6.5): ohne gültige Sitzung leiten
// Seiten auf /anmelden um, /api/* antwortet 401. Frei bleiben Anmeldung, Rechtstexte, interne Aufrufe (Bearer) und
// Kalender-Abos (Token). Ohne Einladungsmodus (open) und im Dev-Server lässt die Sperre alles durch.
import {accountsConfig} from './config.mjs';
import {context,currentSession,accountState} from './login.mjs';
import {validBearer} from '../integrations/prepared-access.mjs';

const FREE=[/^\/anmelden(\/|$)/,/^\/registrieren$/,/^\/api\/auth\//,/^\/api\/me$/,/^\/(impressum|datenschutz|agb|widerruf|kontakt)$/,
 /^\/api\/internal\//,/^\/api\/calendar\/feed\//,/^\/api\/dev\//,
 // Benachrichtigungen abbestellen per Token aus der Mail (server/accounts/notify.mjs), auch ohne Sitzung
 /^\/abbestellen$/,/^\/api\/notify\/unsubscribe$/,
 // Erreichbarkeitsprüfung für einen Uptime-Dienst (server/integrations/health.mjs): keine Daten, keine Personen, nur lesend
 /^\/api\/health$/,
 // Meldungen von Stripe (server/accounts/billing.mjs): ohne Sitzung, berechtigt ist die Signatur
 /^\/api\/billing\/webhook$/,
 // Kündigungsbutton nach § 312k BGB (server/accounts/cancel.mjs): muss ohne Anmeldung erreichbar sein
 /^\/kuendigen$/,/^\/api\/billing\/cancel$/,
 // OAuth für den Kunden-MCP: Registrierung, Token und Widerruf rufen Anwendungen ohne Sitzung auf; die Zustimmung
 // (/verbinden, /api/oauth/*) verlangt weiter eine Anmeldung
 /^\/oauth\/(authorize|token|register|revoke)$/];
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

/**
 * Admin-Protokoll (konten-konzept.md 6.1): jede ändernde Anfrage an /api/admin/* zählt je Konto, Pfad, Methode und Stunde
 * eine Zeile hoch (admin_audit, 12 Monate). Nur IDs, keine Adressen, kein Inhalt. Fehler stören die Anfrage nie.
 */
export async function auditAdmin(request,env,{cfg=accountsConfig(env),now=Date.now()}={}){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/admin/')||['GET','HEAD','OPTIONS'].includes(request.method)||cfg.dev||!cfg.db||!cfg.secret)return false;
 try{
  const ctx=context(request,env,{cfg,now});
  const session=await currentSession(ctx);
  const user=session?((await accountState(ctx,session)).adminHere?session.user_id:null):(cfg.legacyHeader?'legacy':null);
  if(!user)return false;
  const at=new Date(now).toISOString(),hour=at.slice(0,13);
  await cfg.db.prepare(`INSERT INTO admin_audit(at,user_id,method,path,action,hour,count) VALUES(?,?,?,?,?,?,1)
    ON CONFLICT(user_id,path,action,hour) WHERE hour IS NOT NULL DO UPDATE SET count=count+1,at=excluded.at`)
   .bind(at,user,request.method,url.pathname.slice(0,200),request.method,hour).run();
  return true;
 }catch{return false;}
}
