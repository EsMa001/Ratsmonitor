/**
 * Leert ein Gebiet, dessen Berichte einem anderen Gebiet gehören (Katalog berichtigt, z. B. Lohr 23.10.2026: die Sitzungen der
 * Stadt Lohr standen bei der VG Lohr a.Main). Gelöscht werden die Berichte des Gebiets und was an ihnen hängt, dazu Quellenstand,
 * Markierungen und Zahlen des Gebiets. Suche, Gebietszahlen und Fakten räumen die Trigger beim Löschen der Berichte selbst auf.
 * Kosten der KI (ai_usage) bleiben als Buchführung erhalten.
 *
 *   node scripts/remove-region-reports.mjs --db <Datenbank.sqlite> --region <id> [--region <id> …]   (zeigt nur an)
 *   node scripts/remove-region-reports.mjs --db <Datenbank.sqlite> --region <id> --apply              (löscht in einer Transaktion)
 *
 * Ohne --db gilt DATABASE_FILE. Nur für Gebiete, die im Katalog keine Quelle mehr haben (method "pending"), sonst holt der nächste
 * Abruf die Berichte wieder.
 */
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// Tabellen mit einer Zeile je Bericht (topic_id); fehlt eine Tabelle, wird sie übersprungen.
const BY_TOPIC = ['report_rules', 'model_labels', 'article_analyses', 'article_versions', 'notify_events'];
// Stände je Gebiet in system_state.
const STATE_KEYS = region => ['import-marks:', 'import-list:', 'import-debug:'].map(prefix => prefix + region);

export function removeRegionReports(db, regions, { apply = false } = {}) {
  const has = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const counts = {};
  const add = (table, n) => { counts[table] = (counts[table] || 0) + Number(n || 0); };
  const run = () => {
    for (const region of regions) {
      const where = '(SELECT id FROM topics WHERE region_id=?)';
      for (const table of BY_TOPIC.filter(has)) {
        add(table, db.prepare(`SELECT count(*) n FROM ${table} WHERE topic_id IN ${where}`).get(region).n);
        if (apply) db.prepare(`DELETE FROM ${table} WHERE topic_id IN ${where}`).run(region);
      }
      for (const table of ['x_cases', 'source_coverage'].filter(has)) {
        add(table, db.prepare(`SELECT count(*) n FROM ${table} WHERE region_id=?`).get(region).n);
        if (apply) db.prepare(`DELETE FROM ${table} WHERE region_id=?`).run(region);
      }
      if (has('system_state')) for (const key of STATE_KEYS(region)) {
        add('system_state', db.prepare('SELECT count(*) n FROM system_state WHERE key=?').get(key).n);
        if (apply) db.prepare('DELETE FROM system_state WHERE key=?').run(key);
      }
      add('topics', db.prepare('SELECT count(*) n FROM topics WHERE region_id=?').get(region).n);
      if (apply) db.prepare('DELETE FROM topics WHERE region_id=?').run(region);
    }
  };
  if (!apply) { run(); return counts; }
  db.exec('BEGIN IMMEDIATE');
  try { run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  return counts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), regions = [];
  let file = process.env.DATABASE_FILE || '', apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db') file = args[++i];
    else if (args[i] === '--region') regions.push(args[++i]);
    else if (args[i] === '--apply') apply = true;
    else throw new Error('Unbekannte Angabe: ' + args[i]);
  }
  if (!file || !regions.length) throw new Error('Aufruf: --db <Datenbank.sqlite> --region <id> [--apply]');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=10000');
  try {
    const counts = removeRegionReports(db, regions, { apply });
    console.log((apply ? 'Gelöscht' : 'Würde löschen (ohne --apply nichts geändert)') + ': ' + JSON.stringify(counts));
  } finally { db.close(); }
}
