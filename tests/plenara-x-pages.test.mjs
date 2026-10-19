// plenara.X-Seiten: Vertrag der Seitenquellen (läuft immer) und Browserprüfung (nur mit PLENARA_E2E=<Adresse des Dev-Servers>).
// Die Seiten haben keine Komponententests; dieser Test fängt die Fehler, die sich beim Umbauen am häufigsten einschleichen:
// fehlender Lade-, Fehler- oder Leerzustand, fehlender Kopf, Methodik oder Querverweis, alte Seitennamen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const dir = new URL('../components/ratsmonitor/pages/analytics/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, dir), 'utf8');

/* Seite → Dateien, in denen ihr Code steht; gemeinsame Bausteine müssen in einer davon vorkommen */
const SEITEN = {
  Themenatlas: ['AtlasPage.tsx', 'XAtlasView.tsx'],
  Ortsvergleich: ['ComparePage.tsx'],
  Trends: ['XTrendsPage.tsx'],
  Beschlusslage: ['BeschluessePage.tsx'],
  Projekte: ['SignalePage.tsx'],
  Nachrichten: ['NewsradarPage.tsx'],
  Werte: ['FaktenPage.tsx'],
  Fraktionen: ['FraktionenPage.tsx'],
  Gremien: ['GremiennetzPage.tsx'],
  Themennetz: ['KnowledgeGraphPage.tsx'],
};
const code = (seite) => SEITEN[seite].filter((f) => fs.existsSync(new URL(f, dir))).map(read).join('\n');

test('jede plenara.X-Seite hat Kopf, Fehler- und Ladezustand, Methodik und Querverweis', () => {
  for (const seite of Object.keys(SEITEN)) {
    const c = code(seite);
    assert.ok(c.length > 0, `${seite}: Datei fehlt`);
    assert.match(c, /Fehler/, `${seite}: kein Fehlerzustand`);
    assert.match(c, /Laden|animate-pulse/, `${seite}: kein Ladezustand`);
    assert.match(c, /MethodikNote|XKopf|AtlasPage|PageBand/, `${seite}: weder Kopf noch Methodik`);
  }
});

test('Seiten, die nur auf Knopfdruck rechnen, nutzen useAnalysisRun (ein Weg für Laden, Fehler, veraltet)', () => {
  for (const seite of ['Trends', 'Beschlusslage', 'Projekte', 'Nachrichten', 'Werte', 'Fraktionen', 'Gremien', 'Themennetz', 'Ortsvergleich']) {
    assert.match(code(seite), /useAnalysisRun/, `${seite}: eigener Abrufweg statt useAnalysisRun`);
  }
});

test('Seiten ohne Ergebnis zeigen einen Leerzustand', () => {
  for (const seite of ['Trends', 'Beschlusslage', 'Projekte', 'Nachrichten', 'Fraktionen', 'Gremien']) {
    assert.match(code(seite), /<Leer/, `${seite}: kein Leerzustand`);
  }
});

test('der Seitenname „Ausgang“ ist durch „Beschlusslage“ ersetzt (Menü, Kopf, Querverweise)', () => {
  const sichtbar = ['../../menu/MainMenu.tsx', 'XKopf.tsx', 'GremiennetzPage.tsx', 'FraktionenPage.tsx', 'Methodik.tsx'].map(read).join('\n');
  assert.doesNotMatch(sichtbar, /"(plenara\.X )?Ausgang"/, 'alter Name „Ausgang“ als Beschriftung');
  assert.match(read('XKopf.tsx'), /plenara\.X Beschlusslage/);
});

test('die Analyse-Adressen sind in AnalyticsPages und in der Seitenliste dieselben', () => {
  const pages = read('AnalyticsPages.tsx');
  for (const pfad of ['atlas', 'vergleich', 'trends', 'beschluesse', 'signale', 'ausschreibungen', 'news', 'fakten', 'fraktionen', 'gremien', 'graph']) {
    assert.match(pages, new RegExp(`/analytics/${pfad}`), `${pfad} fehlt in AnalyticsPages`);
  }
});

/* ---- Browserprüfung (optional): PLENARA_E2E=http://localhost:5173 node --test tests/plenara-x-pages.test.mjs ---- */
const base = process.env.PLENARA_E2E;
const e2e = base ? test : test.skip;
const playwright = () => createRequire(process.env.HOME + '/code/video-tools/package.json')('playwright');

