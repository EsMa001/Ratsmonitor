/* Plenara.X Trends: Rangliste, Trendkarte, Themenfelder */
export default {
  meta: { bereich: "trends", dauer: "25-30 s", zeigt: "Trendanalyse: Zeitraum, Rangliste der Begriffe, Trendkarte", tags: ["anleitung", "webinar"] },
  parameter: {},
  start: "Trends", ende: "Trendkarte",
  setup: async (H) => { await H.go("/analytics/trends"); await H.calc(); await H.sleep(1500); },
  beats: [
    ["start", async (H) => { await H.move(640, 330, 30); }, 6],
    ["rangliste", async (H) => { await H.scrollTo(900); await H.sleep(1200); await H.move(640, 420, 40); }, 8],
    ["karte", async (H) => { await H.scrollTo(320); await H.sleep(1200); await H.move(560, 380, 50); await H.sleep(900); await H.move(760, 300, 50); }, 8],
  ],
};
