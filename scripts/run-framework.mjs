import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const [command, ...args] = process.argv.slice(2);
if (!["dev", "build"].includes(command)) throw new Error("Expected dev or build.");
const managedLinux = readExecutionProfile() === "managed-linux";

if (managedLinux && command === "build") {
  const result = spawnSync("bash", [
    fileURLToPath(new URL("./build-verified.sh", import.meta.url)), ...args,
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Dev: die Wortliste der Suche in der lokalen Datenbank im Hintergrund aufbauen bzw. nachführen (siehe
// server/integrations/search-words.mjs). Beim ersten Mal rund eine halbe Minute; bis dahin sucht die App wie gewohnt.
// Ohne lokale Datenbank oder mit RM_SKIP_SEARCH_WORDS=1 passiert nichts.
if (command === "dev" && !process.env.RM_SKIP_SEARCH_WORDS) {
  try {
    spawn(process.execPath, ["--no-warnings", fileURLToPath(new URL("./refresh-search-words.mjs", import.meta.url)), "--quiet"], { stdio: "ignore", detached: true, cwd: fileURLToPath(new URL("..", import.meta.url)) }).unref();
  } catch { /* Hilfe beim Start, kein Muss */ }
}

// Import in this process so the preview owner retains its PID and signals.
const cli = new URL(managedLinux
  ? "../node_modules/vite/bin/vite.js"
  : "../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), command,
  ...(!managedLinux && command === "dev" ? ["--port", "5173"] : []), ...args];
await import(cli.href);
