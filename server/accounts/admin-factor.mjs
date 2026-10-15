// Zweiter Faktor der Administration und „Ansehen als Stufe“ (requirements/konten-konzept.md 6.4).
// Einrichten nur über einen Admin-Host (Tunnel: der SSH-Schlüssel schützt die Einrichtung) oder per Kommandozeile;
// sonst könnte jemand mit Zugriff auf das Postfach eines Admins seinen eigenen zweiten Faktor hinterlegen.
import {AccountError,respond,requireSameOrigin,readJson} from './http.mjs';
import {currentSession,accountState,isAdminHost} from './login.mjs';
import {eventStatement} from './sessions.mjs';
import {limited} from './rate-limit.mjs';
import {newSecret,base32Encode,otpauthUri,sealSecret,openSecret,matchStep} from './totp.mjs';
import {validTier} from '../../shared/plans.mjs';

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
 const {session}=await adminSession(ctx);
 const {tier}=await readJson(ctx.request,256);
 if(tier!==null&&!validTier(tier))throw new AccountError(400,'Unbekannte Stufe.');
 await ctx.db.prepare('UPDATE sessions SET view_tier=? WHERE id=?').bind(tier,session.id).run();
 return {response:respond({ok:true,viewTier:tier})};
}
