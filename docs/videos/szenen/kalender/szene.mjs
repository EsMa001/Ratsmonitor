/* Sitzungskalender: Gebiet wählen, Sitzungstag öffnen, Abo und E-Mail */
export default {
  meta: { bereich: "kalender", dauer: "18-20 s", zeigt: "Kalender, Ort wählen, Tag mit Sitzungen, Kalender abonnieren", tags: ["anleitung", "webinar"] },
  parameter: { ort: "Münster" },
  start: "Kalender ohne Gebiet", ende: "Abo und E-Mail sichtbar",
  setup: async (H) => { await H.go("/konto/kalender"); await H.sleep(800); },
  beats: [
    ["oeffnen", async (H) => { await H.move(640, 300, 30); }, 3],
    ["gebiete", async (H, p) => { await H.click(H.page.getByPlaceholder(/Ort oder Kreis/)); await H.page.keyboard.type(p.ort, { delay: 90 }); await H.sleep(1500); await H.click(H.page.getByRole("button", { name: new RegExp(`^Stadt ${p.ort}$`) })); await H.sleep(2000); }, 2],
    ["tag", async (H) => { await H.click(H.page.locator("button[aria-label$=' Sitzungen']:not([aria-label$=' 0 Sitzungen'])").last()); await H.sleep(1200); }, 4],
    ["abo", async (H) => { await H.page.getByText("Auf dem Laufenden bleiben").scrollIntoViewIfNeeded(); await H.sleep(1200); await H.move(640, 400, 30); }, 5],
  ],
};
