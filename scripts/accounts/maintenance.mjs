#!/usr/bin/env node
/**
 * Pflegejob der Kontendatei (requirements/konten-konzept.md, 12 und 13), nachts über den Zeitplaner (Job „accounts“):
 * Fristen anwenden, „Testzugang endet“ 14 Tage vorher, „Plus endet“ 3 Tage vorher (gekündigt, Zahlung offen, von Hand),
 * Hinweis bei langer Inaktivität, Überwachung des Postausgangs.
 * Danach sichert deploy/node/accounts-backup.sh die Kontendatei verschlüsselt (deploy/node/accounts-job.sh).
 *   ACCOUNTS_FILE=… node scripts/accounts/maintenance.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../sqlite-adapter.mjs';
import {accountsConfig} from '../../server/accounts/config.mjs';
import {sendMail,processOutbox,warnOperator} from '../../server/accounts/mail.mjs';
import {removeUser} from '../../server/accounts/account.mjs';
import {NOTIFY_RETENTION} from '../../server/accounts/notify.mjs';
import {TIER_LABEL,rank} from '../../shared/plans.mjs';
import {pickGrant} from '../../server/accounts/sessions.mjs';
import {sendBillingMail} from '../../server/accounts/billing.mjs';

const DAY=86400000;
/** Fristen (Platzhalter für Inaktivität und Sperre bis zur Entscheidung, konten-konzept.md Abschnitt 15) */
export const RETENTION={tokensAfterExpiry:DAY,requests:DAY,flows:DAY,authEvents:90*DAY,mailOutbox:30*DAY,adminAudit:365*DAY,
 inactive:730*DAY,inactiveGrace:30*DAY,blocked:365*DAY,tierNotice:14*DAY,plusNotice:3*DAY,billingEvents:90*DAY,cancellations:3*365*DAY};
const iso=ms=>new Date(ms).toISOString();

