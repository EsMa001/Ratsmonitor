/* Konto: Menü, Profil mit Tarif, Symbole in der Kopfzeile */
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* Überschrift oben im Bild */
export default {
  meta: { bereich: "konto", dauer: "16-18 s", zeigt: "Kontomenü, Profil und Tarif, Symbole für Suchen, Artikel, Kalender", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Klimaschutz" },
  start: "Startseite", ende: "Kopfzeile mit Symbolen",
  setup: async (H) => { await H.go("/"); await H.sleep(500); },
  beats: [
    ["menue", async (H) => { await H.clickRole("button", /^Konto$/); await H.sleep(800); }, 4],
    ["profil", async (H) => { await H.click(H.page.getByText("Konto", { exact: true }).last()); await H.sleep(1800); await H.move(300, 600, 40); await H.sleep(1500); await zu(H, "Tarif", 120); await H.move(640, 400, 40); }, 7],
    ["symbole", async (H) => { await H.move(1000, 40, 30); await H.sleep(900); await H.move(1130, 40, 20); }, 6],
  ],
};
