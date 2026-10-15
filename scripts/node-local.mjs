#!/usr/bin/env node
/*
 * Lokaler Node-Server wie auf dem Server (node:sqlite, ohne die Größengrenze der lokalen D1 im Dev-Server), auf der lokalen
 * D1-Datei. Zum Prüfen von plenara.X mit häufigen Begriffen. Baut zuerst (scripts/build-node.mjs), außer mit --no-build.
 * Ohne Kontendatei gelten keine Stufengrenzen. Aufruf: node scripts/node-local.mjs [--no-build] [--port 3000] [<datei.sqlite>]
 */
import { spawnSync, spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
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
const env = { ...process.env, DATABASE_FILE: resolve(file), PORT: port, HOST: '127.0.0.1' };
delete env.ACCOUNTS_FILE;
console.log(`[node-local] http://localhost:${port} auf ${file}`);
const child = spawn(process.execPath, ['dist/standalone/serve.mjs'], { stdio: 'inherit', env });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
child.on('exit', (code) => process.exit(code ?? 0));
