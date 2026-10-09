/**
 * Prüft das Browser-Paket eines Builds: Lädt vinexts Link die clientseitige Navigation aus einem Paketteil,
 * der `navigateClientSide` auch wirklich exportiert? Sonst tun Klicks auf Links nichts (nur direkte Aufrufe gehen).
 *
 *   node scripts/check-client-navigation.mjs dist/standalone/dist/client   # Node-Build
 *   node scripts/check-client-navigation.mjs dist/client                   # Cloudflare-Build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkClientNavigation(clientDir) {
  const chunks = path.join(clientDir, '_next', 'static', 'chunks');
  const files = fs.readdirSync(chunks).filter((f) => f.endsWith('.js'));
  const read = (f) => fs.readFileSync(path.join(chunks, f), 'utf8');
  const problems = [], checked = [];
  for (const file of files) {
    const src = read(file);
    for (const match of src.matchAll(/\{navigateClientSide:\w+\}=\w+\?\?await (\w+)\(\)/g)) {
      const loader = match[1];
      const def = src.slice(src.indexOf(`function ${loader}(`), src.indexOf(`function ${loader}(`) + 400);
      const target = (def.match(/import\(`\.\/([^`]+)`\)/) || [])[1];
      if (!target) {
        // Mit rm-vinext-static-navigation (vite.config.ts): statischer Namensraum statt import(). Der Bundler legt
        // dafür ein Objekt mit Zugriffsfunktionen an; navigateClientSide muss darin vorkommen.
        const staticNamespace = /Promise\.resolve\(\w+\)/.test(def);
        const hasGetter = files.some((f) => /navigateClientSide:\(\)=>/.test(read(f)));
        checked.push(`${file} -> statischer Namensraum`);
        if (!staticNamespace || !hasGetter) problems.push(`${file}: Ladefunktion ${loader} ohne import() und ohne Namensraum mit navigateClientSide`);
        continue;
      }
      const exports = (read(target).match(/export\s*\{([^}]*)\}/g) || []).join(',');
      const names = exports.replace(/export\s*\{|\}/g, '').split(',').map((s) => s.trim().split(/\s+as\s+/).pop());
      checked.push(`${file} -> ${target}`);
      if (!names.includes('navigateClientSide')) problems.push(`${file} lädt ${target}, das navigateClientSide nicht exportiert`);
    }
  }
  if (!checked.length) problems.push('Keine Link-Navigation im Browser-Paket gefunden (Muster geändert?)');
  return { checked, problems };
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const dir = process.argv[2];
  if (!dir) { console.error('Aufruf: node scripts/check-client-navigation.mjs <client-Ordner>'); process.exit(1); }
  const { checked, problems } = checkClientNavigation(path.resolve(dir));
  for (const line of checked) console.log('geprüft:', line);
  for (const line of problems) console.error('FEHLER:', line);
  process.exitCode = problems.length ? 1 : 0;
}
