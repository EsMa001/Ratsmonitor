#!/usr/bin/env node
/**
 * Abgleich mit Stripe (server/accounts/billing.mjs, docs/betrieb/stripe-test.md): alle Abos des Stripe-Kontos neu
 * übernehmen und plan_grants nachführen; fängt verpasste Meldungen auf. Gedacht für den täglichen Zeitplaner.
 *   ACCOUNTS_FILE=… STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… STRIPE_PRICE_PLUS=… [STRIPE_PRICE_PRO=…] node scripts/billing/reconcile.mjs
 * Lokal ohne ACCOUNTS_FILE: die lokale D1-Datei des Dev-Servers (wie scripts/accounts/dev-setup.mjs), STRIPE_* aus .dev.vars.
 */
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAdapter} from '../sqlite-adapter.mjs';
import {accountsConfig} from '../../server/accounts/config.mjs';
import {billingReady,reconcile} from '../../server/accounts/billing.mjs';

const vars={...process.env};
let file=vars.ACCOUNTS_FILE;
if(!file){
 const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
 const local=fs.existsSync(dir)?fs.readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
 file=local?dir+local:null;
 if(fs.existsSync('.dev.vars'))for(const line of fs.readFileSync('.dev.vars','utf8').split(/\r?\n/)){
  const m=line.match(/^\s*(STRIPE_[A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if(m&&!vars[m[1]])vars[m[1]]=m[2];
 }
}
if(!file){console.error('ACCOUNTS_FILE ist nicht gesetzt, und es gibt keine lokale D1-Datei.');process.exit(1);}
const sql=new DatabaseSync(file);
try{
 sql.exec('PRAGMA busy_timeout=15000');
 const cfg=accountsConfig({...vars,ACCOUNTS:sqliteAdapter(sql)},{dev:false});
 if(!billingReady(cfg)){
  console.error('Stripe ist nicht eingerichtet: STRIPE_SECRET_KEY (Testschlüssel; Live nur mit STRIPE_LIVE=1), STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PLUS (dazu STRIPE_PRICE_PRO für Pro).');
  process.exitCode=1;
 }else console.log(JSON.stringify(await reconcile({db:cfg.db,cfg,now:Date.now()})));
}finally{sql.close();}
