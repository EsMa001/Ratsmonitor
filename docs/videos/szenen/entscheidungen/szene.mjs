/* Plenara.X Status und Beschlüsse: Quoten, Dauer, Abstimmungen */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
export default {
  meta: { bereich: "entscheidungen", dauer: "30-35 s", zeigt: "Beschlussquote, Vertagung, Ablehnung, Dauer, Abstimmungsergebnis, Statusabdeckung", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Status und Beschlüsse, leer", ende: "Abstimmungen",
  setup: async (H) => { await H.go("/analytics/beschluesse"); await H.calc(); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 3],
    ["raten", async (H) => { await tipp(H, p.thema, /Auswerten/); await H.move(640, 300, 40); }, 9],
    ["dauer", async (H) => { await H.scrollTo(520); await H.sleep(1200); await H.move(640, 400, 40); }, 7],
    ["votes", async (H) => { await H.scrollTo(1100); await H.sleep(1200); await H.move(640, 400, 40); }, 7],
  ],
};
