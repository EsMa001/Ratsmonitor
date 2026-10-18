// Handy-Bestandsaufnahme: öffnet jede Seite bei 375 px und misst Textmenge, Länge, Tippflächen, Überlauf.
// Aufruf: node scripts/mobil-audit.mjs [basisadresse] [stufe]  (Stufe: guest|basic|pro|enterprise, Standard enterprise)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(process.env.HOME + "/code/video-tools/package.json");
const { chromium } = require("playwright");
const base = process.argv[2] || "http://localhost:5173";
const tier = process.argv[3] || "enterprise";
const ROUTES = ["/", "/suche", "/analytics/atlas", "/analytics/vergleich", "/analytics/trends", "/analytics/beschluesse", "/analytics/signale", "/analytics/ausschreibungen", "/analytics/news", "/analytics/fakten", "/analytics/fraktionen", "/analytics/gremien", "/analytics/graph", "/konto/suchen", "/konto/artikel", "/konto/kalender", "/konto/profil", "/preise", "/videos", "/datenabdeckung", "/faq", "/funktionen/benachrichtigungen", "/anwender/immobilien", "/anwender/versorgung", "/anwender/planung", "/anwender/verbaende", "/anwender/oeffentlichkeit", "/anmelden", "/kontakt", "/impressum", "/datenschutz"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
if (tier !== "guest") await ctx.request.post(base + "/api/dev/login", { data: { email: `${tier}@plenara.test` }, headers: { origin: base } });
const out = [];
for (const path of ROUTES) {
  const page = await ctx.newPage();
  try {
    await page.goto(base + path, { waitUntil: "load", timeout: 25000 });
    await page.waitForFunction(() => document.querySelector("main,#inhalt") && document.body.innerText.length > 250 && !document.querySelector("[aria-busy=true]"), null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => {
      const H = innerHeight, vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
      const words = (root, maxTop) => { let n = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (w.nextNode()) { const t = w.currentNode, e = t.parentElement; if (!e || !vis(e) || e.closest("script,style,[aria-hidden=true],.sr-only")) continue; const r = e.getBoundingClientRect(); if (maxTop != null && r.top > maxTop) continue; n += (t.textContent.match(/\S+/g) || []).length; } return n; };
      const small = [...document.querySelectorAll("a,button,input,select,[role=button],[role=tab]")].filter((e) => vis(e) && !e.closest("footer")).map((e) => ({ r: e.getBoundingClientRect(), e })).filter(({ r }) => r.top < 6000 && (r.height < 40 || r.width < 40)).map(({ r, e }) => `${Math.round(r.width)}x${Math.round(r.height)} ${(e.getAttribute("aria-label") || e.textContent || e.tagName).trim().slice(0, 30)}`);
      const fonts = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let tiny = 0;
      while (w.nextNode()) { const e = w.currentNode.parentElement; if (e && vis(e) && w.currentNode.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 12) tiny++; }
      return { title: document.title, wordsAboveFold: words(document.body, H), wordsTotal: words(document.body), heightScreens: +(document.documentElement.scrollHeight / H).toFixed(1), overflowX: document.documentElement.scrollWidth - innerWidth, smallTargets: small.length, smallSample: small.slice(0, 6), tinyText: tiny };
    });
    await page.screenshot({ path: `tmp/mobil/${tier}${path.replace(/\//g, "_") || "_start"}.png` });
    out.push({ path, ...m });
  } catch (e) { out.push({ path, error: String(e).slice(0, 120) }); }
  await page.close();
}
await browser.close();
mkdirSync("tmp/mobil", { recursive: true });
writeFileSync(`tmp/mobil/audit-${tier}.json`, JSON.stringify(out, null, 1));
for (const r of out) console.log(r.path.padEnd(34), r.error || `fold ${String(r.wordsAboveFold).padStart(3)}  text ${String(r.wordsTotal).padStart(5)}  ${String(r.heightScreens).padStart(5)} Sch  ΔX ${r.overflowX}  klein ${r.smallTargets}  tiny ${r.tinyText}`);
