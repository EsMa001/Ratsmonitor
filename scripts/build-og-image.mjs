// Vorschaubild für Link-Vorschauen (Slack, Mail, soziale Netze): public/og.png, 1200 x 630.
// Aufruf: node scripts/build-og-image.mjs   (braucht playwright aus ~/code/video-tools)
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = createRequire(`${homedir()}/code/video-tools/`)("playwright");
const { w, h, pts } = JSON.parse(readFileSync(`${root}public/data/gemeinde-punkte.json`, "utf8"));
const scale = 520 / h, X0 = 650, Y0 = 55;
let dots = "";
for (let i = 0; i < pts.length; i += 2) dots += `<circle cx="${(X0 + pts[i] * scale).toFixed(1)}" cy="${(Y0 + pts[i + 1] * scale).toFixed(1)}" r="1.9"/>`;
const font = (f, wgt) => `@font-face{font-family:P;font-weight:${wgt};src:url(data:font/ttf;base64,${readFileSync(`${root}public/fonts/${f}`).toString("base64")})}`;
const html = `<!doctype html><meta charset="utf-8"><style>
${font("IBMPlexSans-Regular.ttf", 400)}${font("IBMPlexSans-SemiBold.ttf", 600)}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;font-family:P;color:#0f172a;position:relative;overflow:hidden;
background:radial-gradient(ellipse 900px 520px at 88% -15%,rgba(13,148,136,.14),rgba(13,148,136,0) 70%),#fff}
svg{position:absolute;left:0;top:0}svg circle{fill:#0d9488;fill-opacity:.55}
.t{position:absolute;left:72px;top:96px;width:560px}
.logo img{height:120px;display:block;margin-left:-14px}
.s{margin-top:36px;font-size:52px;line-height:1.12;font-weight:600}
.u{position:absolute;left:72px;bottom:64px;width:520px;font-size:24px;line-height:1.4;color:#64748b}
</style><svg width="1200" height="630">${dots}</svg>
<div class="t"><div class="logo"><img src="data:image/png;base64,${readFileSync(`${root}scripts/assets/og-logo.png`).toString("base64")}"></div><div class="s">Früher wissen, was vor Ort beraten wird.</div></div>
<div class="u">Beschlüsse und Beratungen aus den Ratsinformationssystemen der Kommunen, durchsuchbar auf einer Karte.</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
writeFileSync(`${root}public/og.png`, await page.screenshot());
await browser.close();
console.log("public/og.png geschrieben");
