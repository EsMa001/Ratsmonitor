/* Schreibt docs/videos/katalog.md aus den Beschreibungen der Szenen, Kapitel und Videos: node tools/katalog.mjs */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadScene } from "./key.mjs";
const V = new URL("../", import.meta.url).pathname;
const dirs = (d) => (existsSync(V + d) ? readdirSync(V + d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);
let md = "# Katalog (erzeugt von tools/katalog.mjs, nicht von Hand ändern)\n\n## Szenen\n\n| Szene | Bereich | Dauer | Zeigt | Start → Ende | Parameter | Tags | Schritte |\n|---|---|---|---|---|---|---|---|\n";
for (const id of dirs("szenen")) {
  const s = await loadScene(id), p = s.parameter || {};
  const steps = (typeof s.beats === "function" ? s.beats(p) : s.beats).map((b) => b[0]).join(", ");
  md += `| \`${id}\` | ${s.meta?.bereich ?? ""} | ${s.meta?.dauer ?? ""} | ${s.meta?.zeigt ?? ""} | ${s.start ?? ""} → ${s.ende ?? ""} | ${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(", ")} | ${(s.meta?.tags || []).join(", ")} | ${steps} |\n`;
}
md += "\n## Kapitel\n\n| Kapitel | Titel | Szenen | Texte |\n|---|---|---|---|\n";
for (const id of dirs("kapitel")) { const k = JSON.parse(readFileSync(`${V}kapitel/${id}/kapitel.json`, "utf8")); md += `| \`${id}\` | ${k.titel} | ${k.szenen.join(", ")} | ${["kurz", "lang"].filter((t) => existsSync(`${V}kapitel/${id}/${t}.txt`)).join(", ")} |\n`; }
md += "\n## Videos\n\n";
for (const f of existsSync(V + "videos") ? readdirSync(V + "videos").filter((x) => x.endsWith(".json")).sort() : []) { const v = JSON.parse(readFileSync(V + "videos/" + f, "utf8")); md += `- \`${f.replace(".json", "")}\`: ${v.kapitel.map((k) => k.kapitel + (k.text ? ` (${k.text})` : "")).join(" → ")}\n`; }
writeFileSync(V + "katalog.md", md);
console.log("katalog.md geschrieben");
