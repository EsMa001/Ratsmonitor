/* Zeigt die Produktvorteile (docs/produkt/vorteile.json): node vorteile.mjs [N] [--md]   N = nur die ersten N; --md schreibt docs/produkt/VORTEILE.md */
import { readFileSync, writeFileSync } from "node:fs";
const P = new URL("../../produkt/", import.meta.url).pathname;
const d = JSON.parse(readFileSync(P + "vorteile.json", "utf8"));
const n = Number(process.argv.find((a) => /^\d+$/.test(a))) || d.vorteile.length;
if (process.argv.includes("--md")) {
  let md = `# Produktvorteile von Plenara (nach Relevanz)\n\nErzeugt aus \`vorteile.json\` (\`node docs/videos/tools/vorteile.mjs --md\`), nicht von Hand ändern. Stand ${d.stand}.\n\n${d.hinweis}\n\n`;
  for (const [s, t] of Object.entries(d.stufen)) md += `- **Stufe ${s}:** ${t}\n`;
  md += "\n| Rang | Stufe | Vorteil | Beleg |\n|---|---|---|---|\n";
  for (const v of d.vorteile) md += `| ${v.rang} | ${v.stufe} | ${v.titel}${v.pruefen ? " ⚠" : ""} | ${v.beleg} |\n`;
  writeFileSync(P + "VORTEILE.md", md); console.log("VORTEILE.md geschrieben");
} else for (const v of d.vorteile.slice(0, n)) console.log(`${String(v.rang).padStart(2)} [${v.stufe}] ${v.titel}${v.pruefen ? " ⚠" : ""}`);
