/**
 * Ersatz für das Modul 'cloudflare:workers' im Node-Build (RM_TARGET=node, siehe vite.config.ts).
 *
 * Der Code liest überall `import {env} from 'cloudflare:workers'`. Hier liefert `env`:
 * - `env.DB`: die SQLite-Datei aus DATABASE_FILE über einen D1-kompatiblen Adapter (server/node/d1-sqlite.mjs).
 *   Geöffnet beim ersten Zugriff, nie beim Bauen; genau eine Verbindung je Prozess, auch wenn das Modul in mehreren
 *   Server-Paketen (rsc, ssr) landet (globalThis). Ohne DATABASE_FILE, oder wenn die Datei fehlt, ist `env.DB`
 *   undefined wie auf Cloudflare ohne Bindung. serve.mjs startet dann gar nicht erst (nur ohne DATABASE_FILE und mit
 *   RM_ALLOW_NO_DB=1 doch; dann steht es laut im Protokoll, denn die Seiten zeigen still den Stand vom September).
 * - `env.ACCOUNTS`: die Kontendatei aus ACCOUNTS_FILE (eigene Datei, requirements/konten-konzept.md 3.2), eigener
 *   globalThis-Schlüssel, secure_delete an. `env.ACCOUNTS_HOOKS`: Löschprotokoll neben der Datei (deleted.log) und
 *   wal_checkpoint, nur hier im Node-Betrieb; unter Miniflare fehlen sie (die Kontomodule rufen sie optional auf).
 * - alle anderen Schlüssel (ADMIN_SETUP_HASH, IMPORT_TOKEN, …) aus process.env,
 *   gelesen beim Zugriff. Leere Werte gelten als nicht gesetzt.
 *
 * Lokal (npm run dev) wird dieses Modul nicht benutzt; dort kommt `env` weiter von Miniflare.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openD1 } from './d1-sqlite.mjs';
import { createLocalSourceReader } from './ai-local-sources.mjs';

let sourceReader;
const localSources = () => sourceReader ??= createLocalSourceReader({directory:process.env.RM_PDF_STORE||'tmp/pdf-store'});

const STATE = Symbol.for('ratsmonitor.node.database');
const state = (globalThis[STATE] ??= { database: undefined, failedAt: 0, warned: false });
const RETRY_MS = 30_000;

function db() {
  // Nach einem Fehlschlag (z. B. Sperre eines anderen Prozesses) nach 30 s erneut versuchen statt bis zum Neustart nie.
  if (state.database || Date.now() - state.failedAt < RETRY_MS) return state.database;
  const file = process.env.DATABASE_FILE;
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
    state.failedAt = Date.now();
    console.error('[ratsmonitor] Datenbank konnte nicht geöffnet werden:', error?.message ?? error);
  }
  return state.database;
}

const ACCOUNTS = Symbol.for('ratsmonitor.node.accounts');
const accountState = (globalThis[ACCOUNTS] ??= { database: undefined, failedAt: 0 });
function accounts() {
  if (accountState.database || Date.now() - accountState.failedAt < RETRY_MS) return accountState.database;
  const file = process.env.ACCOUNTS_FILE;
  if (!file) return undefined;
  try {
    accountState.database = openD1(file, { busyTimeoutMs: Number(process.env.ACCOUNTS_BUSY_TIMEOUT_MS || 2000), secureDelete: true });
    console.log('[ratsmonitor] Kontendatei geöffnet');
  } catch (error) {
    accountState.failedAt = Date.now();
    console.error('[ratsmonitor] Kontendatei konnte nicht geöffnet werden:', error?.message ?? error);
  }
  return accountState.database;
}
const accountHooks = {
  /** Eine Zeile je Löschung (Hash der Konto-ID, HMAC der Adresse), außerhalb der Datei und ihrer Sicherung */
  async logDeletion({ userHash, emailHmac, at }) {
    const file = process.env.ACCOUNTS_FILE;
    if (!file) return;
    fs.appendFileSync(path.join(path.dirname(file), 'deleted.log'), `${at} ${userHash} ${emailHmac}\n`, { mode: 0o600 });
  },
  async checkpoint() { await accounts()?.exec('PRAGMA wal_checkpoint(TRUNCATE)'); },
};

const value = (key) => {
  const v = process.env[key];
  return v === undefined || v === '' ? undefined : v;
};

export const env = new Proxy(Object.create(null), {
  get(_target, key) {
    if (typeof key !== 'string') return undefined;
    if (key === 'DB') return db();
    if (key === 'AI_LOCAL_SOURCES') return localSources();
    if (key === 'ACCOUNTS') return accounts();
    if (key === 'ACCOUNTS_HOOKS') return process.env.ACCOUNTS_FILE ? accountHooks : undefined;
    return value(key);
  },
  has(_target, key) {
    if (typeof key !== 'string') return false;
    if (key === 'AI_LOCAL_SOURCES') return true;
    if (key === 'ACCOUNTS') return accounts() !== undefined;
    return key === 'DB' ? db() !== undefined : value(key) !== undefined;
  },
  set() { return false; },
  ownKeys() { return []; },
});
