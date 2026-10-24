/* plenara.X Ausschreibungen: Vergaben der Kommunen, Karte und neueste Vorgänge */
const fertig = (H) => H.hidden(async () => { await H.sleep(300); await H.calc(); await H.sleep(900); });
const klick = async (H, loc) => { await H.click(loc); await fertig(H); };
const tipp = async (H, t) => { await H.click("input[data-search='q']:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });
const btn = (H, name) => H.page.locator("main button").filter({ hasText: name }).first();
const link = (H, name) => H.page.getByRole("link", { name }).first();
export default {
  meta: { bereich: "plenarax", dauer: "10-12 s", zeigt: "Ausschreibungen: Karte, Zahl, neueste Vergaben", tags: ["anleitung", "werbung"] },
  parameter: {},
  start: "Ausschreibungen", ende: "Ausschreibungen, neueste Vorgänge",
  setup: async (H) => { await H.go("/analytics/ausschreibungen"); await H.calc(); await H.sleep(1200); await H.page.evaluate(() => window.scrollTo(0, 0)); },
  beats: [
    ["start", async (H) => { await H.move(640, 210, 40); await H.sleep(600); await H.move(950, 260, 40); }, 4],
    ["liste", async (H) => { await zu(H, "Neueste Vorgänge", 80); await H.move(900, 300, 40); await H.sleep(600); await H.move(900, 450, 40); }, 5],
  ],
};
