/**
 * Einstieg des Node-Servers, statt des von vinext erzeugten dist/standalone/server.js.
 * scripts/build-node.mjs legt diese Datei als dist/standalone/serve.mjs ab; Start: node dist/standalone/serve.mjs
 *
 * Unterschiede zum erzeugten Einstieg:
 * - Lauscht standardmäßig nur auf 127.0.0.1: Die Admin-Kennung kommt aus Kopfzeilen, die nur Caddy setzen darf.
 * - keepAliveTimeout länger als der von Caddy: Sonst schließt Node eine Verbindung, die Caddy gerade wiederverwendet,
 *   und ein POST endet mit 502.
 * - Bei SIGTERM/SIGINT (systemctl stop/restart) laufende Anfragen kurz ausklingen lassen und die Datenbank schließen.
 * - Hält die Daten von plenara.X im Arbeitsspeicher (warmData): 5 s nach dem Start und alle 10 Minuten liest er x_cases und
 *   seine Indizes einmal ganz (mit plenara.X-Worker in einem eigenen Thread), für alle Seiten gleich, ohne Ansichten vorzurechnen. Ergebnisse merkt sich jede Route je Bau
 *   (xCached, revision-cache.mjs). Aus: RM_SKIP_WARM=1.
 * - Prüft vor dem Start die Datenbank. Ohne sie würden die Seiten still den mitgelieferten, alten Stand zeigen;
 *   deshalb startet der Server dann nicht (Ausnahme für Tests: RM_ALLOW_NO_DB=1).
 * - Konten (requirements/konten-konzept.md, 6.5 und 13): RM_ACCESS ist open oder invite. Mit invite startet der Server
 *   nur mit Kontendatei (ACCOUNTS_FILE, migriert), ACCOUNTS_SECRET und SITE_URL; fehlt RM_ACCESS, gilt open mit Warnung
 *   (Stand vor den Konten, Basic-Auth davor). Jede Minute arbeitet er den Postausgang der Kontomails ab.
 */
import fs from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { startProdServer } from 'vinext/server/prod-server';

// Leere Werte gelten wie überall in der Umgebungsdatei als nicht gesetzt (|| statt ??).
const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '127.0.0.1';
const graceMs = Number(process.env.SHUTDOWN_GRACE_MS || 20000);
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`[ratsmonitor] Start abgebrochen: PORT ist keine gültige Portnummer (${process.env.PORT}).`);
  process.exit(1);
}
// Die Admin-Kennung kommt aus Kopfzeilen; wer den Port direkt erreicht, könnte sie fälschen.
if (!LOOPBACK.has(host) && process.env.RM_ALLOW_PUBLIC_BIND !== '1') {
  console.error(`[ratsmonitor] Start abgebrochen: HOST=${host} wäre von außen erreichbar. Nur hinter Caddy auf 127.0.0.1 betreiben (Ausnahme: RM_ALLOW_PUBLIC_BIND=1).`);
  process.exit(1);
}

// Der Adapter nutzt StatementSync.columns() (node:sqlite ab Node 22.16); gebaut und getestet wird mit Node 24.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 16)) {
  console.error(`[ratsmonitor] Start abgebrochen: Node ${process.version} ist zu alt, nötig ist mindestens 22.16 (empfohlen 24).`);
  process.exit(1);
}

