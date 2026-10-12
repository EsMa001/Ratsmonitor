// Doppelte Zusammenfassungsversuche aufräumen: je Bericht bleibt in article_analyses (Art 'summary') der neueste gescheiterte
// Versuch und jede gelungene KI-Zusammenfassung; ältere gescheiterte Versuche fallen weg (früher legte jeder Lauf von
// summaries.mjs und jeder Import eine weitere Zeile an, bis zu 5 je Bericht; Stand Server 12.10.2026: 680.566 Zeilen für
// rund 368.000 Berichte). Die Datei wird erst nach VACUUM kleiner; der freie Platz wird sonst von neuen Zeilen wiederverwendet.
//
//   DATABASE_FILE=<sqlite> node scripts/dedupe-analyses.mjs            nur zählen
//   DATABASE_FILE=<sqlite> node scripts/dedupe-analyses.mjs --apply    löschen, in Stücken zu 5.000 Berichten
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const apply=process.argv.includes('--apply');
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:!apply});db.exec('PRAGMA busy_timeout=60000');

const FAILED="coalesce(json_extract(payload,'$.status'),'')<>'completed'";
// Zeilen, die wegfallen: gescheitert und nicht der neueste gescheiterte Versuch ihres Berichts
const EXTRA=`SELECT a.id,a.topic_id,length(a.payload) bytes FROM article_analyses a WHERE a.kind='summary' AND ${FAILED.replaceAll('payload','a.payload')}
 AND EXISTS(SELECT 1 FROM article_analyses b WHERE b.topic_id=a.topic_id AND b.kind='summary' AND ${FAILED.replaceAll('payload','b.payload')}
  AND (b.created_at>a.created_at OR (b.created_at=a.created_at AND b.id>a.id)))`;
const t0=Date.now();
const all=db.prepare("SELECT count(*) n FROM article_analyses WHERE kind='summary'").get().n;
const extra=db.prepare(`SELECT count(*) n,coalesce(sum(bytes),0) b,count(DISTINCT topic_id) topics FROM (${EXTRA})`).get();
console.log(`${all} Zusammenfassungszeilen, davon ${extra.n} ältere gescheiterte Versuche bei ${extra.topics} Berichten (${(extra.b/1e9).toFixed(2)} GB JSON), ${((Date.now()-t0)/1000).toFixed(0)} s`);
if(!apply){console.log('Nichts gelöscht (--apply löscht).');process.exit(0);}

const topics=db.prepare(`SELECT DISTINCT topic_id FROM (${EXTRA})`).all().map(r=>r.topic_id);
const del=db.prepare(`DELETE FROM article_analyses WHERE id IN (SELECT id FROM (${EXTRA}) WHERE topic_id=?)`);
let n=0;
for(let i=0;i<topics.length;i+=5000){
 db.exec('BEGIN');for(const id of topics.slice(i,i+5000))n+=Number(del.run(id).changes);db.exec('COMMIT');
 console.log(`${Math.min(i+5000,topics.length)}/${topics.length} Berichte, ${n} Zeilen gelöscht`);
}
console.log(`fertig: ${n} Zeilen gelöscht, ${((Date.now()-t0)/1000).toFixed(0)} s. Datei verkleinern: VACUUM (braucht freien Platz in Dateigröße und sperrt die Datenbank).`);
