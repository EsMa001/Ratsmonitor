#!/usr/bin/env node
/**
 * Lokaler Dev-Server: Kontotabellen (drizzle-accounts/, Buchführung accounts_migrations) in die lokale D1-Datei einspielen
 * und Testkonten anlegen: basic@, pro@, enterprise@ und admin@plenara.test (requirements/konten-konzept.md, 13).
 * Läuft beim Start von scripts/run-framework.mjs dev; ohne lokale Datenbank passiert nichts. Anmelden lokal über
 * /konto (Dev-Login) oder per Code aus dem Dev-Postfach (/konto/postfach).
 */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {applyMigrations} from '../node-migrate.mjs';

const DEV_ACCOUNTS=[['basic@plenara.test','basic',false],['pro@plenara.test','pro',false],['enterprise@plenara.test','enterprise',false],['admin@plenara.test','enterprise',true]];
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=fs.existsSync(dir)?fs.readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.ACCOUNTS_DEV_FILE||(local?dir+local:null);
if(!file)process.exit(0);
const db=new DatabaseSync(file);
try{
 db.exec('PRAGMA busy_timeout=15000');
 applyMigrations(db,fileURLToPath(new URL('../../drizzle-accounts/',import.meta.url)),{table:'accounts_migrations',log:()=>{}});
 const at=new Date().toISOString();
 for(const [email,tier,admin] of DEV_ACCOUNTS){
  const id='u_dev_'+email.split('@')[0];
  db.prepare("INSERT OR IGNORE INTO users(id,email,email_verified_at,status,created_at) VALUES(?,?,?,'active',?)").run(id,email,at,at);
  if(!db.prepare("SELECT 1 FROM plan_grants WHERE user_id=? AND note='dev-seed'").get(id))db.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at,note,created_by) VALUES(?,?,'manual',?,'dev-seed','dev')").run(id,tier,at);
  if(admin)db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role,granted_at,granted_by) VALUES(?,'admin',?,'dev')").run(id,at);
 }
}catch(error){console.error('Kontotabellen lokal nicht eingerichtet:',error.message);}
finally{db.close();}
