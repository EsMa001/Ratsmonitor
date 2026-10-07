/* Karte: in ein Gebiet hineinzoomen und das Gebiet anklicken, die Liste zeigt dessen Beschlüsse (Ort aus dem Parameter) */
/* Lage des Ortes in der Deutschlandansicht (1280x720). Münster ist aus Breite/Länge genähert und beim Aufnehmen zu prüfen; Stuttgart ist gemessen. */
const POS = { Münster: { zoom: [560, 241], klick: [560, 241] }, Stuttgart: { zoom: [605, 387], klick: [563, 358] } };
export default {
  meta: { bereich: "karte", dauer: "8-10 s", zeigt: "Zoom auf den Ort, Klick auf die Zahl, Liste des Gebiets", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { thema: "Klimaschutz", ort: "Münster" },
  start: "Karte mit Treffern (ganz Deutschland)", ende: "Gebiet angeklickt, Liste darunter gefiltert",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: (p) => {
    const pos = POS[p.ort]; if (!pos) throw new Error(`Lage von ${p.ort} fehlt in POS (karte-gebiet)`);
    return [
      ["zoom", async (H) => { await H.move(...pos.zoom, 30); for (let k = 0; k < 3; k++) { await H.page.mouse.wheel(0, -400); await H.sleep(1200); } }, 1.5],
      ["klick", async (H) => { await H.move(...pos.klick, 40); await H.sleep(300); await H.page.mouse.down(); await H.sleep(60); await H.page.mouse.up(); await H.loaded(); await H.sleep(800); }, 2.5],
    ];
  },
};
