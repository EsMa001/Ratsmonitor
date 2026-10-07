/* Clip-Szenen: SCENES[id] = { setup(H), beats: [[name, Funktion(H), Haltezeit in s], ...] }.
   Die Schritte laufen nacheinander und werden mit Zeiten aufgenommen. Im Skript ordnet "@schritt1,schritt2 Satz" einem Satz Schritte zu (compose.py).
   H siehe rec-clip.mjs (click, search, type, scrollTo, move, openFirstArticle, tapNode ...). */
export const SCENES = {
  /* Trefferliste: Status-Zeitstrahl in der Liste, danach der Artikel in Ruhe */
  "treffer-liste": {
    setup: async (H) => { await H.search("Wärmeplanung"); await H.scrollTo(380); await H.sleep(900); },
    beats: [
      /* Ein Vorgang mit Zeitstrahl: mehrere Stationen, erkennbar an den runden Stationspunkten */
      ["liste", async (H) => { await H.page.waitForFunction(() => [...document.querySelectorAll("article")].some((x) => x.querySelector("[class*='h-2.5'][class*='rounded-full']")), null, { timeout: 20000 }); await H.page.evaluate(() => { const a = [...document.querySelectorAll("article")].find((x) => x.querySelector("[class*='h-2.5'][class*='rounded-full']")); a.dataset.demo = "1"; a.scrollIntoView({ behavior: "smooth", block: "center" }); }); }, 2.5],
      ["zeile", async (H) => { const b = await H.page.locator("article[data-demo]").boundingBox(); await H.move(b.x + 160, b.y + 26, 40); }, 2.5],
      ["zeitstrahl", async (H) => { const b = await H.page.locator("article[data-demo]").boundingBox(); const y = b.y + b.height - 24; await H.move(b.x + 70, y, 40); await H.sleep(1400); await H.move(b.x + 320, y, 60); await H.sleep(1400); await H.move(b.x + 560, y, 60); }, 2.5],
      ["artikel", async (H) => { const href = await H.page.locator("article[data-demo] a[href^='/beschluss/']").first().getAttribute("href"); await H.go(href); }, 3],
      ["verlauf", (H) => H.scrollTo(480), 4],
      ["quelle", (H) => H.scrollTo(1000), 4],
    ],
  },
};
