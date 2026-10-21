// OAuth 2.1 für den Kunden-MCP: die Web-App ist der Anmeldedienst (docs/betrieb/claude-mcp-einbindung.md).
// Ablauf: Client registriert sich (RFC 7591) → /oauth/authorize prüft und leitet auf /verbinden → angemeldetes Konto
// stimmt zu (POST /api/oauth/decide) → Code (5 Minuten, einmal, PKCE S256) → /oauth/token gibt Zugangstoken (30 Minuten,
// signiert, server/mcp/tokens.mjs) und Erneuerungstoken (30 Tage, rotierend). Zustimmen darf nur ein Konto, das der
// Betreiber in der Kundendatei einem Kunden zugeordnet hat; Gebiete und Grenzen stehen nur dort.
import {randomToken,sha256hex,sealText,openText,b64url} from './crypto.mjs';
import {AccountError,respond,requireSameOrigin,readJson} from './http.mjs';
import {siteBase} from './config.mjs';
import {limitedAll} from './rate-limit.mjs';
import {currentSession} from './login.mjs';
import {eventStatement} from './sessions.mjs';
import {customerStore} from '../mcp/customers.mjs';
import {signAccessToken,SCOPE} from '../mcp/tokens.mjs';
import {CATALOG} from '../../shared/catalog.mjs';

const DAY=86400000;
export const CODE_MS=5*60000,REQUEST_MS=30*60000,REFRESH_MS=30*DAY;
const iso=ms=>new Date(ms).toISOString();
const REGION_NAMES=new Map(CATALOG.map(r=>[r.id,r.name]));
const VERIFIER=/^[A-Za-z0-9._~-]{43,128}$/;
const CHALLENGE=/^[A-Za-z0-9_-]{43}$/;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'};

export class OAuthError extends Error{constructor(error,description,status=400){super(description);this.error=error;this.status=status;}}
const oauthJson=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache',...CORS,...headers}});
/** Fehler im Format von RFC 6749; unerwartete Fehler ohne Einzelheiten */
export function oauthFailure(error){
 if(error instanceof OAuthError)return oauthJson({error:error.error,error_description:error.message},error.status,error.status===401?{'WWW-Authenticate':'Basic realm="plenara"'}:{});
 if(error instanceof AccountError)return oauthJson({error:error.status===429?'slow_down':'invalid_request',error_description:error.message},error.status);
 console.error('[oauth]',error instanceof Error?error.message:String(error));
 return oauthJson({error:'server_error',error_description:'Das hat gerade nicht geklappt. Bitte erneut versuchen.'},503);
}
export const preflight=()=>new Response(null,{status:204,headers:CORS});

const stores=new Map();
/** Adresse, Geheimnis und Kundendatei; ohne Einrichtung antwortet alles mit 503 */
export function oauthSetup(ctx){
 const issuer=siteBase(ctx.cfg,ctx.request);
 if(!issuer||!ctx.cfg.mcp?.secret||!ctx.cfg.mcp?.customersFile)throw new OAuthError('temporarily_unavailable','Der Zugang für KI-Assistenten ist auf diesem Server nicht eingerichtet.',503);
 const file=ctx.cfg.mcp.customersFile;
 if(!stores.has(file))stores.set(file,customerStore(file));
 return {issuer,resource:issuer+'/mcp',secret:ctx.cfg.mcp.secret,customers:stores.get(file)};
}

