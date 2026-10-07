/* Konto: Menü, Profil mit Tarif, Symbole in der Kopfzeile */
export default {
  meta: { bereich: "konto", dauer: "16-18 s", zeigt: "Kontomenü, Profil und Tarif, Symbole für Suchen, Artikel, Kalender", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Startseite", ende: "Kopfzeile mit Symbolen",
  setup: async (H) => { await H.go("/"); await H.sleep(500); },
  beats: [
    ["menue", async (H) => { await H.clickRole("button", /^Konto$/); await H.sleep(800); }, 4],
    ["profil", async (H) => { await H.click(H.page.getByText("Konto", { exact: true }).last()); await H.sleep(2000); await H.move(640, 420, 30); }, 7],
    ["symbole", async (H) => { await H.move(1000, 40, 30); await H.sleep(900); await H.move(1130, 40, 20); }, 6],
  ],
};
