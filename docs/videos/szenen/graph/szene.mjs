/* Plenara.X Knowledge Graph: Netz erstellen, Knoten ziehen und anklicken */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
export default {
  meta: { bereich: "graph", dauer: "25-30 s", zeigt: "Knowledge Graph zu einem Thema, Knoten ziehen, anklicken", tags: ["anleitung", "webinar", "wow"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Knowledge Graph, leer", ende: "Graph mit Auswahl",
  setup: async (H) => { await H.go("/analytics/graph"); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await tipp(H, p.thema, /Graph erstellen/); await H.move(640, 330, 30); }, 5],
    ["knoten", async (H) => { await H.dragNode(1, 70, 40); await H.sleep(700); await H.tapNode(0); await H.sleep(1000); await H.tapNode(2); }, 8],
  ],
};
