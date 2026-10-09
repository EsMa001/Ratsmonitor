/**
 * Spielt fehlende Migrationen aus drizzle/*.sql in eine SQLite-Datei ein, für den Node-Betrieb ohne Wrangler.
 * Buchführung wie `wrangler d1 migrations apply`: Tabelle d1_migrations (id, name, applied_at), eine Zeile je Datei.
 * Eine Datenbank, die lokal mit Wrangler/Miniflare migriert wurde, gilt damit als auf demselben Stand.
 *
 *   node scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite          # anwenden
 *   node scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite --check  # nur anzeigen, was fehlt
 *
 * Jede Datei läuft in einer eigenen Transaktion. Vorher eine Sicherung anlegen: Große Indizes über alle Vorgänge
 * brauchen Minuten und schreiben viel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export function pendingMigrations(db, dir) {
  db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  const applied = new Set(db.prepare('SELECT name FROM d1_migrations').all().map((row) => row.name));
  return fs.readdirSync(dir).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort().filter((file) => !applied.has(file));
}

export function applyMigrations(db, dir, { log = console.log } = {}) {
  const pending = pendingMigrations(db, dir);
  for (const file of pending) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const started = Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO d1_migrations(name) VALUES(?)').run(file);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} fehlgeschlagen: ${error.message}`, { cause: error });
    }
    log(`angewendet: ${file} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  return pending;
}

async function main() {
  const [file, flag, ...rest] = process.argv.slice(2);
  if (!file || rest.length || (flag && flag !== '--check')) throw new Error('Aufruf: node scripts/node-migrate.mjs <Datenbank.sqlite> [--check]');
  const dir = fileURLToPath(new URL('../drizzle/', import.meta.url));
  const db = new DatabaseSync(path.resolve(file));
  try {
    db.exec('PRAGMA busy_timeout=15000');
    db.exec('PRAGMA journal_mode=WAL');
    if (flag === '--check') {
      const pending = pendingMigrations(db, dir);
      console.log(pending.length ? `fehlen: ${pending.join(', ')}` : 'Datenbank ist auf dem neuesten Stand.');
      process.exitCode = pending.length ? 2 : 0;
      return;
    }
    const applied = applyMigrations(db, dir);
    console.log(applied.length ? `${applied.length} Migration(en) angewendet.` : 'Nichts zu tun, Datenbank ist auf dem neuesten Stand.');
  } finally { db.close(); }
}

// realpath: auf dem Server liegt der Code hinter dem Verweis app/current
if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
