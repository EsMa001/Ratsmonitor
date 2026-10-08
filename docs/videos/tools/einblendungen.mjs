/* Einblendungen als PNG mit Transparenz: node einblendungen.mjs <out-ordner>   (im Ordner ~/code/video-tools starten)
   Liest je Kapitel <out>/cNN/einblendungen.json ([{satz, text | zahl+label}] und optional {kapitel:true, text}) und audio.json (Zeiten der Sätze),
   schreibt <out>/cNN/ovK.png und <out>/cNN/overlays.json ([{png, start, end}] in Sekunden vom Kapitelanfang). assemble.py legt sie über das Kapitel. */
import { homedir } from "node:os";
import { writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
const R = process.env.REPO || `${homedir()}/code/Ratsmonitor`, T = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { chromium } = await import(`${T}/node_modules/playwright/index.mjs`);
const out = process.argv[2], LEAD = 0.5;
const esc = (s) => String(s).replace(/Plenarra/g, "Plenara").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = `@font-face{font-family:P;src:url(file://${R}/public/fonts/IBMPlexSans-Regular.ttf);font-weight:400}@font-face{font-family:P;src:url(file://${R}/public/fonts/IBMPlexSans-SemiBold.ttf);font-weight:600}
*{box-sizing:border-box;margin:0}html,body{background:transparent}body{width:1280px;height:720px;font-family:P,sans-serif;color:#0f172a;position:relative;overflow:hidden}
.card{position:absolute;left:48px;bottom:44px;max-width:860px;padding:18px 30px 18px 26px;background:rgba(255,255,255,.97);border-left:7px solid #0d9488;border-radius:12px;box-shadow:0 8px 28px rgba(15,23,42,.22)}
.t{font-size:34px;font-weight:600;line-height:1.25;letter-spacing:-.01em}
.n{display:flex;align-items:baseline;gap:22px}.n b{font-size:82px;font-weight:600;line-height:1;color:#0d9488;letter-spacing:-.02em}.n span{font-size:28px;line-height:1.25;color:#334155;max-width:520px}
.kap{position:absolute;left:48px;top:84px;padding:12px 24px;background:rgba(13,148,136,.95);color:#fff;border-radius:10px;font-size:30px;font-weight:600;box-shadow:0 6px 20px rgba(15,23,42,.2)}`;
const html = (e) => `<style>${css}</style>` + (e.kapitel ? `<div class=kap>${esc(e.text)}</div>` : e.zahl ? `<div class="card n"><b>${esc(e.zahl)}</b><span>${esc(e.label || "")}</span></div>` : `<div class="card t">${esc(e.text)}</div>`);
const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
for (const d of readdirSync(out).filter((x) => /^c\d+$/.test(x)).sort()) {
  const f = `${out}/${d}/einblendungen.json`; if (!existsSync(f)) continue;
  const E = JSON.parse(readFileSync(f, "utf8")), A = JSON.parse(readFileSync(`${out}/${d}/audio.json`, "utf8")).sentences, ov = [];
  for (const [i, e] of E.entries()) {
    const start = e.kapitel ? LEAD : LEAD + A[e.satz].start + 0.35;
    const end = e.kapitel ? LEAD + 2.8 : Math.max(start + 2.6, LEAD + A[e.satz].end + 0.5);
    const h = `${out}/${d}/ov${i}.html`, png = `${out}/${d}/ov${i}.png`;
    writeFileSync(h, html(e)); await page.goto("file://" + require_path(h)); await page.waitForTimeout(150);
    await page.screenshot({ path: png, omitBackground: true });
    ov.push({ png: require_path(png), start: +start.toFixed(2), end: +end.toFixed(2) });
  }
  writeFileSync(`${out}/${d}/overlays.json`, JSON.stringify(ov));
}
await browser.close();
function require_path(p) { return p.startsWith("/") ? p : process.cwd() + "/" + p; }
console.log("Einblendungen: " + readdirSync(out).filter((x) => /^c\d+$/.test(x)).map((d) => (existsSync(`${out}/${d}/overlays.json`) ? JSON.parse(readFileSync(`${out}/${d}/overlays.json`, "utf8")).length : 0)).join("+"));
