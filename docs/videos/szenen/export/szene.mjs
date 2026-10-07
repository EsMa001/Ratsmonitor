/* Export: Trefferliste als Excel/CSV, einzelner Artikel mit PDF, Druck, Excel, CSV */
export default {
  meta: { bereich: "export", dauer: "12-14 s", zeigt: "Exportmenü über der Trefferliste, Exportmenü im Artikel", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Trefferliste", ende: "Exportmenü im Artikel offen",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: [
    ["fenster", async (H) => { await H.clickRole("button", /^Exportieren$/); await H.sleep(800); await H.move(640, 330, 30); }, 5],
    ["artikel", async (H) => { await H.hidden(() => H.openFirstArticle()); await H.sleep(800); await H.clickRole("button", /^Exportieren$/); await H.sleep(600); }, 6],
  ],
};
