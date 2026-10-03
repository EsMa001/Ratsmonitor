// Lückenhafte Abrufe finden: vergleicht je Gebiet den eingestellten Abrufzeitraum mit dem
// tatsächlich gespeicherten Datenbestand und dem Status des letzten Abrufs.
// Aufruf: node scripts/import-gaps.mjs [Pfad zur lokalen D1-SQLite] [--md Ausgabedatei]
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, writeFileSync } from 'node:fs';
import regions from '../shared/nrw-regions.json' with { type: 'json' };
import { NRW_SOURCES } from '../server/integrations/source-catalog.mjs';
import { SOURCES } from '../server/integrations/regions.mjs';
import { historyWindow, historyWindowLabel, windowStart } from '../shared/history-window.mjs';

const args = process.argv.slice(2);
const mdAt = args.indexOf('--md');
const mdFile = mdAt >= 0 ? args[mdAt + 1] : null;
const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const dbFile = args.find((a, i) => !a.startsWith('--') && i !== mdAt + 1) ?? `${dir}/${readdirSync(dir).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')}`;
const db = new DatabaseSync(dbFile, { readOnly: true });
const now = new Date();
const DAY = 864e5;
/* Spielraum am Fensteranfang: kleine Orte tagen nicht jede Woche */
const SLACK_DAYS = 45;

const configured = new Map([...SOURCES, ...NRW_SOURCES, { id: 'muenster', method: 'oparl' }].map((s) => [s.id, s]));
const data = new Map(db.prepare("SELECT region_id rid, count(*) n, min(date) first, max(date) last FROM search_cards GROUP BY region_id").all().map((r) => [r.rid, r]));
const coverage = new Map(db.prepare('SELECT region_id rid, payload FROM source_coverage').all().map((r) => [r.rid, JSON.parse(r.payload)]));

const rows = regions.map((r) => {
  const src = configured.get(r.id);
  const c = coverage.get(r.id) ?? {};
  const d = data.get(r.id);
  const method = c.method ?? src?.method ?? 'pending';
  const connected = !!src && method !== 'pending';
  let win;
  try { win = historyWindow(c.window); } catch { win = historyWindow(); }
  const start = windowStart(now, win);
  /* Beginnt das Fenster in der Sommerpause (Juli/August), zählt die Lücke erst ab September */
  const eff = start.getUTCMonth() === 6 || start.getUTCMonth() === 7 ? Date.UTC(start.getUTCFullYear(), 8, 1) : start.getTime();
  const missingDays = d ? Math.round((Date.parse(d.first) - eff) / DAY) : null;
  const issues = Array.isArray(c.issues) ? c.issues.length : 0;
  let gap;
  if (!connected) gap = 'nicht angebunden';
  else if (!d) gap = 'angebunden, keine Daten';
  else if (missingDays > SLACK_DAYS) gap = 'Zeitraum unvollständig';
  else if (c.complete === false || c.resumable) gap = 'letzter Abruf unvollständig';
  else gap = 'ok';
  return { id: r.id, name: r.name, kind: r.kind, method, win, start: start.toISOString().slice(0, 10), n: d?.n ?? 0, first: d?.first ?? '', last: d?.last ?? '', missingDays, issues, resumable: !!c.resumable, last_attempt: (c.lastAttemptAt ?? c.importedAt ?? '').slice(0, 10), gap };
});

const ORDER = ['Zeitraum unvollständig', 'angebunden, keine Daten', 'letzter Abruf unvollständig', 'nicht angebunden', 'ok'];
const groups = Object.fromEntries(ORDER.map((g) => [g, rows.filter((r) => r.gap === g)]));
/* Vorrang: echte Zeitlücken und angebundene Gebiete ohne Daten; danach Abrufe mit einzelnen Fehlern */
const priority = [...groups['Zeitraum unvollständig'], ...groups['angebunden, keine Daten']];
const actionable = [...priority, ...groups['letzter Abruf unvollständig']];
const linkOf = (list) => `/admin?auswahl=${list.slice(0, 450).map((r) => r.id).join(',')}`;

