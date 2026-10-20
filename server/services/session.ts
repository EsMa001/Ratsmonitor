import 'server-only';
import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {after} from 'next/server';
import {context,currentSession,accountState} from '../accounts/login.mjs';
import {accountsConfig,isDev} from '../accounts/config.mjs';
import {failure} from '../accounts/http.mjs';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AdminError,adminAccess} from '../integrations/admin-access.mjs';
import {FEATURES} from '@/shared/plans.mjs';
import {validBearer} from '../integrations/prepared-access.mjs';

// Sitzung, Rollen und Rechte für Routen und Seiten (requirements/konten-konzept.md, Abschnitte 5.2, 6.1, 7).
type Later=Array<()=>Promise<unknown>>;
type Handler=(ctx:ReturnType<typeof context>)=>Promise<{response:Response;later?:Later}>;

/** Arbeit nach der Antwort (Mails, alles Adressabhängige); außerhalb einer Anfrage einfach anstoßen */
export function schedule(task:()=>Promise<unknown>){
 try{after(task);}catch{Promise.resolve().then(task).catch(error=>console.error('[konten] Nacharbeit fehlgeschlagen:',error instanceof Error?error.message:String(error)));}
}
/** Hülle für Kontorouten: Kontext aus Anfrage und Umgebung, Fehler als JSON, Nacharbeit nach der Antwort */
export function accountRoute(handler:Handler){
 return async(request:Request)=>{
  try{
   const {response,later}=await handler(context(request,env));
   for(const task of later||[])schedule(task);
   return response;
  }catch(error){return failure(error);}
 };
}
/**
 * Anfrage aus den Kopfzeilen nachbauen (Seiten und requireAdmin() haben keine Request). Protokoll und Host wie bei
 * VINEXT_TRUST_PROXY aus X-Forwarded-Proto/-Host, die Caddy selbst setzt; ohne Proxy (Dev) http und Host.
 */
async function requestFromHeaders(){
 const h=await headers();
 const proto=(h.get('x-forwarded-proto')||'http').split(',')[0].trim()==='https'?'https':'http';
 const host=(h.get('host')||'localhost').trim();
 return new Request(`${proto}://${host}/`,{headers:{cookie:h.get('cookie')||'','user-agent':h.get('user-agent')||''}});
}
export type AdminState={kind:'admin'|'anonymous'|'stale'|'denied'|'setup'|'totp'|'totp-setup'|'unavailable';user?:{userId:string;displayName:string;email:string};legacy?:boolean;totpConfirmed?:boolean;adminHost?:boolean};
/**
 * Die eine Prüfung für die Administration (Routen und Seite). Admin ist, wer eine Sitzung hat, die Rolle admin,
 * eine Anmeldung jünger als 7 Tage und über einen Admin-Host kommt (ADMIN_HOSTS, nur http im Tunnel).
 * Der alte Weg über die Kopfzeilen oai-authenticated-user-* gilt nur mit ADMIN_LEGACY_HEADER=1 (Cloudflare, Übergang).
 * Im lokalen Dev-Server bleibt die Administration ohne Anmeldung offen (wie bisher).
 */
