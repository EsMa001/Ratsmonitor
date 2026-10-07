/* Plenara.X Gebietsvergleich: zwei Orte nebeneinander */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
export default {
  meta: { bereich: "vergleich", dauer: "25-30 s", zeigt: "Gebietsvergleich zweier Orte: Überblick, Themenprofil, Gremien, typische Begriffe", tags: ["anleitung", "webinar"] },
  parameter: { ort: "Münster", ort2: "Osnabrück" },
  start: "Gebietsvergleich, leer", ende: "Themenprofil und Begriffe",
  setup: async (H) => { await H.go("/analytics/vergleich"); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await tipp(H, `${p.ort}, ${p.ort2}`, /Vergleich starten/); }, 5],
    ["profil", async (H) => { await H.scrollTo(500); await H.sleep(1200); await H.move(640, 400, 40); }, 8],
    ["begriffe", async (H) => { await H.scrollTo(1400); await H.sleep(1200); await H.move(640, 400, 40); }, 7],
  ],
};
