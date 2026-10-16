// node screenshots.mjs   Screenshots der öffentlichen Seiten für die Präsentation (BASE=http://localhost:18080 = Tunnel zum Server, CHROME=Pfad zu chrome.exe)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = process.env.BASE || "http://localhost:18080";
const OUT = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(OUT, { recursive: true });
const EXE = process.env.CHROME || "C:/Users/maxes/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe"; // Chromium von Playwright (docs/videos)

const PAGES = [
  ["start", "/", 4000],
  ["suche", "/suche?q=Windkraft", 6000],
  ["karte", "/suche?q=Photovoltaik", 7000],
  ["artikel", "/beschluss/de-06432010-vo-34279", 4000],
  ["alarme", "/funktionen/benachrichtigungen", 3000],
  ["abdeckung", "/datenabdeckung", 6000],
  ["preise", "/preise", 3000],
  ["x-ueber", "/analytics/ueber", 3000],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "de-DE" });
const page = await ctx.newPage();
for (const [name, path, wait] of PAGES) {
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
  } catch (e) {
    console.log(name, "networkidle nicht erreicht:", e.message.split("\n")[0]);
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}${name}.png` });
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 160);
  console.log(name, "->", text);
}
await browser.close();
console.log("fertig:", OUT);
