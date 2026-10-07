import { chromium } from "playwright";
import { readFileSync, writeFileSync, renameSync, readdirSync, mkdirSync, rmSync } from "node:fs";
const BASE = "http://localhost:5173";
const T = JSON.parse(readFileSync("audio.json", "utf8"));
const S = T.sentences;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cursor = `(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;background:rgba(13,148,136,.55);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)';const add=()=>document.documentElement.appendChild(d);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();addEventListener('mousemove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'},true)})()`;
rmSync("raw", { recursive: true, force: true }); mkdirSync("raw");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: "raw", size: { width: 1280, height: 720 } }, locale: "de-DE" });
await ctx.addInitScript(cursor);
await ctx.addInitScript(() => {
  try { localStorage.setItem("ratsmonitor:brand:v1", "plenara-v2sq"); localStorage.setItem("ratsmonitor:tier:v1", "enterprise"); } catch {}
  const st = document.createElement("style");
  st.textContent = '[class*="border-dashed"][class*="border-amber-300"]{display:none!important}';
  const add = () => document.documentElement.appendChild(st);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
});
const created = Date.now();
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await sleep(2500);
const t0 = Date.now();
const offset = (t0 - created) / 1000;
const now = () => (Date.now() - t0) / 1000;
const at = async (t) => { const w = t * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); };
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("Schritt", name, "übersprungen:", String(e).split("\n")[0].slice(0, 120)); } };
const move = (x, y, steps = 30) => page.mouse.move(x, y, { steps });
const loaded = async () => { await page.waitForFunction(() => { const el = [...document.querySelectorAll("span")].find((x) => /Treffer/.test(x.textContent || "")); return !!el && !(el.textContent || "").trim().startsWith("…") && !document.querySelector('[aria-busy="true"]'); }, null, { timeout: 40000 }); };

await move(640, 360, 1);
// 1 Willkommen / 2 Hier finden Sie
await at(S[1].start); await step("map", async () => { await move(700, 300, 60); await sleep(1500); await move(560, 250, 60); });
// 3 Beginnen wir
await at(S[2].start); await step("tosearch", async () => { await move(640, 530, 50); });
// 4 Suchbegriff: Kita
await at(S[3].start + 0.6); await step("click", async () => { await page.click("#q"); });
await at(S[3].end - 1.4); await step("typeKita", async () => { await page.keyboard.type("Kita", { delay: 200 }); });
await at(S[3].end + 0.5); await step("enter", async () => { await page.keyboard.press("Enter"); await loaded(); await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); });
// 5 Ort wählen
await at(S[4].start - 0.2); await step("top", async () => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); });
await at(S[4].start + 0.9); await step("clickq", async () => { await page.click("#q"); });
await at(S[4].start + 1.4); await step("typeOrt", async () => { await page.keyboard.type("Münster", { delay: 140 }); });
await at(S[4].end - 0.4); await step("hoverOpt", async () => { const opt = page.locator('[role="option"]').filter({ hasText: "Kreisfreie Stadt" }).first(); await opt.hover(); });
// 6 Sobald Sie bestätigen
await at(S[5].start + 0.2); await step("pick", async () => { const opt = page.locator('[role="option"]').filter({ hasText: "Kreisfreie Stadt" }).first(); await opt.click(); await loaded(); });
// 7 Auf der Karte
await at(S[6].start + 1.0); await step("mapMove", async () => { await move(600, 260, 60); await sleep(1500); await move(760, 330, 60); });
// 8 Jedes Gebiet
await at(S[7].start); await step("badges", async () => { await move(560, 330, 60); await sleep(1000); await move(640, 296, 40); });
// 9 Klick auf Gebiet
await at(S[8].start + 0.5); await step("clickArea", async () => { await page.mouse.click(640, 293); });
// 10 Liste
await at(S[9].start); await step("scroll", async () => { await page.evaluate(() => window.scrollTo({ top: 420, behavior: "smooth" })); await sleep(2500); await move(640, 450, 40); });
// 11 Ausblick
await at(S[10].start); await step("up", async () => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); });
await at(T.total + 1.5);
const v = page.video();
await ctx.close();
await browser.close();
const f = readdirSync("raw").find((x) => x.endsWith(".webm"));
renameSync("raw/" + f, "screen.webm");
writeFileSync("screen.json", JSON.stringify({ offset }));
console.log("fertig, offset", offset, "dauer", now());
