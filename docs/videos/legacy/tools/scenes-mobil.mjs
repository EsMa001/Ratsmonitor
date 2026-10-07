/* Szenen der Handy-Videos. Schritt = [Satznummer ab 0, Verzögerung in s, Name, Funktion(H)].
   `setup` läuft vor der Aufnahme (Startzustand). H siehe rec-mobil.mjs. */
const tap = (H, role, name) => H.tapRole(role, name);

export const SCENES = {
  /* 02 Filter und Zeitraum */
  "02": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [1, 0.3, "filter", (H) => H.filterBtn()],
      [3, 0.2, "zeitraum", async (H) => { await tap(H, "button", /Zeitraum/); await H.sleep(900); await H.tapText("Letzte 12 Monate"); }],
      [3, 2.2, "thema", async (H) => { await tap(H, "button", /Alle Themen/); await H.sleep(900); await H.page.locator('[role="option"]').nth(1).tap(); }],
      [3, 4.6, "stand", async (H) => { await tap(H, "button", /Alle Stände/); await H.sleep(900); await H.page.locator('[role="option"]').nth(1).tap(); }],
      [4, 0.2, "zu", async (H) => { await H.page.keyboard.press("Escape"); await H.loaded(); }],
      [6, 0.3, "marke", async (H) => { await H.page.getByRole("button", { name: /entfernen/ }).first().tap(); await H.loaded(); }],
    ],
  },
  /* 03 Alarme einrichten */
  "03": {
    setup: async (H) => { await H.search("Radweg"); },
    steps: [
      [3, 0.5, "herz", async (H) => { await tap(H, "button", /Suche speichern/); }],
      [5, 0.3, "konto", async (H) => { await H.page.locator('a[href="/konto/suchen"]').first().tap(); await H.sleep(1500); }],
      [6, 0.6, "glocke", async (H) => { await H.page.getByRole("button", { name: /Bei neuen Treffern benachrichtigen/ }).first().tap(); }],
      [8, 0.2, "scroll", (H) => H.scrollTo(300)],
    ],
  },
  /* 04 Exakter Begriff */
  "04": {
    setup: async (H) => { await H.search("Radweg"); },
    steps: [
      [2, 0.2, "filter", (H) => H.filterBtn()],
      [3, 0.3, "exakt", async (H) => { await H.page.getByRole("switch", { name: "Exakter Begriff" }).tap(); await H.loaded().catch(() => {}); }],
      [4, 1.5, "zu", async (H) => { await H.filterBtn(); await H.sleep(500); await H.page.tap("#q"); await H.page.keyboard.type("Fahrradstraße", { delay: 90 }); await H.page.keyboard.press("Enter"); await H.loaded(); }],
      [6, 1.0, "filter2", async (H) => { await H.scrollTo(0); await H.sleep(500); await H.filterBtn(); }],
      [7, 0.9, "kombi", async (H) => { await H.page.getByRole("switch", { name: "Begriffe kombinieren" }).tap(); await H.loaded().catch(() => {}); }],
    ],
  },
  /* 05 Die Karte im Detail */
  "05": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [2, 0.3, "heatmap", async (H) => { await tap(H, "button", "Darstellung der Karte"); await H.sleep(800); await tap(H, "radio", "Heatmap"); await H.loaded(); }],
      [3, 0.3, "punkte", async (H) => { await tap(H, "radio", "Punkte"); await H.loaded(); }],
      [4, 0.3, "flaechen", async (H) => { await tap(H, "radio", "Flächen"); await H.loaded(); await H.sleep(600); await tap(H, "button", "Darstellung der Karte"); }],
      [5, 0.3, "zoom", async (H) => { await H.pinch(195, 160, 2.2); }],
      [6, 0.3, "zentrieren", async (H) => { await tap(H, "button", "Auf Treffer zentrieren"); await H.sleep(1800); }],
    ],
  },
  /* 06 Trefferliste und Sortierung */
  "06": {
    setup: async (H) => { await H.search("Kita"); await H.scrollTo(300); await H.sleep(700); },
    steps: [
      [1, 0.3, "oben", (H) => H.scrollTo(320)],
      [2, 0.2, "sort", async (H) => { await tap(H, "button", /Sortierung/); await H.sleep(1500); }],
      [2, 3.0, "sort2", async (H) => { await H.page.getByRole("menuitemradio").or(H.page.getByRole("option")).or(H.page.getByRole("radio")).nth(1).tap(); await H.loaded(); }],
      [3, 0.2, "ansicht", async (H) => { await tap(H, "button", /Ansicht/); await H.sleep(1200); }],
      [4, 0.4, "zeile", (H) => H.scrollTo(700)],
      [5, 0.3, "verlauf", (H) => H.scrollTo(1000)],
    ],
  },
  /* 07 Artikel speichern und teilen */
  "07": {
    setup: async (H) => { await H.search("Kita"); await H.openFirstArticle(); },
    steps: [
      [0, 0.4, "scroll", (H) => H.scrollTo(420)],
      [1, 0.2, "quelle", (H) => H.scrollTo(1100)],
      [2, 0.2, "bookmark", async (H) => { await H.scrollTo(0); await H.sleep(1200); await tap(H, "button", /Artikel speichern/); }],
      [3, 0.3, "konto", async (H) => { await H.page.locator('a[href="/konto/artikel"]').first().tap(); await H.sleep(1500); }],
      [4, 0.3, "glocke", async (H) => { await tap(H, "button", /Benachrichtigungen einschalten/); }],
      [5, 0.2, "zurueck", async (H) => { await H.page.goBack(); await H.sleep(1500); await H.page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {}); await tap(H, "button", /Teilen|teilen/); }],
    ],
  },
  /* 08 Export (Handy: nur Artikel-Export; die Liste lässt sich nur am Computer exportieren) */
  "08": {
    setup: async (H) => { await H.search("Kita"); await H.scrollTo(300); await H.sleep(700); },
    steps: [
      [2, 0.2, "artikel", async (H) => { await H.openFirstArticle(); }],
      [3, 0.6, "symbol", async (H) => { await H.scrollTo(0); await H.sleep(500); await tap(H, "button", "Exportieren"); await H.sleep(900); }],
      [5, 0.4, "format", async (H) => { await H.page.getByText("Excel (.xlsx)").first().tap(); await H.sleep(1500); await H.page.getByText("CSV (.csv)").first().tap(); }],
    ],
  },
  /* 09 Kalender */
  "09": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [1, 0.4, "kalender", async (H) => { await H.page.locator('a[href="/konto/kalender"]').first().tap(); await H.sleep(2000); }],
      [2, 0.3, "gebiete", async (H) => { await H.page.getByPlaceholder(/Ort oder Kreis/).scrollIntoViewIfNeeded(); await H.scrollTo(await H.page.evaluate(() => window.scrollY + 120)); }],
      [3, 0.3, "ort", async (H) => { await H.page.getByPlaceholder(/Ort oder Kreis/).tap(); await H.page.keyboard.type("Münster", { delay: 110 }); await H.sleep(1200); await H.page.getByText("Stadt Münster", { exact: true }).first().tap(); await H.sleep(1500); }],
      [4, 0.3, "oben", (H) => H.scrollTo(380)],
      [5, 0.5, "tag", async (H) => { await H.page.getByRole("button", { name: /2026-10-07/ }).first().tap(); await H.sleep(1000); await H.scrollTo(700); }],
      [6, 0.3, "abo", async (H) => { await H.page.getByText("Kalender abonnieren").first().scrollIntoViewIfNeeded(); }],
    ],
  },
  /* 10 Postfach und Wochenbericht */
  "10": {
    setup: async (H) => { await H.search("Radweg"); await tap(H, "button", /Suche speichern/); await H.sleep(800); },
    steps: [
      [2, 0.3, "postfach", async (H) => { await H.page.goto(H.BASE + "/konto/postfach", { waitUntil: "load" }); await H.sleep(1500); }],
      [3, 0.2, "beispiele", async (H) => { await H.page.getByText(/Beispiel-Benachrichtigungen erzeugen/).first().tap(); await H.sleep(1500); }],
      [4, 0.2, "oeffnen", async (H) => { await H.page.locator("main li button").first().tap(); await H.sleep(1200); await H.scrollTo(300); }],
      [5, 0.2, "suchen", async (H) => { await H.page.locator('a[href="/konto/suchen"]').first().tap(); await H.sleep(1500); }],
      [6, 0.3, "bericht", async (H) => { await H.page.getByRole("switch", { name: /Wochenbericht/ }).scrollIntoViewIfNeeded(); }],
      [7, 0.3, "schalter", async (H) => { await H.page.getByRole("switch", { name: /Wochenbericht/ }).tap(); }],
    ],
  },
  /* 11 Konto und Profil */
  "11": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [1, 0.5, "person", async (H) => { await H.page.locator('button[aria-label="Konto"]').first().tap(); await H.sleep(1000); }],
      [3, 0.3, "konto", async (H) => { await H.page.getByRole("menuitem", { name: "Konto" }).first().tap(); await H.sleep(1500); }],
      [4, 0.2, "name", async (H) => { await H.scrollTo(230); await H.sleep(600); await H.page.getByPlaceholder(/Vor- und Nachname/).tap(); await H.page.keyboard.type("Maria Beispiel", { delay: 90 }); await H.page.getByPlaceholder(/name@beispiel/).tap(); await H.page.keyboard.type("maria@beispiel.de", { delay: 70 }); await H.page.keyboard.press("Enter").catch(() => {}); await H.sleep(500); await H.scrollTo(620); }],
      [5, 0.8, "suchen", async (H) => { await H.page.locator('a[href="/konto/suchen"]').first().tap(); await H.sleep(1200); }],
      [6, 0.8, "artikel", async (H) => { await H.page.locator('a[href="/konto/artikel"]').first().tap(); await H.sleep(1500); }],
      [7, 0.0, "kalender", async (H) => { await H.page.locator('a[href="/konto/kalender"]').first().tap(); }],
    ],
  },
  /* 12 Datenabdeckung */
  "12": {
    setup: async (H) => { },
    steps: [
      [1, 0.3, "menue", async (H) => { await H.page.locator("header button").first().tap(); await H.sleep(1200); }],
      [2, 0.5, "seite", async (H) => { const l = H.page.locator("a:visible", { hasText: "Datenabdeckung" }); const n = await l.count(); let best = null, by = 1e9; for (let i = 0; i < n; i++) { const b = await l.nth(i).boundingBox(); if (b && b.y >= 0 && b.y < by) { by = b.y; best = l.nth(i); } } await best.tap(); await H.sleep(2500); }],
      [3, 0.3, "zahlen", (H) => H.scrollTo(260)],
      [4, 0.3, "abruf", (H) => H.scrollTo(420)],
      [5, 0.3, "suche", async (H) => { await H.page.getByPlaceholder(/Gemeinde oder Kreis/).scrollIntoViewIfNeeded(); await H.page.getByPlaceholder(/Gemeinde oder Kreis/).tap(); await H.page.keyboard.type("Köln", { delay: 130 }); await H.sleep(1500); }],
      [6, 0.3, "kontakt", async (H) => { await H.page.getByRole("link", { name: /Kontakt aufnehmen/ }).first().scrollIntoViewIfNeeded().catch(() => {}); await H.scrollTo(await H.page.evaluate(() => document.body.scrollHeight)); }],
    ],
  },
  /* 13 Politik vor Ort im Blick (Vorstellung) */
  "13": {
    setup: async (H) => { },
    steps: [
      [2, 0.3, "karte", async (H) => { await H.page.mouse.move(195, 300); }],
      [3, 0.5, "suche", async (H) => { await H.page.tap("#q"); await H.page.keyboard.type("Kita", { delay: 170 }); await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
      [4, 0.4, "karte2", async (H) => { await H.page.mouse.move(150, 200); }],
      [5, 0.2, "liste", async (H) => { await H.scrollTo(560); await H.sleep(2200); await H.scrollTo(900); }],
      [6, 0.2, "speichern", async (H) => { await H.scrollTo(0); await H.sleep(1100); await tap(H, "button", /Suche speichern/); }],
      [8, 0.0, "ende", async (H) => { await H.page.locator('a[href="/konto/suchen"]').first().tap(); }],
    ],
  },
  /* 14 Für Unternehmen und Verbände (Vorstellung) */
  "14": {
    setup: async (H) => { },
    steps: [
      [2, 0.3, "suche", async (H) => { await H.page.tap("#q"); await H.page.keyboard.type("Bebauungsplan", { delay: 110 }); await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
      [3, 0.3, "liste", async (H) => { await H.scrollTo(560); }],
      [4, 0.3, "artikel", async (H) => { await H.openFirstArticle(); await H.scrollTo(520); }],
      [5, 0.4, "alarm", async (H) => { await H.page.goto(H.BASE + "/", { waitUntil: "networkidle" }); await H.sleep(800); await H.search("Bebauungsplan"); await tap(H, "button", /Suche speichern/); }],
      [6, 0.3, "filter", async (H) => { await H.filterBtn(); }],
      [7, 0.3, "export", async (H) => { await H.filterBtn(); await H.sleep(500); await H.openFirstArticle(); await H.scrollTo(0); await H.sleep(500); await tap(H, "button", "Exportieren"); }],
      [8, 0.2, "preise", async (H) => { await H.page.keyboard.press("Escape"); await H.page.goto(H.BASE + "/", { waitUntil: "load" }); await H.sleep(800); await H.page.locator("header button").first().tap(); await H.sleep(1000); await H.page.getByRole("link", { name: "Preismodelle" }).last().tap().catch(() => {}); }],
    ],
  },
};
