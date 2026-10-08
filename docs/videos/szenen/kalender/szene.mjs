/* Sitzungskalender: Gebiet wählen, Sitzungstag öffnen, Abo und E-Mail */
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* Überschrift oben im Bild, unabhängig von der Seitenlänge */
export default {
  meta: { bereich: "kalender", dauer: "18-20 s", zeigt: "Kalender, Ort wählen, Tag mit Sitzungen, Kalender abonnieren", tags: ["anleitung", "webinar"] },
  parameter: { ort: "Münster" },
  start: "Kalender ohne Gebiet", ende: "Abo und E-Mail sichtbar",
  setup: async (H) => { await H.go("/konto/kalender"); await H.sleep(800); },
  beats: (p) => [
    ["oeffnen", async (H) => { await zu(H, "Oktober 2026", 110); await H.move(640, 330, 30); }, 3.5],
    ["gebiete", async (H) => { await zu(H, "Meine Gebiete", 200); await H.click(H.page.getByPlaceholder(/Ort oder Kreis/)); await H.page.keyboard.type(p.ort, { delay: 90 }); await H.sleep(1500); await H.click(H.page.getByRole("button", { name: new RegExp(`^Stadt ${p.ort}$`) })); await H.sleep(1500); }, 2],
    ["tag", async (H) => { await zu(H, "Oktober 2026", 110); await H.click(H.page.locator("button[aria-label$=' Sitzungen']:not([aria-label$=' 0 Sitzungen'])").last()); await H.sleep(1200); }, 4.5],
    ["abo", async (H) => { await zu(H, "Auf dem Laufenden bleiben", 150); await H.move(640, 400, 30); }, 5],
  ],
};