// ---------------------------------------------------------------- Registrierung (RFC 7591)
const LOOPBACK=new Set(['localhost','127.0.0.1','[::1]']);
/** Erlaubte Rücksprungadressen: https, http nur auf dem eigenen Rechner, eigene App-Schemata mit Punkt (RFC 8252) */
export function validRedirect(value){
 if(typeof value!=='string'||value.length>500||/[\u0000- \u007f]/.test(value))return false;
 let url;try{url=new URL(value);}catch{return false;}
 if(url.hash||url.username||url.password)return false;
 if(url.protocol==='https:')return !!url.hostname;
 if(url.protocol==='http:')return LOOPBACK.has(url.hostname);
 return /^[a-z][a-z0-9+-]*(\.[a-z0-9+-]+)+:$/.test(url.protocol);
}
const cleanName=value=>String(value??'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,100)||'Unbenannte Anwendung';

export async function register(ctx){
 oauthSetup(ctx);
 if(limitedAll('oauth-register',ctx.ip,[{max:20,windowMs:3600000}],ctx.now))throw new OAuthError('slow_down','Zu viele Registrierungen. Bitte später erneut.',429);
 let body;
 try{body=await readJson(ctx.request,16384);}catch{throw new OAuthError('invalid_client_metadata','Ungültige Angaben (JSON erwartet).');}
 const uris=body.redirect_uris;
 if(!Array.isArray(uris)||!uris.length||uris.length>5||!uris.every(validRedirect))
  throw new OAuthError('invalid_redirect_uri','redirect_uris: 1 bis 5 Adressen; https, http nur für localhost, oder ein eigenes App-Schema.');
 const grants=body.grant_types??['authorization_code','refresh_token'],types=body.response_types??['code'];
 if(!Array.isArray(grants)||!grants.every(g=>['authorization_code','refresh_token'].includes(g))||!Array.isArray(types)||!types.every(t=>t==='code'))
  throw new OAuthError('invalid_client_metadata','Nur authorization_code und refresh_token mit response_type code.');
 const method=body.token_endpoint_auth_method??'none';
 if(!['none','client_secret_post','client_secret_basic'].includes(method))throw new OAuthError('invalid_client_metadata','token_endpoint_auth_method: none, client_secret_post oder client_secret_basic.');
 const id='oc_'+randomToken(16),name=cleanName(body.client_name),secret=method==='none'?null:'pcs_'+randomToken(32);
 await ctx.db.prepare('INSERT INTO oauth_clients(id,name,redirect_uris,auth_method,secret_hash,created_at) VALUES(?,?,?,?,?,?)')
  .bind(id,name,JSON.stringify([...new Set(uris)]),method,secret?await sha256hex(secret):null,iso(ctx.now)).run();
 return {response:oauthJson({client_id:id,client_id_issued_at:Math.floor(ctx.now/1000),client_name:name,redirect_uris:[...new Set(uris)],
  grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:method,
  ...(secret?{client_secret:secret,client_secret_expires_at:0}:{})},201)};
}

async function clientById(db,id){
 if(typeof id!=='string'||!/^oc_[A-Za-z0-9_-]{22}$/.test(id))return null;
 const row=await db.prepare('SELECT id,name,redirect_uris,auth_method,secret_hash FROM oauth_clients WHERE id=?').bind(id).first();
 return row?{...row,redirectUris:JSON.parse(row.redirect_uris)}:null;
}

// ---------------------------------------------------------------- Zustimmung
const textPage=(status,text)=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
function redirectTo(base,params){
 const url=new URL(base);
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,v);
 return url.toString();
}

/** GET /oauth/authorize: Anfrage prüfen, versiegeln und zur Zustimmungsseite /verbinden weiterleiten */
export async function authorize(ctx){
 const {issuer,resource}=oauthSetup(ctx);
 const p=ctx.url.searchParams,client=await clientById(ctx.db,p.get('client_id'));
 // Ohne bekannten Client oder passende Rücksprungadresse nie weiterleiten (offene Weiterleitung)
 if(!client)return {response:textPage(400,'Unbekannte Anwendung. Bitte die Verbindung in der Anwendung neu einrichten.')};
 const redirect=p.get('redirect_uri')||(client.redirectUris.length===1?client.redirectUris[0]:'');
 if(!client.redirectUris.includes(redirect))return {response:textPage(400,'Die Rücksprungadresse passt nicht zur Anwendung.')};
 const state=p.get('state')||'',back=params=>({response:Response.redirect(redirectTo(redirect,{...params,state,iss:issuer}),302)});
 if(state.length>1000)return back({error:'invalid_request',error_description:'state zu lang'});
 if(p.get('response_type')!=='code')return back({error:'unsupported_response_type'});
 if(p.get('code_challenge_method')!=='S256'||!CHALLENGE.test(p.get('code_challenge')||''))return back({error:'invalid_request',error_description:'PKCE mit S256 ist erforderlich.'});
 const target=(p.get('resource')||resource).replace(/\/+$/,'');
 if(target!==resource)return back({error:'invalid_target',error_description:'Unbekannte Ressource.'});
 const sealed=await sealText(ctx.cfg.secret,'oauth-request',JSON.stringify({c:client.id,r:redirect,ch:p.get('code_challenge'),s:state,exp:ctx.now+REQUEST_MS}));
 return {response:Response.redirect(new URL('/verbinden?anfrage='+encodeURIComponent(sealed),issuer).toString(),302)};
}

