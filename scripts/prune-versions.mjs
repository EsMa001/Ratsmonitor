// Findet Versionen (article_versions), die sich vom nächsten Stand desselben Vorgangs nur in Abruf- und Prüfzeitpunkten
// unterscheiden. Bis 05.10.2026 entstand bei jedem erneut gelesenen Termin eine solche Version (attendance.fetchedAt);
// seitdem vergleicht der Import mit stableJson (shared/article-record.mjs). Die Kopien belegen rund die Hälfte der
// Versionstabelle, ohne einen inhaltlichen Stand festzuhalten.
//
//   node scripts/prune-versions.mjs                 # nur zählen (Standard), lokale Datenbank
//   node scripts/prune-versions.mjs --apply         # löschen; Dev-Server vorher stoppen
//   node scripts/prune-versions.mjs --apply --vacuum  # danach die Datei verkleinern (braucht so viel freien Platz wie die Datenbank groß ist)
//
// Verglichen wird der ganze Stand ohne metadata, updatedAt und Abruf-/Prüfzeitpunkte. Eine Version bleibt, sobald sich
// irgendetwas anderes unterscheidet (Titel, Status, Termine, Dokumente, Zusammenfassung, Analysen …).
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {stableJson} from '../shared/article-record.mjs';
const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const file = process.env.DB_FILE || dir + fs.readdirSync(dir).filter(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite').map(f => [f, fs.statSync(dir + f).size]).sort((a, b) => b[1] - a[1])[0][0];
const apply = process.argv.includes('--apply'), vacuum = process.argv.includes('--vacuum');
const db = new DatabaseSync(file, {readOnly: !apply});
const content = payload => { let t; try { t = JSON.parse(payload); } catch { return null; } if (!t || typeof t !== 'object') return null; const {metadata, updatedAt, ...rest} = t; return stableJson(rest); };
const started = Date.now();
let topics = 0, versions = 0, redundant = 0, bytes = 0, kept = 0;
const doomed = [];
// Je Vorgang: Versionen nach Zeit, zuletzt der aktuelle Stand. Eine Version ist überflüssig, wenn ihr Inhalt dem nächsten gleicht.
const ids = db.prepare('SELECT DISTINCT topic_id FROM article_versions').all().map(r => r.topic_id);
const versionsOf = db.prepare('SELECT id,length(payload) size,payload FROM article_versions WHERE topic_id=? ORDER BY captured_at,rowid');
const current = db.prepare('SELECT payload FROM topics WHERE id=?');
for (const id of ids) {
  topics++;
  const rows = versionsOf.all(id), now = current.get(id);
  const states = [...rows.map(r => content(r.payload)), now ? content(now.payload) : null];
  for (let i = 0; i < rows.length; i++) {
    versions++;
    if (states[i] !== null && states[i] === states[i + 1]) { redundant++; bytes += rows[i].size; doomed.push(rows[i].id); } else kept++;
  }
  if (topics % 20000 === 0) console.log(`${topics}/${ids.length} Vorgänge, ${redundant} überflüssige Versionen bisher`);
}
console.log(`Vorgänge mit Versionen ${topics}, Versionen ${versions}: überflüssig ${redundant} (${(bytes / 1e9).toFixed(2)} GB Nutzlast), inhaltlich verschieden ${kept}. Dauer ${((Date.now() - started) / 1000).toFixed(0)} s`);
if (!apply) { console.log('Nur gezählt. Löschen mit --apply (Dev-Server vorher stoppen).'); process.exit(0); }
const del = db.prepare('DELETE FROM article_versions WHERE id=?');
db.exec('BEGIN');
for (let i = 0; i < doomed.length; i++) { del.run(doomed[i]); if (i % 10000 === 9999) { db.exec('COMMIT'); db.exec('BEGIN'); console.log(`${i + 1}/${doomed.length} gelöscht`); } }
db.exec('COMMIT');
console.log(`${doomed.length} Versionen gelöscht.`);
if (vacuum) { const s = Date.now(); db.exec('VACUUM'); console.log(`VACUUM in ${((Date.now() - s) / 1000).toFixed(0)} s, Datei jetzt ${(fs.statSync(file).size / 1e9).toFixed(2)} GB`); }
