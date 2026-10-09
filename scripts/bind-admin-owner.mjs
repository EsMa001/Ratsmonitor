/**
 * Legt fest, welches Konto die Administration besitzt (system_state 'admin-owner-v1'), ohne Freischaltcode.
 * Für den eigenen Server: Caddy meldet jede Anfrage mit einer festen Nutzer-ID (RM_ADMIN_USER_ID, deploy/node/Caddyfile),
 * dieses Skript bindet genau diese ID. Wer Root auf dem Server hat, darf das; über das Netz geht es nicht.
 *
 *   node scripts/bind-admin-owner.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite max            # nur wenn noch frei
 *   node scripts/bind-admin-owner.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite max --replace  # bestehende Bindung ersetzen
 *
 * Eine von deinem PC übernommene Datenbank trägt den Besitzer des lokalen Dev-Servers; dann --replace verwenden.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const OWNER_KEY = 'admin-owner-v1';

export function bindAdminOwner(db, userId, { replace = false } = {}) {
  if (typeof userId !== 'string' || !/^[A-Za-z0-9._@-]{1,128}$/.test(userId)) throw new Error('Ungültige Nutzer-ID (Buchstaben, Ziffern, . _ @ -, höchstens 128 Zeichen).');
  const current = db.prepare('SELECT value FROM system_state WHERE key=?').get(OWNER_KEY);
  const previous = current ? JSON.parse(current.value).userId : null;
  if (previous === userId) return { changed: false, previous };
  if (previous && !replace) throw new Error(`Die Administration gehört bereits „${previous}“. Zum Ersetzen --replace angeben.`);
  const value = JSON.stringify({ userId, createdAt: new Date().toISOString(), boundBy: 'bind-admin-owner' });
  db.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(OWNER_KEY, value);
  return { changed: true, previous };
}

function main() {
  const [file, userId, flag, ...rest] = process.argv.slice(2);
  if (!file || !userId || rest.length || (flag && flag !== '--replace')) throw new Error('Aufruf: node scripts/bind-admin-owner.mjs <Datenbank.sqlite> <Nutzer-ID> [--replace]');
  const db = new DatabaseSync(path.resolve(file));
  try {
    db.exec('PRAGMA busy_timeout=15000');
    const result = bindAdminOwner(db, userId, { replace: flag === '--replace' });
    console.log(result.changed
      ? `Administration gehört jetzt „${userId}“${result.previous ? ` (vorher „${result.previous}“)` : ''}.`
      : `Administration gehört bereits „${userId}“, nichts geändert.`);
  } finally { db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
