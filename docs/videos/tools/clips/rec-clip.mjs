/* Nimmt eine Szene OHNE Ton als Clip auf: node rec-clip.mjs <szene>   (im Ordner ~/code/video-tools starten, BASE = Adresse der App)
   Szenen mit benannten Schritten stehen in scenes.mjs: [name, Funktion(H), Haltezeit in s]. Ergebnis: out-clips/<szene>/ (Bilder, clip.json mit Zeiten der Schritte
   und dem Commit der Seite). Das Video entsteht später mit compose.py aus Clip und Ton, eine Textänderung braucht deshalb keine neue Aufnahme. */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
const TOOLS = process.env.VIDEO_TOOLS || `${homedir()}/code/video-tools`;
const { chromium } = await import(`${TOOLS}/node_modules/playwright/index.mjs`);
const BASE = process.env.BASE || "http://localhost:5173";
const ID = process.argv[2];
const OUT = `out-clips/${ID}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cursor = `(()=>{const d=document.createElement('div');d.style.cssText='position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;background:rgba(13,148,136,.55);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)';const add=()=>document.documentElement.appendChild(d);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',add):add();addEventListener('mousemove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'},true)})()`;
rmSync(`${OUT}/raw`, { recursive: true, force: true }); mkdirSync(`${OUT}/raw`, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: "de-DE" });
await ctx.addInitScript(cursor);
await ctx.addInitScript(() => {
  try { localStorage.setItem("ratsmonitor:brand:v1", "plenara-v2sq"); localStorage.setItem("ratsmonitor:tier:v1", "enterprise"); } catch {}
  const st = document.createElement("style"); st.textContent = '[class*="border-dashed"][class*="border-amber-300"]{display:none!important}';
  const add = () => document.documentElement.appendChild(st); document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", add) : add();
});
const page = await ctx.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(40000);
const loaded = async () => { await page.waitForFunction(() => { const el = [...document.querySelectorAll("span")].find((x) => /Treffer/.test(x.textContent || "")); return !!el && !(el.textContent || "").trim().startsWith("…") && !document.querySelector('[aria-busy="true"]'); }, null, { timeout: 40000 }); };
const calc = async () => { await page.waitForFunction(() => !/Analyse wird berechnet|Wird berechnet|Graph wird berechnet|Netz wird berechnet|Vergleich wird berechnet/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {}); await sleep(500); };
const go = async (path) => { await page.goto(BASE + path, { waitUntil: "load" }); await sleep(2200); };
const home = () => go("/");
let mx = 640, my = 360;
const move = async (x, y, steps = 28) => { await page.mouse.move(x, y, { steps }); mx = x; my = y; };
const click = async (target, { dx = 0, dy = 0 } = {}) => {
  const loc = typeof target === "string" ? page.locator(target).first() : target.first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox(); if (!b) throw new Error("kein Element: " + target);
  await move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy); await sleep(250); await page.mouse.down(); await sleep(60); await page.mouse.up();
};
const role = (r, name) => page.getByRole(r, { name });
const clickRole = (r, name) => click(role(r, name));
const clickText = (t) => click(page.getByText(t, { exact: false }));
const type = async (term, delay = 90) => { await click("#q:visible"); await page.keyboard.type(term, { delay }); await page.keyboard.press("Enter"); await sleep(600); };
const search = async (term) => { await click("#q:visible"); await page.keyboard.type(term, { delay: 0 }); await page.keyboard.press("Enter"); await loaded(); await page.evaluate(() => window.scrollTo(0, 0)); await sleep(500); };
const scrollTo = (y) => page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
const openFirstArticle = async () => { const href = await page.locator("article a[href^='/beschluss/']").first().getAttribute("href"); await go(href); };
const nodes = async () => { const loc = page.locator("[data-node]"); const n = await loc.count(); const out = []; for (let i = 0; i < n; i++) { const b = await loc.nth(i).boundingBox(); if (b && b.y > 110 && b.y + b.height < 690 && b.x > 60 && b.x + b.width < 1180) out.push({ b, a: b.width * b.height }); } return out.sort((x, y) => y.a - x.a); };
const tapNode = async (rank) => { const o = (await nodes())[rank]; if (!o) return; await move(o.b.x + o.b.width / 2, o.b.y + o.b.height / 2); await sleep(250); await page.mouse.down(); await sleep(60); await page.mouse.up(); };
const dragNode = async (rank, dx, dy) => { const o = (await nodes())[rank]; if (!o) return; const x = o.b.x + o.b.width / 2, y = o.b.y + o.b.height / 2; await move(x, y); await sleep(250); await page.mouse.down(); await move(x + dx, y + dy, 36); await page.mouse.up(); };
const H = { sleep, loaded, calc, go, home, move, click, role, clickRole, clickText, type, search, scrollTo, openFirstArticle, tapNode, dragNode, page, BASE };

const { SCENES } = await import("./scenes.mjs");
const sc = SCENES[ID]; if (!sc) throw new Error("Szene fehlt: " + ID);
await home();
if (sc.setup) await sc.setup(H);
await sleep(1000);
const frames = []; let capturing = true;
const cap = (async () => { while (capturing) { const ts = Date.now(); try { const buf = await page.screenshot({ type: "jpeg", quality: 85 }); const n = frames.length; frames.push(ts); writeFileSync(`${OUT}/raw/f${String(n).padStart(5, "0")}.jpg`, buf); } catch {} } })();
const beats = []; let failed = 0;
for (const [name, fn, hold = 1] of sc.beats) {
  const start = Date.now();
  try { await fn(H); } catch (e) { failed++; console.log("Schritt", name, "fehlgeschlagen:", String(e).split("\n")[0].slice(0, 140)); }
  await sleep(hold * 1000);
  beats.push({ name, start, end: Date.now() });
}
capturing = false; await cap; await ctx.close(); await browser.close();
let commit = ""; try { commit = execSync("git rev-parse --short HEAD", { cwd: new URL("../../../../", import.meta.url).pathname }).toString().trim(); } catch {}
writeFileSync(`${OUT}/clip.json`, JSON.stringify({ id: ID, commit, recorded: new Date().toISOString(), frames, beats }));
if (failed) console.log(`ACHTUNG: ${failed} Schritt(e) fehlgeschlagen, Clip nicht verwenden`);
console.log("fertig", ID, "Bilder", frames.length, "Schritte", beats.map((b) => `${b.name} ${((b.end - b.start) / 1000).toFixed(1)}s`).join(", "));
if (failed) process.exit(1);
