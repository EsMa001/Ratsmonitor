// Zahlen für plenara.X neu bauen (x_cases, server/integrations/x-cases.mjs). Schritt 3 des Jobs rule-texts.
//   node scripts/plenara-x/build-x-cases.mjs [--dry-run]   lokale Datenbank (DATABASE_FILE oder .wrangler/)
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {buildXCases} from '../../server/integrations/x-cases.mjs';
import {stepSummary} from '../pdf-store/state.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');
if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='x_cases'").get()){console.error('Tabelle x_cases fehlt: erst Migration 0036 einspielen (scripts/node-migrate.mjs).');process.exit(1);}
const r=buildXCases(db,{dry:process.argv.includes('--dry-run')});
console.log(`plenara.X: ${r.cases} Vorgänge, davon ${r.unread} ungelesen, ${r.seconds} s`);
stepSummary(r);db.close();
