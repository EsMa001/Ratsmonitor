/* plenara.X Atlas: Überblick, Thema, Suchbegriff, Themenliste */
/* Hilfen: fertig = warten ohne Aufnahme, bis die Seite gerechnet hat; klick = sichtbar klicken, Laden ohne Aufnahme; tipp = Begriff sichtbar tippen, Absenden ohne Aufnahme; jump/zu = harter Sprung (kein Blitzbild) */
const fertig = (H) => H.hidden(async () => { await H.sleep(300); await H.calc(); await H.sleep(900); });
const klick = async (H, loc) => { await H.click(loc); await fertig(H); };
const tipp = async (H, t) => { await H.click("input[data-search='q']:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });
const btn = (H, name) => H.page.locator("main button").filter({ hasText: name }).first();
const link = (H, name) => H.page.getByRole("link", { name }).first();
/* Zahl der Vorgänge oben (der Atlas zeigt beim Rechnen die alte Zahl weiter) */
const zahl = (H) => H.page.evaluate(() => (document.body.innerText.match(/([\d.]+)\s*\n+\s*Vorgänge/) || [])[1] || "");
export default {
  meta: { bereich: "plenarax", dauer: "25-30 s", zeigt: "Atlas: Karte und Zahlen, Thema wählen, Suchbegriff, Themenliste", tags: ["anleitung", "werbung", "wow"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Atlas, alle Themen", ende: "Atlas, Unterthemen",
  setup: async (H) => { await H.go("/analytics/atlas"); await H.calc(); await H.sleep(1200); },
  beats: (p) => [
    ["start", async (H) => { await H.move(420, 560, 40); await H.sleep(800); await H.move(700, 600, 40); }, 4],
    ["thema", async (H) => { await klick(H, btn(H, /^Umwelt, Klima & Energie$/)); await H.move(500, 600, 40); }, 4],
    ["begriff", async (H) => { const vorher = await zahl(H); await tipp(H, p.thema); await H.hidden(() => H.page.waitForFunction((v) => { const e = [...document.querySelectorAll("main p,main span,main div")].find((x) => x.nextElementSibling?.innerText?.trim() === "Vorgänge" || /^Vorgänge$/.test(x.innerText.trim()) && false); const t = document.body.innerText.match(/([\d.]+)\s*\n+\s*Vorgänge/); return t && t[1] !== v; }, vorher, { timeout: 60000 }).catch(() => {}).then(() => H.sleep(800))); await H.move(400, 520, 40); }, 5],
    ["themen", async (H) => { await zu(H, "Unterthemen", 90); await H.move(800, 330, 40); }, 5],
  ],
};
