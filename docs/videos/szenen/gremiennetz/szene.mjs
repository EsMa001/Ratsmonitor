/* Plenara.X Gremiennetz: Weg der Vorgänge durch die Gremien */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip); jump = harter Sprung ohne Scroll-Animation (kein Blitzbild) */
const tipp = async (H, t, knopf) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); }); };
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* springt so, dass die Überschrift oben im Bild steht (unabhängig von der Seitenlänge) */
export default {
  meta: { bereich: "gremiennetz", dauer: "35-40 s", zeigt: "Gremiennetz mit Pfeilen, Übergangsdauer, Rollen im Netz", tags: ["anleitung", "webinar"] },
  parameter: {},
  start: "Gremiennetz", ende: "Gremiennetz mit Hervorhebung",
  setup: async (H) => { await H.go("/analytics/gremien"); await H.calc(); await H.sleep(1500); },
  beats: [
    ["start", async (H) => { await H.move(640, 330, 30); }, 4.5],
    ["netz", async (H) => { await jump(H, 350); await H.move(640, 360, 40); }, 6],
    ["pfeile", async (H) => { await jump(H, 700); await H.move(300, 300, 40); await H.sleep(1500); await H.move(800, 300, 40); }, 6],
    ["dauer", async (H) => { await H.move(1000, 300, 40); }, 5],
    ["arten", async (H) => { await zu(H, "Rollen im Netz", 70); await H.move(640, 400, 40); }, 6],
    ["fazit", async (H) => { await jump(H, 350); await H.move(500, 360, 50); await H.sleep(1000); await H.move(800, 400, 50); }, 6],
  ],
};
