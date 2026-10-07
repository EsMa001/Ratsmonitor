/* Plenara.X Diffusionsanalyse: Thema starten, Zeitraffer, Kennzahlen, Diagramm, zweites Thema, Bundesländer */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const analyse = (H, t) => tipp(H, t, /Analyse starten/);
export default {
  meta: { bereich: "diffusion", dauer: "35-40 s", zeigt: "Diffusionsanalyse: Zeitraffer auf der Karte, Kennzahlen, Diagramm, Vergleichsthema, Bundesländer", tags: ["anleitung", "webinar", "wow"] },
  parameter: { thema: "Wärmeplanung", thema2: "Hitzeschutz" },
  start: "Diffusionsanalyse, leer", ende: "Bundesländer-Liste",
  setup: async (H) => { await H.go("/analytics/diffusion"); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 3],
    ["zeitraffer", async (H) => { await analyse(H, p.thema); await H.move(700, 300, 40); }, 9],
    ["kennzahlen", async (H) => { await H.move(640, 160, 40); }, 6],
    ["diagramm", async (H) => { const h = H.page.getByText("Ausbreitung im Zeitverlauf").first(); await h.scrollIntoViewIfNeeded(); await H.sleep(900); const b = await h.boundingBox(); await H.click(H.page.locator("body"), { dx: 0, dy: 0 }).catch(() => {}); await H.move(640, b.y + 170, 40); await H.page.mouse.down(); await H.page.mouse.up(); await H.sleep(800); }, 6],
    ["gegenbeispiel", async (H) => { await H.scrollTo(0); await H.sleep(900); await analyse(H, p.thema2); await H.move(700, 300, 40); }, 9],
    ["laender", async (H) => { const h = H.page.getByText("Bundesländer", { exact: true }).first(); await h.scrollIntoViewIfNeeded(); await H.sleep(600); await H.move(640, 400, 40); }, 6],
  ],
};
