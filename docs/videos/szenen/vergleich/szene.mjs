/* Plenara.X Gebietsvergleich: zwei Orte nebeneinander */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip); jump = harter Sprung ohne Scroll-Animation (kein Blitzbild) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* springt so, dass die Überschrift oben im Bild steht (unabhängig von der Seitenlänge) */
export default {
  meta: { bereich: "vergleich", dauer: "40-45 s", zeigt: "Gebietsvergleich zweier Orte: Überblick, Themenprofil, Stand der Vorlagen, typische und gemeinsame Begriffe", tags: ["anleitung", "webinar"] },
  parameter: { ort: "Münster", ort2: "Osnabrück" },
  start: "Gebietsvergleich, leer", ende: "Überblick",
  setup: async (H) => { await H.go("/analytics/vergleich"); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 4],
    ["orte", async (H) => { await tipp(H, `${p.ort}, ${p.ort2}`, /Vergleich starten/); await zu(H, "Überblick", 100); await H.move(640, 300, 40); }, 7],
    ["profil", async (H) => { await zu(H, "Themenprofil", 70); await H.move(640, 400, 40); await H.sleep(2500); await zu(H, "Stand der Vorlagen", 70); await H.move(640, 360, 40); }, 6],
    ["begriffe", async (H) => { await zu(H, "Typisch für den Ort", 70); await H.move(640, 400, 40); await H.sleep(2500); await zu(H, "Gemeinsame Begriffe", 70); await H.move(640, 360, 40); }, 6],
    ["massstab", async (H) => { await zu(H, "Themenprofil", 70); await H.move(640, 400, 40); }, 5],
    ["hinweis", async (H) => { await zu(H, "Überblick", 100); await H.move(640, 300, 40); }, 5],
  ],
};