const lines = [];
const out = (s = '') => lines.push(s);
out('# Lückenhafte Abrufe');
out();
out(`Stand: ${now.toISOString().slice(0, 10)} · ${regions.length} Gebiete im Katalog · erzeugt mit \`node scripts/import-gaps.mjs\``);
out();
out('| Befund | Gebiete |');
out('|---|---|');
for (const g of ORDER) out(`| ${g} | ${groups[g].length} |`);
out();
out('Die Links öffnen den Admin-Bereich (Seite „Daten & Verarbeitung“) mit vorausgewählten Gebieten. Dort den Abrufzeitraum wählen und den Abruf starten; gespeicherte, fortsetzbare Abrufe machen an der Abbruchstelle weiter.');
out();
out(`**1. Vorrang: echte Zeitlücken und Gebiete ohne Daten** (${priority.length} Gebiete)`);
out();
out('```');
out(linkOf(priority));
out('```');
out();
out(`**2. Alles, inklusive Abrufe mit einzelnen Fehlern** (${actionable.length} Gebiete)`);
out();
out('```');
out(linkOf(actionable));
out('```');
out();
out(`Hinweis: Eine Lücke zählt erst ab ${SLACK_DAYS} Tagen ohne Daten am Fensteranfang; die Sommerpause (Juli/August) wird nicht als Lücke gewertet. Nichtöffentliche Sitzungsteile sind grundsätzlich nicht abrufbar.`);
const table = (title, list, cols) => {
  if (!list.length) return;
  out();
  out(`## ${title} (${list.length})`);
  out();
  out(`| ${cols.map((c) => c[0]).join(' | ')} |`);
  out(`|${cols.map(() => '---').join('|')}|`);
  for (const r of list) out(`| ${cols.map((c) => c[1](r)).join(' | ')} |`);
};
const by = (k) => (a, b) => (b[k] ?? 0) - (a[k] ?? 0);
table('Zeitraum unvollständig', [...groups['Zeitraum unvollständig']].sort(by('missingDays')), [
  ['Gebiet', (r) => r.name], ['Zeitraum', (r) => historyWindowLabel(r.win)], ['soll ab', (r) => r.start], ['Daten ab', (r) => r.first],
  ['fehlen ca.', (r) => `${Math.round(r.missingDays / 30.4)} Monate`], ['Vorgänge', (r) => r.n], ['fortsetzbar', (r) => (r.resumable ? 'ja' : 'nein')], ['Fehler', (r) => r.issues],
]);
table('Angebunden, aber keine Daten', groups['angebunden, keine Daten'], [
  ['Gebiet', (r) => r.name], ['Quelle', (r) => r.method], ['letzter Versuch', (r) => r.last_attempt || '–'], ['Fehler', (r) => r.issues],
]);
table('Letzter Abruf unvollständig (Zeitraum aber abgedeckt)', [...groups['letzter Abruf unvollständig']].sort(by('issues')), [
  ['Gebiet', (r) => r.name], ['Daten ab', (r) => r.first], ['Vorgänge', (r) => r.n], ['fortsetzbar', (r) => (r.resumable ? 'ja' : 'nein')], ['Fehler', (r) => r.issues],
]);
table('Nicht angebunden (keine Quelle konfiguriert)', groups['nicht angebunden'], [['Gebiet', (r) => r.name], ['Ebene', (r) => (r.kind === 'district' ? 'Kreis' : 'Stadt/Gemeinde')]]);

const md = lines.join('\n') + '\n';
if (mdFile) {
  writeFileSync(mdFile, md);
  console.log(`Bericht geschrieben: ${mdFile}`);
}
console.log(ORDER.map((g) => `${g}: ${groups[g].length}`).join(' | '));
console.log(`Vorrang: ${priority.length} | inklusive einzelner Fehler: ${actionable.length}`);
