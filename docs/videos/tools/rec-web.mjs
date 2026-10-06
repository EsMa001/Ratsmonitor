/* Nimmt ein Web-Video (Querformat 1280x720, Maus) auf: node rec-web.mjs <NN>  (im Ordner ~/code/video-tools starten)
   Liest out-web/<NN>/audio.json (von speak.py) und führt die Schritte aus SCENES (scenes-web.mjs) zum jeweiligen Satz aus.
   Bilder werden als JPG mitgeschnitten (out-web/<NN>/raw), build.py ... web setzt sie mit dem Ton zusammen. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
const TOOLS = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { chromium } = await import(`${TOOLS}/node_modules/playwright/index.mjs`);
const BASE = process.env.BASE || "http://localhost:5173";
const NN = process.argv[2];
const OUT = `out-web/${NN}`;
const T = JSON.parse(readFileSync(`${OUT}/audio.json`, "utf8"));
const S = T.sentences;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cursor = `(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;background:rgba(13,148,136,.55);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)';const add=()=>document.documentElement.appendChild(d);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();addEventListener('mousemove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'},true)})()`;
rmSync(`${OUT}/raw`, { recursive: true, force: true }); mkdirSync(`${OUT}/raw`, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "de-DE" });
await ctx.addInitScript(cursor);
await ctx.addInitScript(() => {
  try { localStorage.setItem("ratsmonitor:brand:v1", "plenara-v2sq"); localStorage.setItem("ratsmonitor:tier:v1", "enterprise"); } catch {}
  const st = document.createElement("style");
  st.textContent = '[class*="border-dashed"][class*="border-amber-300"]{display:none!important}';
  const add = () => document.documentElement.appendChild(st);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(40000);

/* Hilfen */
const loaded = async () => { await page.waitForFunction(() => { const el = [...document.querySelectorAll("span")].find((x) => /Treffer/.test(x.textContent || "")); return !!el && !(el.textContent || "").trim().startsWith("…") && !document.querySelector('[aria-busy="true"]'); }, null, { timeout: 40000 }); };
const home = async () => { await page.goto(BASE + "/", { waitUntil: "load" }); await sleep(2000); };
let mx = 640, my = 360;
const move = async (x, y, steps = 28) => { await page.mouse.move(x, y, { steps }); mx = x; my = y; };
/* Maus fährt sichtbar zum Element und klickt */
const click = async (target, { dx = 0, dy = 0 } = {}) => {
  const loc = typeof target === "string" ? page.locator(target).first() : target.first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error("kein Element");
  await move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy);
  await sleep(250);
  await page.mouse.down(); await sleep(60); await page.mouse.up();
};
const role = (r, name) => page.getByRole(r, { name });
const clickRole = (r, name) => click(role(r, name));
const clickText = (t) => click(page.getByText(t, { exact: false }));
const search = async (term, { typing = 0 } = {}) => { await click("#q"); await page.keyboard.type(term, { delay: typing }); await page.keyboard.press("Enter"); await loaded(); await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500); };
const scrollTo = (y) => page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
const filterBtn = () => clickRole("button", /Filter/);
const openFirstArticle = async () => {
  const href = await page.locator("article a[href^='/beschluss/']").first().getAttribute("href");
  await page.goto(BASE + href, { waitUntil: "load" }); await sleep(1500);
};
const H = { sleep, loaded, home, search, scrollTo, click, clickRole, clickText, role, filterBtn, openFirstArticle, move, page, BASE };

const { SCENES } = await import(`./scenes-web.mjs`);
const sc = SCENES[NN];
if (!sc) throw new Error("Keine Szenen für " + NN);
await home();
if (sc.setup) await sc.setup(H);
await sleep(1500);

const frames = [];
let capturing = true;
const cap = (async () => { while (capturing) { const ts = Date.now(); try { const buf = await page.screenshot({ type: "jpeg", quality: 85, scale: "device" }); const n = frames.length; frames.push(ts); writeFileSync(`${OUT}/raw/f${String(n).padStart(5, "0")}.jpg`, buf); } catch {} } })();
const t0 = Date.now();
const at = async (t) => { const w = t * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); };
for (const [s, d, name, fn] of sc.steps) {
  await at(S[s].start + d);
  try { await fn(H); } catch (e) { console.log("Schritt", name, "übersprungen:", String(e).split("\n")[0].slice(0, 140)); }
}
await at(T.total + 1.5);
capturing = false; await cap;
await ctx.close(); await browser.close();
writeFileSync(`${OUT}/screen.json`, JSON.stringify({ t0, frames }));
console.log("fertig", NN, "Bilder", frames.length);
