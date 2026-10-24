/* Karte: zum Thema den Ort hinzunehmen, die Karte fliegt in das Gebiet und zeigt seine Zahl, die Liste dessen Beschlüsse (Ort aus dem Parameter).
   Früher zoomte die Szene auf fest eingetragene Kartenpunkte; seit der Umgestaltung der Karte (10.2026) trafen sie nicht mehr. Die Ortssuche ist unabhängig von der Lage. */
export default {
  meta: { bereich: "karte", dauer: "8-10 s", zeigt: "Ort zum Thema tippen, Karte fliegt ins Gebiet, Zahl und Liste des Gebiets", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { thema: "Klimaschutz", ort: "Münster" },
  start: "Karte mit Treffern (ganz Deutschland)", ende: "Gebiet gewählt, Liste darunter gefiltert",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: (p) => [
    ["zoom", async (H) => {
      /* Fokus ohne Klick (der Klick scrollt die Seite zum Fuß), dann sichtbar „Begriff Ort“ tippen, egal was im Feld stand */
      await H.hidden(async () => { await H.page.locator("input[data-search='q']:visible").first().focus(); await H.page.keyboard.press("ControlOrMeta+a"); await H.page.keyboard.press("Backspace"); await H.page.evaluate(() => window.scrollTo(0, 0)); await H.sleep(400); });
      await H.page.keyboard.type(`${p.thema} ${p.ort}`, { delay: 90 }); await H.sleep(900); }, 1.2],
    /* Flug der Karte ohne Aufnahme (ruckelnde Zwischenbilder), danach liegt das Gebiet mittig: die Maus zeigt auf seine Zahl */
    ["klick", async (H) => { await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.loaded(); await H.page.evaluate(() => window.scrollTo(0, 0)); await H.sleep(2500); }); await H.move(370, 380, 40); await H.sleep(600); await H.move(900, 300, 40); }, 2.5],
  ],
};
