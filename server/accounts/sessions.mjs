// Sitzungen (requirements/konten-konzept.md, Abschnitt 5.2). Im Cookie ein Zufallswert, in der Datenbank nur sein Hash.
// GET schreibt nie; verlängert wird über POST /api/auth/refresh, höchstens einmal am Tag (Admin-Host: einmal je Stunde).
import {randomToken,sha256hex} from './crypto.mjs';
import {ACCOUNT_DEFAULT_TIER,rank} from '../../shared/plans.mjs';

const DAY=86400000,HOUR=3600000;
export const DURATION={
 user:{idle:30*DAY,absolute:90*DAY,renew:DAY},
 admin:{idle:12*HOUR,absolute:7*DAY,renew:HOUR},
};
export const ADMIN_AUTH_MAX_MS=7*DAY;
const iso=ms=>new Date(ms).toISOString();

/** Neue Sitzung; liefert den Cookie-Wert (nur hier im Klartext) und die Laufzeit in Sekunden */
export async function createSession(db,{userId,adminHost=false,device=null,now=Date.now()}){
 const d=adminHost?DURATION.admin:DURATION.user;
 const value=randomToken(32),id=await sha256hex(value);
 const statement=db.prepare('INSERT INTO sessions(id,user_id,created_at,auth_at,last_seen_at,expires_at,absolute_expires_at,admin_host,device) VALUES(?,?,?,?,?,?,?,?,?)')
  .bind(id,userId,iso(now),iso(now),iso(now),iso(now+d.idle),iso(now+d.absolute),adminHost?1:0,device);
 return {value,id,maxAge:d.absolute/1000,statement};
}
/** Sitzung zum Cookie-Wert, nur wenn gültig und das Konto aktiv ist. Liest nur. */
export async function readSession(db,value,{now=Date.now()}={}){
 if(!db||!value||!/^[A-Za-z0-9_-]{43}$/.test(value))return null;
 const id=await sha256hex(value);
 const row=await db.prepare(`SELECT s.id,s.user_id,s.auth_at,s.last_seen_at,s.expires_at,s.absolute_expires_at,s.admin_host,
   u.email,u.name,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?`).bind(id).first();
 const at=iso(now);
 if(!row||row.status!=='active'||row.expires_at<=at||row.absolute_expires_at<=at)return null;
 return row;
}
/** Verlängert die Leerlaufzeit, höchstens bis zur absoluten Grenze; nur wenn die letzte Nutzung alt genug ist */
export async function refreshSession(db,session,{now=Date.now()}={}){
 const d=session.admin_host?DURATION.admin:DURATION.user;
 if(Date.parse(session.last_seen_at)>now-d.renew)return false;
 const expires=Math.min(now+d.idle,Date.parse(session.absolute_expires_at));
 const r=await db.prepare('UPDATE sessions SET last_seen_at=?,expires_at=? WHERE id=?').bind(iso(now),iso(expires),session.id).run();
 return Number(r?.meta?.changes||0)>0;
}
export const renewDue=(session,now=Date.now())=>Date.parse(session.last_seen_at)<=now-(session.admin_host?DURATION.admin:DURATION.user).renew;

/** Wirksame Stufe: höchste gültige Zeile in plan_grants, sonst ACCOUNT_DEFAULT_TIER. Kein anderer Code liest plan_grants. */
export async function effectiveTier(db,userId,{now=Date.now()}={}){
 const at=iso(now);
 const {results}=await db.prepare('SELECT tier,source,ends_at FROM plan_grants WHERE user_id=? AND starts_at<=? AND (ends_at IS NULL OR ends_at>?)').bind(userId,at,at).all();
 let best=null;
 for(const r of results||[])if(!best||rank(r.tier)>rank(best.tier)||(rank(r.tier)===rank(best.tier)&&(r.ends_at===null||(best.ends_at!==null&&r.ends_at>best.ends_at))))best=r;
 return best?{tier:best.tier,until:best.ends_at,source:best.source}:{tier:ACCOUNT_DEFAULT_TIER,until:null,source:null};
}
export async function rolesOf(db,userId){
 const {results}=await db.prepare('SELECT role FROM user_roles WHERE user_id=?').bind(userId).all();
 return (results||[]).map(r=>r.role);
}
/** Ereignis nur mit IDs, nie mit Adressen, Tokens oder IP */
export const eventStatement=(db,{userId=null,kind,detail=null,now=Date.now()})=>
 db.prepare('INSERT INTO auth_events(at,user_id,kind,detail) VALUES(?,?,?,?)').bind(iso(now),userId,kind,detail?JSON.stringify(detail):null);
/** Alle Sitzungen und offenen Tokens einer Person beenden (Sperre, Rolle, Adresse, Löschen, revoke) */
export const revokeAllStatements=(db,{userId,email})=>[
 db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
 db.prepare('DELETE FROM login_tokens WHERE (user_id=? OR email=?) AND used_at IS NULL').bind(userId,email),
];
