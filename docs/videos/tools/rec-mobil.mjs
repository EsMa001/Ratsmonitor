/* Nimmt ein Handy-Video (Hochformat) auf: node rec-mobil.mjs <NN>  (im Ordner ~/code/video-tools starten)
   Liest out/<NN>/audio.json (von speak.py) und führt die Schritte aus SCENES zum jeweiligen Satz aus.
   Bilder werden als JPG mitgeschnitten (out/<NN>/raw), build.py setzt sie mit dem Ton zusammen. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
const TOOLS = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { chromium } = await import(`${TOOLS}/node_modules/playwright/index.mjs`);
const BASE = process.env.BASE || "http://localhost:5173";
const NN = process.argv[2];
const OUT = `out/${NN}`;
const T = JSON.parse(readFileSync(`${OUT}/audio.json`, "utf8"));
const S = T.sentences;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const touch = `(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:2147483647;width:34px;height:34px;border-radius:50%;background:rgba(13,148,136,.35);border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 6px rgba(0,0,0,.25);pointer-events:none;left:-60px;top:-60px;transform:translate(-50%,-50%) scale(.6);opacity:0;transition:opacity .12s,transform .12s';const add=()=>document.documentElement.appendChild(d);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();const on=e=>{const t=e.touches?e.touches[0]:e;d.style.left=t.clientX+'px';d.style.top=t.clientY+'px';d.style.opacity='1';d.style.transform='translate(-50%,-50%) scale(1)'};const off=()=>{d.style.opacity='0';d.style.transform='translate(-50%,-50%) scale(.6)'};addEventListener('touchstart',on,true);addEventListener('touchmove',on,true);addEventListener('touchend',off,true);addEventListener('mousedown',on,true);addEventListener('mouseup',off,true)})()`;
rmSync(`${OUT}/raw`, { recursive: true, force: true }); mkdirSync(`${OUT}/raw`, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
await ctx.addInitScript(touch);
await ctx.addInitScript(() => {
  try { localStorage.setItem("ratsmonitor:brand:v1", "plenara-v2sq"); localStorage.setItem("ratsmonitor:tier:v1", "enterprise"); } catch {}
  const st = document.createElement("style");
  st.textContent = '[class*="border-dashed"][class*="border-amber-300"]{display:none!important}';
  const add = () => document.documentElement.appendChild(st);
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
});
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

/* Hilfen */
const loaded = async () => { await page.waitForFunction(() => { const el = [...document.querySelectorAll("span")].find((x) => /Treffer/.test(x.textContent || "")); return !!el && !(el.textContent || "").trim().startsWith("…") && !document.querySelector('[aria-busy="true"]'); }, null, { timeout: 40000 }); };
const home = async () => { await page.goto(BASE + "/", { waitUntil: "networkidle" }); await sleep(1500); };
const search = async (term, { typing = 0 } = {}) => { await page.tap("#q"); await page.keyboard.type(term, { delay: typing }); await page.keyboard.press("Enter"); await loaded(); await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500); };
const scrollTo = (y) => page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
const tapRole = (role, name) => page.getByRole(role, { name }).first().tap();
const tapText = (t) => page.getByText(t, { exact: false }).first().tap();
const filterBtn = () => tapRole("button", /Filter/);
const openFirstArticle = async () => {
  const href = await page.locator("article a[href^='/beschluss/']").first().getAttribute("href");
  await page.goto(BASE + href, { waitUntil: "load" }); await sleep(1200);
};
const cdp = await ctx.newCDPSession(page);
const pinch = (x, y, scale) => cdp.send("Input.synthesizePinchGesture", { x, y, scaleFactor: scale, relativeSpeed: 400, gestureSourceType: "touch" });
const H = { pinch, sleep, loaded, home, search, scrollTo, tapRole, tapText, filterBtn, openFirstArticle, page, BASE };

/* Schritte je Video: [Satznummer ab 0, Verzögerung in s, Name, Funktion]. `setup` läuft vor der Aufnahme. */
const { SCENES } = await import(`./scenes-mobil.mjs`);
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
