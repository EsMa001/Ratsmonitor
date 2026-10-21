// Anmelden und Registrieren per E-Mail-Link oder Code (requirements/konten-konzept.md, Abschnitte 5.1 bis 5.3, 11).
// Grundsätze: Antwort und synchrone Arbeit sind für bekannte, unbekannte, gesperrte und eingeladene Adressen gleich;
// alles, was von der Adresse abhängt, läuft nach der Antwort (later). Tokens und Codes nur als Hash, einmal einlösbar.
import {randomToken,randomId,sha256hex,randomCode,normalizeCode,hmacHex} from './crypto.mjs';
import {AccountError,respond,requireSameOrigin,readJson,parseCookies,cookieNames,setCookie,clientIp,deviceLabel} from './http.mjs';
import {accountsConfig,siteBase,mailLogin} from './config.mjs';
import {limitedAll} from './rate-limit.mjs';
import {createSession,readSession,refreshSession,renewDue,effectiveTier,rolesOf,eventStatement,ADMIN_AUTH_MAX_MS} from './sessions.mjs';
import {sendMail,processOutbox} from './mail.mjs';
import {safeNext} from '../../shared/safe-next.mjs';
import {AGB_VERSION,PRIVACY_VERSION} from '../../shared/legal-versions.mjs';
import {FEATURES,limitsJson,validTier,rank} from '../../shared/plans.mjs';

export const TOKEN_MS=15*60000,FLOW_MS=15*60000;
const DAY=86400000;
const iso=ms=>new Date(ms).toISOString();
export const SENT_TEXT='Wenn die Adresse für Plenara freigeschaltet ist, kommt in wenigen Minuten eine E-Mail mit Link und Code.';
const EXPIRED='Link oder Code abgelaufen oder schon benutzt. Bitte neu anfordern.';
const NEW_CODE='Bitte einen neuen Code anfordern.';
const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;

/** Adresse vereinheitlichen; ungültig → null */
export function normalizeEmail(value){
 const email=String(value??'').trim().normalize('NFC').toLowerCase();
 if(email.length>254||!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(email))return null;
 if(email.split('@')[0].length>64)return null;
 return email;
}
/** Gemeinsamer Zustand einer Anfrage */
export function context(request,env,{now=Date.now(),cfg=accountsConfig(env)}={}){
 if(!cfg.db)throw new AccountError(503,'Konten sind auf diesem Server nicht eingerichtet.');
 if(!cfg.secret)throw new AccountError(503,'Konten sind auf diesem Server nicht vollständig eingerichtet.');
 const url=new URL(request.url);
 return {request,cfg,db:cfg.db,content:env?.DB,now,url,names:cookieNames({protocol:url.protocol,dev:cfg.dev}),cookies:parseCookies(request.headers.get('cookie')),ip:clientIp(request)};
}
export const isAdminHost=(ctx)=>ctx.url.protocol==='http:'&&ctx.cfg.adminHosts.includes(ctx.url.host.toLowerCase());
const authLimited=ctx=>limitedAll('auth',ctx.ip,[{max:30,windowMs:15*60000}],ctx.now);

/** Sitzung aus dem Cookie dieses Protokolls (über https nur __Host-) */
export async function currentSession(ctx){
 return readSession(ctx.db,ctx.cookies.get(ctx.names.session),{now:ctx.now});
}

