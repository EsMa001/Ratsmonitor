/* Trefferliste: Status-Zeitstrahl in der Liste, danach der Artikel in Ruhe */
/* Der Vorgang mit Zeitstrahl: der erste Artikel mit Stationspunkten (jedes Mal neu gesucht, die Liste kann neu rendern) */
const demo = (H) => H.page.locator("article").filter({ has: H.page.locator("[class*='h-2.5'][class*='rounded-full']") }).first();
export default {
  meta: { bereich: "trefferliste", dauer: "20-25 s", zeigt: "Liste mit Status-Zeitstrahl, Artikel mit Verlauf und Quelle", tags: ["anleitung", "webinar", "wow"] },
  parameter: { thema: "Klimaschutz" },
  start: "Startseite", ende: "Artikel, unten (Originalunterlagen)",
    setup: async (H, p) => {
      /* Alles Vorbereiten passiert hier, vor der Aufnahme: Suche, Warten auf einen Vorgang mit Zeitstrahl, sofort (ohne Scroll-Animation) in die Mitte holen */
      await H.search(p.thema);
      await H.page.waitForFunction(() => [...document.querySelectorAll("article")].some((x) => x.querySelector("[class*='h-2.5'][class*='rounded-full']")), null, { timeout: 20000 });
      /* Die Liste lädt nach und verschiebt sich: erst warten, dann mehrmals in die Mitte holen, bis der Vorgang an derselben Stelle bleibt */
      await H.sleep(3000);
      const center = () => H.page.evaluate(() => { const a = [...document.querySelectorAll("article")].find((x) => x.querySelector("[class*='h-2.5'][class*='rounded-full']")); if (!a) return -1; a.scrollIntoView({ behavior: "instant", block: "center" }); const r = a.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
      let last = -1; for (let k = 0; k < 10; k++) { const y = await center(); if (y >= 0 && Math.abs(y - last) < 3) break; last = y; await H.sleep(1200); }
      await H.sleep(800);
    },
    beats: [
      /* Ein Vorgang mit Zeitstrahl: mehrere Stationen, erkennbar an den runden Stationspunkten */
      ["liste", async (H) => { await H.move(640, 300, 30); }, 2.5],
      ["zeile", async (H) => { const b = await demo(H).boundingBox(); await H.move(b.x + 160, b.y + 26, 40); }, 2.5],
      ["zeitstrahl", async (H) => { const b = await demo(H).boundingBox(); const y = b.y + b.height - 24; await H.move(b.x + 70, y, 40); await H.sleep(1400); await H.move(b.x + 320, y, 60); await H.sleep(1400); await H.move(b.x + 560, y, 60); }, 2.5],
      ["artikel", async (H) => { const href = await demo(H).locator("a[href^='/beschluss/']").first().getAttribute("href"); await H.hidden(() => H.go(href)); }, 3],
      ["verlauf", (H) => H.scrollTo(480), 4],
      ["quelle", (H) => H.scrollTo(1000), 4],
    ],
  };
