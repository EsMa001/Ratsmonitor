/* Filterfenster: öffnen, Thema und Status wählen, Marken unter der Suche, exakter Begriff, Begriffe kombinieren */
const win = (H) => H.page.locator("#filter-body");
const sw = (H, name) => win(H).getByRole("switch", { name });
const pick = async (H, label, rx) => {
  await H.click(win(H).locator(`button[aria-haspopup='listbox'][aria-label^='${label}']`));
  await H.sleep(700);
  const opt = H.page.locator("[role='option']").filter({ hasText: rx }).first();
  await H.click(opt);
  await H.sleep(900);
};
export default {
  meta: { bereich: "filter", dauer: "25-30 s", zeigt: "Filterfenster mit Zeitraum, Thema, Status, Karte, Marken, exaktem Begriff, Begriffe kombinieren", tags: ["anleitung", "webinar"] },
  parameter: { thema: "Wärmeplanung" },
  start: "Trefferliste zum Thema, Filter zu", ende: "Filter mit Auswahl, Marken sichtbar",
  setup: async (H, p) => { await H.search(p.thema); await H.sleep(500); },
  beats: [
    ["offen", async (H) => { await H.click("[aria-controls='filter-body']"); await H.sleep(800); await H.move(300, 260, 30); }, 2],
    ["exakt", async (H) => { const b = await sw(H, "Exakter Begriff").first().boundingBox(); if (b) { await H.move(b.x + b.width / 2, b.y + b.height / 2, 30); await H.sleep(1500); } await H.move(300, 330, 30); }, 1.5],  /* nur auf den Schalter zeigen: lokal ist die exakte Suche nicht gefüllt (0 Treffer), ein Umschalten zeigte eine leere Liste */
    ["zeitraum", async (H) => { await pick(H, "Zeitraum", /12 Monate/); await H.loaded(); }, 1],
    ["thema", async (H) => { await pick(H, "Thema", /Klima/); await H.loaded(); }, 1],
    ["status", async (H) => { await pick(H, "Status", /beschlossen|genehmigt|zugestimmt/i); await H.loaded(); }, 1.5],
    ["karte", async (H) => { await H.move(900, 380, 40); await H.sleep(1200); await H.move(760, 300, 40); }, 2.5],
    ["marken", async (H) => { await H.move(640, 120, 40); }, 3],
    ["kombi", async (H) => { await H.click(sw(H, "Begriffe kombinieren")); await H.loaded(); }, 2.5],
  ],
};
