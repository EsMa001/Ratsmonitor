/* plenara.X Einblicke: Gremien (Wege durch die Ausschüsse), Themennetz, Aktuelles */
/* Hilfen: fertig = warten ohne Aufnahme, bis die Seite gerechnet hat; klick = sichtbar klicken, Laden ohne Aufnahme; tipp = Begriff sichtbar tippen, Absenden ohne Aufnahme; jump/zu = harter Sprung (kein Blitzbild) */
const fertig = (H) => H.hidden(async () => { await H.sleep(300); await H.calc(); await H.sleep(900); });
const klick = async (H, loc) => { await H.click(loc); await fertig(H); };
const tipp = async (H, t) => { await H.click("input[data-search='q']:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });
const btn = (H, name) => H.page.locator("main button").filter({ hasText: name }).first();
const link = (H, name) => H.page.getByRole("link", { name }).first();
export default {
  meta: { bereich: "plenarax", dauer: "20-25 s", zeigt: "Gremien-Netz, Themennetz, Aktuelles mit Zitat und Quelle", tags: ["anleitung", "werbung"] },
  parameter: {},
  start: "Gremien", ende: "Aktuelles",
  setup: async (H) => { await H.go("/analytics/gremien"); await H.calc(); await H.sleep(1200); await H.page.evaluate(() => window.scrollTo({ top: 330, behavior: "instant" })); await H.sleep(600); },
  beats: [
    ["gremien", async (H) => { await H.move(500, 420, 40); await H.sleep(600); await H.move(800, 480, 40); }, 5],
    ["netz", async (H) => { await H.hidden(async () => { await H.go("/analytics/graph"); await H.calc(); await H.page.getByRole("button", { name: /Netz anzeigen/ }).first().click({ timeout: 3000 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1500); await H.page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" })); await H.sleep(600); }); await H.move(640, 400, 40); }, 5],
    ["aktuelles", async (H) => { await H.hidden(async () => { await H.go("/analytics/news"); await H.calc(); await H.sleep(1200); await H.page.evaluate(() => window.scrollTo({ top: 380, behavior: "instant" })); await H.sleep(600); }); await H.move(640, 400, 40); }, 6],
  ],
};
