// Baut gesellschaftsvertrag-gbr.pdf aus dem Markdown (kleiner Konverter, Chromium aus ~/code/video-tools).
// Aufruf im Ordner ~/code/video-tools: node ~/code/Ratsmonitor/docs/gesellschaft/pdf.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(process.env.HOME, "code/video-tools/package.json"));
const { chromium } = require("playwright");
const TEAL = "#0d9488";
const font = pathToFileURL(path.join(here, "../../public/fonts/ibm-plex-sans-latin-")).href;
const esc = (s) => s.replace(/&(?!nbsp;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
const md = fs.readFileSync(path.join(here, "gesellschaftsvertrag-gbr.md"), "utf8").split("\n");
let out = "", i = 0;
while (i < md.length) {
  const l = md[i];
  if (!l.trim()) { i++; continue; }
  if (l.startsWith("# ")) { out += `<h1>${inl(l.slice(2))}</h1>`; i++; continue; }
  if (l.startsWith("## ")) { out += `<h2>${inl(l.slice(3))}</h2>`; i++; continue; }
  if (l.startsWith("> ")) { out += `<p class="hinweis">${inl(l.slice(2))}</p>`; i++; continue; }
  if (l.startsWith("---")) { out += `<hr>`; i++; continue; }
  if (l.startsWith("|")) {
    const rows = []; while (i < md.length && md[i].startsWith("|")) rows.push(md[i++]);
    const cells = (r) => r.split("|").slice(1, -1).map((c) => inl(c.trim()));
    out += `<table><tr>${cells(rows[0]).map((c) => `<th>${c}</th>`).join("")}</tr>${rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
    continue;
  }
  const m = l.match(/^(\d+)\. (.*)/);
  if (m) { out += `<p class="par"><span class="nr">${m[1]}.</span>${inl(m[2])}</p>`; i++; continue; }
  const s = l.match(/^\s+([a-z]\)) (.*)/);
  if (s) { out += `<p class="sub"><span class="nr">${s[1]}</span>${inl(s[2])}</p>`; i++; continue; }
  if (l.startsWith("- ")) { out += `<p class="li">• ${inl(l.slice(2))}</p>`; i++; continue; }
  out += `<p>${inl(l.replace(/&nbsp;/g, " "))}</p>`; i++;
}
const P = [[78,50,3.6,1],[75.9,60.7,3.6,1],[69.8,69.8,3.6,1],[60.7,75.9,3.6,1],[50,78,3.6,1],[39.3,75.9,3.6,1],[30.2,69.8,3.6,1],[24.1,60.7,3.6,1],[50,22,3.6,1],[60.7,24.1,3.6,1],[69.8,30.2,3.6,1],[75.9,39.3,3.6,1],[67,50,3,.55],[63.8,60,3,.55],[55.3,66.2,3,.55],[44.7,66.2,3,.55],[36.2,60,3,.55],[33,50,3,.55],[36.2,40,3,.55],[44.7,33.8,3,.55],[55.3,33.8,3,.55],[63.8,40,3,.55]];
const dots = P.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${TEAL}" fill-opacity="${o}"/>`).join("");
const logo = `<span class="logo"><svg viewBox="15 15 70 70" overflow="visible">${dots}<path d="M22 108V50A28 28 0 0 1 38.2 24.6" stroke="${TEAL}" stroke-width="7" fill="none" stroke-linecap="round"/></svg>lenara<i></i></span>`;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:400;src:url(${font}400-normal.woff2)}
@font-face{font-family:Plex;font-weight:600;src:url(${font}600-normal.woff2)}
body{font:400 10.5pt/1.5 Plex,sans-serif;color:#1f2933;margin:0}
.logo{display:inline-block;font-weight:600;font-size:26pt;letter-spacing:-.015em;color:#0f172a}
.logo svg{height:.66em;width:.66em;vertical-align:-.07em;margin-right:.01em}
.logo i{display:inline-block;width:.15em;height:.15em;background:${TEAL};margin-left:.05em}
.kopf{border-bottom:2px solid ${TEAL};padding-bottom:8pt;margin-bottom:14pt}
h1{font-size:17pt;margin:0 0 8pt;color:#0f172a}
h2{font-size:11.5pt;margin:14pt 0 4pt;color:${TEAL};break-after:avoid}
p{margin:0 0 5pt}.par,.sub{padding-left:18pt;position:relative}.sub{padding-left:36pt}
.nr{position:absolute;left:0}.sub .nr{left:18pt}
.hinweis{background:#f0fdfa;border-left:3px solid ${TEAL};padding:6pt 8pt;font-size:9.5pt}
.li{padding-left:12pt}hr{border:0;border-top:1px solid #cbd5e1;margin:14pt 0}
table{border-collapse:collapse;width:100%;margin:6pt 0}th,td{border:1px solid #cbd5e1;padding:4pt 6pt;text-align:left}th{background:#f1f5f9}
code{font-size:9.5pt}
</style><div class="kopf">${logo}</div>${out}`;
const b = await chromium.launch();
const pg = await b.newPage();
await pg.setContent(html, { waitUntil: "load" });
await pg.evaluate(() => document.fonts.ready);
if (process.env.SHOT) { await pg.setViewportSize({ width: 794, height: 1123 }); await pg.screenshot({ path: process.env.SHOT }); }
await pg.pdf({
  path: path.join(here, "gesellschaftsvertrag-gbr.pdf"), format: "A4",
  margin: { top: "20mm", bottom: "20mm", left: "22mm", right: "22mm" },
  displayHeaderFooter: true, headerTemplate: "<span></span>",
  footerTemplate: `<div style="font:8px sans-serif;width:100%;text-align:center;color:#64748b">Plenara GbR · Entwurf · Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>`,
  printBackground: true,
});
await b.close();
console.log("ok");
