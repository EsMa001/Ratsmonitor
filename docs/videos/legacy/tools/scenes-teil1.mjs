/* Szenen des Webinars Teil 1 (Verkaufsteil). Schlüssel "w1/cNN" = Kapitel NN. Aufbau wie scenes-web.mjs. */
const calc = async (H) => { await H.page.waitForFunction(() => !/berechnet|Wird/i.test(document.body.innerText.match(/Analyse wird berechnet|Wird berechnet/)?.[0] || ""), null, { timeout: 60000 }).catch(() => {}); await H.sleep(500); };
const start = (name) => async (H) => { await H.clickRole("button", name); };
const topic = async (H, term) => { await H.click("#q:visible"); await H.page.keyboard.type(term, { delay: 90 }); await H.page.keyboard.press("Enter"); await H.sleep(800); };
const go = async (H, path) => { await H.page.goto(H.BASE + path, { waitUntil: "load" }); await H.sleep(2200); };
const drift = async (H, pts) => { for (const [x, y] of pts) { await H.move(x, y, 60); await H.sleep(700); } };

/* Knoten (SVG, data-node) im Bild: nach Größe sortiert, damit große Knoten zuerst angeklickt werden */
const nodes = async (H) => { const loc = H.page.locator("[data-node]"); const n = await loc.count(); const out = []; for (let i = 0; i < n; i++) { const b = await loc.nth(i).boundingBox(); if (b && b.y > 110 && b.y + b.height < 690 && b.x > 60 && b.x + b.width < 1180) out.push({ b, a: b.width * b.height }); } return out.sort((x, y) => y.a - x.a); };
const centre = (o) => [o.b.x + o.b.width / 2, o.b.y + o.b.height / 2];
const tapNode = async (H, rank) => { const o = (await nodes(H))[rank]; if (!o) return; const [x, y] = centre(o); await H.move(x, y); await H.sleep(250); await H.page.mouse.down(); await H.sleep(60); await H.page.mouse.up(); };
const dragNode = async (H, rank, dx, dy) => { const o = (await nodes(H))[rank]; if (!o) return; const [x, y] = centre(o); await H.move(x, y); await H.sleep(250); await H.page.mouse.down(); await H.move(x + dx, y + dy, 36); await H.page.mouse.up(); };

