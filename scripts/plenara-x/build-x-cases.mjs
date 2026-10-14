// Zahlen für plenara.X neu bauen (x_cases, server/integrations/x-cases.mjs). Schritt 3 des Jobs rule-texts.
//   node scripts/plenara-x/build-x-cases.mjs [--dry-run]   lokale Datenbank (DATABASE_FILE oder .wrangler/)
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {buildXCases} from '../../server/integrations/x-cases.mjs';
import {stepSummary} from '../pdf-store/state.mjs';
import {factCoverage} from '../../server/integrations/fact-coverage.mjs';
import {CATALOG} from '../../shared/catalog.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local);db.exec('PRAGMA busy_timeout=60000');
if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='x_cases'").get()){console.error('Tabelle x_cases fehlt: erst Migration 0036 einspielen (scripts/node-migrate.mjs).');process.exit(1);}
const r=buildXCases(db,{dry:process.argv.includes('--dry-run')});
console.log(`plenara.X: ${r.cases} Vorgänge, davon ${r.unread} ungelesen, ${r.seconds} s`);
// Für die Administration (Reiter „Themen & Texte“): Vorgänge je Thema und Unterthema und Berichte je Fakt, damit die Seite
// beim Öffnen nichts rechnen muss
const themes=Object.fromEntries(db.prepare('SELECT label,count(*) n FROM x_cases GROUP BY label').all().map(x=>[x.label,x.n]));
const subs={};for(const x of db.prepare("SELECT subs FROM x_cases WHERE subs<>''").iterate())for(const u of x.subs.split(','))if(u)subs[u]=(subs[u]||0)+1;
const facts=db.prepare("SELECT 1 FROM sqlite_master WHERE name='topic_facts'").get()?Object.fromEntries(db.prepare('SELECT kind,count(DISTINCT topic_id) n FROM topic_facts GROUP BY kind').all().map(x=>[x.kind,x.n])):{};
// Abdeckung je Fakt: Gemeinden mit Wert von allen Gemeinden in Deutschland
const factPlaces=Object.keys(facts).length?factCoverage(db,CATALOG):null;
stepSummary({...r,themes,subs,facts,factPlaces});db.close();
