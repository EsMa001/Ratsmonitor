/* Plenara.X Diffusionsanalyse: Zeitraffer, Kennzahlen, Diagramm, zweites Thema, Bundesländer (je Satz ein Bildzustand, Karte immer ganz im Bild) */
/* Begriff sichtbar tippen, Absenden und Warten ohne Aufnahme (kein Ladetext im Clip); jump = harter Sprung ohne Scroll-Animation (kein Blitzbild) */
const tipp = async (H, t, knopf, danach) => { await H.click("#q:visible"); await H.page.keyboard.type(t, { delay: 90 }); await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.page.getByRole("button", { name: knopf }).first().click({ timeout: 1500 }).catch(() => {}); await H.sleep(500); await H.calc(); await H.sleep(1200); if (danach) await danach(); }); };
/* Zeitraffer anhalten und auf den Anfang stellen (Schieberegler auf Minimum); "Analyse starten" spielt ihn danach von vorn ab */
const anhalten = (H) => async () => { await H.page.evaluate(() => { document.querySelector('button[aria-label="Pause"]')?.click(); const i = document.querySelector('input[aria-label="Datum"]'); if (i) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, i.min); i.dispatchEvent(new Event("input", { bubbles: true })); } }); await H.sleep(600); };
const abspielen = (H) => H.page.evaluate(() => { [...document.querySelectorAll("button")].find((b) => /Analyse starten/.test(b.getAttribute("aria-label") || b.innerText || ""))?.click(); });
const jump = (H, y) => H.hidden(async () => { await H.page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y); await H.sleep(500); });
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* springt so, dass die Überschrift oben im Bild steht (unabhängig von der Seitenlänge) */
export default {
  meta: { bereich: "diffusion", dauer: "45-50 s", zeigt: "Diffusionsanalyse: Zeitraffer auf der Karte, Kennzahlen, Diagramm, Vergleichsthema, Bundesländer", tags: ["anleitung", "webinar", "wow"] },
  parameter: { thema: "Wärmeplanung", thema2: "Hitzeschutz" },
  start: "Diffusionsanalyse, leer", ende: "Bundesländer-Liste",
  setup: async (H) => { await H.go("/analytics/diffusion"); await H.sleep(800); },
  beats: (p) => [
    ["start", async (H) => { await H.move(640, 330, 30); }, 5],
    ["karte", async (H) => { await tipp(H, p.thema, /Analyse starten/, anhalten(H)); await jump(H, 345); await H.move(700, 300, 40); await H.sleep(1500); await H.move(520, 380, 50); }, 6],
    ["zeitraffer", async (H) => { await abspielen(H); await H.move(760, 300, 50); }, 9],
    ["kennzahlen", async (H) => { await zu(H, "Ausbreitung im Zeitverlauf", 330); await H.move(120, 500, 40); }, 5],
    ["zehnneunzig", async (H) => { await H.move(520, 500, 40); }, 4],
    ["diagramm", async (H) => { await zu(H, "Ausbreitung im Zeitverlauf", 70); await H.move(640, 440, 40); await H.page.mouse.down(); await H.page.mouse.up(); await H.sleep(800); await H.move(900, 440, 40); await H.page.mouse.down(); await H.page.mouse.up(); }, 5],
    ["gegenbeispiel", async (H) => { await jump(H, 0); await tipp(H, p.thema2, /Analyse starten/); await jump(H, 345); await H.move(700, 300, 40); }, 8],
    ["laender", async (H) => { await zu(H, "Bundesländer", 70); await H.move(640, 400, 40); }, 5],
  ],
};
