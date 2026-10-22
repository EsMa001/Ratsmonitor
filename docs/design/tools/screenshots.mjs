// node screenshots.mjs   Screenshots der öffentlichen Seiten für die Präsentationen (BASE=http://localhost:18080 = Tunnel zum Server, CHROME=Pfad zu chrome.exe)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const BASE = process.env.BASE || "http://localhost:18080";
const OUT = "../praesentation/screenshots/";
mkdirSync(OUT, { recursive: true });
const EXE = process.env.CHROME || "C:/Users/maxes/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe"; // Chromium von Playwright (docs/videos)
const PAGES = [
  ["start", "/", 4000, false],
  ["suche-bplan", "/suche?q=Bebauungsplan", 7000, false],
  ["suche-vergabe", "/suche?q=Vergabe", 7000, false],
  ["suche-waerme", "/suche?q=W%C3%A4rmeplanung", 7000, false],
  ["artikel-waerme", "/beschluss/de-06532012-vo-14155", 4000, true],
  ["anwender-oeffentlichkeit", "/anwender/oeffentlichkeit", 8000, true],
  ["anwender-immobilien", "/anwender/immobilien", 8000, true],
  ["anwender-versorgung", "/anwender/versorgung", 8000, true],
  ["anwender-verbaende", "/anwender/verbaende", 8000, true],
  ["anwender-planung", "/anwender/planung", 8000, true],
  ["abdeckung", "/datenabdeckung", 7000, true],
  ["x-ueber", "/analytics/ueber", 5000, true],
  ["alarme", "/funktionen/benachrichtigungen", 4000, true],
];
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "de-DE" });
const page = await ctx.newPage();
for (const [name, path, wait, full] of PAGES) {
  try { await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 }); } catch (e) { console.log(name, "networkidle nicht erreicht"); }
  await page.waitForTimeout(wait);
  if (full) { for (let y = 0; y < 8000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(250); } await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1500); }
  await page.screenshot({ path: OUT + name + ".png", fullPage: full });
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log(name, "ok, Höhe", h);
}
await browser.close();
