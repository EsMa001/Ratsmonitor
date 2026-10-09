/**
 * Ersatz für das Modul 'cloudflare:workers' im Node-Build (RM_TARGET=node, siehe vite.config.ts).
 *
 * Der Code liest überall `import {env} from 'cloudflare:workers'`. Hier liefert `env`:
 * - `env.DB`: die SQLite-Datei aus DATABASE_FILE über einen D1-kompatiblen Adapter (server/node/d1-sqlite.mjs),
 *   einmal je Prozess geöffnet. Ohne DATABASE_FILE ist `env.DB` undefined, wie auf Cloudflare ohne Bindung:
 *   Die Seiten zeigen dann den mitgelieferten Stand, die Administration meldet „Datenbank fehlt“.
 * - alle anderen Schlüssel (ADMIN_SETUP_HASH, IMPORT_TOKEN, OPENAI_API_KEY, VAPID_*, …) aus process.env.
 *   Leere Werte gelten als nicht gesetzt.
 *
 * Lokal (npm run dev) wird dieses Modul nicht benutzt; dort kommt `env` weiter von Miniflare.
 */
import { openD1 } from './d1-sqlite.mjs';

let database;
let failed = false;

function db() {
  if (database || failed) return database;
  const file = process.env.DATABASE_FILE;
  if (!file) return undefined;
  try {
    database = openD1(file, { readOnly: process.env.DATABASE_READONLY === '1' });
  } catch (error) {
    failed = true;
    console.error('[ratsmonitor] Datenbank konnte nicht geöffnet werden:', error?.message ?? error);
  }
  return database;
}

const value = (key) => {
  const v = process.env[key];
  return v === undefined || v === '' ? undefined : v;
};

export const env = new Proxy(Object.create(null), {
  get(_target, key) {
    if (typeof key !== 'string') return undefined;
    if (key === 'DB') return db();
    return value(key);
  },
  has(_target, key) {
    if (typeof key !== 'string') return false;
    return key === 'DB' ? db() !== undefined : value(key) !== undefined;
  },
  set() { return false; },
  ownKeys() { return []; },
});

export default { env };
