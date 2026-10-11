/* Startseite (Landing): Überschrift, Zahl der letzten 30 Tage, Thema eingeben, Treffer mit Karte */
export default {
  meta: { bereich: "einleitung", dauer: "25-30 s", zeigt: "Startseite mit Zähler der letzten 30 Tage, Thema eingeben, Karte mit Treffern", tags: ["werbung", "anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Startseite", ende: "Karte mit Treffern zum Thema",
  setup: async (H) => {
    await H.go("/");
    await H.page.waitForFunction(() => /\d{2,3}\.\d{3}/.test(document.body.innerText), null, { timeout: 40000 }).catch(() => {});
    await H.sleep(2500);
  },
  beats: (p) => [
    ["kopf", async (H) => { await H.move(420, 330, 40); }, 3],
    ["marke", async (H) => { await H.move(380, 250, 50); await H.sleep(1500); }, 2],
    ["zahl", async (H) => { await H.move(330, 400, 50); await H.sleep(1500); }, 3],
    ["suche", async (H) => {
      await H.click(H.page.getByPlaceholder(/Thema suchen/));
      await H.page.keyboard.type(p.thema, { delay: 110 });
      await H.sleep(600);
      await H.hidden(async () => { await H.page.keyboard.press("Enter"); await H.loaded(); await H.page.evaluate(() => window.scrollTo(0, 0)); await H.sleep(800); });
      await H.move(560, 300, 50);
    }, 4],
  ],
};
