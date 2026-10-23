# Funktionsumfang je Stufe

Stand: 23.10.2026. Die Werte stammen aus `shared/plans.mjs` (eine Quelle für Server und Oberfläche, Spiegel in `components/ratsmonitor/lib/tier.ts`) und sollen dort und hier gleich bleiben; `tests/accounts-rules.test.mjs` vergleicht. Wenn sich eine Zahl im Code ändert, dieses Dokument mit ändern.

Entscheidung 23.10.2026: sehr niedriger Preis, schnell wachsen ohne Vertrieb und ohne große Werbung (Serverkosten etwa 15 € im Monat). Alles gilt für ganz Deutschland, also alle Gebiete, für die es Daten gibt.

- **Ohne Anmeldung** (Gast): Suche mit allen Filtern, 10 Treffer, Artikel lesen und teilen.
- **Konto** (basic, kostenlos): jedes angemeldete Konto ohne Freischaltung (`ACCOUNT_DEFAULT_TIER`); 20 Treffer, 5 gespeicherte Suchen, 5 gespeicherte Artikel, 5 Benachrichtigungen, nur täglich oder wöchentlich (eine Glocke „sofort“ und gefolgte Vorgänge kommen mit dem nächsten täglichen Termin um 7 Uhr).
- **Plus** (pro, 2,99 € im Monat, monatlich kündbar, kein kostenloser Test): alles, auch plenara.X und der Kalender.
- **Enterprise**: noch nicht im Angebot, kommt vielleicht mit KI, Team-Funktionen, Schnittstelle. Im Code bleibt die Stufe (Rechte wie Plus, dazu 5 E-Mail-Empfänger), die Preisseite zeigt sie nicht.
- Die Preisseite zeigt Konto und Plus als Karten, „ohne Anmeldung“ als Satz darüber.
- Bezahlung ist noch nicht angebunden; Plus schaltet der Admin in der Testphase auf Anfrage frei.

| Funktion | Gast | Konto | Plus | Enterprise (später) |
|---|---|---|---|---|
| Treffer je Suche | 10 | 20 | unbegrenzt | unbegrenzt |
| Filter | ja | ja | ja | ja |
| Gemerkte Artikel | 0 | 5 | 100 | 100 |
| Gespeicherte Suchen | 0 | 5 | 100 | 100 |
| Benachrichtigungen (aktiv) | 0 | 5 | 100 | 100 |
| E-Mail-Empfänger | 0 | 1 | 1 | 5 |
| E-Mails sofort | nein | nein | ja | ja |
| plenara.X | nein | nein | ja | ja |
| Kalender | nein | nein | ja | ja |

Hinweise:

- „100“ ist die interne Obergrenze (`PLAN_MAX`) für Plus und Enterprise, faktisch praktisch unbegrenzt.
- KI-Assistenten (MCP) gehören zu keiner Stufe (Entscheidung 23.10.2026, ob und wie sie angeboten werden, ist offen). Der Code bleibt: Zugang per OAuth nur für Konten, die der Betreiber in die Kundendatei einträgt, oder per Schlüssel des Betreibers (`docs/betrieb/claude-mcp-einbindung.md`).
- Gast ist die Stufe ohne Konto. Die Grenzen für Gäste zeigen den Hinweis zum Anmelden, die des Kontos den Hinweis auf Plus.
- Die Grenzen gelten serverseitig nur, soweit das Backend sie prüft. Offen: Tarifrechte serverseitig durchsetzen (Todo `be-tarifrechte`).