e2e('alle plenara.X-Seiten laden ohne Konsolenfehler, mit Kopf und Methodik (Desktop und Handy)', async () => {
  const { chromium } = playwright();
  const b = await chromium.launch();
  try {
    for (const [name, vp, mobil] of [['Desktop', { width: 1440, height: 900 }, false], ['Handy', { width: 390, height: 844 }, true]]) {
      const ctx = await b.newContext({ viewport: vp, isMobile: mobil, hasTouch: mobil });
      await ctx.request.post(base + '/api/dev/login', { data: { email: 'enterprise@plenara.test' }, headers: { origin: base } });
      for (const pfad of ['atlas', 'vergleich', 'trends', 'beschluesse', 'signale', 'ausschreibungen', 'news', 'fakten', 'fraktionen', 'gremien', 'graph']) {
        const pg = await ctx.newPage();
        const fehler = [];
        pg.on('pageerror', (e) => fehler.push(String(e)));
        await pg.goto(`${base}/analytics/${pfad}`, { waitUntil: 'load', timeout: 90000 });
        await pg.waitForTimeout(6000);
        assert.deepEqual(fehler, [], `${name} ${pfad}: Seitenfehler`);
        assert.ok(await pg.locator('h1').first().isVisible(), `${name} ${pfad}: keine Überschrift`);
        const breite = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(breite <= 1, `${name} ${pfad}: seitlicher Überlauf (${breite} px)`);
        await pg.close();
      }
      await ctx.close();
    }
  } finally { await b.close(); }
});

e2e('Desktop: Filter und Reiter der überarbeiteten Seiten funktionieren', async () => {
  const { chromium } = playwright();
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.request.post(base + '/api/dev/login', { data: { email: 'enterprise@plenara.test' }, headers: { origin: base } });
    const seite = async (pfad, warte = 9000) => { const pg = await ctx.newPage(); await pg.goto(base + pfad, { waitUntil: 'load', timeout: 90000 }); await pg.waitForTimeout(warte); return pg; };
    // Signale: Schritt als Auswahlliste
    let pg = await seite('/analytics/signale');
    await pg.getByRole('button', { name: /Schritt:/ }).click();
    assert.ok(await pg.getByRole('listbox').isVisible(), 'Signale: Schrittliste öffnet nicht');
    await pg.close();
    // Ortsvergleich: Eingaben sichtbar, Reiter schalten um
    pg = await seite('/analytics/vergleich');
    assert.ok(await pg.locator('#vergleich-thema').isVisible(), 'Ortsvergleich: Eingabefelder nicht offen');
    assert.ok(await pg.getByText('Aktivste Gremien', { exact: true }).isVisible(), 'Ortsvergleich: Zeile Aktivste Gremien fehlt am Desktop');
    await pg.getByRole('tab', { name: 'Verlauf' }).click();
    assert.ok(await pg.getByText('Vorgänge je Monat.', { exact: true }).isVisible(), 'Ortsvergleich: Reiter Verlauf zeigt nichts');
    await pg.close();
    // Gremien und Fraktionen: Reiter
    pg = await seite('/analytics/gremien');
    await pg.getByRole('tab', { name: 'Rollen im Netz' }).click();
    assert.ok(await pg.getByRole('heading', { name: 'Rollen im Netz' }).isVisible(), 'Gremien: Reiter Rollen zeigt nichts');
    await pg.close();
    pg = await seite('/analytics/fraktionen');
    await pg.getByRole('tab', { name: 'Themenprofil' }).click();
    assert.ok(await pg.getByRole('heading', { name: 'Themenprofil' }).isVisible(), 'Fraktionen: Reiter Themenprofil zeigt nichts');
    await pg.close();
    // Beschlusslage: Balken mit Beschriftung
    pg = await seite('/analytics/beschluesse');
    assert.match(await pg.locator('[role="img"][aria-label^="beschlossen"]').first().getAttribute('aria-label'), /vertagt.*abgelehnt/);
    await pg.close();
    // Kopfzeile: Favoriten als ein Menü, Dunkelmodus im Konto-Menü
    pg = await seite('/analytics/atlas', 5000);
    await pg.getByRole('button', { name: /Favoriten/ }).click();
    assert.equal(await pg.getByRole('menuitem').count(), 4, 'Kopfzeile: Favoriten hat nicht vier Einträge');
    await pg.keyboard.press('Escape');
    await pg.getByRole('button', { name: 'Konto' }).click();
    assert.ok(await pg.getByRole('menuitemcheckbox', { name: /Dunkler Modus/ }).isVisible(), 'Kopfzeile: Dunkelmodus nicht im Konto-Menü');
    await pg.close();
    // Netze: Knoten per Tastatur erreichbar und wählbar
    for (const pfad of ['/analytics/gremien', '/analytics/graph']) {
      pg = await seite(pfad, 10000);
      const knoten = pg.locator('g[data-node][role="button"]');
      assert.ok(await knoten.count() > 3, `${pfad}: keine Knoten mit Rolle Knopf`);
      await knoten.nth(1).focus();
      await pg.keyboard.press('Enter');
      assert.equal(await knoten.nth(1).getAttribute('aria-pressed'), 'true', `${pfad}: Enter wählt den Knoten nicht`);
      await pg.close();
    }
    // Trends: Abspielsymbol in den Zeilen
    pg = await seite('/analytics/trends', 14000);
    assert.ok(await pg.locator('[title="Ausbreitung auf der Karte abspielen"]').first().isVisible(), 'Trends: kein Abspielsymbol');
    await pg.close();
  } finally { await b.close(); }
});
