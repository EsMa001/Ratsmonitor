/* Plenara.X Trends: Zeitraum, Trendkarte, Rangliste, Themenfelder */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip); jump = harter Sprung ohne Scroll-Animation (kein Blitzbild) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* springt so, dass die Überschrift oben im Bild steht (unabhängig von der Seitenlänge) */
export default {
  meta: { bereich: "trends", dauer: "35-40 s", zeigt: "Trendanalyse: Zeitraum, Trendkarte, Rangliste mit Verlaufskurven, Themenfelder", tags: ["anleitung", "webinar"] },
  parameter: {},
  start: "Trends", ende: "Themenfelder",
  setup: async (H) => { await H.go("/analytics/trends"); await H.calc(); await H.sleep(1500); },
  beats: [
    ["start", async (H) => { await H.move(640, 330, 30); }, 4],
    ["zeitraum", async (H) => { await jump(H, 430); await H.move(300, 150, 40); }, 5],
    ["karte", async (H) => { await zu(H, "Trendkarte", 70); await H.move(560, 380, 50); await H.sleep(1000); await H.move(780, 300, 50); }, 6],
    ["rangliste", async (H) => { await jump(H, 1000); await H.move(640, 420, 40); }, 7],
    ["themenfelder", async (H) => { await zu(H, "Themenfelder", 70); await H.move(640, 400, 40); }, 6],
  ],
};
