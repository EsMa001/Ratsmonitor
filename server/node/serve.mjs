/**
 * Einstieg des Node-Servers, statt des von vinext erzeugten dist/standalone/server.js.
 * scripts/build-node.mjs legt diese Datei als dist/standalone/serve.mjs ab; Start: node dist/standalone/serve.mjs
 *
 * Unterschiede zum erzeugten Einstieg:
 * - Lauscht standardmäßig nur auf 127.0.0.1: Die Admin-Kennung kommt aus Kopfzeilen, die nur Caddy setzen darf.
 * - keepAliveTimeout länger als der von Caddy: Sonst schließt Node eine Verbindung, die Caddy gerade wiederverwendet,
 *   und ein POST endet mit 502.
 * - Bei SIGTERM/SIGINT (systemctl stop/restart) laufende Anfragen kurz ausklingen lassen und die Datenbank schließen.
 * - Prüft vor dem Start die Datenbank. Ohne sie würden die Seiten still den mitgelieferten, alten Stand zeigen;
 *   deshalb startet der Server dann nicht (Ausnahme für Tests: RM_ALLOW_NO_DB=1).
 */
import fs from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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
  const file = process.env.DATABASE_FILE || process.env.DB_FILE;
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
const problem = checkDatabase();
if (problem) {
  console.error(`[ratsmonitor] Start abgebrochen: ${problem}`);
  process.exit(1);
}

const { server } = await startProdServer({ port, host, outDir: join(import.meta.dirname, 'dist') });
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 0; // Abrufe im Adminbereich dauern Minuten; Grenzen setzt Caddy
console.log(`[ratsmonitor] Node ${process.version}, NODE_ENV=${process.env.NODE_ENV ?? '(leer)'}, TZ=${process.env.TZ ?? '(System)'}`);

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
