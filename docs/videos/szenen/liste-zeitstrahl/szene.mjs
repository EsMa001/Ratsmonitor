/* Trefferliste: Status-Zeitstrahl in der Liste, danach der Artikel in Ruhe */
export default {
  meta: { bereich: "trefferliste", dauer: "20-25 s", zeigt: "Liste mit Status-Zeitstrahl, Artikel mit Verlauf und Quelle", tags: ["anleitung", "webinar", "wow"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Startseite", ende: "Artikel, unten (Originalunterlagen)",
    setup: async (H, p) => { await H.search(p.thema); await H.scrollTo(380); await H.sleep(900); },
    beats: [
      /* Ein Vorgang mit Zeitstrahl: mehrere Stationen, erkennbar an den runden Stationspunkten */
      ["liste", async (H) => { await H.page.waitForFunction(() => [...document.querySelectorAll("article")].some((x) => x.querySelector("[class*='h-2.5'][class*='rounded-full']")), null, { timeout: 20000 }); await H.page.evaluate(() => { const a = [...document.querySelectorAll("article")].find((x) => x.querySelector("[class*='h-2.5'][class*='rounded-full']")); a.dataset.demo = "1"; a.scrollIntoView({ behavior: "smooth", block: "center" }); }); }, 2.5],
      ["zeile", async (H) => { const b = await H.page.locator("article[data-demo]").boundingBox(); await H.move(b.x + 160, b.y + 26, 40); }, 2.5],
      ["zeitstrahl", async (H) => { const b = await H.page.locator("article[data-demo]").boundingBox(); const y = b.y + b.height - 24; await H.move(b.x + 70, y, 40); await H.sleep(1400); await H.move(b.x + 320, y, 60); await H.sleep(1400); await H.move(b.x + 560, y, 60); }, 2.5],
      ["artikel", async (H) => { const href = await H.page.locator("article[data-demo] a[href^='/beschluss/']").first().getAttribute("href"); await H.go(href); }, 3],
      ["verlauf", (H) => H.scrollTo(480), 4],
      ["quelle", (H) => H.scrollTo(1000), 4],
    ],
  };
