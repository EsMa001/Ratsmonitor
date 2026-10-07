/* Einleitung: Startseite mit Karte, ein Thema eingeben (Entwurf) */
export default {
  meta: { bereich: "einleitung", dauer: "8-12 s", zeigt: "Startseite, Karte, Thema eingeben, Treffer", tags: ["werbung", "anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Startseite (leere Karte)", ende: "Karte mit Treffern zum Thema",
  setup: async (H, p) => { await H.sleep(500); },
  beats: (p) => [
    ["start", async (H) => { await H.move(700, 300, 40); }, 3],
    ["karte", async (H) => { await H.move(560, 250, 60); await H.sleep(1200); await H.move(640, 330, 60); }, 2],
    ["suche", async (H) => { await H.type(p.thema, 110); await H.loaded(); await H.scrollTo(0); await H.sleep(400); await H.move(560, 250, 50); }, 3],
  ],
};
