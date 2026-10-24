/* Karte: Darstellung auf Heatmap umschalten */
export default {
  meta: { bereich: "karte", dauer: "5-6 s", zeigt: "Kartenansicht wechseln, Heatmap", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Karte mit Treffern (Flächen)", ende: "Heatmap",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: [
    ["heatmap", async (H) => { await H.clickRole("button", "Darstellung der Karte"); await H.sleep(800); await H.move(640, 330, 30); await H.hidden(async () => { await H.page.getByRole("radio", { name: "Heatmap" }).click(); await H.loaded(); await H.sleep(1800); }); await H.move(560, 380, 30); }, 3],  /* Neuzeichnen der Karte ohne Aufnahme (sonst leere Karte als Blitzbild) */
  ],
};
