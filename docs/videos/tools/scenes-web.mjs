/* Szenen der Web-Videos (Querformat, Maus). Schritt = [Satznummer ab 0, Verzögerung in s, Name, Funktion(H)].
   `setup` läuft vor der Aufnahme (Startzustand). H siehe rec-web.mjs. */
const opt = (H, i) => H.click(H.page.locator('[role="option"]').nth(i));

export const SCENES = {
  /* 01 Erste Suche und Karte */
  "01": {
    steps: [
      [1, 0.4, "karte", async (H) => { await H.move(700, 300, 50); await H.sleep(1200); await H.move(560, 250, 50); }],
      [4, 0.4, "suchleiste", (H) => H.click("#q")],
      [4, 2.3, "kita", async (H) => { await H.page.keyboard.type("Kita", { delay: 200 }); }],
      [5, 0.0, "enter", async (H) => { await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
      [6, 0.6, "liste", async (H) => { await H.scrollTo(540); await H.sleep(2200); await H.scrollTo(760); }],
      [7, 0.2, "filter", async (H) => { await H.scrollTo(0); await H.sleep(1100); await H.filterBtn(); await H.sleep(700); await H.clickRole("button", /Zeitraum/); await H.sleep(800); await H.clickText("Letzte 12 Monate"); }],
      [8, 0.3, "artikel", async (H) => { await H.page.keyboard.press("Escape"); await H.loaded().catch(() => {}); await H.scrollTo(500); await H.sleep(900); await H.openFirstArticle(); }],
      [9, 0.3, "quelle", async (H) => { await H.scrollTo(450); await H.sleep(1800); await H.scrollTo(1000); }],
      [10, 0.3, "ende", (H) => H.scrollTo(0)],
    ],
  },
  /* 02 Filter und Zeitraum */
  "02": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [1, 0.3, "filter", (H) => H.filterBtn()],
      [2, 0.2, "zeitraum", async (H) => { await H.clickRole("button", /Zeitraum/); await H.sleep(900); await H.clickText("Letzte 12 Monate"); }],
      [2, 2.4, "thema", async (H) => { await H.clickRole("button", /Alle Themen/); await H.sleep(900); await opt(H, 1); }],
      [2, 4.4, "stand", async (H) => { await H.clickRole("button", /Alle Stände/); await H.sleep(900); await opt(H, 1); }],
      [3, 0.2, "zu", async (H) => { await H.page.keyboard.press("Escape"); await H.loaded(); }],
      [5, 0.3, "marke", async (H) => { await H.click(H.page.getByRole("button", { name: /entfernen/ })); await H.loaded(); }],
    ],
  },
  /* 03 Alarme einrichten */
  "03": {
    setup: async (H) => { await H.search("Radweg"); },
    steps: [
      [3, 0.5, "herz", (H) => H.clickRole("button", /Suche speichern/)],
      [5, 0.3, "konto", async (H) => { await H.click('a[href="/konto/suchen"]'); await H.sleep(1500); }],
      [6, 0.6, "glocke", (H) => H.clickRole("button", /Bei neuen Treffern benachrichtigen/)],
      [8, 0.2, "scroll", (H) => H.scrollTo(300)],
    ],
  },
  /* 04 Exakter Begriff */
  "04": {
    setup: async (H) => { await H.search("Radweg"); },
    steps: [
      [2, 0.2, "filter", (H) => H.filterBtn()],
      [3, 0.3, "exakt", async (H) => { await H.clickRole("switch", "Exakter Begriff"); await H.loaded().catch(() => {}); }],
      [4, 1.5, "zu", async (H) => { await H.filterBtn(); await H.sleep(500); await H.click("#q"); await H.page.keyboard.type("Fahrradstraße", { delay: 90 }); await H.page.keyboard.press("Enter"); await H.loaded(); }],
      [6, 1.0, "filter2", async (H) => { await H.scrollTo(0); await H.sleep(500); await H.filterBtn(); }],
      [7, 0.9, "kombi", async (H) => { await H.clickRole("switch", "Begriffe kombinieren"); await H.loaded().catch(() => {}); }],
    ],
  },
  /* 05 Die Karte im Detail */
  "05": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [2, 0.3, "heatmap", async (H) => { await H.clickRole("button", "Darstellung der Karte"); await H.sleep(800); await H.clickRole("radio", "Heatmap"); await H.loaded(); }],
      [3, 0.3, "punkte", async (H) => { await H.clickRole("radio", "Punkte"); await H.loaded(); }],
      [4, 0.3, "flaechen", async (H) => { await H.clickRole("radio", "Flächen"); await H.loaded(); await H.sleep(600); await H.clickRole("button", "Darstellung der Karte"); }],
      [5, 0.3, "zoom", async (H) => { await H.clickRole("button", "Vergrößern"); await H.sleep(700); await H.clickRole("button", "Vergrößern"); }],
      [6, 0.3, "zentrieren", async (H) => { await H.clickRole("button", "Auf Treffer zentrieren"); }],
    ],
  },
  /* 06 Trefferliste und Sortierung */
  "06": {
    setup: async (H) => { await H.search("Kita"); await H.scrollTo(300); await H.sleep(700); },
    steps: [
      [1, 0.3, "oben", (H) => H.scrollTo(320)],
      [2, 0.2, "sort", async (H) => { await H.clickRole("button", /Sortierung/); await H.sleep(1500); }],
      [2, 3.0, "sort2", async (H) => { await H.click(H.page.getByRole("menuitemradio").or(H.page.getByRole("option")).or(H.page.getByRole("radio")).nth(1)); await H.loaded(); }],
      [3, 0.2, "ansicht", async (H) => { await H.clickRole("button", /Ansicht/); await H.sleep(1200); }],
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
      [2, 0.2, "bookmark", async (H) => { await H.scrollTo(0); await H.sleep(1200); await H.clickRole("button", /Artikel speichern/); }],
      [3, 0.3, "konto", async (H) => { await H.click('a[href="/konto/artikel"]'); await H.sleep(1500); }],
      [4, 0.3, "glocke", (H) => H.clickRole("button", /Benachrichtigungen einschalten/)],
      [5, 0.2, "zurueck", async (H) => { await H.page.goBack(); await H.sleep(1500); await H.clickRole("button", /Teilen|teilen/); }],
    ],
  },
  /* 08 Export (Web: Trefferliste und Artikel) */
  "08": {
    setup: async (H) => { await H.search("Kita"); await H.scrollTo(300); await H.sleep(700); },
    steps: [
      [2, 0.3, "export", async (H) => { await H.clickRole("button", /Exportieren/); await H.sleep(1000); }],
      [3, 0.6, "format", async (H) => { await H.clickText("Excel (.xlsx)"); await H.sleep(1500); await H.clickText("CSV (.csv)"); }],
      [4, 0.0, "artikel", async (H) => { await H.page.keyboard.press("Escape"); await H.sleep(500); await H.openFirstArticle(); }],
      [5, 0.3, "menue", async (H) => { await H.scrollTo(0); await H.sleep(500); await H.clickRole("button", "Exportieren"); await H.sleep(900); }],
      [6, 0.0, "pdf", async (H) => { await H.clickText("PDF"); }],
      [7, 0.0, "excel", async (H) => { await H.clickText("Excel (.xlsx)"); }],
    ],
  },
  /* 09 Kalender */
  "09": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [1, 0.4, "kalender", async (H) => { await H.click('a[href="/konto/kalender"]'); await H.sleep(2000); }],
      [2, 0.3, "gebiete", async (H) => { await H.page.getByPlaceholder(/Ort oder Kreis/).scrollIntoViewIfNeeded(); await H.scrollTo(await H.page.evaluate(() => window.scrollY + 120)); }],
      [3, 0.3, "ort", async (H) => { await H.click(H.page.getByPlaceholder(/Ort oder Kreis/)); await H.page.keyboard.type("Münster", { delay: 110 }); await H.sleep(1200); await H.click(H.page.getByText("Stadt Münster", { exact: true })); await H.sleep(1500); }],
      [4, 0.3, "oben", (H) => H.scrollTo(380)],
      [5, 0.5, "tag", async (H) => { await H.clickRole("button", /2026-10-07/); await H.sleep(1000); await H.scrollTo(700); }],
      [6, 0.3, "abo", async (H) => { await H.page.getByText("Kalender abonnieren").first().scrollIntoViewIfNeeded(); }],
    ],
  },
  /* 10 Postfach und Wochenbericht */
  "10": {
    setup: async (H) => { await H.search("Radweg"); await H.clickRole("button", /Suche speichern/); await H.sleep(800); },
    steps: [
      [2, 0.3, "postfach", async (H) => { await H.page.goto(H.BASE + "/konto/postfach", { waitUntil: "load" }); await H.sleep(1500); }],
      [3, 0.2, "beispiele", async (H) => { await H.clickText(/Beispiel-Benachrichtigungen erzeugen/); await H.sleep(1500); }],
      [4, 0.2, "oeffnen", async (H) => { await H.click(H.page.locator("main li button")); await H.sleep(1200); await H.scrollTo(300); }],
      [5, 0.2, "suchen", async (H) => { await H.click('a[href="/konto/suchen"]'); await H.sleep(1500); }],
      [6, 0.3, "bericht", async (H) => { await H.page.getByRole("switch", { name: /Wochenbericht/ }).scrollIntoViewIfNeeded(); }],
      [7, 0.3, "schalter", (H) => H.clickRole("switch", /Wochenbericht/)],
    ],
  },
  /* 11 Konto und Profil */
  "11": {
    setup: async (H) => { await H.search("Kita"); },
    steps: [
      [1, 0.5, "person", async (H) => { await H.click('button[aria-label="Konto"]'); await H.sleep(1000); }],
      [3, 0.3, "konto", async (H) => { await H.clickRole("menuitem", "Konto"); await H.sleep(1500); }],
      [4, 0.2, "name", async (H) => { await H.scrollTo(230); await H.sleep(600); await H.click(H.page.getByPlaceholder(/Vor- und Nachname/)); await H.page.keyboard.type("Maria Beispiel", { delay: 90 }); await H.click(H.page.getByPlaceholder(/name@beispiel/)); await H.page.keyboard.type("maria@beispiel.de", { delay: 70 }); await H.page.keyboard.press("Enter").catch(() => {}); await H.sleep(500); await H.scrollTo(620); }],
      [5, 0.8, "suchen", async (H) => { await H.click('a[href="/konto/suchen"]'); await H.sleep(1200); }],
      [6, 0.8, "artikel", async (H) => { await H.click('a[href="/konto/artikel"]'); await H.sleep(1500); }],
      [7, 0.0, "kalender", (H) => H.click('a[href="/konto/kalender"]')],
    ],
  },
  /* 12 Datenabdeckung */
  "12": {
    steps: [
      [2, 0.4, "seite", async (H) => { await H.click(H.page.locator("header a:visible", { hasText: "Datenabdeckung" })); await H.sleep(2500); }],
      [3, 0.3, "zahlen", (H) => H.scrollTo(260)],
      [4, 0.3, "abruf", (H) => H.scrollTo(420)],
      [5, 0.3, "suche", async (H) => { await H.click(H.page.getByPlaceholder(/Gemeinde oder Kreis/)); await H.page.keyboard.type("Köln", { delay: 130 }); await H.sleep(1500); }],
      [6, 0.3, "kontakt", async (H) => { await H.scrollTo(await H.page.evaluate(() => document.body.scrollHeight)); }],
    ],
  },
  /* 13 Politik vor Ort im Blick (Vorstellung) */
  "13": {
    steps: [
      [2, 0.3, "karte", async (H) => { await H.move(700, 300, 50); }],
      [3, 0.5, "suche", async (H) => { await H.click("#q"); await H.page.keyboard.type("Kita", { delay: 170 }); await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
      [4, 0.4, "karte2", async (H) => { await H.move(560, 240, 50); }],
      [5, 0.2, "liste", async (H) => { await H.scrollTo(540); await H.sleep(2200); await H.scrollTo(860); }],
      [6, 0.2, "speichern", async (H) => { await H.scrollTo(0); await H.sleep(1100); await H.clickRole("button", /Suche speichern/); }],
      [8, 0.0, "ende", (H) => H.click('a[href="/konto/suchen"]')],
    ],
  },
  /* 14 Für Unternehmen und Verbände (Vorstellung) */
  "14": {
    steps: [
      [2, 0.3, "suche", async (H) => { await H.click("#q"); await H.page.keyboard.type("Bebauungsplan", { delay: 110 }); await H.page.keyboard.press("Enter"); await H.loaded(); await H.scrollTo(0); }],
      [3, 0.3, "liste", (H) => H.scrollTo(540)],
      [4, 0.3, "artikel", async (H) => { await H.openFirstArticle(); await H.scrollTo(520); }],
      [5, 0.4, "alarm", async (H) => { await H.page.goto(H.BASE + "/", { waitUntil: "load" }); await H.sleep(1500); await H.search("Bebauungsplan"); await H.clickRole("button", /Suche speichern/); }],
      [6, 0.3, "filter", (H) => H.filterBtn()],
      [7, 0.3, "export", async (H) => { await H.filterBtn(); await H.sleep(500); await H.scrollTo(300); await H.sleep(800); await H.clickRole("button", /Exportieren/); }],
      [8, 0.2, "preise", async (H) => { await H.page.keyboard.press("Escape"); await H.click(H.page.locator("header a:visible", { hasText: "Preise" })); }],
    ],
  },
};
