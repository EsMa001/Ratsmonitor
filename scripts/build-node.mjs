/**
 * Baut die App als eigenständigen Node-Server (statt Cloudflare Worker): `npm run build:node`.
 * Ergebnis: dist/standalone/ mit serve.mjs (unser Einstieg, server/node/serve.mjs), dist/{client,server},
 * public/ und den nötigen Paketen.
 *
 * Start (Werte als Umgebungsvariablen, siehe deploy/node/ratsmonitor.env.example und docs/betrieb/node-server.md):
 *   DATABASE_FILE=/srv/ratsmonitor/data/ratsmonitor.sqlite NODE_ENV=production node dist/standalone/serve.mjs
 *
 * Achtung: vinext leert dist/ vor jedem Bau. Ein Node-Build ersetzt also einen Cloudflare-Build im selben Ordner.
 * Der lokale Dev-Server (npm run dev) liest dist/ nicht und bleibt unverändert.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkClientNavigation } from './check-client-navigation.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/vinext/dist/cli.js', import.meta.url));
// Eigener Prozess: vinext beendet sich nach der Standalone-Ausgabe mit process.exit(0), danach käme hier nichts mehr.
const result = spawnSync(process.execPath, [cli, 'build', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, RM_TARGET: 'node', NODE_ENV: 'production' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const standalone = new URL('../dist/standalone/', import.meta.url);
const fail = (message) => { console.error(`build:node: ${message}`); process.exit(1); };
if (!fs.existsSync(new URL('server.js', standalone))) fail('dist/standalone/server.js fehlt.');
fs.copyFileSync(new URL('../server/node/serve.mjs', import.meta.url), new URL('serve.mjs', standalone));

// Prüfen: kein Cloudflare-Modul mehr im Server-Paket, und die Datenbank-Anbindung nicht im Browser-Paket.
const scan = (dir, pattern) => {
  const hits = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !/\.(m?js)$/.test(entry.name)) continue;
    const file = `${entry.parentPath ?? entry.path}/${entry.name}`;
    if (pattern.test(fs.readFileSync(file, 'utf8'))) hits.push(file);
  }
  return hits;
};
const server = fileURLToPath(new URL('dist/server/', standalone));
const client = fileURLToPath(new URL('dist/client/', standalone));
const leftover = scan(server, /["']cloudflare:workers["']/);
if (leftover.length) fail(`'cloudflare:workers' noch im Server-Paket: ${leftover.slice(0, 3).join(', ')}`);
const leaked = scan(client, /node:sqlite|DATABASE_FILE/);
if (leaked.length) fail(`Datenbank-Anbindung im Browser-Paket: ${leaked.slice(0, 3).join(', ')}`);
const navigation = checkClientNavigation(client);
if (navigation.problems.length) fail(`Link-Navigation im Browser-Paket kaputt: ${navigation.problems.join('; ')}`);
console.log('build:node: fertig. Start mit: node dist/standalone/serve.mjs');
