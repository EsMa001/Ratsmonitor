// D1-Verhalten des Node-Adapters (server/node/d1-sqlite.mjs) und des Ersatzmoduls für 'cloudflare:workers'.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openD1 } from '../server/node/d1-sqlite.mjs';

const STATE = Symbol.for('ratsmonitor.node.database');
const resetShim = () => { try { globalThis[STATE]?.database?.close(); } catch {} delete globalThis[STATE]; };

function fresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-d1-'));
  const file = path.join(dir, 'db.sqlite');
  fs.writeFileSync(file, '');
  const db = openD1(file);
  return { db, file, dir };
}

test('bind() liefert eine neue Anweisung: dieselbe vorbereitete Anweisung lässt sich mehrfach binden', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)');
  const insert = db.prepare('INSERT INTO t(id, v) VALUES(?, ?)');
  const a = insert.bind(1, 'a'), b = insert.bind(2, 'b');
  await db.batch([a, b]);
  const { results } = await db.prepare('SELECT id, v FROM t ORDER BY id').all();
  assert.deepEqual(results, [{ id: 1, v: 'a' }, { id: 2, v: 'b' }]);
});

test('Werte: true/false als 1/0, undefined und Objekte abgelehnt wie bei D1', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE t(v)');
  assert.throws(() => db.prepare('INSERT INTO t VALUES(?)').bind(10n), /D1_TYPE_ERROR/);
  await db.prepare('INSERT INTO t VALUES(?)').bind(true).run();
  await db.prepare('INSERT INTO t VALUES(?)').bind(false).run();
  assert.deepEqual((await db.prepare('SELECT v FROM t').all()).results.map((r) => r.v), [1, 0]);
  assert.throws(() => db.prepare('INSERT INTO t VALUES(?)').bind(undefined), /D1_TYPE_ERROR/);
  assert.throws(() => db.prepare('INSERT INTO t VALUES(?)').bind({ a: 1 }), /D1_TYPE_ERROR/);
});

test('first(), first(Spalte), all(), run() und raw() liefern die Formen von D1', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)');
  const run = await db.prepare('INSERT INTO t(v) VALUES(?)').bind('x').run();
  assert.equal(run.success, true);
  assert.equal(run.meta.changes, 1);
  assert.equal(run.meta.last_row_id, 1);
  assert.deepEqual(run.results, []);
  const row = await db.prepare('SELECT id, v FROM t').first();
  assert.deepEqual(row, { id: 1, v: 'x' });
  assert.equal(Object.getPrototypeOf(row), Object.prototype, 'gewöhnliches Objekt');
  assert.equal(await db.prepare('SELECT v FROM t').first('v'), 'x');
  assert.equal(await db.prepare('SELECT v FROM t WHERE id=99').first(), null);
  assert.equal(await db.prepare('SELECT v FROM t WHERE id=99').first('v'), null);
  await assert.rejects(db.prepare('SELECT v FROM t').first('nope'), /D1_COLUMN_NOTFOUND/);
  assert.deepEqual(await db.prepare('SELECT id, v FROM t').raw(), [[1, 'x']]);
  assert.deepEqual(await db.prepare('SELECT id, v FROM t').raw({ columnNames: true }), [['id', 'v'], [1, 'x']]);
});

test('RETURNING funktioniert mit first() und all()', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE s(key TEXT PRIMARY KEY, value TEXT)');
  const saved = await db.prepare('INSERT OR IGNORE INTO s(key, value) VALUES(?, ?) RETURNING value').bind('k', 'v').first();
  assert.deepEqual(saved, { value: 'v' });
  const again = await db.prepare('INSERT OR IGNORE INTO s(key, value) VALUES(?, ?) RETURNING value').bind('k', 'w').first();
  assert.equal(again, null);
});

test('batch() ist atomar: ein Fehler rollt alles zurück, Fehlertext mit D1_ERROR', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY)');
  const insert = db.prepare('INSERT INTO t(id) VALUES(?)');
  await assert.rejects(db.batch([insert.bind(1), insert.bind(2), insert.bind(1)]), (error) => {
    assert.match(error.message, /^D1_ERROR: .*UNIQUE constraint failed/);
    return true;
  });
  assert.equal(await db.prepare('SELECT count(*) AS n FROM t').first('n'), 0);
  const results = await db.batch([insert.bind(3), db.prepare('SELECT id FROM t')]);
  assert.equal(results.length, 2);
  assert.equal(results[0].meta.changes, 1);
  assert.deepEqual(results[1].results, [{ id: 3 }]);
  await assert.rejects(db.batch([]), /D1_ERROR/);
});

test('Fehler in einzelnen Anweisungen tragen D1_ERROR und den SQLite-Text', async () => {
  const { db } = fresh();
  await assert.rejects(db.prepare('SELECT * FROM missing').all(), /^Error: D1_ERROR: no such table: missing/);
  await assert.rejects(db.exec('SELEC 1'), /D1_ERROR/);
});

test('Fremdschlüssel sind wie bei D1 eingeschaltet, WAL ist aktiv', async () => {
  const { db } = fresh();
  assert.equal(await db.prepare('PRAGMA foreign_keys').first('foreign_keys'), 1);
  assert.equal(await db.prepare('PRAGMA journal_mode').first('journal_mode'), 'wal');
});