async function openRequest(ctx,value){
 let r;
 try{r=JSON.parse(await openText(ctx.cfg.secret,'oauth-request',String(value||'')));}catch{r=null;}
 if(!r||typeof r.exp!=='number'||r.exp<=ctx.now)throw new AccountError(400,'Diese Anfrage ist abgelaufen. Bitte die Verbindung in der Anwendung neu starten.');
 const client=await clientById(ctx.db,r.c);
 if(!client||!client.redirectUris.includes(r.r))throw new AccountError(400,'Unbekannte Anwendung.');
 return {r,client};
}
const describe=c=>({identity:c.identity,name:c.name,regionCount:c.allowedRegionIds.length,
 regions:c.allowedRegionIds.slice(0,12).map(id=>REGION_NAMES.get(id)||id)});

/** GET /api/oauth/request?anfrage=…: Anwendung, Rücksprungziel und die Kunden, für die dieses Konto zustimmen darf */
export async function requestInfo(ctx){
 const {customers}=oauthSetup(ctx);
 const {r,client}=await openRequest(ctx,ctx.url.searchParams.get('anfrage'));
 const app={name:client.name,host:new URL(r.r).host||new URL(r.r).protocol};
 const session=await currentSession(ctx);
 if(!session)return {response:respond({signedIn:false,app})};
 return {response:respond({signedIn:true,app,scope:SCOPE,customers:customers.forAccount(session.user_id).map(describe)})};
}

