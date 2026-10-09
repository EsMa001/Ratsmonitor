/**
 * Ersatz für das Modul 'cloudflare:workers' im Node-Build (RM_TARGET=node, siehe vite.config.ts).
 *
 * Der Code liest überall `import {env} from 'cloudflare:workers'`. Hier liefert `env`:
 * - `env.DB`: die SQLite-Datei aus DATABASE_FILE über einen D1-kompatiblen Adapter (server/node/d1-sqlite.mjs).
 *   Geöffnet beim ersten Zugriff, nie beim Bauen; genau eine Verbindung je Prozess, auch wenn das Modul in mehreren
 *   Server-Paketen (rsc, ssr) landet (globalThis). Ohne DATABASE_FILE, oder wenn die Datei fehlt, ist `env.DB`
 *   undefined wie auf Cloudflare ohne Bindung; das steht dann laut im Protokoll, denn die Seiten zeigen still den
 *   mitgelieferten Stand.
 * - alle anderen Schlüssel (ADMIN_SETUP_HASH, IMPORT_TOKEN, OPENAI_API_KEY, VAPID_*, …) aus process.env,
 *   gelesen beim Zugriff. Leere Werte gelten als nicht gesetzt.
 *
 * Lokal (npm run dev) wird dieses Modul nicht benutzt; dort kommt `env` weiter von Miniflare.
 */
import { openD1 } from './d1-sqlite.mjs';

const STATE = Symbol.for('ratsmonitor.node.database');
const state = (globalThis[STATE] ??= { database: undefined, failed: false, warned: false });

function db() {
  if (state.database || state.failed) return state.database;
  const file = process.env.DATABASE_FILE || process.env.DB_FILE;
  if (!file) {
    if (!state.warned) { state.warned = true; console.error('[ratsmonitor] DATABASE_FILE ist nicht gesetzt: keine Datenbank, die Seiten zeigen den mitgelieferten Stand.'); }
    return undefined;
  }
  try {
    state.database = openD1(file, {
      readOnly: process.env.DATABASE_READONLY === '1',
      busyTimeoutMs: Number(process.env.DATABASE_BUSY_TIMEOUT_MS || 5000),
    });
    console.log(`[ratsmonitor] Datenbank geöffnet: ${file}${process.env.DATABASE_READONLY === '1' ? ' (nur lesen)' : ''}`);
  } catch (error) {
    state.failed = true;
    console.error('[ratsmonitor] Datenbank konnte nicht geöffnet werden:', error?.message ?? error);
  }
  return state.database;
}

/** Für den Server-Einstieg (server/node/serve.mjs): Verbindung beim Beenden sauber schließen. */
export function closeDatabase() {
  try { state.database?.close(); } catch { /* schon zu */ }
  state.database = undefined;
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
