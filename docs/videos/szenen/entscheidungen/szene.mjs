/* Plenara.X Beschlüsse: Quoten, Dauer, Abstimmungen, Statusabdeckung */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip); jump = harter Sprung ohne Scroll-Animation (kein Blitzbild) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3,summary")].find((x) => x.innerText.trim().startsWith(t)); if (e) e.closest("details")?.setAttribute("open", ""); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* springt so, dass die Überschrift oben im Bild steht (unabhängig von der Seitenlänge) */
export default {
  meta: { bereich: "entscheidungen", dauer: "35-40 s", zeigt: "Beschlussquote, Vertagung, Ablehnung, Durchlaufzeit, Abstimmungsergebnis, Stand der Vorgänge", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Beschlüsse (Start mit Haushalt)", ende: "Stand der Vorgänge",
  setup: async (H) => { await H.go("/analytics/beschluesse"); await H.calc(); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 4.5],
    ["raten", async (H) => { await tipp(H, p.thema, /Auswerten/); await jump(H, 330); await H.move(300, 150, 40); }, 5],
    ["rateno", async (H) => { await H.move(560, 150, 40); await H.sleep(1500); await H.move(800, 150, 40); }, 4.5],
    ["dauer", async (H) => { await zu(H, "Durchlaufzeit", 70); await H.move(640, 400, 40); }, 6],
    ["votes", async (H) => { await zu(H, "Abstimmung und Änderungen", 70); await H.move(300, 300, 40); }, 6],
    ["status", async (H) => { await zu(H, "Stand der Vorgänge", 70); await H.move(640, 250, 40); }, 6],
  ],
};
