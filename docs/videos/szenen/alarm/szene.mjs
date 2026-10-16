/* Alarm: Suche speichern, im Konto die Benachrichtigung per E-Mail einschalten */
export default {
  meta: { bereich: "alarme", dauer: "10-12 s", zeigt: "Suche speichern, gespeicherte Suchen, Glocke einschalten", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { thema: "Klimaschutz" },
  start: "Trefferseite", ende: "Gespeicherte Suche mit eingeschalteter Benachrichtigung",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: [
    ["herz", (H) => H.clickRole("button", /Suche speichern/), 1.5],
    ["konto", async (H) => { await H.move(1190, 28, 30); await H.hidden(async () => { await H.page.locator('a[href="/konto/suchen"]').first().click(); await H.page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); await H.sleep(1200); }); }, 1.5],  /* Seitenwechsel ohne Aufnahme (sonst Blitzbild) */
    ["glocke", async (H) => { await H.hidden(async () => { await H.page.evaluate(() => window.scrollTo({ top: 260, behavior: "instant" })); await H.sleep(500); }); await H.clickRole("button", /Bei neuen Treffern benachrichtigen/); await H.sleep(500); }, 2.5],
  ],
};
