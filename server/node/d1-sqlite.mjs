/**
 * D1-kompatibler Zugang zu einer SQLite-Datei über node:sqlite, für den Betrieb als normaler Node-Server
 * (Build mit RM_TARGET=node, siehe server/node/cloudflare-workers.mjs).
 *
 * Nachgebildet wird, was der Code von D1 nutzt: prepare, bind, first, all, run, raw, batch, exec.
 * - bind() liefert wie bei D1 eine neue Anweisung; dieselbe vorbereitete Anweisung kann mehrfach gebunden werden.
 * - Werte: true/false werden 1/0 wie bei D1; undefined, Objekte und Arrays lehnt D1 ab, hier ebenso.
 * - batch() läuft in einer Transaktion und ganz ohne Unterbrechung (node:sqlite ist synchron): entweder alles oder nichts.
 * - Fehler tragen wie bei D1 das Präfix "D1_ERROR: ", der ursprüngliche Text bleibt dahinter erhalten.
 * - Zeilen sind gewöhnliche Objekte (node:sqlite liefert Objekte ohne Prototyp).
 *
 * node:sqlite rechnet im Hauptthread: Eine lange Abfrage hält alle anderen Anfragen dieses Prozesses so lange an,
 * wie D1 sie hintereinander abarbeitet.
 */
import { DatabaseSync } from 'node:sqlite';

const CACHE_LIMIT = 500;

function d1Error(error) {
  if (error && typeof error.message === 'string' && error.message.startsWith('D1_')) return error;
  const wrapped = new Error('D1_ERROR: ' + (error?.message ?? String(error)), { cause: error });
  if (error?.code) wrapped.code = error.code;
  return wrapped;
}

function bindValue(value, index) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error(`D1_TYPE_ERROR: Type '${value === undefined ? 'undefined' : typeof value}' not supported for value '${String(value)}' (Parameter ${index + 1})`);
}

const plain = (row) => (row == null ? row : { ...row });

class Statement {
  #database; #sql; #params;
  constructor(database, sql, params = []) { this.#database = database; this.#sql = sql; this.#params = params; }
  bind(...values) { return new Statement(this.#database, this.#sql, values.map(bindValue)); }
  #statement() { return this.#database.statement(this.#sql); }
  /** Synchrone Ausführung; batch() nutzt sie, damit eine Transaktion nicht von anderen Anfragen unterbrochen wird. */
  execute() {
    const started = performance.now();
    try {
      const statement = this.#statement();
      if (statement.columns().length) {
        const results = statement.all(...this.#params).map(plain);
        return { success: true, results, meta: this.#database.meta(started, 0, null, results.length) };
      }
      const outcome = statement.run(...this.#params);
      const changes = Number(outcome.changes);
      return { success: true, results: [], meta: this.#database.meta(started, changes, outcome.lastInsertRowid, 0) };
    } catch (error) { throw d1Error(error); }
  }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
  async first(column) {
    let row;
    try { row = this.#statement().get(...this.#params); } catch (error) { throw d1Error(error); }
    if (row === undefined) return null;
    if (column === undefined) return plain(row);
    if (!Object.hasOwn(row, column)) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    return row[column];
  }
  async raw(options = {}) {
    let statement, rows;
    try { statement = this.#statement(); rows = statement.all(...this.#params); } catch (error) { throw d1Error(error); }
    const names = statement.columns().map((column) => column.name);
    const values = rows.map((row) => names.map((name) => row[name]));
    return options.columnNames ? [names, ...values] : values;
  }
}

class Database {
  #db; #cache = new Map();
  constructor(db) { this.#db = db; }
  statement(sql) {
    let statement = this.#cache.get(sql);
    if (statement) { this.#cache.delete(sql); this.#cache.set(sql, statement); return statement; }
    statement = this.#db.prepare(sql);
    this.#cache.set(sql, statement);
    if (this.#cache.size > CACHE_LIMIT) this.#cache.delete(this.#cache.keys().next().value);
    return statement;
  }
  meta(started, changes, lastRowId, rowsRead) {
    return {
      duration: performance.now() - started,
      changes,
      last_row_id: lastRowId == null ? 0 : Number(lastRowId),
      changed_db: changes > 0,
      rows_read: rowsRead,
      rows_written: changes,
      size_after: 0,
    };
  }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    if (!Array.isArray(statements)) throw new Error('D1_ERROR: batch() erwartet eine Liste von Anweisungen');
    if (!statements.length) return [];
    if (statements.some((s) => !(s instanceof Statement))) throw new Error('D1_ERROR: batch() erwartet Anweisungen aus prepare()');
    // Kein await bis zum COMMIT: Die Transaktion läuft am Stück und mischt sich nicht mit anderen Anfragen.
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map((statement) => statement.execute());
      this.#db.exec('COMMIT');
      return results;
    } catch (error) {
      try { this.#db.exec('ROLLBACK'); } catch { /* bereits zurückgerollt */ }
      throw d1Error(error);
    }
  }
  async exec(sql) {
    const started = performance.now();
    const count = sql.split('\n').filter((line) => line.trim()).length;
    try { this.#db.exec(sql); } catch (error) { throw d1Error(error); }
    return { count, duration: performance.now() - started };
  }
  async dump() { throw new Error('D1_ERROR: dump() wird im Node-Betrieb nicht unterstützt'); }
  withSession() { return this; }
  close() { this.#cache.clear(); this.#db.close(); }
}

/**
 * Öffnet die Datenbankdatei. Einstellungen wie bei D1/Miniflare (Fremdschlüssel an), dazu WAL, damit Leser nicht auf
 * Schreiber warten, und eine Wartezeit, wenn ein anderer Prozess (Skripte, Sicherung) gerade schreibt.
 */
export function openD1(file, { readOnly = false, busyTimeoutMs = 15000 } = {}) {
  let db;
  try { db = new DatabaseSync(file, { readOnly }); } catch (error) { throw d1Error(error); }
  db.exec(`PRAGMA busy_timeout=${Number(busyTimeoutMs) | 0}`);
  if (!readOnly) {
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA synchronous=NORMAL');
  }
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('PRAGMA cache_size=-262144');
  db.exec('PRAGMA mmap_size=1073741824');
  return new Database(db);
}