// ---------------------------------------------------------------- Link anfordern
export async function requestLink(ctx){
 requireSameOrigin(ctx.request);
 // Ohne Mailversand käme nie eine Mail an (Notzugang: ratsmonitor-accounts login-link, Admins: Code aus der App)
 if(!mailLogin(ctx.cfg))throw new AccountError(503,'Die Anmeldung per E-Mail ist noch nicht freigeschaltet.');
 const body=await readJson(ctx.request,2048);
 const email=normalizeEmail(body.email);
 if(!email)throw new AccountError(400,'Bitte eine gültige E-Mail-Adresse eingeben.');
 const site=siteBase(ctx.cfg,ctx.request);
 if(!site)throw new AccountError(503,'Die Anmeldung ist auf diesem Server noch nicht eingerichtet.');
 const next=safeNext(typeof body.next==='string'?body.next:'/');
 const {db,now,names}=ctx,at=iso(now);
 const emailHmac=await hmacHex(ctx.cfg.secret,'email-rate',email);
 const response202=cookies=>respond({ok:true,message:SENT_TEXT},{status:202,cookies});
 // Über der Grenze des Absenders: gleiche Antwort, aber nichts schreiben (sonst verbrauchte ein Absender das Kontingent
 // einer fremden Adresse und entwertete laufend ihren Link)
 if(limitedAll('link',ctx.ip,[{max:5,windowMs:15*60000},{max:20,windowMs:DAY}],now))return {response:response202([]),later:[]};
 const ipHmac=await hmacHex(ctx.cfg.secret,'ip-rate',ctx.ip);
 // Je Adresse und Absender 3 in 15 Minuten und 10 am Tag, je Adresse insgesamt 30 am Tag: ein fremder Absender kann
 // die eigenen Links einer Person so nicht aufbrauchen
 const counts=await db.prepare('SELECT coalesce(sum(at>? AND ip_hmac=?),0) recent,coalesce(sum(ip_hmac=?),0) mine,count(*) day FROM login_requests WHERE email_hmac=? AND at>?')
  .bind(iso(now-15*60000),ipHmac,ipHmac,emailHmac,iso(now-DAY)).first();
 const overLimit=Number(counts?.recent||0)>=3||Number(counts?.mine||0)>=10||Number(counts?.day||0)>=30;
 // Flow-Cookie: im selben Browser für dieselbe Adresse weiterverwenden (der Code gilt nur mit ihm)
 let flowValue=ctx.cookies.get(names.flow),flowHash=TOKEN_RE.test(flowValue||'')?await sha256hex(flowValue):null;
 const flow=flowHash?await db.prepare('SELECT email_hmac,expires_at FROM login_flows WHERE id=?').bind(flowHash).first():null;
 const statements=[db.prepare('INSERT INTO login_requests(email_hmac,ip_hmac,at) VALUES(?,?,?)').bind(emailHmac,ipHmac,at)];
 // Jeder neue Link bekommt einen neuen Ablauf (der Code gilt nur mit ihm); der alte behält seine Fehlversuche, die
 // zur Tagesgrenze je Adresse zählen. Nur ohne neuen Link (Grenze erreicht) bleibt der bisherige Ablauf.
 if(!flow||flow.email_hmac!==emailHmac||flow.expires_at<=at||!overLimit){
  flowValue=randomToken(32);flowHash=await sha256hex(flowValue);
  statements.push(db.prepare('INSERT INTO login_flows(id,email_hmac,attempts,created_at,expires_at) VALUES(?,?,0,?,?)').bind(flowHash,emailHmac,at,iso(now+FLOW_MS)));
 }else statements.push(db.prepare('UPDATE login_flows SET expires_at=? WHERE id=?').bind(iso(now+FLOW_MS),flowHash));
 await db.batch(statements);
 const response=response202([setCookie(names.flow,flowValue,{maxAge:FLOW_MS/1000,secure:names.secure,sameSite:'Strict'})]);
 const later=overLimit?[]:[()=>issueLoginToken(ctx,{email,next,flowHash,site})];
 return {response,later};
}
/** Nach der Antwort: Zweck bestimmen, Token und Code anlegen, Mail einreihen und verschicken */
export async function issueLoginToken(ctx,{email,next,flowHash,site}){
 const {db,cfg,now}=ctx,at=iso(now);
 const user=await db.prepare('SELECT id,status FROM users WHERE email=?').bind(email).first();
 let purpose=null;
 if(user){if(user.status!=='active')return null;purpose='login';}
 else{
  const invite=await db.prepare('SELECT 1 x FROM invites WHERE email=? AND expires_at>?').bind(email,at).first();
  if(invite||(cfg.access==='open'&&cfg.openSignup))purpose='signup';
  else return null;
 }
 const token=randomToken(32),code=randomCode();
 const id=await sha256hex(token),codeHash=await sha256hex(purpose+'|'+flowHash+'|'+code);
 await db.batch([
  // Immer nur ein offenes Token je Adresse: ältere Anmeldelinks und -codes werden ungültig
  db.prepare("DELETE FROM login_tokens WHERE email=? AND purpose IN ('login','signup') AND used_at IS NULL").bind(email),
  db.prepare('INSERT INTO login_tokens(id,flow_hash,code_hash,email,purpose,user_id,next,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,flowHash,codeHash,email,purpose,user?.id??null,next,at,iso(now+TOKEN_MS)),
 ]);
 await sendMail(db,cfg,{to:email,template:purpose,data:{link:`${site}/anmelden/bestaetigen#t=${token}`,code},userId:user?.id??null,quota:purpose,discardAfterMs:TOKEN_MS,now});
 await processOutbox(db,cfg,{site,now});
 return purpose;
}

// ---------------------------------------------------------------- Link prüfen (verbraucht nichts)
export async function peek(ctx){
 requireSameOrigin(ctx.request);
 if(authLimited(ctx))throw new AccountError(429,'Zu viele Versuche. Bitte in einigen Minuten erneut.');
 const body=await readJson(ctx.request,2048);
 if(!TOKEN_RE.test(String(body.token||'')))return {response:respond({valid:false,error:EXPIRED})};
 const row=await ctx.db.prepare("SELECT email,purpose,flow_hash FROM login_tokens WHERE id=? AND used_at IS NULL AND expires_at>? AND purpose IN ('login','signup')").bind(await sha256hex(body.token),iso(ctx.now)).first();
 if(!row)return {response:respond({valid:false,error:EXPIRED})};
 const flow=ctx.cookies.get(ctx.names.flow);
 const sameBrowser=!!flow&&TOKEN_RE.test(flow)&&await sha256hex(flow)===row.flow_hash;
 return {response:respond({valid:true,email:row.email,purpose:row.purpose,sameBrowser,...(row.purpose==='signup'?{agbVersion:AGB_VERSION}:{})})};
}

/** Zustimmungen beim Registrieren: AGB in der aktuellen Fassung und Volljährigkeit; Name optional */
function signupConsent(body){
 if(body.agb!==AGB_VERSION||body.adult!==true)return null;
 const name=typeof body.name==='string'?body.name.normalize('NFC').replace(/\s+/g,' ').trim().slice(0,100):'';
 return {name:name||null};
}

// ---------------------------------------------------------------- Link einlösen
export async function verify(ctx){
 requireSameOrigin(ctx.request);
 if(authLimited(ctx))throw new AccountError(429,'Zu viele Versuche. Bitte in einigen Minuten erneut.');
 const body=await readJson(ctx.request,4096);
 if(!TOKEN_RE.test(String(body.token||'')))throw new AccountError(400,EXPIRED);
 const id=await sha256hex(body.token),at=iso(ctx.now);
 const open=await ctx.db.prepare("SELECT purpose FROM login_tokens WHERE id=? AND used_at IS NULL AND expires_at>? AND purpose IN ('login','signup')").bind(id,at).first();
 if(!open)throw new AccountError(400,EXPIRED);
 const consent=open.purpose==='signup'?signupConsent(body):{};
 if(!consent)throw new AccountError(400,'Bitte AGB und Volljährigkeit bestätigen.',{needConsent:true,agbVersion:AGB_VERSION});
 const used=await ctx.db.prepare("UPDATE login_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? AND purpose IN ('login','signup') RETURNING email,purpose,user_id,next").bind(at,id,at).first();
 if(!used)throw new AccountError(400,EXPIRED);
 return completeLogin(ctx,used,consent);
}

// ---------------------------------------------------------------- Code statt Link (nur mit dem Flow-Cookie dieses Browsers)
export async function enterCode(ctx){
 requireSameOrigin(ctx.request);
 if(authLimited(ctx))throw new AccountError(429,'Zu viele Versuche. Bitte in einigen Minuten erneut.');
 const body=await readJson(ctx.request,4096);
 const code=normalizeCode(body.code);
 if(!code)throw new AccountError(400,'Bitte den achtstelligen Code eingeben.');
 const flowValue=ctx.cookies.get(ctx.names.flow);
 if(!TOKEN_RE.test(flowValue||''))throw new AccountError(400,NEW_CODE);
 const {db,now}=ctx,at=iso(now),flowHash=await sha256hex(flowValue);
 const flow=await db.prepare('UPDATE login_flows SET attempts=attempts+1 WHERE id=? AND attempts<5 AND expires_at>? RETURNING email_hmac,attempts').bind(flowHash,at).first();
 if(!flow)throw new AccountError(400,NEW_CODE);
 const total=await db.prepare('SELECT coalesce(sum(attempts),0) n FROM login_flows WHERE email_hmac=? AND created_at>?').bind(flow.email_hmac,iso(now-DAY)).first();
 if(Number(total?.n||0)>10){
  // Zu viele Fehlversuche für diese Adresse: nur noch der Link. Gleiche Antwort für alle Adressarten.
  return {response:respond({error:NEW_CODE+' Für diese Adresse gilt bis morgen nur der Link aus der E-Mail.'},{status:400}),later:[()=>noticeCodeLocked(ctx,flowHash)]};
 }
 const [login,signup]=await Promise.all(['login','signup'].map(p=>sha256hex(p+'|'+flowHash+'|'+code)));
 const row=await db.prepare('SELECT id,purpose FROM login_tokens WHERE flow_hash=? AND code_hash IN (?,?) AND used_at IS NULL AND expires_at>?').bind(flowHash,login,signup,at).first();
 if(!row){
  const left=Math.max(0,5-Number(flow.attempts));
  throw new AccountError(400,left?`Code falsch oder abgelaufen, noch ${left} ${left===1?'Versuch':'Versuche'}.`:NEW_CODE);
 }
 const consent=row.purpose==='signup'?signupConsent(body):{};
 if(!consent){
  // Richtiger Code, es fehlen nur die Zustimmungen: Versuch nicht anrechnen
  await db.prepare('UPDATE login_flows SET attempts=max(attempts-1,0) WHERE id=?').bind(flowHash).run();
  throw new AccountError(409,'Bitte AGB und Volljährigkeit bestätigen.',{needConsent:true,agbVersion:AGB_VERSION});
 }
 const used=await db.prepare("UPDATE login_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>? AND purpose IN ('login','signup') RETURNING email,purpose,user_id,next").bind(at,row.id,at).first();
 if(!used)throw new AccountError(400,EXPIRED);
 return completeLogin(ctx,used,consent);
}
async function noticeCodeLocked(ctx,flowHash){
 const {db,cfg,now}=ctx;
 const token=await db.prepare('SELECT user_id,email FROM login_tokens WHERE flow_hash=? AND user_id IS NOT NULL LIMIT 1').bind(flowHash).first();
 if(!token)return;
 const recent=await db.prepare("SELECT 1 x FROM auth_events WHERE user_id=? AND kind='code_locked' AND at>? LIMIT 1").bind(token.user_id,iso(now-DAY)).first();
 if(recent)return;
 await eventStatement(db,{userId:token.user_id,kind:'code_locked',now}).run();
 const site=siteBase(cfg,ctx.request);
 await sendMail(db,cfg,{to:token.email,template:'code_locked',userId:token.user_id,quota:'account',now});
 await processOutbox(db,cfg,{site,now});
}

/**
 * Gemeinsamer Abschluss von Link, Code und App-Code: Konto anlegen oder prüfen, neue Sitzung, Cookie. adminVerified: der
 * zweite Faktor ist mit dieser Anmeldung schon geprüft (Anmelden mit App-Code); extra: weitere Anweisungen im selben Batch.
 */
export async function completeLogin(ctx,used,consent,{adminVerified=false,extra=[]}={}){
 const {db,cfg,now,names}=ctx,at=iso(now);
 let user=await db.prepare('SELECT id,email,status FROM users WHERE email=?').bind(used.email).first();
 const statements=[];let created=false,grant=null;
 if(used.purpose==='login'){
  if(!user||user.status!=='active'||user.id!==used.user_id)throw new AccountError(400,EXPIRED);
 }else if(!user){
  const invite=await db.prepare('SELECT tier,tier_until FROM invites WHERE email=? AND expires_at>?').bind(used.email,at).first();
  // Einladung inzwischen abgelaufen oder zurückgezogen: kein Konto (außer bei offener Registrierung)
  if(!invite&&!(cfg.access==='open'&&cfg.openSignup))throw new AccountError(400,EXPIRED);
  created=true;
  user={id:randomId('u_'),email:used.email,status:'active'};
  statements.push(
   db.prepare('INSERT INTO users(id,email,email_verified_at,name,status,created_at) VALUES(?,?,?,?,?,?)').bind(user.id,user.email,at,consent.name??null,'active',at),
   db.prepare('INSERT INTO consents(user_id,doc,version,given_at,privacy_version) VALUES(?,?,?,?,?)').bind(user.id,'agb',AGB_VERSION,at,PRIVACY_VERSION),
   db.prepare('INSERT INTO consents(user_id,doc,version,given_at,privacy_version) VALUES(?,?,?,?,?)').bind(user.id,'alter18','1',at,PRIVACY_VERSION),
   db.prepare('DELETE FROM invites WHERE email=?').bind(used.email),
   eventStatement(db,{userId:user.id,kind:'signup',now}));
  if(invite?.tier&&validTier(invite.tier)){
   grant={tier:invite.tier,until:invite.tier_until};
   statements.push(db.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at,note,created_by) VALUES(?,?,'beta',?,?,?,?)").bind(user.id,invite.tier,at,invite.tier_until??null,'Einladung','invite'));
  }
 }else if(user.status!=='active')throw new AccountError(400,EXPIRED);
 // Session Fixation: eine vorhandene Sitzung dieses Browsers endet, es gibt immer eine neue
 const old=ctx.cookies.get(names.session);
 if(TOKEN_RE.test(old||''))statements.push(db.prepare('DELETE FROM sessions WHERE id=?').bind(await sha256hex(old)));
 const session=await createSession(db,{userId:user.id,adminHost:isAdminHost(ctx),device:deviceLabel(ctx.request.headers.get('user-agent')),now});
 statements.push(session.statement,
  db.prepare('UPDATE users SET last_login_at=? WHERE id=?').bind(at,user.id),
  eventStatement(db,{userId:user.id,kind:'login',now}),...extra);
 if(adminVerified)statements.push(db.prepare('UPDATE sessions SET admin_verified_at=? WHERE id=?').bind(at,session.id));
 await db.batch(statements);
 const cookies=[setCookie(names.session,session.value,{maxAge:session.maxAge,secure:names.secure}),setCookie(names.flow,'',{maxAge:0,secure:names.secure,sameSite:'Strict'})];
 const response=respond({ok:true,created,next:safeNext(used.next||'/')},{cookies});
 const later=[];
 if(created){
  const site=siteBase(cfg,ctx.request);
  later.push(async()=>{await sendMail(db,cfg,{to:user.email,template:'welcome',data:grant||{},userId:user.id,quota:'account',now});await processOutbox(db,cfg,{site,now});});
 }
 return {response,later};
}

// ---------------------------------------------------------------- Sitzung: abmelden, verlängern, Zustand
export async function logout(ctx){
 requireSameOrigin(ctx.request);
 const value=ctx.cookies.get(ctx.names.session);
 if(TOKEN_RE.test(value||'')){
  const row=await ctx.db.prepare('DELETE FROM sessions WHERE id=? RETURNING user_id').bind(await sha256hex(value)).first();
  if(row)await eventStatement(ctx.db,{userId:row.user_id,kind:'logout',now:ctx.now}).run();
 }
 return {response:respond({ok:true},{cookies:[setCookie(ctx.names.session,'',{maxAge:0,secure:ctx.names.secure})]})};
}
export async function refresh(ctx){
 requireSameOrigin(ctx.request);
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Nicht angemeldet.');
 return {response:respond({ok:true,renewed:await refreshSession(ctx.db,session,{now:ctx.now})})};
}
/** Stufe, Rollen und Rechte der Sitzung; null ohne Sitzung */
/** Zweiter Faktor gilt in einer Sitzung so lange (einmal am Tag eingeben) */
export const ADMIN_TOTP_MS=12*3600000;
/**
 * Stufe, Rollen und Admin-Zustand der Sitzung. admin: none (keine Rolle), stale (Anmeldung älter als 7 Tage), ok,
 * totp (öffentliche Adresse, Code fehlt), setup (öffentliche Adresse, zweiter Faktor noch nicht eingerichtet).
 * Über einen Admin-Host (Tunnel) ist der SSH-Schlüssel der zweite Faktor; sonst der Code aus der Authenticator-App.
 * Admins können die Seite mit den Rechten einer anderen Stufe ansehen (view_tier); ihre Admin-Rechte bleiben.
 */
export async function accountState(ctx,session){
 const realTier=await effectiveTier(ctx.db,session.user_id,{now:ctx.now});
 const roles=await rolesOf(ctx.db,session.user_id);
 const isAdmin=roles.includes('admin');
 let admin='none',totpConfirmed=false;
 if(isAdmin){
  totpConfirmed=!!(await ctx.db.prepare('SELECT confirmed_at FROM user_totp WHERE user_id=?').bind(session.user_id).first())?.confirmed_at;
  if(Date.parse(session.auth_at)<=ctx.now-ADMIN_AUTH_MAX_MS)admin='stale';
  else if(isAdminHost(ctx))admin='ok';
  else if(!totpConfirmed)admin='setup';
  else admin=session.admin_verified_at&&Date.parse(session.admin_verified_at)>ctx.now-ADMIN_TOTP_MS?'ok':'totp';
 }
 // Ansehen als: höhere Stufen als die eigene nur mit voller Admin-Freigabe (Rolle, frisch, Tunnel oder zweiter Faktor)
 const preview=isAdmin&&validTier(session.view_tier)&&(admin==='ok'||rank(session.view_tier)<=rank(realTier.tier));
 const tier=preview?{tier:session.view_tier,until:null,source:'preview'}:realTier;
 return {tier,realTier,roles,admin,adminHere:admin==='ok',totpConfirmed,adminHost:isAdminHost(ctx)};
}
/** Absenderadresse aus MAIL_FROM („Name <adresse>“), für den Hinweis auf der Anmeldeseite */
const senderOf=from=>String(from||'').match(/<([^>]+)>/)?.[1]||(/^[^\s<>]+@[^\s<>]+$/.test(String(from||''))?String(from):null);
export async function me(ctx){
 const session=await currentSession(ctx);
 // login: welche Wege die Anmeldeseite anbietet (Link und Code per Mail, E-Mail-Adresse und Code aus der App)
 const common={accounts:true,access:ctx.cfg.access??'open',sender:senderOf(ctx.cfg.mail.from),login:{mail:mailLogin(ctx.cfg),totp:!!ctx.cfg.totpLogin}};
 if(!session)return {response:respond({...common,tier:'guest',features:FEATURES.guest,limits:limitsJson('guest')})};
 const {tier,realTier,roles,admin,adminHere,totpConfirmed}=await accountState(ctx,session);
 return {response:respond({...common,user:{id:session.user_id,email:session.email,name:session.name},
  tier:tier.tier,tierUntil:tier.until,tierSource:tier.source,roles,adminHere,
  ...(roles.includes('admin')?{admin,totpConfirmed,realTier:realTier.tier,viewTier:session.view_tier??null}:{}),
  features:FEATURES[tier.tier],limits:limitsJson(tier.tier),renewAfter:renewDue(session,ctx.now)})};
}
/** Geräte: Liste und Beenden einzelner, anderer oder aller Sitzungen */
export async function sessionsList(ctx){
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Nicht angemeldet.');
 const {results}=await ctx.db.prepare('SELECT id,device,created_at,last_seen_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen_at DESC').bind(session.user_id,iso(ctx.now)).all();
 return {response:respond({sessions:(results||[]).map(r=>({id:r.id.slice(0,12),device:r.device,since:r.created_at.slice(0,10),lastSeen:r.last_seen_at.slice(0,10),current:r.id===session.id}))})};
}
export async function sessionsRevoke(ctx){
 requireSameOrigin(ctx.request);
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Nicht angemeldet.');
 const {revoke}=await readJson(ctx.request,1024);
 const {db,now}=ctx;
 if(revoke==='all'||revoke==='others'){
  // Verbundene KI-Assistenten (OAuth des Kunden-MCP) zählen wie andere Geräte
  await db.batch([db.prepare(`DELETE FROM sessions WHERE user_id=?${revoke==='others'?' AND id<>?':''}`).bind(...(revoke==='others'?[session.user_id,session.id]:[session.user_id])),
   db.prepare('DELETE FROM oauth_grants WHERE user_id=?').bind(session.user_id),
   eventStatement(db,{userId:session.user_id,kind:'logout_all',detail:{scope:revoke},now})]);
 }else if(typeof revoke==='string'&&/^[a-f0-9]{12}$/.test(revoke)){
  await db.prepare("DELETE FROM sessions WHERE user_id=? AND substr(id,1,12)=?").bind(session.user_id,revoke).run();
 }else throw new AccountError(400,'Ungültige Auswahl.');
 const cookies=revoke==='all'||revoke===session.id.slice(0,12)?[setCookie(ctx.names.session,'',{maxAge:0,secure:ctx.names.secure})]:[];
 return {response:respond({ok:true},{cookies})};
}
