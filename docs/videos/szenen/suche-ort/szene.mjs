/* Suche: Ortsname tippen, Ort wird erkannt (Marke „Ort erkannt“), Treffer des Ortes */
export default {
  meta: { bereich: "suche", dauer: "6-8 s", zeigt: "Ortsname tippen, Vorschlag, Ort erkannt, Treffer", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { ort: "Münster" },
  start: "Startseite", ende: "Treffer des Ortes",
  setup: async (H) => { await H.sleep(500); },
  beats: (p) => [
    ["tippen", async (H) => { await H.click("#q:visible"); await H.page.keyboard.type(p.ort, { delay: 120 }); }, 2.5],
    ["ergebnis", async (H) => { await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.loaded(); await H.sleep(2500); }); await H.sleep(900); await H.move(640, 330, 30); }, 3],  /* Flug der Karte zum Ort ohne Aufnahme (ruckelnde Zwischenbilder) */
  ],
};
