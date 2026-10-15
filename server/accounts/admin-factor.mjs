// Zweiter Faktor der Administration und „Ansehen als Stufe“ (requirements/konten-konzept.md 6.4).
// Einrichten nur über einen Admin-Host (Tunnel: der SSH-Schlüssel schützt die Einrichtung) oder per Kommandozeile;
// sonst könnte jemand mit Zugriff auf das Postfach eines Admins seinen eigenen zweiten Faktor hinterlegen.
import {AccountError,respond,requireSameOrigin,readJson} from './http.mjs';
import {currentSession,accountState,isAdminHost,completeLogin,normalizeEmail} from './login.mjs';
import {eventStatement} from './sessions.mjs';
import {limited,limitedAll} from './rate-limit.mjs';
import {hmacHex} from './crypto.mjs';
import {safeNext} from '../../shared/safe-next.mjs';
import {newSecret,base32Encode,otpauthUri,sealSecret,openSecret,matchStep} from './totp.mjs';
import {validTier,rank} from '../../shared/plans.mjs';
import {warnOperator} from './mail.mjs';
/** Fehlversuche je Konto und Tag, danach nur noch Zurücksetzen per Kommandozeile (übersteht Neustarts) */
export const TOTP_DAILY_FAILS=20;

const iso=ms=>new Date(ms).toISOString();
const cleanCode=code=>String(code??'').replace(/[\s-]/g,'');

async function adminSession(ctx){
 requireSameOrigin(ctx.request);
 const session=await currentSession(ctx);
 if(!session)throw new AccountError(401,'Bitte anmelden.');
 const state=await accountState(ctx,session);
 if(!state.roles.includes('admin'))throw new AccountError(403,'Nur für die Administration.');
 if(state.admin==='stale')throw new AccountError(401,'Bitte neu anmelden (Anmeldung älter als 7 Tage).');
 return {session,state};
}

/** Code aus der Authenticator-App: schaltet die Administration in dieser Sitzung für 12 Stunden frei */
export async function totpVerify(ctx){
 const {session,state}=await adminSession(ctx);
 if(!state.totpConfirmed)throw new AccountError(409,'Der zweite Faktor ist noch nicht eingerichtet.');
 const {db,now,cfg}=ctx;
 if(limited('totp',session.user_id,{max:5,windowMs:15*60000,now}))throw new AccountError(429,'Zu viele Versuche. Bitte in 15 Minuten erneut.');
 const fails=await db.prepare("SELECT count(*) n FROM auth_events WHERE user_id=? AND kind='totp_failed' AND at>?").bind(session.user_id,iso(now-86400000)).first();
 if(Number(fails?.n||0)>=TOTP_DAILY_FAILS){
  await warnOperator(db,cfg,`Der zweite Faktor eines Admin-Kontos (${session.user_id}) ist nach ${TOTP_DAILY_FAILS} Fehlversuchen gesperrt. Falls unerwartet: Sitzungen beenden (ratsmonitor-accounts revoke) und Postfach prüfen.`,now);
  throw new AccountError(429,'Zu viele Fehlversuche heute. Die Administration über die öffentliche Adresse ist bis morgen gesperrt; über den Tunnel geht sie weiter.');
 }
 const {code}=await readJson(ctx.request,256);
 const row=await db.prepare('SELECT secret,last_step FROM user_totp WHERE user_id=? AND confirmed_at IS NOT NULL').bind(session.user_id).first();
 const step=row?await matchStep(await openSecret(cfg.secret,row.secret),cleanCode(code),{now,lastStep:row.last_step}):null;
 if(step===null){
  await eventStatement(db,{userId:session.user_id,kind:'totp_failed',now}).run();
  throw new AccountError(400,'Code falsch oder schon benutzt. Bitte den aktuellen Code aus der App eingeben.');
 }
 // Jeder Code nur einmal: der Schritt wird atomar vorgerückt
 const used=await db.prepare('UPDATE user_totp SET last_step=? WHERE user_id=? AND last_step<? RETURNING user_id').bind(step,session.user_id,step).first();
 if(!used)throw new AccountError(400,'Code schon benutzt. Bitte den nächsten Code abwarten.');
 await db.batch([
  db.prepare('UPDATE sessions SET admin_verified_at=? WHERE id=?').bind(iso(now),session.id),
  eventStatement(db,{userId:session.user_id,kind:'totp_ok',now}),
 ]);
 return {response:respond({ok:true})};
}

const LOGIN_FAIL='E-Mail-Adresse oder Code stimmt nicht.';
const TOO_MANY='Zu viele Versuche. Bitte in 15 Minuten erneut.';
/**
 * Anmelden mit E-Mail-Adresse und Code aus der Authenticator-App, ohne Mail (LOGIN_TOTP=1). Nur Konten mit eingerichtetem
 * zweiten Faktor; die Administration ist damit gleich für 12 Stunden frei. Unbekannte Adressen, Konten ohne App und falsche
 * Codes bekommen dieselbe Antwort; Grenzen je Absender und je Adresse (auch für unbekannte), dazu die Tagessperre des Kontos.
 */
