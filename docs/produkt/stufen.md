# Funktionsumfang je Stufe

Stand: 29.10.2026. Die Werte stammen aus `shared/plans.mjs` (eine Quelle für Server und Oberfläche; `components/ratsmonitor/lib/tier.ts` liest dieselbe Datei) und sollen dort und hier gleich bleiben; `tests/accounts-rules.test.mjs` vergleicht die Tabelle. Wenn sich eine Zahl im Code ändert, dieses Dokument mit ändern.

Entscheidung 29.10.2026 (ersetzt die vom 23.10.2026): vier Stufen im Angebot, Gast, Konto, Plus und Pro. Alles gilt für ganz Deutschland, also alle Gebiete, für die es Daten gibt.

- **Ohne Anmeldung** (Gast): Suche nach Begriff und Ort (auch mit Umkreis), ohne Filter, 10 Treffer, Artikel lesen und teilen. Filter aus einem geteilten Link entfernt der Server (`withoutFilters` in `server/accounts/guest-search.mjs`), der Zeitraum endet heute, Formalien bleiben ausgeblendet.
- **Konto** (`basic`, kostenlos): jedes angemeldete Konto ohne Freischaltung (`ACCOUNT_DEFAULT_TIER`); 20 Treffer, alle Filter, 1 gespeicherte Suche, 1 gespeicherter Artikel, 1 Benachrichtigung (Glocke an einer Suche oder einem Vorgang), wöchentlich, Sitzungskalender mit 1 Gebiet.
- **Plus** (`plus`, 2,99 € im Monat, monatlich kündbar, kein kostenloser Test): alle Treffer, plenara.X, 10 gespeicherte Suchen und 10 Artikel, ein Wochenbericht je Woche zu allen Suchen und gefolgten Vorgängen (Wochentag wählbar), Kalender mit 5 Gebieten.
- **Pro** (`pro`, 19,99 € im Monat, monatlich kündbar): alles unbegrenzt (intern höchstens 1.000, `PLAN_MAX`), Benachrichtigung je Suche einstellbar, täglich oder wöchentlich, Dokumentsuche (Suche in den Texten der Sitzungsunterlagen, Seite `/dokumente`, Route `/api/dokumente`; Konzept `requirements/dokumentsuche-konzept.md`).
- **Enterprise** (`enterprise`): nicht im Angebot, verborgen über Pro (Rechte wie Pro, dazu 5 E-Mail-Empfänger, die es noch nicht gibt). Die Preisseite zeigt sie nicht; Testkonto `enterprise@plenara.test`, Admin-Testkonto `admin@plenara.test`.
- „Sofort“ gibt es in keiner Stufe mehr: höchstens täglich (Pro), sonst wöchentlich. Gespeicherte Glocken „sofort“ gelten als täglich (Pro) bzw. wöchentlich (`freqFor` in `shared/plans.mjs`, Migration `drizzle-accounts/0009`).
- Die Preisseite zeigt Konto, Plus und Pro als Karten, „ohne Anmeldung“ als Satz darüber.
- Bezahlung über Stripe, derzeit im Testmodus (`docs/betrieb/stripe-test.md`): Plus und Pro haben je einen Preis (`STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`). Alle Buchungsknöpfe führen zu `/konto/buchen`; dort stehen Plus und Pro zur Wahl (`?stufe=pro` wählt vor), ohne Anmeldung erst anmelden oder kostenlos registrieren. Wer schon ein Abo hat, wechselt dort mit „Zu Pro wechseln“ bzw. „Zu Plus wechseln“ (Bestätigung im Kundenportal von Stripe) oder unter „Abo verwalten“: nach oben sofort mit anteiliger Rechnung, nach unten zum Periodenende. Ohne eingerichtete Bezahlung bleibt es bei der Anfrage über den Kontakt.

| Funktion | Gast | Konto | Plus | Pro | Enterprise (verborgen) |
|---|---|---|---|---|---|
| Preis im Monat | – | kostenlos | 2,99 € | 19,99 € | – |
| Treffer je Suche | 10 | 20 | unbegrenzt | unbegrenzt | unbegrenzt |
| Filter | nein | ja | ja | ja | ja |
| Gespeicherte Suchen | 0 | 1 | 10 | unbegrenzt | unbegrenzt |
| Gemerkte Artikel | 0 | 1 | 10 | unbegrenzt | unbegrenzt |
| Glocken (Suchen und Vorgänge) | 0 | 1 | 20 | unbegrenzt | unbegrenzt |
| Rhythmus der Mails | – | wöchentlich | wöchentlich | täglich oder wöchentlich | täglich oder wöchentlich |
| Wochenbericht über alle Suchen | nein | nein | ja | ja | ja |
| Gebiete im Kalender | 0 | 1 | 5 | unbegrenzt | unbegrenzt |
| plenara.X | nein | nein | ja | ja | ja |
| Dokumentsuche | nein | nein | nein | ja | ja |
| E-Mail-Empfänger | 0 | 1 | 1 | 1 | 5 |

Hinweise:

- Durchgesetzt wird serverseitig: Trefferzahl und Filter (`app/api/search/route.ts`), gespeicherte Suchen, Artikel, Glocken, Rhythmus, Wochenbericht und Kalendergebiete (`server/accounts/account.mjs`), Versand nur im Umfang der Stufe (`mailScope` in `server/accounts/notify.mjs`), Kalendergebiete in `/api/calendar`, der Kalender-Datei und dem Abo-Link (`calendarScope`, `calendarAgsFor`), plenara.X über `gated(…,{feature:'analytics'})`, Dokumentsuche über `gated(…,{feature:'fulltext'})` (`FEATURES.fulltext`).
- Ein Gebiet im Kalender ist ein Eintrag: ein Ort oder Kreis, auf Wunsch mit Umkreis (die Liste der Gemeindeschlüssel im Umkreis rechnet der Browser).
- Nach einem Wechsel nach unten wird nichts gelöscht. Gemeldet werden nur die ersten Suchen und Artikel bis zur Grenze, davon die ältesten Glocken bis zur Grenze; der Kalender zeigt die ersten Gebiete, ohne Umkreis. Neues lässt sich erst wieder anlegen, wenn man unter der Grenze ist.
- Plus: Weil alle Suchen und gefolgten Vorgänge in einer Mail je Woche kommen, darf jede gespeicherte Suche und jeder Artikel eine Glocke haben (20).
- KI-Assistenten (MCP) gehören zu keiner Stufe (Entscheidung 23.10.2026). Zugang per OAuth nur für Konten, die der Betreiber in die Kundendatei einträgt, oder per Schlüssel des Betreibers (`docs/betrieb/claude-mcp-einbindung.md`).
- Gast ist die Stufe ohne Konto. Die Grenzen für Gäste zeigen den Hinweis zum Anmelden, die des Kontos den Hinweis auf Plus, die von Plus den auf Pro.
- Interne Schlüssel bis 29.10.2026: `pro` hieß Plus. Die Migration `drizzle-accounts/0009_tiers_plus_pro.sql` hat alle Freischaltungen, Einladungen und „ansehen als“ von `pro` auf `plus` umgestellt; seitdem meint `pro` die neue Stufe Pro.
