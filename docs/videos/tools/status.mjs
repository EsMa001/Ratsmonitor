/* Zeigt, welche Clips fehlen oder veraltet sind: node status.mjs [szene...]   (im Ordner ~/code/video-tools starten)
   veraltet = seit dem Commit der Aufnahme hat sich die Seite geändert (components/ratsmonitor, app). */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
const REPO = new URL("../../../", import.meta.url).pathname;
export function clipState(id) {
  const f = `out-clips/${id}/clip.json`; /* id = Schlüssel des Clips (key.mjs) */
  if (!existsSync(f)) return { id, state: "fehlt" };
  const { commit, recorded } = JSON.parse(readFileSync(f, "utf8"));
  let changed = [];
  try { changed = execSync(`git diff --name-only ${commit} -- components/ratsmonitor app`, { cwd: REPO }).toString().split("\n").filter(Boolean); } catch { return { id, state: "unbekannt", commit, recorded }; }
  return { id, state: changed.length ? "veraltet" : "aktuell", commit, recorded: recorded.slice(0, 10), changed };
}
if (process.argv[1].endsWith("status.mjs")) {
  const ids = process.argv.length > 2 ? process.argv.slice(2) : existsSync("out-clips") ? readdirSync("out-clips") : [];
  for (const id of ids) { const s = clipState(id); console.log(`${s.state.padEnd(9)} ${id}  ${s.commit ? `(Commit ${s.commit}, ${s.recorded})` : ""}${s.changed?.length ? "  geändert: " + s.changed.slice(0, 4).join(", ") + (s.changed.length > 4 ? " …" : "") : ""}`); }
}
