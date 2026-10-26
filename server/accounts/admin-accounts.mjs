// Kontenübersicht der Administration (requirements/konten-konzept.md 6.2, Entscheidung 26.10.2026): alle Konten mit Stufe,
// Zahlungsstand, Abo und Nutzung, die Adresse nur gekürzt. Die volle Adresse gibt es je Konto auf Klick oder über die Suche
// nach der genauen Adresse; jeder solche Abruf steht im Admin-Protokoll (admin_audit: action reveal/search, target = Konto-ID).
// Die Übersicht liest nur; Stufen über pickGrant wie überall (sessions.mjs).
import {pickGrant} from './sessions.mjs';
import {normalizeEmail} from './login.mjs';
import {RUNNING} from './billing.mjs';

const DAY=86400000;
const iso=ms=>new Date(ms).toISOString();
/** Höchstzahl Zeilen je Abruf, neueste Konten zuerst; die Summen zählen immer alle */
export const MAX_ROWS=5000;

/** „max.mustermann@gmail.com“ → „ma•••@g•••.com“: genug zum Wiedererkennen, nicht zum Anschreiben */
export function maskEmail(email){
 const [local='',domain='']=String(email||'').split('@');
 const dot=domain.lastIndexOf('.');
 const host=dot>0?domain.slice(0,dot):domain,tld=dot>0?domain.slice(dot):'';
 return `${local.slice(0,local.length>3?2:1)}•••@${host.slice(0,1)}•••${tld}`;
}
/**
 * Zahlungsstand eines Abos: paid (läuft, bezahlt), canceling (gekündigt, läuft bis cancel_at), due (Folgezahlung offen),
 * pending (erste Zahlung offen), ended (beendet). Ohne Abo null.
 */
export function paymentState(sub){
 if(!sub)return null;
 if(['canceled','incomplete_expired'].includes(sub.status))return 'ended';
 if(sub.status==='incomplete')return 'pending';
 if(['past_due','unpaid'].includes(sub.status))return 'due';
 return sub.cancel_at?'canceling':'paid';
}

export async function accountsOverview(db,{now=Date.now()}={}){
 const at=iso(now);
 const count=async(sql,...args)=>Number((await db.prepare(sql).bind(...args).first())?.n||0);
 const [{results:users},{results:grants},{results:subs}]=await Promise.all([
  db.prepare(`SELECT u.id,u.email,u.status,u.created_at,u.last_login_at,
    (SELECT group_concat(role) FROM user_roles r WHERE r.user_id=u.id) roles,
    (SELECT count(*) FROM saved_searches s WHERE s.user_id=u.id) searches,
    (SELECT count(*) FROM saved_searches s WHERE s.user_id=u.id AND s.notify_mail=1) alerts,
    (SELECT count(*) FROM saved_articles a WHERE a.user_id=u.id) articles,
    (SELECT count(*) FROM sessions x WHERE x.user_id=u.id AND x.expires_at>?) sessions
   FROM users u ORDER BY u.created_at DESC LIMIT ?`).bind(at,MAX_ROWS).all(),
  db.prepare('SELECT user_id,tier,source,ends_at FROM plan_grants WHERE starts_at<=? AND (ends_at IS NULL OR ends_at>?)').bind(at,at).all(),
  db.prepare(`SELECT user_id,status,started_at,period_end,cancel_at,canceled_at,ended_at,last_paid_at FROM subscriptions WHERE user_id IS NOT NULL
   ORDER BY user_id,status IN (${RUNNING.map(s=>`'${s}'`).join(',')}) DESC,updated_at DESC`).all(),
 ]);
 const grantsOf=new Map();
 for(const g of grants||[])grantsOf.set(g.user_id,[...(grantsOf.get(g.user_id)||[]),g]);
 const subOf=new Map();
 for(const s of subs||[])if(!subOf.has(s.user_id))subOf.set(s.user_id,s);
 const rows=(users||[]).map(u=>{
  const tier=pickGrant(grantsOf.get(u.id)||[]),sub=subOf.get(u.id)||null;
  return {id:u.id,email:maskEmail(u.email),status:u.status,createdAt:u.created_at,lastLoginAt:u.last_login_at,
   roles:u.roles?String(u.roles).split(','):[],tier:tier.tier,tierSource:tier.source,tierUntil:tier.until,
   payment:paymentState(sub),subscription:sub&&{status:sub.status,startedAt:sub.started_at,periodEnd:sub.period_end,cancelAt:sub.cancel_at,
    canceledAt:sub.canceled_at,endedAt:sub.ended_at,lastPaidAt:sub.last_paid_at},
   searches:Number(u.searches),alerts:Number(u.alerts),articles:Number(u.articles),sessions:Number(u.sessions)};
 });
 // Summen über alle Konten, nicht nur die gezeigten Zeilen
 const accounts=await count('SELECT count(*) n FROM users');
 const tiers={};
 let withGrant=0;
 for(const list of grantsOf.values()){const t=pickGrant(list).tier;tiers[t]=(tiers[t]||0)+1;withGrant++;}
 const fallback=pickGrant([]).tier;
 tiers[fallback]=(tiers[fallback]||0)+accounts-withGrant;
 const payments={paid:0,canceling:0,due:0,pending:0,ended:0};
 for(const sub of subOf.values())payments[paymentState(sub)]++;
 const summary={accounts,rows:rows.length,tiers,...payments,
  blocked:await count("SELECT count(*) n FROM users WHERE status='blocked'"),
  admins:await count("SELECT count(DISTINCT user_id) n FROM user_roles WHERE role='admin'"),
  new7:await count('SELECT count(*) n FROM users WHERE created_at>?',iso(now-7*DAY)),
  new30:await count('SELECT count(*) n FROM users WHERE created_at>?',iso(now-30*DAY)),
  active30:await count('SELECT count(*) n FROM users WHERE last_login_at>?',iso(now-30*DAY)),
  invites:await count('SELECT count(*) n FROM invites WHERE expires_at>?',at)};
 return {at,summary,rows};
}

const audit=(db,{adminId,action,target,now})=>db.prepare('INSERT INTO admin_audit(at,user_id,method,path,action,target) VALUES(?,?,?,?,?,?)')
 .bind(iso(now),adminId,'POST','/api/admin/accounts',action,target).run();
/** Volle Adresse und Name eines Kontos (Klick in der Übersicht), im Admin-Protokoll vermerkt; unbekannt: null */
export async function revealAccount(db,{adminId,id,now=Date.now()}){
 const user=await db.prepare('SELECT id,email,name FROM users WHERE id=?').bind(String(id)).first();
 if(!user)return null;
 await audit(db,{adminId,action:'reveal',target:user.id,now});
 return {id:user.id,email:user.email,name:user.name??null};
}
/** Suche nach der genauen Adresse; ungültige Adresse: undefined, nicht gefunden: null. Jede Suche steht im Protokoll. */
export async function findAccount(db,{adminId,email,now=Date.now()}){
 const address=normalizeEmail(email);
 if(!address)return undefined;
 const user=await db.prepare('SELECT id,email,name FROM users WHERE email=?').bind(address).first();
 await audit(db,{adminId,action:user?'search':'search-miss',target:user?.id??null,now});
 return user?{id:user.id,email:user.email,name:user.name??null}:null;
}
