/* plenara.X Fakten: Hebesätze, Karte, Gebiet antippen zeigt die Vorgänge mit dem Wert */
/* Hilfen: fertig = warten ohne Aufnahme, bis die Seite gerechnet hat; klick = sichtbar klicken, Laden ohne Aufnahme; tipp = Begriff sichtbar tippen, Absenden ohne Aufnahme; jump/zu = harter Sprung (kein Blitzbild) */
const fertig = (H) => H.hidden(async () => { await H.sleep(300); await H.calc(); await H.sleep(900); });
const klick = async (H, loc) => { await H.click(loc); await fertig(H); };
const tipp = async (H, t) => { await H.click("input[data-search='q']:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });
const btn = (H, name) => H.page.locator("main button").filter({ hasText: name }).first();
const link = (H, name) => H.page.getByRole("link", { name }).first();
export default {
  meta: { bereich: "plenarax", dauer: "15-20 s", zeigt: "Fakten: Hebesätze mit Spanne, Karte je Gemeinde, Wert mit Quelle", tags: ["anleitung", "werbung"] },
  parameter: {},
  start: "Fakten, Hebesätze", ende: "Fakten, Vorgänge eines Gebiets",
  setup: async (H) => { await H.go("/analytics/fakten?fakt=hebesatz"); await H.calc(); await H.sleep(1200); },
  beats: [
    ["start", async (H) => { await H.move(300, 420, 40); await H.sleep(500); await H.move(200, 530, 40); }, 4],
    ["karte", async (H) => { await zu(H, "Gebiete", 90); await H.move(320, 400, 40); await H.sleep(600); await H.move(900, 300, 40); }, 5],
    ["liste", async (H) => { await klick(H, H.page.locator("main button").filter({ hasText: /\d %$/ }).first()); await H.move(900, 420, 40); }, 5],
  ],
};
