#!/usr/bin/env node
/**
 * Kontenverwaltung auf dem Server, nur über die Kommandozeile (requirements/konten-konzept.md, 6.2). Keine Nutzerlisten im
 * Browser. Adressen nie als Argument (Shell-Historie, journald): --email-stdin liest sie von der Eingabe, sonst --id.
 *
 *   ratsmonitor-accounts invite --email-stdin --note "Gespräch 14.10." [--tier pro --until 2027-01-31] [--days 30] [--send]
 *   ratsmonitor-accounts create --email-stdin --note "eigenes Konto" [--tier enterprise [--until …]] [--admin]
 *                        Konto direkt anlegen (Betreiber, ohne Mail), danach Anmeldung mit login-link
 *   ratsmonitor-accounts role admin|user (--id u_… | --email-stdin)
 *   ratsmonitor-accounts tier basic|pro|enterprise [--until 2027-01-31] [--source manual|beta] (--id | --email-stdin)
 *   ratsmonitor-accounts block --note "Grund" | unblock | revoke | delete (--id | --email-stdin)
 *   ratsmonitor-accounts export --out datei.json (--id | --email-stdin)
 *   ratsmonitor-accounts list [--invites] [--full] | stats
 *   ratsmonitor-accounts login-link [--base http://127.0.0.1:8080] (--id | --email-stdin)     Notzugang ohne Mailversand
 *   ratsmonitor-accounts test-mail --email-stdin   Versand prüfen: eine Testmail sofort verschicken
 *   ratsmonitor-accounts reapply-deletions        nach dem Rückspielen einer Sicherung: Löschungen aus deleted.log erneut
 *   ratsmonitor-accounts totp-reset (--id | --email-stdin)   zweiten Faktor zurücksetzen (Handy verloren); beendet Sitzungen
 *   ratsmonitor-accounts totp-setup (--id | --email-stdin)   zweiten Faktor einrichten ohne Tunnel: zeigt den Schlüssel einmal
 *
 * Umgebung: ACCOUNTS_FILE, ACCOUNTS_SECRET, SITE_URL, MAIL_* (der Wrapper deploy/node/ratsmonitor-accounts lädt
 * ratsmonitor.env und accounts.env). Lokal: ACCOUNTS_FILE=<lokale D1-Datei> node scripts/accounts/manage.mjs …
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../ai-job.mjs';
import {accountsConfig} from '../../server/accounts/config.mjs';
import {randomId,randomToken,sha256hex,hmacHex} from '../../server/accounts/crypto.mjs';
import {normalizeEmail,TOKEN_MS} from '../../server/accounts/login.mjs';
import {effectiveTier,eventStatement,revokeAllStatements} from '../../server/accounts/sessions.mjs';
import {removeUser,collectUserData} from '../../server/accounts/account.mjs';
import {newSecret,base32Encode,otpauthUri,sealSecret} from '../../server/accounts/totp.mjs';
import {sendMail,processOutbox} from '../../server/accounts/mail.mjs';
import {validTier} from '../../shared/plans.mjs';

const args=process.argv.slice(2);
const command=args.shift();
const flag=name=>{const i=args.indexOf(name);if(i<0)return false;args.splice(i,1);return true;};
const option=name=>{const i=args.indexOf(name);if(i<0)return undefined;const v=args[i+1];args.splice(i,2);return v;};
const fail=message=>{console.error(message);process.exit(1);};
const iso=ms=>new Date(ms).toISOString();

const file=process.env.ACCOUNTS_FILE;
if(!file)fail('ACCOUNTS_FILE ist nicht gesetzt.');
if(!fs.existsSync(file))fail(`Kontendatei fehlt: ${file}`);
// Als root angelegte -wal/-shm könnte der Dienst danach nicht mehr schreiben
if(typeof process.getuid==='function'&&fs.statSync(file).uid!==process.getuid())fail('Bitte als Eigentümer der Kontendatei aufrufen (sudo -u ratsmonitor oder der Wrapper ratsmonitor-accounts).');
const sql=new DatabaseSync(file);
sql.exec('PRAGMA busy_timeout=10000');sql.exec('PRAGMA foreign_keys=ON');sql.exec('PRAGMA secure_delete=ON');
const db=sqliteAdapter(sql);
const cfg={...accountsConfig(process.env,{dev:false}),db,
 hooks:{
  async logDeletion({userHash,emailHmac,at}){fs.appendFileSync(path.join(path.dirname(file),'deleted.log'),`${at} ${userHash} ${emailHmac}\n`,{mode:0o600});},
  async checkpoint(){sql.exec('PRAGMA wal_checkpoint(TRUNCATE)');},
 }};
const now=Date.now();
const audit=(userId,kind,detail)=>eventStatement(db,{userId,kind,detail:{...detail,by:'cli'},now}).run();

async function readEmail(){
 if(!flag('--email-stdin'))return null;
 const rl=readline.createInterface({input:process.stdin,output:process.stdin.isTTY?process.stderr:undefined,terminal:!!process.stdin.isTTY});
 const line=await new Promise(resolve=>{if(process.stdin.isTTY)process.stderr.write('E-Mail-Adresse: ');rl.once('line',resolve);rl.once('close',()=>resolve(''));});
 rl.close();
 const email=normalizeEmail(line);
 if(!email)fail('Keine gültige Adresse.');
 return email;
}
async function target(){
 const id=option('--id'),email=await readEmail();
 const row=id?sql.prepare('SELECT * FROM users WHERE id=?').get(id):email?sql.prepare('SELECT * FROM users WHERE email=?').get(email):null;
 if(!id&&!email)fail('Bitte --id <konto> oder --email-stdin angeben.');
 if(!row)fail('Konto nicht gefunden.');
 return row;
}
const short=email=>{const [a,d]=String(email).split('@');return `${a.slice(0,2)}…@${d}`;};
const untilDate=value=>{if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('--until als JJJJ-MM-TT.');return value+'T00:00:00.000Z';};
const site=()=>{if(!cfg.siteUrl)fail('SITE_URL ist nicht gesetzt.');return cfg.siteUrl;};

switch(command){
 case 'create':{
  const note=option('--note'),tier=option('--tier'),until=untilDate(option('--until')),admin=flag('--admin');
  if(!note)fail('--note mit Anlass ist Pflicht.');
  if(tier&&(!validTier(tier)||tier==='guest'))fail('Stufe: basic, pro oder enterprise.');
  const email=await readEmail();if(!email)fail('Bitte --email-stdin.');
  if(sql.prepare('SELECT 1 FROM users WHERE email=?').get(email))fail('Für diese Adresse gibt es schon ein Konto.');
  const id=randomId('u_'),at=iso(now);
  const statements=[
   db.prepare("INSERT INTO users(id,email,email_verified_at,status,created_at) VALUES(?,?,?,'active',?)").bind(id,email,at,at),
   db.prepare('DELETE FROM invites WHERE email=?').bind(email),
   eventStatement(db,{userId:id,kind:'created',detail:{by:'cli',note:note.slice(0,80)},now}),
  ];
  if(tier)statements.push(db.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at,note,created_by) VALUES(?,?,'manual',?,?,?,'cli')").bind(id,tier,at,until,note.slice(0,200)));
  if(admin)statements.push(db.prepare("INSERT INTO user_roles(user_id,role,granted_at,granted_by) VALUES(?,'admin',?,'cli')").bind(id,at));
  await db.batch(statements);
  console.log(`Konto ${id} für ${short(email)} angelegt${tier?`, Stufe ${tier}${until?' bis '+until.slice(0,10):''}`:''}${admin?', Rolle admin':''}. Anmelden: login-link --id ${id}`);
  break;
 }
 case 'invite':{
  const note=option('--note'),tier=option('--tier'),until=untilDate(option('--until')),days=Number(option('--days')||30),send=flag('--send');
  if(!note)fail('--note mit Anlass und Zustimmung ist Pflicht (Art. 6 Abs. 1 b).');
  if(tier&&(!validTier(tier)||tier==='guest'))fail('Stufe: basic, pro oder enterprise.');
  if(tier&&!until)fail('Eine Teststufe braucht --until.');
  const email=await readEmail();if(!email)fail('Bitte --email-stdin.');
  if(sql.prepare('SELECT 1 FROM users WHERE email=?').get(email))fail('Für diese Adresse gibt es schon ein Konto.');
  sql.prepare('INSERT INTO invites(email,tier,tier_until,note,invited_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET tier=excluded.tier,tier_until=excluded.tier_until,note=excluded.note,expires_at=excluded.expires_at')
   .run(email,tier||null,until,note,'cli',iso(now),iso(now+days*86400000));
  if(send){await sendMail(db,cfg,{to:email,template:'invite',data:{days},quota:'signup',now});console.log(JSON.stringify(await processOutbox(db,cfg,{site:site(),now})));}
  console.log(`Einladung für ${short(email)} gespeichert, gültig ${days} Tage${tier?`, Stufe ${tier} bis ${until.slice(0,10)}`:''}${send?', Mail eingereiht':''}.`);
  break;
 }
 case 'role':{
  const role=args.shift();if(!['admin','user'].includes(role))fail('role admin|user');
  const user=await target();
  const statements=role==='admin'
   ?[db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role,granted_at,granted_by) VALUES(?,'admin',?,'cli')").bind(user.id,iso(now))]
   :[db.prepare("DELETE FROM user_roles WHERE user_id=? AND role='admin'").bind(user.id)];
  await db.batch([...statements,...revokeAllStatements(db,{userId:user.id,email:user.email}),eventStatement(db,{userId:user.id,kind:'role',detail:{role,by:'cli'},now})]);
  console.log(`Rolle ${role} für ${user.id}; alle Sitzungen beendet.`);
  break;
 }
 case 'tier':{
  const tier=args.shift(),until=untilDate(option('--until')),source=option('--source')||'manual';
  if(!validTier(tier)||tier==='guest')fail('tier basic|pro|enterprise');
  if(!['manual','beta'].includes(source))fail('--source manual|beta (stripe nur über den Zahlungsdienst)');
  const user=await target();
  sql.prepare('INSERT INTO plan_grants(user_id,tier,source,starts_at,ends_at,created_by) VALUES(?,?,?,?,?,?)').run(user.id,tier,source,iso(now),until,'cli');
  await audit(user.id,'tier',{tier,source,until});
  console.log(`Stufe jetzt: ${JSON.stringify(await effectiveTier(db,user.id,{now}))}`);
  break;
 }
 case 'block':case 'unblock':case 'revoke':{
  const note=option('--note');
  if(command==='block'&&!note)fail('--note mit Grund ist Pflicht.');
  const user=await target();
  const statements=command==='block'?[db.prepare("UPDATE users SET status='blocked',blocked_at=?,block_note=? WHERE id=?").bind(iso(now),note,user.id)]
   :command==='unblock'?[db.prepare("UPDATE users SET status='active',blocked_at=NULL,block_note=NULL WHERE id=?").bind(user.id)]:[];
  await db.batch([...statements,...revokeAllStatements(db,{userId:user.id,email:user.email}),eventStatement(db,{userId:user.id,kind:command==='revoke'?'revoked':command==='block'?'blocked':'unblocked',detail:{by:'cli'},now})]);
  console.log(`${command} für ${user.id}: erledigt, Sitzungen und offene Anmeldungen beendet.`);
  break;
 }
 case 'delete':{
  const user=await target();
  const ctx={db,cfg,now,request:null};
  const {later}=await removeUser(ctx,{userId:user.id,email:user.email,notify:!flag('--silent')});
  if(cfg.siteUrl)for(const task of later||[])await task();
  console.log(`Konto ${user.id} gelöscht${cfg.siteUrl?' (Mail „Konto gelöscht“ eingereiht)':''}.`);
  break;
 }
 case 'export':{
  const out=option('--out');if(!out)fail('--out <datei>');
  const user=await target();
  fs.writeFileSync(out,JSON.stringify({...await collectUserData(db,user.id,user.email),exportedAt:iso(now)},null,1),{mode:0o600});
  await audit(user.id,'export',{});
  console.log(`Daten von ${user.id} nach ${out} (Rechte 600).`);
  break;
 }
 case 'list':{
  const full=flag('--full');
  if(flag('--invites')){
   for(const r of sql.prepare('SELECT email,tier,tier_until,note,created_at,expires_at FROM invites ORDER BY created_at').all())
    console.log([full?r.email:short(r.email),r.tier||'-',r.tier_until?.slice(0,10)||'-',r.expires_at<iso(now)?'abgelaufen':'offen',r.note].join('\t'));
   break;
  }
  for(const r of sql.prepare("SELECT u.id,u.email,u.status,u.created_at,u.last_login_at,(SELECT group_concat(role) FROM user_roles WHERE user_id=u.id) roles FROM users u ORDER BY created_at").all()){
   const t=await effectiveTier(db,r.id,{now});
   console.log([r.id,full?r.email:short(r.email),r.status,t.tier+(t.until?' bis '+t.until.slice(0,10):''),r.roles||'-',r.last_login_at?.slice(0,10)||'-'].join('\t'));
  }
  break;
 }
 case 'stats':{
  const one=q=>sql.prepare(q).get().n;
  console.log(JSON.stringify({konten:one('SELECT count(*) n FROM users'),aktiveSitzungen:one(`SELECT count(*) n FROM sessions WHERE expires_at>'${iso(now)}'`),
   einladungen:one('SELECT count(*) n FROM invites'),mails24h:Object.fromEntries(sql.prepare(`SELECT status,count(*) n FROM mail_outbox WHERE created_at>'${iso(now-86400000)}' GROUP BY status`).all().map(r=>[r.status,r.n]))}));
  break;
 }
 case 'test-mail':{
  // Versand prüfen (MAIL_TRANSPORT, Absender, Zugangsdaten): eine Betreiber-Mail an die eingegebene Adresse, sofort verschickt
  const email=await readEmail();if(!email)fail('Bitte --email-stdin.');
  await sendMail(db,cfg,{to:email,template:'operator',data:{message:`Testmail von Plenara (${cfg.mail.transport}). Wenn diese Mail ankommt, funktioniert der Versand.`},quota:'operator',now});
  const r=await processOutbox(db,cfg,{site:site(),now});
  console.log(`Transport ${cfg.mail.transport}, Absender ${cfg.mail.from}: ${JSON.stringify(r)}`);
  if(!r.sent)fail('Nicht verschickt; Grund im Protokoll oben ([konten] Mail …).');
  break;
 }
 case 'login-link':{
  const base=(option('--base')||site()).replace(/\/+$/,'');
  const user=await target();
  if(user.status!=='active')fail('Konto ist gesperrt.');
  const token=randomToken(32);
  sql.prepare("DELETE FROM login_tokens WHERE email=? AND purpose IN ('login','signup') AND used_at IS NULL").run(user.email);
  sql.prepare("INSERT INTO login_tokens(id,flow_hash,code_hash,email,purpose,user_id,next,created_at,expires_at) VALUES(?,?,?,?,'login',?,'/',?,?)")
   .run(await sha256hex(token),await sha256hex(randomToken(32)),await sha256hex(randomToken(32)),user.email,user.id,iso(now),iso(now+TOKEN_MS));
  await audit(user.id,'login_link',{});
  // Nur aufs Terminal, nicht ins Protokoll: gilt 15 Minuten und einmal
  process.stdout.write(`${base}/anmelden/bestaetigen#t=${token}\n`);
  break;
 }
 case 'reapply-deletions':{
  const log=path.join(path.dirname(file),'deleted.log');
  if(!fs.existsSync(log)){console.log('Kein Löschprotokoll.');break;}
  const hashes=new Set(fs.readFileSync(log,'utf8').split('\n').map(l=>l.split(' ')[1]).filter(Boolean));
  let removed=0;
  for(const u of sql.prepare('SELECT id,email FROM users').all()){
   if(!hashes.has(await sha256hex(u.id)))continue;
   await removeUser({db,cfg,now,request:null},{userId:u.id,email:u.email,notify:false});removed++;
  }
  const emailHashes=new Set(fs.readFileSync(log,'utf8').split('\n').map(l=>l.split(' ')[2]).filter(Boolean));
  for(const i of sql.prepare('SELECT email FROM invites').all())if(emailHashes.has(await hmacHex(cfg.secret,'deletion',i.email)))sql.prepare('DELETE FROM invites WHERE email=?').run(i.email);
  console.log(`${removed} Konto/Konten erneut gelöscht.`);
  break;
 }
 case 'totp-reset':{
  const user=await target();
  await db.batch([db.prepare('DELETE FROM user_totp WHERE user_id=?').bind(user.id),...revokeAllStatements(db,{userId:user.id,email:user.email}),eventStatement(db,{userId:user.id,kind:'totp_reset',detail:{by:'cli'},now})]);
  console.log(`Zweiter Faktor für ${user.id} zurückgesetzt, Sitzungen beendet. Neu einrichten über den Tunnel (/admin) oder totp-setup.`);
  break;
 }
 case 'totp-setup':{
  const user=await target();
  if(!sql.prepare("SELECT 1 FROM user_roles WHERE user_id=? AND role='admin'").get(user.id))fail('Nur für Konten mit der Rolle admin.');
  if(sql.prepare('SELECT 1 FROM user_totp WHERE user_id=? AND confirmed_at IS NOT NULL').get(user.id))fail('Schon eingerichtet; vorher totp-reset.');
  if(!cfg.secret)fail('ACCOUNTS_SECRET fehlt.');
  const base32=base32Encode(newSecret());
  // Per Kommandozeile gilt der Schlüssel sofort als bestätigt: die Person tippt ihn in die App und prüft den ersten Code in /admin
  sql.prepare('INSERT INTO user_totp(user_id,secret,created_at,confirmed_at,last_step) VALUES(?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,created_at=excluded.created_at,confirmed_at=excluded.confirmed_at,last_step=0')
   .run(user.id,await sealSecret(cfg.secret,base32),iso(now),iso(now));
  await db.batch(revokeAllStatements(db,{userId:user.id,email:user.email}));
  await audit(user.id,'totp_setup',{});
  // Nur aufs Terminal: nicht in Protokolle oder Chats kopieren
  process.stdout.write(`Schlüssel (in der Authenticator-App „manuell eingeben“): ${base32.match(/.{1,4}/g).join(' ')}\n${otpauthUri(base32,user.email)}\n`);
  break;
 }
 default:
  fail('Befehle: create, invite, test-mail, role, tier, block, unblock, revoke, delete, export, list, stats, login-link, reapply-deletions, totp-reset, totp-setup (Hilfe im Kopf der Datei).');
}
sql.close();