/** POST /api/oauth/decide {anfrage, allow, customer}: Zustimmung oder Ablehnung; Antwort ist die Rücksprungadresse */
export async function decide(ctx){
 requireSameOrigin(ctx.request);
 const {issuer,resource,customers}=oauthSetup(ctx);
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Bitte anmelden.');
 if(limitedAll('oauth-decide',session.user_id,[{max:20,windowMs:600000}],ctx.now))throw new AccountError(429,'Zu viele Versuche. Bitte kurz warten.');
 const body=await readJson(ctx.request,8192);
 const {r,client}=await openRequest(ctx,body.anfrage);
 if(body.allow!==true)return {response:respond({redirect:redirectTo(r.r,{error:'access_denied',state:r.s,iss:issuer})})};
 const allowed=customers.forAccount(session.user_id);
 const chosen=allowed.find(c=>c.identity===body.customer)||(allowed.length===1&&!body.customer?allowed[0]:null);
 if(!chosen)throw new AccountError(403,'Für dieses Konto ist dieser Zugang nicht freigeschaltet.');
 const code=randomToken(32);
 await ctx.db.batch([
  ctx.db.prepare('INSERT INTO oauth_codes(id,client_id,user_id,customer,redirect_uri,code_challenge,resource,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
   .bind(await sha256hex(code),client.id,session.user_id,chosen.identity,r.r,r.ch,resource,iso(ctx.now),iso(ctx.now+CODE_MS)),
  eventStatement(ctx.db,{userId:session.user_id,kind:'oauth_consent',detail:{client:client.id,customer:chosen.identity},now:ctx.now}),
 ]);
 return {response:respond({redirect:redirectTo(r.r,{code,state:r.s,iss:issuer})})};
}

// ---------------------------------------------------------------- Token (RFC 6749, PKCE RFC 7636)
async function formBody(request){
 const type=(request.headers.get('content-type')||'').toLowerCase();
 if(Number(request.headers.get('content-length')||0)>16384)throw new OAuthError('invalid_request','Anfrage zu groß.');
 const text=await request.text();
 if(text.length>16384)throw new OAuthError('invalid_request','Anfrage zu groß.');
 if(type.startsWith('application/json')){try{const v=JSON.parse(text);return new URLSearchParams(Object.entries(v||{}).map(([k,x])=>[k,String(x)]));}catch{throw new OAuthError('invalid_request','Ungültige Anfrage.');}}
 return new URLSearchParams(text);
}
/** Client aus Basic-Kopfzeile oder Formular; öffentliche Clients nur mit client_id */
async function authenticateClient(ctx,form){
 let id=form.get('client_id'),secret=form.get('client_secret'),basic=false;
 const header=ctx.request.headers.get('authorization')||'';
 if(/^Basic /i.test(header)){
  try{const [u,s]=atob(header.slice(6).trim()).split(':');id=decodeURIComponent(u);secret=decodeURIComponent(s||'');basic=true;}catch{throw new OAuthError('invalid_client','Ungültige Client-Anmeldung.',401);}
 }
 const client=await clientById(ctx.db,id);
 if(!client)throw new OAuthError('invalid_client','Unbekannter Client.',401);
 // Vertrauliche Clients: Geheimnis per Basic oder Formular, gleich wie registriert angegeben
 if(client.auth_method!=='none'){
  if(!secret)throw new OAuthError('invalid_client','Client-Geheimnis fehlt.',401);
  if(await sha256hex(secret)!==client.secret_hash)throw new OAuthError('invalid_client','Client-Geheimnis falsch.',401);
 }else if(basic&&secret)throw new OAuthError('invalid_client','Dieser Client ist öffentlich und hat kein Geheimnis.',401);
 return client;
}
const pkce=async verifier=>b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));