test('Ersatzmodul: env.DB aus DATABASE_FILE, übrige Werte aus process.env, leere Werte fehlen', async () => {
  const { file } = fresh();
  const saved = { ...process.env };
  try {
    process.env.DATABASE_FILE = file;
    process.env.IMPORT_TOKEN = 'abc';
    process.env.OPENAI_API_KEY = '';
    resetShim();
    const { env } = await import(`../server/node/cloudflare-workers.mjs?case=${Date.now()}`);
    assert.ok(env.DB, 'Datenbank geöffnet');
    assert.equal(env.DB, env.DB, 'eine Verbindung je Prozess');
    assert.equal(await env.DB.prepare('SELECT 1 AS one').first('one'), 1);
    assert.equal(env.IMPORT_TOKEN, 'abc');
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal('OPENAI_API_KEY' in env, false);
    assert.equal(env.NOT_SET_ANYWHERE, undefined);
  } finally {
    resetShim();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('Ersatzmodul ohne DATABASE_FILE: env.DB fehlt wie auf Cloudflare ohne Bindung', async () => {
  const saved = process.env.DATABASE_FILE;
  delete process.env.DATABASE_FILE;
  resetShim();
  try {
    const { env } = await import(`../server/node/cloudflare-workers.mjs?case=nodb-${Date.now()}`);
    assert.equal(env.DB, undefined);
    assert.equal('DB' in env, false);
  } finally { resetShim(); if (saved !== undefined) process.env.DATABASE_FILE = saved; }
});

test('Ganze Zahlen bleiben ganze Zahlen (node:sqlite machte aus 5 sonst 5.0)', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE t(a TEXT, j TEXT)');
  await db.prepare("INSERT INTO t VALUES(?, json_object('n', ?, 'x', ?))").bind(5, 7, 2.5).run();
  const row = await db.prepare("SELECT a, j, typeof(a) ta, ?||'' s, typeof(?) tb FROM t").bind(3, 4).first();
  assert.deepEqual(row, { a: '5', j: '{"n":7,"x":2.5}', ta: 'text', s: '3', tb: 'integer' });
  assert.equal(await db.prepare('SELECT ? AS v').bind(Number.NaN).first('v'), null);
});

test('meta.changes zählt Zeilen aus Triggern mit, SELECT ändert nichts, RETURNING zählt', async () => {
  const { db } = fresh();
  await db.exec('CREATE TABLE t(a); CREATE TABLE log(x); CREATE TRIGGER tr AFTER INSERT ON t BEGIN INSERT INTO log VALUES(1); END;');
  const run = await db.prepare('INSERT INTO t VALUES(1)').run();
  assert.equal(run.meta.changes, 2);
  assert.equal((await db.prepare('SELECT * FROM t').all()).meta.changes, 0);
  const ret = await db.prepare('INSERT INTO t VALUES(2) RETURNING a').all();
  assert.deepEqual(ret.results, [{ a: 2 }]);
  assert.equal(ret.meta.changes, 2);
});

test('Ein SQL-Fehler kommt als abgelehntes Promise, nicht schon bei prepare()', async () => {
  const { db } = fresh();
  const statement = db.prepare('SELECT * FROM fehlt');
  await assert.rejects(statement.first(), /no such table/);
  await assert.rejects(db.batch([db.prepare('SELECT 1'), statement]), /no such table/);
  await db.exec('CREATE TABLE t(a)');
  await db.batch([db.prepare('INSERT INTO t VALUES(1)')]);
  assert.equal(await db.prepare('SELECT count(*) n FROM t').first('n'), 1, 'nach dem Fehler keine offene Transaktion');
});

test('Lesende Pakete laufen ohne Schreibsperre neben einem anderen Schreiber', async () => {
  const { db, file } = fresh();
  await db.exec('CREATE TABLE t(a)');
  const { DatabaseSync } = await import('node:sqlite');
  const other = new DatabaseSync(file);
  other.exec('PRAGMA busy_timeout=0');
  other.exec('BEGIN IMMEDIATE');
  other.exec('INSERT INTO t VALUES(1)');
  try {
    const started = Date.now();
    const [count] = await db.batch([db.prepare('SELECT count(*) AS n FROM t')]);
    assert.equal(count.results[0].n, 0);
    assert.ok(Date.now() - started < 1000, 'kein Warten auf die Sperre');
  } finally { other.exec('ROLLBACK'); other.close(); }
});

test('Eine fehlende Datei wird nicht still neu angelegt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-d1-'));
  assert.throws(() => openD1(path.join(dir, 'tippfehler.sqlite')), /Datenbankdatei fehlt/);
  assert.equal(fs.existsSync(path.join(dir, 'tippfehler.sqlite')), false);
});

test('Lange Schleifen lassen andere Arbeit dazwischen (Abgabe an die Ereignisschleife)', async () => {
  const { db } = fresh();
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 0);
  try { for (let i = 0; i < 200; i++) await db.prepare('SELECT ?').bind(i).first(); }
  finally { clearInterval(timer); }
  assert.ok(ticks > 0, 'Zeitgeber liefen zwischen den Abfragen');
});
