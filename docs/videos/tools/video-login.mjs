/* Meldet die Videoaufnahme einmal an und speichert die Sitzung für rec-clip.mjs (VIDEO_STATE).
   Aufruf (im Ordner ~/code/video-tools): node video-login.mjs <Anmeldelink> <datei.json>
   Den Anmeldelink druckt scripts/node-local.mjs beim Start (Testkonto enterprise@plenara.test). */
import { homedir } from "node:os";
const TOOLS = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { chromium } = await import(`${TOOLS}/node_modules/playwright/index.mjs`);
const [link, out] = process.argv.slice(2);
if (!link || !out) { console.error("Aufruf: node video-login.mjs <Anmeldelink> <datei.json>"); process.exit(2); }
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(link, { waitUntil: "load" });
await page.waitForTimeout(3000);
/* Bestätigungsseite: Anmeldung mit Knopf abschließen (Link-Vorschauen sollen nicht anmelden) */
await page.getByRole("button", { name: /anmelden|bestätigen|weiter/i }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(4000);
const me = await page.evaluate(() => fetch("/api/me").then((r) => r.json()).catch(() => ({})));
await ctx.storageState({ path: out });
await browser.close();
console.log("Stufe nach Anmeldung:", me.tier ?? "unbekannt");
if (me.tier !== "enterprise") process.exit(1);
