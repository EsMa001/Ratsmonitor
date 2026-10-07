/* Kapitelseiten als PNG (1280x720): node cards.mjs <out-ordner>   (liest <out>/chapters.json)
   Farbverlauf in den Plenara-Farben (Teal), Icons aus dem Icon-Satz der Website (lucide-react). */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
const R = process.env.REPO || `${homedir()}/code/Ratsmonitor`;
const TOOLS = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const req = createRequire(`${R}/package.json`);
const React = req("react"), { renderToStaticMarkup } = req("react-dom/server"), L = req("lucide-react");
const { chromium } = await import(`${TOOLS}/node_modules/playwright/index.mjs`);
const out = process.argv[2];
const chapters = JSON.parse(readFileSync(`${out}/chapters.json`, "utf8"));
const pascal = (s) => s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
const icon = (name, size, stroke, color) => renderToStaticMarkup(React.createElement(L[pascal(name)] || L.Circle, { size, strokeWidth: stroke, color }));
const esc = (s) => s.replace(/Plenarra X/g, "Plenara.X").replace(/Plenarra/g, "Plenara").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const total = chapters.length;
const html = (c) => `<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0}
body{width:1280px;height:720px;font-family:"Inter",-apple-system,"Helvetica Neue",Arial,sans-serif;color:#fff;overflow:hidden;
background:radial-gradient(ellipse 900px 600px at 85% 10%,rgba(94,234,212,.28),rgba(94,234,212,0) 70%),linear-gradient(135deg,#0f766e 0%,#0d9488 55%,#14b8a6 100%);position:relative}
.logo{position:absolute;left:72px;top:56px;font-size:34px;font-weight:600;letter-spacing:-.02em}
.nr{position:absolute;left:72px;top:190px;font-size:22px;font-weight:500;letter-spacing:.08em;color:rgba(255,255,255,.75)}
h1{position:absolute;left:72px;top:232px;width:700px;font-size:64px;line-height:1.05;font-weight:600;letter-spacing:-.025em}
ul{position:absolute;left:72px;top:${c.bullets.length > 3 ? 370 : 390}px;list-style:none;padding:0;width:760px}
li{display:flex;align-items:center;gap:16px;font-size:28px;line-height:1.25;margin-bottom:18px;color:rgba(255,255,255,.95)}
li i{flex:none;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center}
.big{position:absolute;right:90px;top:170px;width:330px;height:330px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center}
.bar{position:absolute;left:72px;right:72px;bottom:48px;display:flex;gap:10px}
.bar b{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.28)}.bar b.on{background:#fff}
</style><body>
<div class=logo>plenara.</div>
<div class=nr>${String(c.nr).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
<h1>${esc(c.title)}</h1>
<ul>${c.bullets.map((b) => `<li><i>${icon("check", 20, 3, "#fff")}</i><span>${esc(b)}</span></li>`).join("")}</ul>
<div class=big>${icon(c.icon, 150, 1.5, "#fff")}</div>
<div class=bar>${chapters.map((x) => `<b class="${x.nr <= c.nr ? "on" : ""}"></b>`).join("")}</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const c of chapters) {
  await page.setContent(html(c));
  await page.screenshot({ path: `${out}/card${String(c.nr).padStart(2, "0")}.png` });
}
await browser.close();
console.log("Kapitelseiten:", total);
