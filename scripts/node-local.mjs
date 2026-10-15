#!/usr/bin/env node
/*
 * Lokaler Node-Server wie auf dem Server (node:sqlite, ohne die Größengrenze der lokalen D1 im Dev-Server), auf der lokalen
 * D1-Datei. Zum Prüfen von plenara.X mit häufigen Begriffen. Baut zuerst (scripts/build-node.mjs), außer mit --no-build.
 * Mit eigener lokaler Kontendatei (tmp/accounts-local.sqlite, Migrationen aus drizzle-accounts) und dem Testkonto
 * enterprise@plenara.test (Stufe Enterprise); der Start druckt einen Anmeldelink (login-link, ohne Mail).
 * Aufruf: node scripts/node-local.mjs [--no-build] [--port 3000] [<datei.sqlite>]
 */
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const portAt = args.indexOf('--port');
const port = portAt >= 0 ? args[portAt + 1] : '3000';
const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const file = args.find((a, i) => !a.startsWith('--') && i !== portAt + 1)
  ?? `${dir}/${readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite').sort((a, b) => statSync(`${dir}/${b}`).size - statSync(`${dir}/${a}`).size)[0]}`;

if (!args.includes('--no-build')) {
  const built = spawnSync(process.execPath, ['scripts/build-node.mjs'], { stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status ?? 1);
}
/* Lokale Kontendatei mit festem Schlüssel je Rechner (nicht in Git) */
mkdirSync('tmp', { recursive: true });
const accounts = resolve('tmp/accounts-local.sqlite'), secretFile = 'tmp/accounts-local.secret';
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const site = `http://localhost:${port}`;
const env = { ...process.env, DATABASE_FILE: resolve(file), PORT: port, HOST: '127.0.0.1', ACCOUNTS_FILE: accounts,
  ACCOUNTS_SECRET: readFileSync(secretFile, 'utf8').trim(), SITE_URL: site, RM_ACCESS: 'open', MAIL_TRANSPORT: 'log' };
const node = (script, list, input) => spawnSync(process.execPath, [script, ...list], { env, input, encoding: 'utf8' });
const migrated = node('scripts/node-migrate.mjs', [accounts, '--dir', 'drizzle-accounts', '--table', 'accounts_migrations']);
if (migrated.status !== 0) { console.error(migrated.stderr || migrated.stdout); process.exit(1); }
const EMAIL = 'enterprise@plenara.test\n';
node('scripts/accounts/manage.mjs', ['create', '--email-stdin', '--note', 'lokal', '--tier', 'enterprise'], EMAIL);
node('scripts/accounts/manage.mjs', ['tier', 'enterprise', '--email-stdin'], EMAIL);
const link = node('scripts/accounts/manage.mjs', ['login-link', '--base', site, '--email-stdin'], EMAIL);
console.log(`[node-local] ${site} auf ${file}`);
console.log(`[node-local] Anmelden als enterprise@plenara.test: ${(link.stdout.match(/https?:\/\/\S+/) || [link.stderr.trim()])[0]}`);
const child = spawn(process.execPath, ['dist/standalone/serve.mjs'], { stdio: 'inherit', env });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
child.on('exit', (code) => process.exit(code ?? 0));