function checkDatabase() {
  const file = process.env.DATABASE_FILE;
  if (!file) return process.env.RM_ALLOW_NO_DB === '1' ? null : 'DATABASE_FILE ist nicht gesetzt.';
  if (!isAbsolute(file)) return `DATABASE_FILE muss ein absoluter Pfad sein: ${file}`;
  if (!fs.existsSync(file)) return `Datenbankdatei fehlt: ${file}`;
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
    const missing = ['topics', 'search_cards', 'system_state', 'd1_migrations'].filter((name) => !tables.has(name));
    if (missing.length) return `Datenbank ohne Tabellen ${missing.join(', ')}: ${file}`;
    const mode = db.prepare('PRAGMA journal_mode').get().journal_mode;
    if (mode !== 'wal') console.warn(`[ratsmonitor] journal_mode der Datenbank ist ${mode}; der Server stellt beim ersten Schreiben auf wal um.`);
  } catch (error) {
    return `Datenbank nicht lesbar (${file}): ${error.message}`;
  } finally { db?.close(); }
  return null;
}
function checkAccounts() {
  const access = process.env.RM_ACCESS;
  if (access && access !== 'open' && access !== 'invite') return `RM_ACCESS muss open oder invite sein, nicht ${access}.`;
  const file = process.env.ACCOUNTS_FILE;
  // Mit Konten muss der Zugang ausdrücklich gesetzt sein: eine verlorene Zeile darf die Seite nicht still öffnen
  if (!access && file) return 'RM_ACCESS fehlt (open oder invite), obwohl Konten eingerichtet sind.';
  if (!access) console.warn('[ratsmonitor] RM_ACCESS ist nicht gesetzt: die Seite ist offen (open), wie vor den Konten.');
  if (!file) return access === 'invite' ? 'RM_ACCESS=invite braucht ACCOUNTS_FILE (Kontendatei).' : null;
  if (!isAbsolute(file) || !fs.existsSync(file)) return `Kontendatei fehlt: ${file}`;
  let db;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
    const missing = ['users', 'sessions', 'accounts_migrations'].filter((name) => !tables.has(name));
    if (missing.length) return `Kontendatei ohne Tabellen ${missing.join(', ')} (Migration drizzle-accounts fehlt)`;
  } catch (error) {
    return `Kontendatei nicht lesbar: ${error.message}`;
  } finally { db?.close(); }
  if (access === 'invite' && (!process.env.ACCOUNTS_SECRET || process.env.ACCOUNTS_SECRET.length < 32)) return 'RM_ACCESS=invite braucht ACCOUNTS_SECRET (mindestens 32 Zeichen).';
  if (access === 'invite' && !process.env.SITE_URL) return 'RM_ACCESS=invite braucht SITE_URL (Links in Mails).';
  // Hinter Caddy kommt https nur über X-Forwarded-Proto an; ohne Vertrauen setzten die Routen Cookies ohne Secure
  if (String(process.env.SITE_URL || '').startsWith('https:') && process.env.VINEXT_TRUST_PROXY !== '1') return 'SITE_URL ist https, aber VINEXT_TRUST_PROXY ist nicht 1 (Caddy davor).';
  return null;
}
// Kontotabellen gehören nicht in die Inhaltsdatei (Entwicklerkopien, Export); nur warnen
try {
  const file = process.env.DATABASE_FILE;
  if (file && fs.existsSync(file)) {
    const db = new DatabaseSync(file, { readOnly: true });
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name IN ('users','sessions') LIMIT 1").get()) console.warn('[ratsmonitor] Die Inhaltsdatei enthält Kontotabellen (users/sessions), etwa aus einer lokalen Kopie. Konten gehören in ACCOUNTS_FILE.');
    db.close();
  }
} catch { /* nur ein Hinweis */ }
const problem = checkDatabase() ?? checkAccounts();
if (problem) {
  console.error(`[ratsmonitor] Start abgebrochen: ${problem}`);
  process.exit(1);
}

// plenara.X-Rechnungen im Worker-Thread (server/integrations/x-offload.mjs): Datei neben dem Importprozess; RM_X_WORKER=0 schaltet ab.
if (process.env.RM_X_WORKER === '0') delete process.env.RM_X_WORKER;
else if (!process.env.RM_X_WORKER) { const xw = join(import.meta.dirname, 'worker/x-worker.mjs'); if (fs.existsSync(xw)) process.env.RM_X_WORKER = xw; }
console.log(`[ratsmonitor] plenara.X-Rechnungen: ${process.env.RM_X_WORKER ? `${Number(process.env.RM_X_WORKERS || 2)} Worker-Thread(s)` : 'im Hauptprozess'}`);
const { server } = await startProdServer({ port, host, outDir: join(import.meta.dirname, 'dist') });
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 0; // Abrufe im Adminbereich dauern Minuten; Grenzen setzt Caddy
console.log(`[ratsmonitor] Node ${process.version}, NODE_ENV=${process.env.NODE_ENV ?? '(leer)'}, TZ=${process.env.TZ ?? '(System)'}, Zugang ${process.env.RM_ACCESS || 'open'}`);
const base = `http://${host === '::1' ? '[::1]' : host}:${port}`;
// Interne Aufrufe weisen sich mit IMPORT_TOKEN aus: Zugangssperre und Stufen lassen sie durch
const internal = process.env.IMPORT_TOKEN && process.env.IMPORT_TOKEN.length >= 16 ? { authorization: `Bearer ${process.env.IMPORT_TOKEN}` } : {};

