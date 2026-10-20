// Prüfung vor dem Veröffentlichen: jede Seite in Chromium und WebKit (Safari) auf 14 Größen (Handy hoch und quer,
// Tablet, Desktop) ohne waagerechten Überlauf, ohne Seitenfehler und ohne Fehlerstatus; dazu axe (WCAG 2.1 AA,
// nur Befunde „serious“ und „critical“) auf Handy und Desktop. Endet mit Code 1, wenn etwas auffällt.
// Playwright und @axe-core/playwright kommen aus ~/code/video-tools (wie scripts/mobil-check.mjs).
// Aufruf: node scripts/frontend-check.mjs [basisadresse] [--stufe guest|basic|pro|enterprise] [--browser chromium,webkit] [--nur i14,d1440] [--ohne-axe]
// Firefox fehlt: Playwrights Firefox startet unter macOS 27 nicht („Could not find profile folder“, Stand 20.10.2026).
import { createRequire } from "node:module";
const require = createRequire(process.env.HOME + "/code/video-tools/package.json");
const pw = require("playwright");
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const base = args[0] && !args[0].startsWith("--") ? args[0] : "http://localhost:3000";
const tier = opt("--stufe", "guest");
const browsers = opt("--browser", "chromium,webkit").split(",");
const only = opt("--nur", "") ? opt("--nur", "").split(",") : null;
const withAxe = !args.includes("--ohne-axe");
let AxeBuilder = null;
if (withAxe) { try { AxeBuilder = require("@axe-core/playwright").default; } catch { console.log("Hinweis: @axe-core/playwright fehlt in ~/code/video-tools, axe wird ausgelassen (npm i --no-save @axe-core/playwright)."); } }

// Name, Breite, Höhe, Touch
const SIZES = [["se1", 320, 568, true], ["and360", 360, 740, true], ["i14", 390, 844, true], ["promax", 430, 932, true], ["quer", 844, 390, true], ["tab768", 768, 1024, true], ["tab1024q", 1024, 768, true], ["tab1180", 1180, 820, true],
  ["d1280", 1280, 720, false], ["d1366", 1366, 768, false], ["d1440", 1440, 900, false], ["d1536", 1536, 864, false], ["d1920", 1920, 1080, false], ["d2560", 2560, 1440, false]];
const AXE_SIZES = new Set(["i14", "d1440"]);
const PAGES = ["/", "/suche?q=schule", "/analytics/atlas?thema=bauen", "/analytics/signale", "/analytics/ausschreibungen", "/analytics/fakten?fakt=hebesatz", "/analytics/trends", "/analytics/trends?begriff=solar", "/analytics/vergleich",
  "/analytics/beschluesse", "/analytics/fraktionen", "/analytics/gremien", "/analytics/graph", "/analytics/news", "/preise", "/anmelden", "/kontakt", "/impressum", "/datenschutz", "/konto", "/gibtsnicht"];
const EXPECTED_404 = new Set(["/gibtsnicht"]);

// Elemente, die über den rechten Rand ragen und von keinem Vorfahren abgeschnitten werden
const overflow = () => {
  const W = innerWidth, out = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.right <= W + 2 || getComputedStyle(el).position === "fixed") continue;
    let a = el.parentElement, clipped = false;
    while (a) { if (getComputedStyle(a).overflowX !== "visible") { clipped = true; break; } a = a.parentElement; }
    if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(" ")[0]}`);
  }
  return { page: Math.max(0, document.documentElement.scrollWidth - W), elements: [...new Set(out)].slice(0, 3) };
};

const problems = [];
let loads = 0;
for (const name of browsers) {
  const browser = await pw[name].launch();
  for (const [size, width, height, touch] of SIZES) {
    if (only && !only.includes(size)) continue;
    // Firefox kennt isMobile nicht; Chromium und WebKit bekommen es für Handy und Tablet
    const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && width < 1000 && name !== "firefox", locale: "de-DE" });
    if (tier !== "guest") await ctx.request.post(base + "/api/dev/login", { data: { email: `${tier}@plenara.test` }, headers: { origin: base } });
    for (const path of PAGES) {
      const page = await ctx.newPage(), errors = [];
      page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
      let status = 0;
      try {
        status = (await page.goto(base + path, { waitUntil: "load", timeout: 60000 }))?.status() ?? 0;
        await page.waitForTimeout(1500);
        const o = await page.evaluate(overflow);
        const label = `${name} ${size} ${path}`;
        if (status >= 400 && !(status === 404 && EXPECTED_404.has(path))) problems.push(`${label}: HTTP ${status}`);
        if (o.page > 0 || o.elements.length) problems.push(`${label}: Überlauf ${o.page} px ${o.elements.join(", ")}`);
        for (const e of errors) problems.push(`${label}: Seitenfehler ${e}`);
        if (AxeBuilder && name === "chromium" && AXE_SIZES.has(size)) {
          const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          for (const v of r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"))
            problems.push(`${label}: axe ${v.id} (${v.nodes.length}×, z. B. ${v.nodes[0]?.target.join(" ").slice(0, 60)})`);
        }
      } catch (e) { problems.push(`${name} ${size} ${path}: ${String(e).split("\n")[0].slice(0, 120)}`); }
      loads++;
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
}
console.log(`${loads} Seitenaufrufe (${browsers.join(", ")}, Stufe ${tier}), ${problems.length} Befunde`);
for (const p of problems) console.log("  " + p);
process.exit(problems.length ? 1 : 0);
