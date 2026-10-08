/* Plenara.X Knowledge Graph: Netz erstellen, Knoten ziehen und anklicken */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip); jump = harter Sprung ohne Scroll-Animation (kein Blitzbild) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
export default {
  meta: { bereich: "graph", dauer: "35-40 s", zeigt: "Knowledge Graph zu einem Thema, Knoten ziehen und anklicken, Gremien und Länder", tags: ["anleitung", "webinar", "wow"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Knowledge Graph, leer", ende: "Graph mit Auswahl",
  setup: async (H) => { await H.go("/analytics/graph"); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 4],
    ["netz", async (H) => { await tipp(H, p.thema, /Graph erstellen/); await jump(H, 330); await H.move(640, 300, 40); }, 6],
    ["knoten", async (H) => { await H.dragNode(1, 70, 40); await H.sleep(900); await H.dragNode(2, -60, 50); }, 6],
    ["gremien", async (H) => { await H.tapNode(3); await H.sleep(1200); await H.tapNode(5); }, 6],
    ["zusammenhang", async (H) => { await H.move(500, 360, 50); await H.sleep(1000); await H.move(800, 420, 50); }, 5],
    ["hinweis", async (H) => { await H.move(640, 300, 40); }, 5],
  ],
};
