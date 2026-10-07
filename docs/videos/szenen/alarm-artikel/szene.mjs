/* Alarm am einzelnen Vorgang: im Artikel die Benachrichtigung einschalten */
export default {
  meta: { bereich: "alarme", dauer: "5-6 s", zeigt: "Artikel, Benachrichtigungen einschalten", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Artikel", ende: "Benachrichtigung am Vorgang eingeschaltet",
  setup: async (H, p) => { await H.search(p.thema); await H.openFirstArticle(); await H.sleep(1500); },
  beats: [
    ["glocke", async (H) => { await H.clickRole("button", /Benachrichtigungen einschalten/); await H.sleep(600); }, 3],
  ],
};
