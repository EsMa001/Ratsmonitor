/* Datenabdeckung: Seite mit Zahlen, Gemeinde suchen */
export default {
  meta: { bereich: "abdeckung", dauer: "16-18 s", zeigt: "Seite Datenabdeckung, Zahlen, Ort prüfen, Stand des letzten Abrufs", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { ort: "Münster" },
  start: "Datenabdeckung", ende: "Suchergebnis für den Ort",
  setup: async (H) => { await H.go("/quellen"); await H.sleep(800); },
  beats: [
    ["seite", async (H) => { await H.move(640, 300, 30); await H.sleep(1500); await H.scrollTo(260); }, 8],
    ["suche", async (H, p) => { await H.click(H.page.getByPlaceholder(/Ort eingeben/)); await H.page.keyboard.type(p.ort, { delay: 100 }); await H.sleep(1500); }, 6],
  ],
};
