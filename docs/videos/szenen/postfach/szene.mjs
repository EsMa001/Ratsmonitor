/* Postfach: Wochenbericht bei den gespeicherten Suchen, Testmails im Test-Postfach */
export default {
  meta: { bereich: "postfach", dauer: "16-18 s", zeigt: "Wochenbericht, Beispielmails, Test-Postfach", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Gespeicherte Suchen mit Wochenbericht", ende: "Test-Postfach mit Mails",
  setup: async (H, p) => { await H.search(p.thema); await H.clickRole("button", /Suche speichern/); await H.page.locator('a[href="/konto/suchen"][aria-label*="(1)"]').waitFor({ timeout: 8000 }); await H.sleep(800); await H.go("/konto/suchen"); await H.sleep(800); },
  beats: [
    ["wochenbericht", async (H) => { const sel = H.page.getByLabel("Rhythmus des Wochenberichts"); await H.click(sel); await H.sleep(500); await sel.selectOption({ label: "Jeden Mittwoch" }); await H.sleep(900); await H.click(H.page.getByRole("switch", { name: "Wochenbericht" })); await H.sleep(500); }, 7],
    ["mails", async (H) => { await H.hidden(() => H.go("/konto/postfach")); await H.clickText("Beispiel-Benachrichtigungen erzeugen"); await H.sleep(1500); }, 5],
    ["testpostfach", async (H) => { await H.move(640, 450, 30); }, 4],
  ],
};
