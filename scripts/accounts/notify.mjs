#!/usr/bin/env node
/**
 * Benachrichtigungen per E-Mail (requirements/benachrichtigungen-konzept.md), über den Zeitplaner alle 10 Minuten (Job
 * „notify“): Treffer aus den Ereignissen des Imports sammeln, fällige Treffer je Konto als eine Mail einreihen, den
 * Postausgang anstoßen. Liest die Inhaltsdatei nur; schreibt nur in die Kontendatei.
 *   ACCOUNTS_FILE=… DATABASE_FILE=… SITE_URL=… node scripts/accounts/notify.mjs [--dry-run] [--minutes 8]
 * Lokal ohne Variablen: die D1-Datei des Dev-Servers für beides (dort liegen die Kontotabellen mit drin).
 *   --dry-run   nur sammeln und zählen, was fällig wäre; keine Mail, keine Treffer schreiben (Kontendatei nur gelesen)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../sqlite-adapter.mjs';
import {accountsConfig} from '../../server/accounts/config.mjs';
import {processOutbox} from '../../server/accounts/mail.mjs';
import {collectNotifications,deliverNotifications} from '../../server/accounts/notify.mjs';

/** Ein Lauf: sammeln, dann versenden. Gibt den Bericht zurück (eine Zeile JSON im Protokoll). */
export async function runNotify(db,content,catalog,cfg,{now=Date.now(),minutes=8,dryRun=false,log=console.log}={}){
 const deadline=Date.now()+minutes*60000;
 const report={at:new Date(now).toISOString(),dryRun};
 report.collect=await collectNotifications(db,content,catalog,{now,deadline,dryRun});
 if(dryRun){
  report.due=Number((await db.prepare('SELECT count(*) n FROM notify_items WHERE mail_id IS NULL AND dropped=0 AND due_at<=?').bind(new Date(now).toISOString()).first())?.n||0);
 }else{
  report.deliver=await deliverNotifications(db,cfg,{now,deadline});
  if(cfg.siteUrl)report.outbox=await processOutbox(db,cfg,{site:cfg.siteUrl,now});
 }
 log(JSON.stringify(report));
 return report;
}

if(process.argv[1]&&fs.realpathSync(path.resolve(process.argv[1]))===fs.realpathSync(fileURLToPath(import.meta.url))){
 const args=process.argv.slice(2),dryRun=args.includes('--dry-run');
 const minutes=Number(args[args.indexOf('--minutes')+1])||8;
 const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
 const local=fs.existsSync(dir)?fs.readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
 const contentFile=process.env.DATABASE_FILE||(local?dir+local:null);
 const accountsFile=process.env.ACCOUNTS_FILE||(!process.env.DATABASE_FILE&&local?dir+local:null);
 if(!accountsFile||!fs.existsSync(accountsFile)){console.log(`${new Date().toISOString()} keine Kontendatei eingerichtet, nichts zu tun`);process.exit(0);}
 if(!contentFile||!fs.existsSync(contentFile)){console.error('DATABASE_FILE fehlt.');process.exit(1);}
 const accountsSql=new DatabaseSync(accountsFile);
 accountsSql.exec('PRAGMA busy_timeout=10000');accountsSql.exec('PRAGMA foreign_keys=ON');accountsSql.exec('PRAGMA secure_delete=ON');
 // Inhaltsdatei nur lesen; im Dev-Server ist es dieselbe Datei wie die Kontendatei
 const same=path.resolve(contentFile)===path.resolve(accountsFile);
 const contentSql=same?accountsSql:new DatabaseSync(contentFile,{readOnly:true});
 if(!same)contentSql.exec('PRAGMA busy_timeout=10000');
 const {REGIONS}=await import('../../shared/regions.ts');
 const env={...process.env,SITE_URL:process.env.SITE_URL||(local&&!process.env.DATABASE_FILE?'http://localhost:5173':undefined)};
 const cfg=accountsConfig(env,{dev:!process.env.ACCOUNTS_FILE});
 try{
  await runNotify(sqliteAdapter(accountsSql),sqliteAdapter(contentSql),REGIONS,cfg,{dryRun,minutes});
  if(!dryRun)accountsSql.exec('PRAGMA wal_checkpoint(PASSIVE)');
 }finally{if(!same)contentSql.close();accountsSql.close();}
}
