/* Abschluss: Aufforderung zur eigenen Suche, Logo */
export default {
  meta: { bereich: "abschluss", dauer: "10-12 s", zeigt: "Startseite, Thema suchen, Logo", tags: ["werbung", "anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Startseite", ende: "Logo oben links",
  setup: async (H) => { await H.go("/"); await H.sleep(500); },
  beats: (p) => [
    ["suche", async (H) => { await H.type(p.thema, 110); await H.loaded(); await H.scrollTo(0); await H.move(560, 250, 50); }, 5],
    ["logo", async (H) => { await H.move(70, 30, 50); }, 3],
  ],
};
