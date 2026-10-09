/**
 * Baut die App als eigenständigen Node-Server (statt Cloudflare Worker): `npm run build:node`.
 * Ergebnis: dist/standalone/server.js mit dist/standalone/dist/{client,server} und den nötigen Paketen.
 *
 * Start (Werte als Umgebungsvariablen, siehe docs/betrieb/node-server.md):
 *   DATABASE_FILE=/srv/ratsmonitor/data/ratsmonitor.sqlite PORT=3000 HOST=127.0.0.1 node dist/standalone/server.js
 *
 * Der lokale Dev-Server (npm run dev) und der Cloudflare-Build (npm run build) bleiben unverändert.
 */
import { fileURLToPath } from 'node:url';

process.env.RM_TARGET = 'node';
process.env.NODE_ENV ??= 'production';
const cli = new URL('../node_modules/vinext/dist/cli.js', import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), 'build', ...process.argv.slice(2)];
await import(cli.href);
