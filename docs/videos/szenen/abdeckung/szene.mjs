/* Datenabdeckung: Seite mit Zahlen, Gemeinde suchen */
const zu = (H, titel, off = 80) => H.hidden(async () => { await H.page.evaluate(([t, o]) => { const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.innerText.trim().startsWith(t)); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - o, behavior: "instant" }); }, [titel, off]); await H.sleep(500); });  /* Überschrift oben im Bild */
export default {
  meta: { bereich: "abdeckung", dauer: "16-18 s", zeigt: "Seite Datenabdeckung, Zahlen, Ort prüfen, Stand des letzten Abrufs", tags: ["anleitung", "webinar", "werbung"] },
  parameter: { ort: "Münster" },
  start: "Datenabdeckung", ende: "Suchergebnis für den Ort",
  setup: async (H) => { await H.go("/quellen"); await H.sleep(800); },
  beats: [
    ["seite", async (H) => { await H.move(640, 300, 30); await H.sleep(1500); await H.scrollTo(260); }, 8],
    ["abruf", async (H) => { await zu(H, "Ist Ihr Ort dabei?", 420); await H.move(1130, 250, 40); }, 4],
    ["melden", async (H) => { await H.hidden(async () => { await H.page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight - 900, behavior: "instant" })); await H.sleep(500); }); await H.move(1150, 480, 40); }, 4],
    ["suche", async (H, p) => { await zu(H, "Ist Ihr Ort dabei?", 420); await H.click(H.page.getByPlaceholder(/Ort eingeben/)); await H.page.keyboard.type(p.ort, { delay: 100 }); await H.sleep(1500); }, 6],
  ],
};