export async function adminState():Promise<AdminState>{
 if(isDev())return {kind:'admin',user:{userId:'dev-local',displayName:'Lokal (Dev)',email:'dev@localhost'}};
 const cfg=accountsConfig(env);
 let state:AdminState={kind:'anonymous'};
 if(cfg.db&&cfg.secret){
  try{
   const ctx=context(await requestFromHeaders(),env,{cfg});
   const session=await currentSession(ctx);
   if(session){
    const {admin,totpConfirmed,adminHost}=await accountState(ctx,session);
    const user={userId:session.user_id,displayName:session.name||session.email,email:session.email};
    if(admin==='ok')return {kind:'admin',user,totpConfirmed,adminHost};
    state={kind:admin==='stale'?'stale':admin==='totp'?'totp':admin==='setup'?'totp-setup':'denied',user};
   }
  }catch(error){if(!cfg.legacyHeader)return {kind:'unavailable'};console.error('[konten] Admin-Prüfung über Konten fehlgeschlagen:',error instanceof Error?error.message:String(error));}
 }
 if(cfg.legacyHeader){
  const user=await getChatGPTUser();
  if(user){
   const access=await adminAccess(env.DB,user);
   if(access.kind==='owner')return {kind:'admin',user:{userId:user.userId,displayName:user.displayName,email:user.email},legacy:true};
   if(state.kind==='anonymous')return {kind:access.kind==='setup'?'setup':'denied',user:{userId:user.userId,displayName:user.displayName,email:user.email},legacy:true};
  }
 }
 return state;
}
export async function requireAdmin(){
 const state=await adminState();
 if(state.kind==='admin')return state.user!;
 if(state.kind==='unavailable')throw new AdminError(503,'Die Zugangsprüfung ist gerade nicht erreichbar.');
 if(state.kind==='anonymous')throw new AdminError(401,'Bitte anmelden.');
 if(state.kind==='stale')throw new AdminError(401,'Bitte neu anmelden (Admin-Anmeldung älter als 7 Tage).');
 if(state.kind==='totp')throw new AdminError(401,'Bitte den Code aus der Authenticator-App eingeben (/admin).');
 if(state.kind==='totp-setup')throw new AdminError(403,'Der zweite Faktor ist noch nicht eingerichtet (einmal über den Tunnel).');
 if(state.kind==='setup')throw new AdminError(403,'Der Admin-Zugang muss zuerst freigeschaltet werden.');
 throw new AdminError(403,'Kein Zugriff auf die Administration.');
}
/**
 * Stufe und Funktionen der Anfrage (Gäste ohne Sitzung). Liest nur. accounts:false heißt: auf dieser Umgebung gibt es
 * keine Konten (Cloudflare-Build, Server ohne Kontendatei); dann gelten keine Stufengrenzen, alles bleibt wie früher.
 */
export async function requestTier(request:Request){
 const cfg=accountsConfig(env);
 const guest={accounts:true,tier:'guest',features:FEATURES.guest,userId:null as string|null};
 if(!cfg.db||!cfg.secret)return {...guest,accounts:false};
 try{
  const ctx=context(request,env,{cfg});
  const session=await currentSession(ctx);
  if(!session)return guest;
  const {tier}=await accountState(ctx,session);
  // Admins mit „Ansehen als Stufe“ bekommen hier die angesehene Stufe (tier.tier), damit sie sehen, was Nutzer sehen
  return {accounts:true,tier:tier.tier,features:(FEATURES as Record<string,typeof FEATURES.guest>)[tier.tier],userId:session.user_id as string|null};
 }catch{return guest;}
}

// ---------------------------------------------------------------- Zugang (Einladungsmodus) und Stufen in Datenrouten
const DENY={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
/** Interne Aufrufe (serve.mjs wärmt vor, Runner): Bearer IMPORT_TOKEN, mindestens 16 Zeichen */
export async function internalCall(request:Request){
 return validBearer(request.headers.get('authorization'),env.IMPORT_TOKEN,16);
}
/**
 * Zweite Linie hinter der Middleware: im Einladungsmodus nur mit Sitzung; mit feature nur, wenn die Stufe es erlaubt.
 * Liefert eine Antwort zum Abweisen oder null. Interne Aufrufe kommen immer durch.
 */
export async function guard(request:Request,{feature}:{feature?:'analytics'|'calendar'}={}){
 if(await internalCall(request))return null;
 const cfg=accountsConfig(env);
 const t=await requestTier(request);
 if(cfg.access==='invite'&&!t.userId&&!cfg.dev)return Response.json({error:'Bitte anmelden.'},{status:401,headers:DENY});
 if(t.accounts&&feature&&!(t.features as Record<string,unknown>)[feature])return Response.json({error:'Diese Funktion gehört zu einer höheren Stufe.',feature,tier:t.tier},{status:403,headers:DENY});
 return null;
}
/** Route mit Prüfung; öffentliche Zwischenspeicher-Angaben werden privat, weil die Antwort an der Stufe hängt */
export function gated<A extends unknown[]>(handler:(request:Request,...rest:A)=>Promise<Response>,options:{feature?:'analytics'|'calendar'}={}){
 return async(request:Request,...rest:A)=>{
  const denied=await guard(request,options);
  if(denied)return denied;
  const response=await handler(request,...rest);
  const cache=response.headers.get('Cache-Control');
  if(cache&&/\bpublic\b/.test(cache)){
   const headers=new Headers(response.headers);
   headers.set('Cache-Control',cache.replace(/\bpublic\b/,'private'));headers.append('Vary','Cookie');
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return response;
 };
}