export async function totpLogin(ctx){
 requireSameOrigin(ctx.request);
 const {db,now,cfg,ip}=ctx;
 if(!cfg.totpLogin)throw new AccountError(404,'Diese Anmeldung ist nicht freigeschaltet.');
 if(limitedAll('totp-login',ip,[{max:10,windowMs:15*60000},{max:30,windowMs:86400000}],now))throw new AccountError(429,TOO_MANY);
 const body=await readJson(ctx.request,1024);
 const email=normalizeEmail(body.email),code=cleanCode(body.code);
 if(!email)throw new AccountError(400,'Bitte eine gültige E-Mail-Adresse eingeben.');
 if(!/^\d{6}$/.test(code))throw new AccountError(400,'Bitte den sechsstelligen Code aus der App eingeben.');
 if(limited('totp-login-email',await hmacHex(cfg.secret,'totp-login',email),{max:5,windowMs:15*60000,now}))throw new AccountError(429,TOO_MANY);
 const row=await db.prepare("SELECT u.id,u.email,t.secret,t.last_step FROM users u JOIN user_totp t ON t.user_id=u.id WHERE u.email=? AND u.status='active' AND t.confirmed_at IS NOT NULL").bind(email).first();
 if(!row){
  // Gleicher Aufwand wie mit Konto, damit die Antwortzeit nichts verrät
  await matchStep(new Uint8Array(20),code,{now,lastStep:0});
  throw new AccountError(400,LOGIN_FAIL);
 }
 const fails=await db.prepare("SELECT count(*) n FROM auth_events WHERE user_id=? AND kind='totp_failed' AND at>?").bind(row.id,iso(now-86400000)).first();
 if(Number(fails?.n||0)>=TOTP_DAILY_FAILS){
  await warnOperator(db,cfg,`Die Anmeldung mit App-Code eines Kontos (${row.id}) ist nach ${TOTP_DAILY_FAILS} Fehlversuchen bis morgen gesperrt. Falls unerwartet: Sitzungen beenden (ratsmonitor-accounts revoke) und zweiten Faktor zurücksetzen (totp-reset).`,now);
  throw new AccountError(429,TOO_MANY);
 }
 const step=await matchStep(await openSecret(cfg.secret,row.secret),code,{now,lastStep:row.last_step});
 if(step===null){
  await eventStatement(db,{userId:row.id,kind:'totp_failed',detail:{via:'login'},now}).run();
  throw new AccountError(400,LOGIN_FAIL);
 }
 // Jeder Code nur einmal, auch über beide Wege (Anmelden und Freischalten in der Sitzung)
 const used=await db.prepare('UPDATE user_totp SET last_step=? WHERE user_id=? AND last_step<? RETURNING user_id').bind(step,row.id,step).first();
 if(!used)throw new AccountError(400,LOGIN_FAIL);
 return completeLogin(ctx,{email:row.email,purpose:'login',user_id:row.id,next:safeNext(typeof body.next==='string'?body.next:'/')},{},
  {adminVerified:true,extra:[eventStatement(db,{userId:row.id,kind:'totp_ok',detail:{via:'login'},now})]});
}

/** Einrichten: ohne code ein neuer Schlüssel (unbestätigt), mit code bestätigen. Nur über einen Admin-Host. */
export async function totpSetup(ctx){
 const {session,state}=await adminSession(ctx);
 if(!isAdminHost(ctx))throw new AccountError(403,'Einrichten nur über den Zugang auf dem Server (Tunnel) oder per Kommandozeile.');
 if(state.totpConfirmed)throw new AccountError(409,'Der zweite Faktor ist schon eingerichtet. Zurücksetzen per Kommandozeile (ratsmonitor-accounts totp-reset).');
 const {db,now,cfg}=ctx;
 const body=await readJson(ctx.request,256);
 if(body.code===undefined){
  const base32=base32Encode(newSecret());
  await db.prepare('INSERT INTO user_totp(user_id,secret,created_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,created_at=excluded.created_at,confirmed_at=NULL,last_step=0')
   .bind(session.user_id,await sealSecret(cfg.secret,base32),iso(now)).run();
  return {response:respond({secret:base32.match(/.{1,4}/g).join(' '),uri:otpauthUri(base32,session.email)})};
 }
 if(limited('totp-setup',session.user_id,{max:10,windowMs:15*60000,now}))throw new AccountError(429,'Zu viele Versuche. Bitte in 15 Minuten erneut.');
 const row=await db.prepare('SELECT secret FROM user_totp WHERE user_id=? AND confirmed_at IS NULL').bind(session.user_id).first();
 if(!row)throw new AccountError(409,'Bitte die Einrichtung neu beginnen.');
 const step=await matchStep(await openSecret(cfg.secret,row.secret),cleanCode(body.code),{now,lastStep:0});
 if(step===null)throw new AccountError(400,'Code stimmt nicht. Uhrzeit des Handys prüfen und den aktuellen Code eingeben.');
 await db.batch([
  db.prepare('UPDATE user_totp SET confirmed_at=?,last_step=? WHERE user_id=? AND confirmed_at IS NULL').bind(iso(now),step,session.user_id),
  eventStatement(db,{userId:session.user_id,kind:'totp_setup',now}),
 ]);
 return {response:respond({ok:true})};
}

/** Admins: Seite mit den Rechten einer Stufe ansehen (null = eigene Stufe). Nur diese Sitzung. */
export async function viewTier(ctx){
 const {session,state}=await adminSession(ctx);
 const {tier}=await readJson(ctx.request,256);
 if(tier!==null&&!validTier(tier))throw new AccountError(400,'Unbekannte Stufe.');
 if(tier!==null&&!state.adminHere&&rank(tier)>rank(state.realTier.tier))throw new AccountError(403,'Höhere Stufen erst nach dem zweiten Faktor (/admin).');
 await ctx.db.prepare('UPDATE sessions SET view_tier=? WHERE id=?').bind(tier,session.id).run();
 return {response:respond({ok:true,viewTier:tier})};
}