// Daten von plenara.X im Arbeitsspeicher halten (nach Neustart, Bau oder großen Jobs), für alle Seiten gleich
// Dieselben Abfragen wie X_WARM_SQL in server/integrations/x-cases.mjs (serve.mjs wird allein kopiert; Test: tests/x-warm.test.mjs)
const X_WARM_SQL = [
  "SELECT sum(length(case_key)+length(steps)+length(terms)+length(factions)) FROM x_cases",
  "SELECT count(*) FROM x_cases INDEXED BY idx_x_cases_date WHERE date>=''",
  "SELECT count(*) FROM x_cases INDEXED BY idx_x_cases_label WHERE label>=''",
  "SELECT count(*) FROM x_cases INDEXED BY idx_x_cases_region WHERE region_id>=''",
  "SELECT count(*) FROM x_cases INDEXED BY idx_x_cases_atlas WHERE date>=''",
  "SELECT count(*) FROM x_signals",
];
// Mit plenara.X-Worker liest ein kurzer eigener Thread (dieselbe Datei, Nachricht warm, warmX in x-cases.mjs): Der Vollscan
// von x_cases hielt sonst alle 10 Minuten jede Anfrage an, je nach Seitencache 0,3 s bis einige Sekunden.
function warmData() {
  if (process.env.RM_X_WORKER) {
    try {
      const worker = new Worker(process.env.RM_X_WORKER, { env: process.env });
      worker.unref();
      const done = () => { void worker.terminate(); };
      worker.once('message', done);
      worker.once('error', done);
      worker.postMessage({ id: 0, warm: true });
    } catch { /* nächster Lauf */ }
    return;
  }
  let db;
  try {
    db = new DatabaseSync(process.env.DATABASE_FILE, { readOnly: true });
    for (const q of X_WARM_SQL) { try { db.prepare(q).get(); } catch { /* Tabelle oder Index fehlt (Migration) */ } }
  } catch { /* nächster Lauf */ } finally { db?.close(); }
}
// Auszüge der Anwenderseiten (/api/x/teaser) vorwärmen, damit der erste Besucher nach dem täglichen Bau nicht wartet; nacheinander,
// liegt ein Auszug im Zwischenspeicher, kostet der Aufruf nichts. Liste = Schlüssel von TEASERS in server/integrations/plenara-x-teaser.mjs
// (serve.mjs wird allein kopiert; Test: tests/plenara-x-teaser.test.mjs)
const TEASER_IDS = ["wohnbau", "gewerbe", "waerme", "wind", "solar", "planung", "grundsteuer", "news-top", "trend-umwelt", "trend-alle", "netz", "ausgang", "gewerbesteuer", "vergaben", "schulen", "mobil"];
async function warmTeasers() {
  for (const id of TEASER_IDS) {
    if (stopping) return;
    try { await (await fetch(`${base}/api/x/teaser?id=${encodeURIComponent(id)}`, { headers: internal })).arrayBuffer(); } catch { /* nächster Lauf */ }
  }
}
if (process.env.RM_SKIP_WARM !== '1') {
  setTimeout(() => { warmData(); void warmTeasers(); setInterval(() => { warmData(); void warmTeasers(); }, 10 * 60e3).unref(); }, 5e3).unref();
}
// Postausgang der Kontomails: beim Start und jede Minute (Mails überstehen so einen Neustart)
async function outbox() {
  if (stopping) return;
  try { await (await fetch(`${base}/api/internal/outbox`, { method: 'POST', headers: internal })).arrayBuffer(); } catch { /* nächster Lauf */ }
}
if (process.env.ACCOUNTS_FILE && internal.authorization) {
  setTimeout(() => { outbox(); setInterval(outbox, 60e3).unref(); }, 5e3).unref();
} else if (process.env.ACCOUNTS_FILE) console.warn('[ratsmonitor] IMPORT_TOKEN fehlt: Kontomails werden nur direkt nach der Anfrage verschickt, nicht nachgeholt.');

let stopping = false;
// Beim Beenden nimmt Node auf offenen Keep-alive-Verbindungen (Caddy) weiter Anfragen an. Diese bekommen
// "Connection: close", damit Caddy die Verbindung danach verwirft und keine neue Arbeit mehr hier landet.
server.on('request', (_request, response) => { if (stopping && !response.headersSent) response.setHeader('Connection', 'close'); });
function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[ratsmonitor] ${signal}: keine neuen Anfragen, beende in höchstens ${Math.round(graceMs / 1000)} s`);
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    try { globalThis[Symbol.for('ratsmonitor.node.database')]?.database?.close(); } catch { /* schon zu */ }
    try { globalThis[Symbol.for('ratsmonitor.node.accounts')]?.database?.close(); } catch { /* schon zu */ }
    process.exit(0);
  };
  server.close(done);
  // Fertige Verbindungen laufend schließen, sonst wartet close() bis zum keepAliveTimeout.
  server.closeIdleConnections?.();
  setInterval(() => server.closeIdleConnections?.(), 250).unref();
  setTimeout(done, graceMs).unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
