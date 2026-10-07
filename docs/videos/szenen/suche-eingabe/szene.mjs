/* Suche: Thema eingeben, Karte und erste Treffer (Entwurf) */
export default {
  meta: { bereich: "suche", dauer: "8-12 s", zeigt: "Thema tippen, Karte, erste Treffer", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Startseite", ende: "Suchergebnis, Liste sichtbar",
  setup: async (H, p) => { await H.sleep(500); },
  beats: (p) => [
    ["eingabe", async (H) => { await H.type(p.thema, 110); await H.loaded(); await H.scrollTo(0); }, 2],
    ["karte", async (H) => { await H.move(620, 300, 50); await H.sleep(1200); await H.move(520, 260, 50); }, 3],
    ["liste", (H) => H.scrollTo(540), 3],
  ],
};
