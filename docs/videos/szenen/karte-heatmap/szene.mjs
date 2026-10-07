/* Karte: Darstellung auf Heatmap umschalten */
export default {
  meta: { bereich: "karte", dauer: "5-6 s", zeigt: "Kartenansicht wechseln, Heatmap", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Karte mit Treffern (Flächen)", ende: "Heatmap",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: [
    ["heatmap", async (H) => { await H.clickRole("button", "Darstellung der Karte"); await H.sleep(800); await H.clickRole("radio", "Heatmap"); await H.loaded(); }, 3],
  ],
};
