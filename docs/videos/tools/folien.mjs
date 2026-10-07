/* Titel-, Vorteils- und Schlussfolie als Video (ohne Ton): node folien.mjs <out-ordner>   (liest <out>/folien.json, schreibt <out>/f-titel.mp4, f-vorteile.mp4, f-schluss.mp4)
   folien.json: { titel: {dur}, vorteile: {items:[…], starts:[s…], dur} | null, schluss: {dur} }. Fertige Folien liegen im Zwischenspeicher out-web/_folien/<hash>.mp4. Logo: docs/videos/assets/logo.png (aus der App aufgenommen). */
import { homedir } from "node:os";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const R = process.env.REPO || `${homedir()}/code/Ratsmonitor`, T = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { chromium } = await import(`${T}/node_modules/playwright/index.mjs`);
const FF = createRequire(`${T}/package.json`)("ffmpeg-static");
const out = process.argv[2], spec = JSON.parse(readFileSync(`${out}/folien.json`, "utf8"));
const LOGO = `file://${R}/docs/videos/assets/logo.png`, FPS = 30;
const esc = (s) => s.replace(/Plenarra/g, "Plenara").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const css = `@font-face{font-family:P;src:url(file://${R}/public/fonts/IBMPlexSans-Regular.ttf);font-weight:400}@font-face{font-family:P;src:url(file://${R}/public/fonts/IBMPlexSans-SemiBold.ttf);font-weight:600}
*{box-sizing:border-box;margin:0}body{width:1280px;height:720px;font-family:P,sans-serif;color:#0f172a;position:relative;overflow:hidden;background:linear-gradient(180deg,#fff 0%,#e6f3f1 100%)}
img.logo{display:block}
@keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes draw{to{stroke-dashoffset:0}}
.m{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.brand{display:flex;align-items:flex-end}.lw{position:relative;overflow:hidden;animation:up 1s cubic-bezier(.2,.7,.2,1) both}img.logo.big{height:170px}
.tail{display:flex;align-items:baseline;line-height:1;margin-bottom:29px;margin-left:6px;opacity:0;animation:up .7s var(--td,1.7s) ease-out forwards}.sq{width:24px;height:24px;background:#0d9488;margin-right:8px;flex:none}.de{font-size:163px;letter-spacing:-.015em;line-height:1}`;
const brand = (td) => `<div class=brand style="--td:${td}s"><div class=lw><img class="logo big" src="${LOGO}"></div><span class=tail><i class=sq></i><span class=de>de</span></span></div>`;
const check = (d) => `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:draw .45s ${d + 0.1}s ease-out forwards"/></svg>`;
const schluss = (k = 1) => `<style>${css}
.lw::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:30%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.85),rgba(255,255,255,0));transform:skewX(-18deg);animation:shine ${1.3*k}s ${1.0*k}s ease-in-out forwards}@keyframes shine{to{left:120%}}
.line{margin-top:44px;height:4px;width:0;border-radius:2px;background:#0d9488;animation:w ${.8*k}s ${1.6*k}s ease-out forwards}@keyframes w{to{width:120px}}
.s{margin-top:34px;font-size:46px;font-weight:600;letter-spacing:-.015em;max-width:980px;line-height:1.2;opacity:0;animation:up ${.8*k}s ${2.1*k}s ease-out forwards}.lw{animation-duration:${1*k}s}.tail{animation-duration:${.7*k}s}</style>
<div class=m>${brand(+(1.7*k).toFixed(2))}<div class=line></div><div class=s>Früher wissen, was vor Ort beraten wird.</div></div>`;
const vorteile = (v) => `<style>${css}
img.logo.s{position:absolute;left:72px;top:46px;height:56px}
h2{position:absolute;left:72px;top:152px;font-size:50px;font-weight:400;letter-spacing:-.01em;color:#0d9488;animation:up .6s ease-out both}
ul{position:absolute;left:72px;top:262px;list-style:none;padding:0}
li{display:flex;align-items:center;gap:24px;font-size:36px;margin-bottom:28px;opacity:0;animation:up .5s ease-out forwards}</style>
<img class="logo s" src="${LOGO}"><h2>Das bringt Ihnen Plenara</h2>
<ul>${v.items.map((t, i) => `<li style="animation-delay:${v.starts[i]}s">${check(v.starts[i])}${esc(t)}</li>`).join("")}</ul>`;
const jobs = [["titel", spec.titel && schluss(0.55), spec.titel?.dur], ["vorteile", spec.vorteile && vorteile(spec.vorteile), spec.vorteile?.dur], ["schluss", spec.schluss && schluss(), spec.schluss?.dur]].filter((j) => j[1] && j[2]);
const cache = `${out}/../_folien`; mkdirSync(cache, { recursive: true });
let browser, page;
for (const [n, html, secs] of jobs) {
  const key = `${cache}/${createHash("sha1").update(html + secs + FPS).digest("hex")}.mp4`;
  if (!existsSync(key)) {
    if (!browser) { browser = await chromium.launch(); page = await browser.newPage({ viewport: { width: 1280, height: 720 } }); }
    const file = `${out}/_${n}.html`; writeFileSync(file, `<meta charset=utf-8>${html}`); await page.goto(`file://${process.cwd()}/${file}`); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
    await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
    const dir = `${out}/_${n}`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const N = Math.round(secs * FPS);
    for (let k = 0; k < N; k++) { await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), (k / FPS) * 1000); await page.screenshot({ path: `${dir}/f${String(k).padStart(4, "0")}.jpg`, type: "jpeg", quality: 92 }); }
    spawnSync(FF, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${dir}/f%04d.jpg`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", key]);
    rmSync(dir, { recursive: true, force: true }); rmSync(file);
  }
  copyFileSync(key, `${out}/f-${n}.mp4`);
}
if (browser) await browser.close();
console.log("Folien:", jobs.map((j) => j[0]).join(", "));
