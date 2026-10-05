// Erzeugt components/ratsmonitor/INDEX.md: kompaktes Verzeichnis des Frontends,
// damit Dateien und CSS-Klassen ohne Suchlauf gefunden werden (spart Tokens).
// Aufruf: node scripts/frontend-index.mjs   (nach neuen/entfernten Dateien oder Klassen neu erzeugen)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "components/ratsmonitor/INDEX.md";
const files = execFileSync("git", ["ls-files", "components", "app"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(tsx?|css)$/.test(f) && !f.startsWith("components/ui/") && !f.startsWith("app/api/"))
  .sort();

const longLines = (src) => src.split("\n").filter((l) => l.length > 300).length;
const out = [];

out.push("# Frontend-Index (erzeugt, nicht von Hand ändern)", "");
out.push("Neu erzeugen: `node scripts/frontend-index.mjs`. Ergänzt `FRONTEND.md` (Wo ist was?) um Dateien, Exporte und CSS-Klassen mit Zeilennummer.");
out.push("`⚠N` = N Zeilen über 300 Zeichen: dort nicht ganze Zeilen lesen, sondern mit `grep -o` oder `grep -n` gezielt suchen.", "");

// CSS: eine Klasse pro Zeile, damit grep nur die Treffer-Zeile liefert
out.push("## CSS-Klassen (Klasse Datei:Zeile)", "");
const cssRows = [];
const cssFiles = [];
for (const f of files.filter((f) => f.endsWith(".css"))) {
  const src = readFileSync(f, "utf8");
  const first = new Map();
  // Nur Selektoren (Text vor "{"), keine Eigenschaften, Importe oder Dateinamen
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  let line = 1, start = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "\n") line++;
    if (ch === ";" || ch === "}") start = i + 1;
    else if (ch === "{") {
      const pre = clean.slice(start, i);
      if (!pre.trim().startsWith("@")) {
        let ln = line - (pre.match(/\n/g) || []).length;
        for (const part of pre.split("\n")) {
          for (const m of part.matchAll(/\.([a-zA-Z_][\w-]*)/g)) if (!first.has(m[1])) first.set(m[1], ln);
          ln++;
        }
      }
      start = i + 1;
    }
  }
  const lang = longLines(src);
  cssFiles.push(`- ${f} (${src.split("\n").length} Zeilen${lang ? `, ⚠${lang}` : ""})`);
  for (const [c, l] of first) cssRows.push([c, `${f.slice(f.lastIndexOf("/") + 1)}:${l}`]);
}
out.push(...cssFiles, "");
out.push(...cssRows.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)).map(([c, w]) => `${c} ${w}`), "");

// TS/TSX: Datei, Zeilen, Exporte
out.push("## Dateien (Zeilen, Exporte)", "");
const exp = /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
let dir = "";
for (const f of files.filter((f) => /\.tsx?$/.test(f))) {
  const src = readFileSync(f, "utf8");
  const d = f.slice(0, f.lastIndexOf("/"));
  if (d !== dir) { out.push("", `### ${d}/`); dir = d; }
  const names = [...new Set([...src.matchAll(exp)].map((m) => m[1]))];
  const lang = longLines(src);
  const lines = src.split("\n").length;
  out.push(`- ${f.slice(d.length + 1)} (${lines}${lang ? `, ⚠${lang}` : ""})${names.length ? ": " + names.join(", ") : ""}`);
}

writeFileSync(OUT, out.join("\n") + "\n");
console.log(`${OUT}: ${files.length} Dateien, ${Math.round(out.join("\n").length / 1024)} KB`);
