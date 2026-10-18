// Handy-Prüfung: Schriftgrößen außerhalb der Stufen und Seitenspringen (CLS) je Seite bei 375 px.
// Aufruf: node scripts/mobil-check.mjs [basisadresse] [stufe]
import { createRequire } from "node:module";
const require = createRequire(process.env.HOME + "/code/video-tools/package.json");
const { chromium } = require("playwright");
const base = process.argv[2] || "http://localhost:5173";
const tier = process.argv[3] || "enterprise";
const OK = new Set([12, 14, 16, 18, 22, 28, 44]);
const ROUTES = ["/", "/suche", "/analytics/atlas", "/analytics/vergleich", "/analytics/trends", "/analytics/beschluesse", "/analytics/signale", "/analytics/ausschreibungen", "/analytics/news", "/analytics/fakten", "/analytics/fraktionen", "/analytics/gremien", "/analytics/graph", "/konto/suchen", "/konto/artikel", "/konto/kalender", "/konto/benachrichtigungen", "/konto/profil", "/preise", "/videos", "/datenabdeckung", "/faq", "/funktionen/benachrichtigungen", "/anwender/immobilien", "/anwender/versorgung", "/anwender/planung", "/anwender/verbaende", "/anwender/oeffentlichkeit", "/anmelden", "/kontakt", "/impressum", "/datenschutz"];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
if (tier !== "guest") await ctx.request.post(base + "/api/dev/login", { data: { email: `${tier}@plenara.test` }, headers: { origin: base } });
for (const path of ROUTES) {
  const page = await ctx.newPage();
  try {
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
    await page.goto(base + path, { waitUntil: "load", timeout: 25000 });
    await page.waitForTimeout(5000);
    const m = await page.evaluate((OK) => {
      const bad = {}; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const e = w.currentNode.parentElement; if (!e || !w.currentNode.textContent.trim()) continue; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); if (!r.width || !r.height || s.visibility === "hidden" || s.display === "none") continue; const f = Math.round(parseFloat(s.fontSize) * 10) / 10; if (!OK.includes(f)) { const k = f + "px"; (bad[k] ||= []).length < 2 && bad[k].push(w.currentNode.textContent.trim().slice(0, 28)); bad[k].n = (bad[k].n || 0) + 1; } }
      return { cls: +window.__cls.toFixed(3), bad: Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, `${v.n}× ${v.join(" | ")}`])) };
    }, [...OK]);
    console.log(path.padEnd(32), "CLS", m.cls, JSON.stringify(m.bad));
  } catch (e) { console.log(path, "Fehler", String(e).slice(0, 100)); }
  await page.close();
}
await browser.close();
