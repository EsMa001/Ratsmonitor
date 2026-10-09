// D1-Verhalten des Node-Adapters (server/node/d1-sqlite.mjs) und des Ersatzmoduls für 'cloudflare:workers'.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openD1 } from '../server/node/d1-sqlite.mjs';

function fresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-d1-'));
  const file = path.join(dir, 'db.sqlite');
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
  assert.deepEqual(await db.batch([]), []);
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
    const { env } = await import(`../server/node/cloudflare-workers.mjs?case=${Date.now()}`);
    assert.ok(env.DB, 'Datenbank geöffnet');
    assert.equal(env.DB, env.DB, 'eine Verbindung je Prozess');
    assert.equal(await env.DB.prepare('SELECT 1 AS one').first('one'), 1);
    assert.equal(env.IMPORT_TOKEN, 'abc');
    assert.equal(env.OPENAI_API_KEY, undefined);
    assert.equal('OPENAI_API_KEY' in env, false);
    assert.equal(env.NOT_SET_ANYWHERE, undefined);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('Ersatzmodul ohne DATABASE_FILE: env.DB fehlt wie auf Cloudflare ohne Bindung', async () => {
  const saved = process.env.DATABASE_FILE;
  delete process.env.DATABASE_FILE;
  try {
    const { env } = await import(`../server/node/cloudflare-workers.mjs?case=nodb-${Date.now()}`);
    assert.equal(env.DB, undefined);
    assert.equal('DB' in env, false);
  } finally { if (saved !== undefined) process.env.DATABASE_FILE = saved; }
});
