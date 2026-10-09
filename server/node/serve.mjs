/**
 * Einstieg des Node-Servers, statt des von vinext erzeugten dist/standalone/server.js.
 * scripts/build-node.mjs legt diese Datei als dist/standalone/serve.mjs ab; Start: node dist/standalone/serve.mjs
 *
 * Unterschiede zum erzeugten Einstieg:
 * - Lauscht standardmäßig nur auf 127.0.0.1: Die Admin-Kennung kommt aus Kopfzeilen, die nur Caddy setzen darf.
 * - keepAliveTimeout länger als der von Caddy: Sonst schließt Node eine Verbindung, die Caddy gerade wiederverwendet,
 *   und ein POST endet mit 502.
 * - Bei SIGTERM/SIGINT (systemctl stop/restart) laufende Anfragen kurz ausklingen lassen und die Datenbank schließen.
 */
import { join } from 'node:path';
import { startProdServer } from 'vinext/server/prod-server';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '127.0.0.1';
const graceMs = Number(process.env.SHUTDOWN_GRACE_MS ?? 20000);

const { server } = await startProdServer({ port, host, outDir: join(import.meta.dirname, 'dist') });
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 0; // Abrufe im Adminbereich dauern Minuten; Grenzen setzt Caddy
console.log(`[ratsmonitor] Node ${process.version}, NODE_ENV=${process.env.NODE_ENV ?? '(leer)'}, TZ=${process.env.TZ ?? '(System)'}`);

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[ratsmonitor] ${signal}: keine neuen Anfragen, beende in höchstens ${Math.round(graceMs / 1000)} s`);
  const done = () => {
    try { globalThis[Symbol.for('ratsmonitor.node.database')]?.database?.close(); } catch { /* schon zu */ }
    process.exit(0);
  };
  server.close(done);
  server.closeIdleConnections?.();
  setTimeout(done, graceMs).unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
