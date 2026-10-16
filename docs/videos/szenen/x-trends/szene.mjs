/* plenara.X Trends: aufsteigende Begriffe, Steckbrief eines Begriffs mit Ausbreitung, Reiter Ausgang */
/* Hilfen: fertig = warten ohne Aufnahme, bis die Seite gerechnet hat; klick = sichtbar klicken, Laden ohne Aufnahme; tipp = Begriff sichtbar tippen, Absenden ohne Aufnahme; jump/zu = harter Sprung (kein Blitzbild) */
const fertig = (H) => H.hidden(async () => { await H.sleep(300); await H.calc(); await H.sleep(900); });
const klick = async (H, loc) => { await H.click(loc); await fertig(H); };
const tipp = async (H, t) => { await H.click("input[data-search='q']:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });
const btn = (H, name) => H.page.locator("main button").filter({ hasText: name }).first();
const link = (H, name) => H.page.getByRole("link", { name }).first();
export default {
  meta: { bereich: "plenarax", dauer: "25-30 s", zeigt: "Trends: Rangliste der zunehmenden Begriffe, Begriff mit Ausbreitung, Ausgang", tags: ["anleitung", "werbung"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Trends, alle Themen", ende: "Trends, Reiter Ausgang",
  setup: async (H) => { await H.go("/analytics/trends"); await H.calc(); await H.sleep(1200); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 4],
    ["liste", async (H) => { await jump(H, 470); await H.move(900, 300, 40); await H.sleep(600); await H.move(900, 480, 40); }, 5],
    ["begriff", async (H) => { await jump(H, 0); await tipp(H, p.thema); await jump(H, 420); await H.move(400, 400, 40); }, 6],
    ["ausgang", async (H) => { await jump(H, 0); await klick(H, link(H, /^Ausgang$/)); await jump(H, 330); await H.move(640, 400, 40); }, 5],
  ],
};
