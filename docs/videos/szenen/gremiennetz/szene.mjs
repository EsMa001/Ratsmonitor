/* Plenara.X Gremiennetz: Weg der Vorgänge durch die Gremien */
export default {
  meta: { bereich: "gremiennetz", dauer: "25-30 s", zeigt: "Gremiennetz mit Pfeilen, Übergangsdauer, Gremienarten", tags: ["anleitung", "webinar"] },
  parameter: {},
  start: "Gremiennetz", ende: "Gremiennetz mit Hervorhebung",
  setup: async (H) => { await H.go("/analytics/gremien"); await H.calc(); await H.sleep(1500); },
  beats: [
    ["start", async (H) => { await H.move(640, 330, 30); }, 5],
    ["pfeile", async (H) => { await H.move(420, 300, 40); await H.sleep(1500); await H.move(800, 420, 50); await H.sleep(1500); await H.move(640, 250, 50); }, 9],
    ["arten", async (H) => { await H.scrollTo(450); await H.sleep(900); await H.move(640, 400, 40); }, 6],
  ],
};
