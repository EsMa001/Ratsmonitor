/* Alarm: Suche speichern, im Konto die Benachrichtigung per E-Mail einschalten */
export default {
  meta: { bereich: "alarme", dauer: "10-12 s", zeigt: "Suche speichern, gespeicherte Suchen, Glocke einschalten", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { thema: "Klimaschutz" },
  start: "Trefferseite", ende: "Gespeicherte Suche mit eingeschalteter Benachrichtigung",
  setup: async (H, p) => { await H.search(p.thema); },
  beats: [
    ["herz", (H) => H.clickRole("button", /Suche speichern/), 1.5],
    ["konto", async (H) => { await H.click('a[href="/konto/suchen"]'); await H.sleep(1500); }, 1.5],
    ["glocke", async (H) => { await H.scrollTo(260); await H.sleep(900); await H.clickRole("button", /Bei neuen Treffern benachrichtigen/); await H.sleep(500); }, 2.5],
  ],
};