export const SCENES = {
  /* 01 Die Frage, danach der Zeitraffer der Wärmeplanung */
  "w1/c01": {
    setup: async (H) => { await go(H, "/analytics/diffusion?q=Wärmeplanung"); await H.clickRole("button", "Analyse starten"); await calc(H); await H.sleep(5000); await go(H, "/"); },
    steps: [
      [0, 0.3, "karte", (H) => drift(H, [[700, 300], [560, 260]])],
      [3, 0.2, "scroll", (H) => H.scrollTo(260)],
      [5, 0.0, "diffusion", async (H) => { await go(H, "/analytics/diffusion?q=Wärmeplanung"); await H.scrollTo(180); await H.clickRole("button", "Analyse starten"); await H.sleep(500); await H.scrollTo(400); }],
    ] },
  /* 03 Plenara in Zahlen: Datenabdeckung */
  "w1/c02": {
    setup: async (H) => { await go(H, "/datenabdeckung"); },
    steps: [
      [1, 0.2, "zahl", (H) => H.scrollTo(120)],
      [2, 0.0, "einwohner", (H) => H.scrollTo(260)],
      [4, 0.0, "quelle", (H) => H.scrollTo(0)],
    ] },
  /* 04 Suchen und finden */
  "w1/c03": { steps: [
    [1, 0.2, "suche", async (H) => { await H.click("#q"); await H.page.keyboard.type("Wärmeplanung", { delay: 110 }); await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
    [2, 0.6, "karte", (H) => drift(H, [[620, 300], [520, 260]])],
    [3, 0.2, "liste", async (H) => { await H.scrollTo(540); await H.sleep(2200); await H.scrollTo(780); }],
    [4, 0.2, "artikel", async (H) => { await H.openFirstArticle(); await H.scrollTo(500); await H.sleep(1500); await H.scrollTo(1000); }],
  ] },
  /* 05 Plenara.X */
  "w1/c08": {
    setup: async (H) => { await go(H, "/analytics/ueber"); },
    steps: [
      [3, 0.0, "funktionen", (H) => H.scrollTo(380)],
      [5, 0.0, "mehr", (H) => H.scrollTo(900)],
    ] },
  /* 06 Diffusionsanalyse */
  "w1/c09": {
    setup: async (H) => { await go(H, "/analytics/diffusion?q=Wärmeplanung"); await H.scrollTo(180); await H.sleep(500); },
    steps: [
      [1, 0.0, "start", async (H) => { await H.clickRole("button", "Analyse starten"); await H.sleep(500); await H.scrollTo(400); }],
      [3, 0.0, "kennzahlen", async (H) => { await calc(H); await H.scrollTo(560); }],
      [4, 0.5, "diagramm", (H) => H.scrollTo(900)],
      [6, 0.0, "hitze", async (H) => { await H.scrollTo(0); await H.sleep(800); await H.click(H.page.getByRole("button", { name: /Filter Suche/ }).first()); await H.sleep(500); await topic(H, "Hitzeschutz"); await H.scrollTo(180); await H.sleep(800); if (await H.page.getByRole("button", { name: "Analyse starten" }).count()) await H.clickRole("button", "Analyse starten"); await calc(H); await H.scrollTo(900); }],
    ] },
  /* 07 Trends */
  "w1/c10": {
    setup: async (H) => { await go(H, "/analytics/trends?q=Wärmeplanung"); await H.scrollTo(180); await H.sleep(500); },
    steps: [
      [1, 0.0, "karte", async (H) => { await calc(H); await H.scrollTo(420); }],
      [3, 0.0, "rang", (H) => H.scrollTo(900)],
    ] },
  /* 08 Status und Beschlüsse */
  "w1/c11": {
    setup: async (H) => { await go(H, "/analytics/beschluesse?q=Wärmeplanung"); await H.scrollTo(180); await H.sleep(500); },
    steps: [
      [1, 0.0, "quote", async (H) => { await calc(H); await H.scrollTo(480); }],
      [3, 0.0, "hinweis", (H) => H.scrollTo(900)],
    ] },
  /* 09 Gebietsvergleich */
  "w1/c12": {
    setup: async (H) => {
      /* vorab berechnen: die Antwort liegt dann im Cache des Browsers und erscheint in der Aufnahme sofort */
      await go(H, "/analytics/vergleich"); await H.clickText("Münster und Osnabrück"); await H.sleep(600); await H.clickRole("button", "Vergleich starten"); await calc(H); await H.sleep(2000);
      await go(H, "/analytics/vergleich"); await H.scrollTo(180); await H.sleep(500);
    },
    steps: [
      [1, 0.0, "start", async (H) => { await H.clickText("Münster und Osnabrück"); await H.sleep(600); await H.clickRole("button", "Vergleich starten"); await calc(H); await H.scrollTo(380); }],
      [2, 0.0, "profil", (H) => H.scrollTo(700)],
      [3, 0.0, "begriffe", (H) => H.scrollTo(1500)],
    ] },
  /* 10 Knowledge Graph */
  "w1/c13": {
    setup: async (H) => {
      await go(H, "/analytics/graph"); await topic(H, "Wärmeplanung"); if (await H.page.getByRole("button", { name: "Graph erstellen" }).count()) await H.clickRole("button", "Graph erstellen"); await calc(H); await H.sleep(3000);
      await go(H, "/analytics/graph"); await H.scrollTo(180); await H.sleep(500);
    },
    steps: [
      [1, 0.0, "start", async (H) => { await topic(H, "Wärmeplanung"); if (await H.page.getByRole("button", { name: "Graph erstellen" }).count()) await H.clickRole("button", "Graph erstellen"); await calc(H); await H.sleep(1500); await H.scrollTo(300); await H.sleep(800); }],
      [2, 0.0, "klick1", (H) => tapNode(H, 2)],
      [2, 2.2, "klick2", (H) => tapNode(H, 5)],
      [3, 0.0, "ziehen1", (H) => dragNode(H, 3, 110, 70)],
      [3, 2.4, "klick3", (H) => tapNode(H, 8)],
      [4, 0.0, "ziehen2", (H) => dragNode(H, 6, -110, 60)],
      [4, 2.6, "klick4", (H) => tapNode(H, 1)],
    ] },
  /* 11 Gremiennetz */
  "w1/c14": {
    setup: async (H) => { await go(H, "/analytics/gremien"); await calc(H); await H.sleep(6000); await go(H, "/analytics/gremien"); await H.scrollTo(180); await H.sleep(300); },
    steps: [
      [1, 0.0, "netz", async (H) => { await calc(H); await H.scrollTo(300); await H.sleep(800); }],
      [1, 3.0, "klick1", (H) => tapNode(H, 0)],
      [2, 0.0, "klick2", (H) => tapNode(H, 2)],
      [2, 2.5, "ziehen1", (H) => dragNode(H, 4, -120, 70)],
      [3, 0.0, "klick3", (H) => tapNode(H, 3)],
      [3, 2.5, "ziehen2", (H) => dragNode(H, 5, 120, -60)],
      [4, 0.0, "klick4", (H) => tapNode(H, 6)],
    ] },
  /* 15 Verlässlich und offen, Für wen */
  "w1/c15": {
    setup: async (H) => { await go(H, "/datenabdeckung"); },
    steps: [
      [2, 0.0, "ort", async (H) => { await H.scrollTo(560); await H.sleep(900); await H.click(H.page.getByPlaceholder(/Ort eingeben/)); await H.page.keyboard.type("Münster", { delay: 120 }); }],
      [3, 0.0, "land", async (H) => { await H.page.keyboard.press("Escape"); await H.scrollTo(1100); }],
      [5, 0.2, "menue", async (H) => { await H.scrollTo(0); await H.click(H.page.getByRole("button", { name: /Use Cases/ })); }],
      [8, 0.0, "zu", async (H) => { await H.page.keyboard.press("Escape"); await H.move(640, 360, 40); }],
    ] },
  /* 13 Jetzt starten */
  "w1/c16": { steps: [
    [2, 0.2, "suche", async (H) => { await H.click("#q"); await H.page.keyboard.type("Wärmeplanung", { delay: 110 }); await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
    [3, 0.3, "herz", (H) => H.clickRole("button", /Suche speichern/)],
  ] },
};