export async function maintain(db,cfg,{now=Date.now(),dryRun=false,log=console.log}={}){
 const report={};
 const count=async(name,sql,...args)=>{
  if(dryRun){report[name]=(await db.prepare(sql.replace(/^DELETE FROM/,'SELECT count(*) n FROM')).bind(...args).first())?.n??0;return;}
  report[name]=Number((await db.prepare(sql).bind(...args).run())?.meta?.changes||0);
 };
 await count('loginTokens','DELETE FROM login_tokens WHERE expires_at<? OR (used_at IS NOT NULL AND used_at<?)',iso(now-RETENTION.tokensAfterExpiry),iso(now-RETENTION.tokensAfterExpiry));
 await count('loginRequests','DELETE FROM login_requests WHERE at<?',iso(now-RETENTION.requests));
 await count('loginFlows','DELETE FROM login_flows WHERE created_at<?',iso(now-RETENTION.flows));
 await count('sessions','DELETE FROM sessions WHERE expires_at<? OR absolute_expires_at<?',iso(now),iso(now));
 await count('invites','DELETE FROM invites WHERE expires_at<?',iso(now));
 await count('authEvents','DELETE FROM auth_events WHERE at<?',iso(now-RETENTION.authEvents));
 await count('mailOutbox',"DELETE FROM mail_outbox WHERE created_at<? AND status NOT IN ('queued','sending')",iso(now-RETENTION.mailOutbox));
 await count('adminAudit','DELETE FROM admin_audit WHERE at<?',iso(now-RETENTION.adminAudit));
 // Meldungen von Stripe (server/accounts/billing.mjs): nur ID und Art, gegen doppelte Verarbeitung; Stripe stellt höchstens 3 Tage zu
 await count('billingEvents','DELETE FROM billing_events WHERE received_at<?',iso(now-RETENTION.billingEvents));
 // Nachweise der Kündigungen (server/accounts/cancel.mjs): 3 Jahre (§ 195 BGB)
 await count('cancellations','DELETE FROM cancellations WHERE received_at<?',iso(now-RETENTION.cancellations));
 // Benachrichtigungen (server/accounts/notify.mjs): Treffer nach 30 Tagen, verschickt, verfallen oder nie fällig geworden;
 // Abbestell-Tokens nach 180 Tagen (ältere Mails lassen sich dann nur noch im Konto abbestellen)
 await count('notifyItems','DELETE FROM notify_items WHERE created_at<?',iso(now-NOTIFY_RETENTION.items));
 await count('notifyTokens','DELETE FROM notify_tokens WHERE created_at<?',iso(now-NOTIFY_RETENTION.tokens));
 // OAuth des Kunden-MCP: abgelaufene Codes und Erneuerungstoken, Anwendungen ohne gültiges Token nach 90 Tagen
 await count('oauthCodes','DELETE FROM oauth_codes WHERE expires_at<?',iso(now-RETENTION.tokensAfterExpiry));
 await count('oauthGrants','DELETE FROM oauth_grants WHERE expires_at<? OR revoked_at<?',iso(now),iso(now-RETENTION.tokensAfterExpiry));
 await count('oauthClients','DELETE FROM oauth_clients WHERE coalesce(last_used_at,created_at)<? AND id NOT IN (SELECT client_id FROM oauth_grants)',iso(now-90*DAY));
 const site=cfg.siteUrl;
 // Testzugang endet: einmal, 14 Tage vorher (AGB)
 const ending=(await db.prepare(`SELECT g.id,g.user_id,g.tier,g.ends_at,u.email FROM plan_grants g JOIN users u ON u.id=g.user_id
   WHERE g.source='beta' AND g.end_notice_at IS NULL AND g.ends_at IS NOT NULL AND g.ends_at>? AND g.ends_at<=? AND u.status='active'`).bind(iso(now),iso(now+RETENTION.tierNotice)).all()).results||[];
 report.tierNotices=ending.length;
 if(!dryRun)for(const g of ending){
  await sendMail(db,cfg,{to:g.email,template:'tier_ending',data:{tier:TIER_LABEL[g.tier]||g.tier,until:g.ends_at},userId:g.user_id,quota:'account',now});
  await db.prepare('UPDATE plan_grants SET end_notice_at=? WHERE id=?').bind(iso(now),g.id).run();
 }
 // Plus oder Pro endet in höchstens 3 Tagen und wird nicht verlängert: Abo gekündigt (Ende = cancel_at) oder Zahlung offen (Stripe),
 // Freischaltung von Hand mit Ende. Einmal je Zeile (end_notice_at; billing.mjs leert es, wenn eine Zahlung verlängert).
 // Läuft das Abo normal weiter oder hält eine andere Zeile die Stufe, kommt nichts.
 const soon=(await db.prepare(`SELECT g.id,g.user_id,g.tier,g.source,g.ends_at,u.email,s.status,s.cancel_at FROM plan_grants g
   JOIN users u ON u.id=g.user_id LEFT JOIN subscriptions s ON g.source='stripe' AND s.id=g.ref
   WHERE g.source IN ('stripe','manual') AND g.tier IN ('plus','pro','enterprise') AND g.end_notice_at IS NULL AND g.ends_at IS NOT NULL
   AND g.ends_at>? AND g.starts_at<=? AND u.status='active'`).bind(iso(now),iso(now)).all()).results||[];
 report.plusEnding=0;
 for(const g of soon){
  let end=Date.parse(g.ends_at),reason='grant';
  if(g.source==='stripe'){
   if(g.cancel_at){reason='canceled';end=Math.min(end,Date.parse(g.cancel_at));}
   else if(['past_due','unpaid','incomplete'].includes(g.status))reason='payment';
   else continue;
  }
  if(end<=now||end>now+RETENTION.plusNotice)continue;
  const others=(await db.prepare('SELECT tier,source,ends_at FROM plan_grants WHERE user_id=? AND id<>? AND starts_at<=? AND (ends_at IS NULL OR ends_at>?)')
   .bind(g.user_id,g.id,iso(end+1000),iso(end+1000)).all()).results||[];
  if(rank(pickGrant(others).tier)>=rank(g.tier))continue;
  report.plusEnding++;
  if(dryRun)continue;
  // Abbestellbar wie alle Zahlungsmails (billing.mjs); markiert wird auch ohne Mail, damit nichts nachkommt
  await sendBillingMail(db,cfg,{userId:g.user_id,template:'plus_ending',data:{tier:TIER_LABEL[g.tier]||g.tier,until:iso(end),reason},now});
  await db.prepare('UPDATE plan_grants SET end_notice_at=? WHERE id=?').bind(iso(now),g.id).run();
 }
 // Gesperrte Konten: nach der Frist löschen
 const blocked=(await db.prepare("SELECT id,email FROM users WHERE status='blocked' AND blocked_at<?").bind(iso(now-RETENTION.blocked)).all()).results||[];
 report.blockedDeleted=blocked.length;
 if(!dryRun)for(const u of blocked)await removeUser({db,cfg,now,request:null},{userId:u.id,email:u.email,notify:false});
 // Lange inaktiv: Hinweis, 30 Tage später löschen (Admins ausgenommen)
 const stale=(await db.prepare(`SELECT id,email,inactive_notice_at FROM users u WHERE status='active' AND coalesce(last_login_at,created_at)<?
   AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='admin')`).bind(iso(now-RETENTION.inactive)).all()).results||[];
 report.inactiveNotices=0;report.inactiveDeleted=0;
 if(!dryRun)for(const u of stale){
  if(!u.inactive_notice_at){await sendMail(db,cfg,{to:u.email,template:'inactive',userId:u.id,quota:'account',now});await db.prepare('UPDATE users SET inactive_notice_at=? WHERE id=?').bind(iso(now),u.id).run();report.inactiveNotices++;}
  else if(u.inactive_notice_at<iso(now-RETENTION.inactiveGrace)){await removeUser({db,cfg,now,request:null},{userId:u.id,email:u.email,notify:false});report.inactiveDeleted++;}
 }
 // Wieder angemeldet: Hinweis zurücksetzen
 if(!dryRun)await db.prepare('UPDATE users SET inactive_notice_at=NULL WHERE inactive_notice_at IS NOT NULL AND last_login_at>inactive_notice_at').run();
 if(!dryRun&&site)report.outbox=await processOutbox(db,cfg,{site,now});
 // Überwachung: hängende oder gescheiterte Mails
 const stuck=await db.prepare("SELECT count(*) n FROM mail_outbox WHERE status IN ('queued','sending') AND created_at<?").bind(iso(now-30*60000)).first();
 const failed=await db.prepare("SELECT count(*) n FROM mail_outbox WHERE status='failed' AND created_at>?").bind(iso(now-DAY)).first();
 report.mailStuck=Number(stuck?.n||0);report.mailFailed24h=Number(failed?.n||0);
 if(!dryRun&&(report.mailStuck||report.mailFailed24h))await warnOperator(db,cfg,`Postausgang der Konten: ${report.mailStuck} Mails hängen länger als 30 Minuten, ${report.mailFailed24h} sind in 24 Stunden gescheitert.`,now);
 log(JSON.stringify({at:iso(now),dryRun,...report}));
 return report;
}

if(process.argv[1]&&fs.realpathSync(path.resolve(process.argv[1]))===fs.realpathSync(fileURLToPath(import.meta.url))){
 const file=process.env.ACCOUNTS_FILE;
 if(!file||!fs.existsSync(file)){console.error('ACCOUNTS_FILE fehlt.');process.exit(1);}
 const sql=new DatabaseSync(file);sql.exec('PRAGMA busy_timeout=10000');sql.exec('PRAGMA foreign_keys=ON');sql.exec('PRAGMA secure_delete=ON');
 const db=sqliteAdapter(sql);
 const cfg={...accountsConfig(process.env,{dev:false}),db,hooks:{
  async logDeletion({userHash,emailHmac,at}){fs.appendFileSync(path.join(path.dirname(file),'deleted.log'),`${at} ${userHash} ${emailHmac}\n`,{mode:0o600});},
  async checkpoint(){sql.exec('PRAGMA wal_checkpoint(TRUNCATE)');},
 }};
 try{await maintain(db,cfg,{dryRun:process.argv.includes('--dry-run')});sql.exec('PRAGMA wal_checkpoint(TRUNCATE)');}
 finally{sql.close();}
}
