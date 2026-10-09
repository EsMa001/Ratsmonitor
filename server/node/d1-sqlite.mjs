/**
 * D1-kompatibler Zugang zu einer SQLite-Datei über node:sqlite, für den Betrieb als normaler Node-Server
 * (Build mit RM_TARGET=node, siehe server/node/cloudflare-workers.mjs).
 *
 * Nachgebildet wird, was der Code von D1 nutzt: prepare, bind, first, all, run, raw, batch, exec.
 * - prepare() übersetzt noch nichts; SQL-Fehler kommen wie bei D1 als abgelehntes Promise der Ausführung.
 * - bind() liefert eine neue Anweisung; dieselbe vorbereitete Anweisung kann mehrfach gebunden werden.
 * - Werte wie D1: ganze Zahlen als INTEGER (node:sqlite machte aus 5 sonst 5.0), true/false als 1/0,
 *   NaN/Unendlich als null, Bytes als BLOB; undefined, Objekte und BigInt lehnt D1 ab, hier ebenso.
 * - batch() läuft in einer Transaktion am Stück (node:sqlite ist synchron, kein await zwischen BEGIN und COMMIT):
 *   entweder alles oder nichts. Nur lesende Pakete nehmen keine Schreibsperre.
 * - meta.changes zählt wie D1 auch Zeilen, die Trigger schreiben.
 * - Fehler tragen wie bei D1 das Präfix "D1_ERROR: ", der Text von SQLite bleibt dahinter erhalten.
 * - Zeilen sind gewöhnliche Objekte (node:sqlite liefert Objekte ohne Prototyp, React lehnt die ab).
 *
 * node:sqlite rechnet im Hauptthread. Vor jeder Ausführung gibt der Adapter deshalb kurz an die Ereignisschleife ab
 * (setImmediate): Schleifen mit Tausenden Abfragen (Import, Kennzahlen) lassen so andere Anfragen dazwischen, wie es
 * bei D1 die Netzwerkwartezeit tat. Eine einzelne lange Abfrage hält den Prozess trotzdem für ihre Dauer an.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const CACHE_LIMIT = 500;
const SLOW_MS = Number(process.env.DATABASE_SLOW_MS || 1000);
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

function d1Error(error) {
  if (error && typeof error.message === 'string' && error.message.startsWith('D1_')) return error;
  const wrapped = new Error('D1_ERROR: ' + (error?.message ?? String(error)), { cause: error });
  if (error?.code) wrapped.code = error.code;
  return wrapped;
}

function typeError(value, index) {
  const shown = typeof value === 'symbol' ? value.toString() : (() => { try { return String(value); } catch { return typeof value; } })();
  return new Error(`D1_TYPE_ERROR: Type '${value === null ? 'null' : typeof value}' not supported for value '${shown}' (Parameter ${index + 1})`);
}

function bindValue(value, index) {
  if (value === null || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number.isSafeInteger(value) ? BigInt(value) : value;
  }
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value) && value.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) return Uint8Array.from(value);
  throw typeError(value, index);
}

const plain = (row) => (row == null ? row : { ...row });

// Liest die Anweisung keine Daten, sondern ändert sie? Für die Wahl der Sperre eines Pakets; im Zweifel „schreibt“.
const READ_ONLY = /^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(?:SELECT|VALUES|EXPLAIN)\b/i;
const WITH = /^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*WITH\b/i;
const WRITES = /\b(?:INSERT|UPDATE|DELETE|REPLACE|UPSERT|CREATE|DROP|ALTER)\b/i;
const readsOnly = (sql) => (READ_ONLY.test(sql) || WITH.test(sql)) && !WRITES.test(sql) && !/\bRETURNING\b/i.test(sql);

class Statement {
  #database; #sql; #params;
  constructor(database, sql, params = []) { this.#database = database; this.#sql = sql; this.#params = params; }
  get sql() { return this.#sql; }
  bind(...values) { return new Statement(this.#database, this.#sql, values.map(bindValue)); }
  /** Übersetzen (oder aus dem Zwischenspeicher holen). Wirft bei SQL-Fehlern. */
  compile() { return this.#database.statement(this.#sql); }
  /** Synchrone Ausführung; batch() nutzt sie, damit eine Transaktion nicht von anderen Anfragen unterbrochen wird. */
  execute() {
    const db = this.#database, started = performance.now();
    try {
      const statement = this.compile();
      const returnsRows = statement.columns().length > 0;
      // Reine Leseabfragen ändern nichts; nur bei schreibenden die Zähler vorher und nachher lesen.
      if (returnsRows && readsOnly(this.#sql)) {
        const results = statement.all(...this.#params).map(plain);
        return { success: true, results, meta: db.meta(this.#sql, started, 0, 0, results.length) };
      }
      const before = db.counters();
      let results = [];
      if (returnsRows) results = statement.all(...this.#params).map(plain);
      else statement.run(...this.#params);
      const after = db.counters();
      const changes = Number(after.c - before.c);
      return { success: true, results, meta: db.meta(this.#sql, started, changes, changes > 0 ? after.r : 0, results.length) };
    } catch (error) { throw d1Error(error); }
  }
  async all() { await yieldToEventLoop(); return this.execute(); }
  async run() { await yieldToEventLoop(); return this.execute(); }
  async first(column) {
    await yieldToEventLoop();
    const started = performance.now();
    let row;
    try { row = this.compile().get(...this.#params); } catch (error) { throw d1Error(error); }
    this.#database.slow(this.#sql, started);
    if (row === undefined) return null;
    if (column === undefined) return plain(row);
    if (row[column] === undefined) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    return row[column];
  }
  async raw(options = {}) {
    await yieldToEventLoop();
    let statement, rows;
    try { statement = this.compile(); rows = statement.all(...this.#params); } catch (error) { throw d1Error(error); }
    const names = statement.columns().map((column) => column.name);
    const values = rows.map((row) => names.map((name) => row[name]));
    return options.columnNames ? [names, ...values] : values;
  }
}

class Database {
  #db; #cache = new Map(); #probe;
  constructor(db) { this.#db = db; this.#probe = db.prepare('SELECT total_changes() AS c, last_insert_rowid() AS r'); this.#probe.setReadBigInts(true); }
  get sqlite() { return this.#db; }
  statement(sql) {
    let statement = this.#cache.get(sql);
    if (statement) { this.#cache.delete(sql); this.#cache.set(sql, statement); return statement; }
    statement = this.#db.prepare(sql);
    this.#cache.set(sql, statement);
    if (this.#cache.size > CACHE_LIMIT) this.#cache.delete(this.#cache.keys().next().value);
    return statement;
  }
  counters() { return this.#probe.get(); }
  slow(sql, started) {
    const ms = performance.now() - started;
    if (ms >= SLOW_MS) console.warn(`[db] langsam ${Math.round(ms)} ms: ${sql.replace(/\s+/g, ' ').slice(0, 160)}`);
    return ms;
  }
  meta(sql, started, changes, lastRowId, rowsRead) {
    return {
      served_by: 'node-sqlite',
      duration: this.slow(sql, started),
      changes,
      last_row_id: Number(lastRowId ?? 0),
      changed_db: changes > 0,
      rows_read: rowsRead,
      rows_written: changes,
      size_after: 0,
    };
  }
  prepare(sql) {
    if (typeof sql !== 'string') throw new Error('D1_ERROR: prepare() erwartet SQL als Text');
    return new Statement(this, sql);
  }
  async batch(statements) {
    if (!Array.isArray(statements) || !statements.length) throw new Error('D1_ERROR: batch() erwartet eine nicht leere Liste von Anweisungen');
    if (statements.some((s) => !(s instanceof Statement))) throw new Error('D1_ERROR: batch() erwartet Anweisungen aus prepare()');
    await yieldToEventLoop();
    // Alles vor BEGIN übersetzen: Ein SQL-Fehler bricht dann ab, ohne dass eine Transaktion offen ist.
    try { for (const statement of statements) statement.compile(); } catch (error) { throw d1Error(error); }
    if (this.#db.isTransaction) throw new Error('D1_ERROR: batch() während einer offenen Transaktion');
    const write = !statements.every((statement) => readsOnly(statement.sql));
    // Ab hier kein await bis COMMIT oder ROLLBACK: Die Transaktion läuft am Stück und mischt sich nicht mit anderen Anfragen.
    this.#db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try {
      const results = statements.map((statement) => statement.execute());
      this.#db.exec('COMMIT');
      return results;
    } catch (error) {
      if (this.#db.isTransaction) { try { this.#db.exec('ROLLBACK'); } catch { /* bereits zurückgerollt */ } }
      throw d1Error(error);
    }
  }
  async exec(sql) {
    await yieldToEventLoop();
    const started = performance.now();
    const count = sql.split('\n').filter((line) => line.trim()).length;
    try { this.#db.exec(sql); } catch (error) { throw d1Error(error); }
    return { count, duration: this.slow(sql, started) };
  }
  async dump() { throw new Error('D1_ERROR: dump() wird im Node-Betrieb nicht unterstützt'); }
  withSession() { return this; }
  close() { this.#cache.clear(); if (this.#db.isOpen) this.#db.close(); }
}

/**
 * Öffnet die Datenbankdatei. Einstellungen wie bei D1/Miniflare (Fremdschlüssel an), dazu WAL, damit Leser nicht auf
 * Schreiber warten. busyTimeoutMs ist für den Server kurz: Während SQLite auf eine Sperre wartet, steht der Prozess.
 * Eine fehlende Datei wird nicht angelegt (ein Tippfehler im Pfad gäbe sonst eine leere Datenbank), außer mit create.
 */
export function openD1(file, { readOnly = false, busyTimeoutMs = 5000, create = false } = {}) {
  if (!create && !fs.existsSync(file)) throw new Error(`D1_ERROR: Datenbankdatei fehlt: ${file}`);
  let db;
  try { db = new DatabaseSync(file, { readOnly }); } catch (error) { throw d1Error(error); }
  db.exec(`PRAGMA busy_timeout=${Math.max(0, Number(busyTimeoutMs) | 0)}`);
  if (!readOnly) {
    const mode = db.prepare('PRAGMA journal_mode=WAL').get().journal_mode;
    if (String(mode).toLowerCase() !== 'wal') console.warn(`[db] journal_mode ist ${mode}, nicht wal`);
    db.exec('PRAGMA synchronous=NORMAL');
    db.exec('PRAGMA journal_size_limit=67108864');
  }
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('PRAGMA cache_size=-131072');
  return new Database(db);
}
