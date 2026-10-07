/* Wochenbericht: bei den gespeicherten Suchen Rhythmus wählen und einschalten */
export default {
  meta: { bereich: "postfach", dauer: "8-10 s", zeigt: "Wochenbericht: Rhythmus wählen, einschalten", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Gespeicherte Suchen mit Wochenbericht", ende: "Wochenbericht eingeschaltet",
  setup: async (H, p) => { await H.search(p.thema); await H.clickRole("button", /Suche speichern/); await H.page.locator('a[href="/konto/suchen"][aria-label*="(1)"]').waitFor({ timeout: 8000 }); await H.sleep(800); await H.go("/konto/suchen"); await H.sleep(800); },
  beats: [
    ["wochenbericht", async (H) => { const sel = H.page.getByLabel("Rhythmus des Wochenberichts"); await H.click(sel); await H.sleep(500); await sel.selectOption({ label: "Jeden Mittwoch" }); await H.sleep(900); await H.click(H.page.getByRole("switch", { name: "Wochenbericht" })); await H.sleep(500); }, 7],
  ],
};