async function issue(ctx,setup,{clientId,userId,customer,family}){
 const user=await ctx.db.prepare("SELECT status FROM users WHERE id=?").bind(userId).first();
 if(user?.status!=='active')throw new OAuthError('invalid_grant','Das Konto ist gesperrt oder gelöscht.');
 if(!setup.customers.forAccount(userId).some(c=>c.identity===customer))throw new OAuthError('invalid_grant','Der Zugang ist für dieses Konto nicht mehr freigeschaltet.');
 const access=await signAccessToken({secret:setup.secret,userId,customer,clientId,audience:setup.resource,now:ctx.now});
 const refresh='prt_'+randomToken(32);
 await ctx.db.batch([
  ctx.db.prepare('INSERT INTO oauth_grants(id,family,client_id,user_id,customer,resource,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
   .bind(await sha256hex(refresh),family,clientId,userId,customer,setup.resource,iso(ctx.now),iso(ctx.now+REFRESH_MS)),
  ctx.db.prepare('UPDATE oauth_clients SET last_used_at=? WHERE id=?').bind(iso(ctx.now),clientId),
 ]);
 return oauthJson({access_token:access.token,token_type:'Bearer',expires_in:access.expiresIn,refresh_token:refresh,scope:SCOPE});
}

/** POST /oauth/token */
export async function token(ctx){
 const setup=oauthSetup(ctx);
 if(limitedAll('oauth-token',ctx.ip,[{max:120,windowMs:600000}],ctx.now))throw new OAuthError('slow_down','Zu viele Anfragen. Bitte kurz warten.',429);
 const form=await formBody(ctx.request),client=await authenticateClient(ctx,form);
 const grant=form.get('grant_type'),at=iso(ctx.now);
 const resource=form.get('resource');
 if(resource&&resource.replace(/\/+$/,'')!==setup.resource)throw new OAuthError('invalid_target','Unbekannte Ressource.');
 if(grant==='authorization_code'){
  const code=form.get('code')||'',verifier=form.get('code_verifier')||'';
  if(!VERIFIER.test(verifier))throw new OAuthError('invalid_grant','code_verifier fehlt oder ist ungültig.');
  const id=await sha256hex(code);
  const row=await ctx.db.prepare('UPDATE oauth_codes SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? AND client_id=? RETURNING user_id,customer,redirect_uri,code_challenge')
   .bind(at,id,at,client.id).first();
  if(!row){
   // Schon eingelöster Code: alles, was mit ihm ausgegeben wurde, zurückziehen (RFC 6749 4.1.2)
   await ctx.db.prepare('UPDATE oauth_grants SET revoked_at=? WHERE family=? AND revoked_at IS NULL').bind(at,id).run();
   throw new OAuthError('invalid_grant','Code ungültig, abgelaufen oder schon benutzt.');
  }
  if((form.get('redirect_uri')||row.redirect_uri)!==row.redirect_uri)throw new OAuthError('invalid_grant','Rücksprungadresse passt nicht.');
  if(await pkce(verifier)!==row.code_challenge)throw new OAuthError('invalid_grant','PKCE-Prüfung fehlgeschlagen.');
  return {response:await issue(ctx,setup,{clientId:client.id,userId:row.user_id,customer:row.customer,family:id})};
 }
 if(grant==='refresh_token'){
  const id=await sha256hex(form.get('refresh_token')||'');
  const row=await ctx.db.prepare('SELECT family,client_id,user_id,customer,expires_at,used_at,revoked_at FROM oauth_grants WHERE id=?').bind(id).first();
  if(!row||row.client_id!==client.id||row.revoked_at||row.expires_at<=at)throw new OAuthError('invalid_grant','Erneuerungstoken ungültig oder abgelaufen.');
  const used=await ctx.db.prepare('UPDATE oauth_grants SET used_at=? WHERE id=? AND used_at IS NULL RETURNING id').bind(at,id).first();
  if(!used){
   // Wiederverwendet: jemand anderes hat das Token. Ganze Kette ungültig.
   await ctx.db.prepare('UPDATE oauth_grants SET revoked_at=? WHERE family=? AND revoked_at IS NULL').bind(at,row.family).run();
   throw new OAuthError('invalid_grant','Erneuerungstoken wurde schon benutzt.');
  }
  return {response:await issue(ctx,setup,{clientId:client.id,userId:row.user_id,customer:row.customer,family:row.family})};
 }
 throw new OAuthError('unsupported_grant_type','Nur authorization_code und refresh_token.');
}

/** POST /oauth/revoke (RFC 7009): Erneuerungstoken mit seiner ganzen Kette; Zugangstoken laufen nach 30 Minuten ab */
export async function revoke(ctx){
 oauthSetup(ctx);
 const form=await formBody(ctx.request);
 const value=form.get('token')||'';
 if(value.startsWith('prt_')){
  const row=await ctx.db.prepare('SELECT family FROM oauth_grants WHERE id=?').bind(await sha256hex(value)).first();
  if(row)await ctx.db.prepare('UPDATE oauth_grants SET revoked_at=? WHERE family=? AND revoked_at IS NULL').bind(iso(ctx.now),row.family).run();
 }
 return {response:oauthJson({})};
}

/** Verbundene Anwendungen eines Kontos (Datenauskunft): eine Zeile je Anmeldung, nur noch gültige */
export async function connectedApps(db,userId,{now=Date.now()}={}){
 const {results}=await db.prepare(`SELECT c.name,g.customer,min(g.created_at) since,max(g.created_at) last FROM oauth_grants g JOIN oauth_clients c ON c.id=g.client_id
   WHERE g.user_id=? AND g.revoked_at IS NULL AND g.expires_at>? GROUP BY g.family ORDER BY last DESC`).bind(userId,iso(now)).all();
 return results||[];
}
