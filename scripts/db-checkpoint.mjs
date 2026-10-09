/**
 * Macht eine SQLite-Datei kopierfertig: schreibt das Protokoll (-wal) vollständig zurück und prüft, dass niemand
 * mehr darauf schreibt. Erst danach darf die Datei allein (ohne -wal/-shm) kopiert werden, etwa auf den Server.
 *
 *   node scripts/db-checkpoint.mjs <Datenbank.sqlite>
 *
 * Bricht ab, wenn ein anderer Prozess die Datei hält (Dev-Server, refresh-search-words, refresh-admin, ai-job …).
 * Danach bis zum Ende der Kopie nichts mehr auf der Datei starten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export function checkpointForCopy(file) {
  if (!fs.existsSync(file)) throw new Error(`Datei fehlt: ${file}`);
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=10000');
    const result = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    if (result.busy !== 0) throw new Error(`Ein anderer Prozess hält die Datei (busy=${result.busy}). Dev-Server und Skripte beenden, dann erneut.`);
    if (result.log !== result.checkpointed) throw new Error(`Protokoll nicht vollständig zurückgeschrieben (${result.checkpointed} von ${result.log} Seiten).`);
    const check = db.prepare('PRAGMA quick_check').get().quick_check;
    if (check !== 'ok') throw new Error(`Datei beschädigt: ${check}`);
  } finally { db.close(); }
  const wal = `${file}-wal`;
  const walSize = fs.existsSync(wal) ? fs.statSync(wal).size : 0;
  if (walSize > 0) throw new Error(`Das Protokoll ist nach dem Zurückschreiben nicht leer (${walSize} Byte): Es schreibt noch jemand.`);
  return { bytes: fs.statSync(file).size };
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [file, ...rest] = process.argv.slice(2);
    if (!file || rest.length) throw new Error('Aufruf: node scripts/db-checkpoint.mjs <Datenbank.sqlite>');
    const { bytes } = checkpointForCopy(path.resolve(file));
    console.log(`Kopierfertig: ${(bytes / 1e9).toFixed(2)} GB. Bis zum Ende der Kopie nichts auf der Datei starten.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
