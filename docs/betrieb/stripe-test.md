# Stripe im Testmodus

Stand: 29.10.2026. Testanbindung für Plus (2,99 €) und Pro (19,99 €, seit 29.10.2026): Bezahlen mit Stripe Checkout, Freischaltung per Meldung (Webhook), Kundenportal mit Wechsel zwischen Plus und Pro. Es fließt kein echtes Geld. Für echte Zahlungen fehlen noch die Punkte unter „Vor dem Live-Betrieb“.

- Code: `server/accounts/billing.mjs`, Routen `app/api/billing/{checkout,portal,webhook}/route.ts`, Abgleich `scripts/billing/reconcile.mjs`, Einrichtung `scripts/billing/setup-stripe.mjs` und `listen.mjs`
- Kontendatei: `drizzle-accounts/0006_billing.sql` (`billing_customers`, `subscriptions`, `billing_events`, eine Zeile je Abo in `plan_grants`)
- Oberfläche: Buchungsseite `/konto/buchen` mit Wahl zwischen Plus und Pro (`?stufe=pro` wählt vor, `pages/BookingPage.tsx`), Abschnitt „Stufe“ auf `/konto/profil` (`Billing` in `components/ratsmonitor/components/PlanCards.tsx`)
- Tests: `tests/billing.test.mjs`
- Hintergrund und Wahl des Anbieters: `requirements/zahlungsdienste-recherche-2026-10-26.md`, Ablauf: `requirements/konten-konzept.md`, Abschnitt 9.1

## Was die Anbindung tut

1. „Plus buchen“ bzw. „Pro buchen“ (Buchungsseite oder Kontoseite) legt eine Checkout-Sitzung bei Stripe an (`POST /api/billing/checkout {tier}`, Preis `STRIPE_PRICE_PLUS` bzw. `STRIPE_PRICE_PRO`, `client_reference_id` = Konto-ID, E-Mail vorbelegt) und leitet dorthin. Läuft schon ein Abo, lehnt die Route ab (409): gewechselt wird im Kundenportal. Die Buchungsseite zeigt dann „Zu Pro wechseln“ bzw. „Zu Plus wechseln“ und öffnet direkt die Bestätigung des Wechsels (`POST /api/billing/portal {tier}`, `flow_data` `subscription_update_confirm`). Das geht nur mit einer Portal-Einstellung mit Wechsel (`setup-stripe.mjs`); sonst antwortet die Route mit 503 und einem Hinweis. Karten- und Kontodaten gibt die Kundin nur bei Stripe ein.
2. Die Rückkehr auf `/konto/profil?zahlung=pruefen` schaltet nichts frei. Die Seite zeigt „Zahlung wird geprüft“ und fragt eine Minute lang `/api/me` nach.
3. Freigeschaltet wird nur über `POST /api/billing/webhook`: Signatur prüfen, Meldung einmal verarbeiten (`billing_events`), Abo bei Stripe neu abrufen, Zeile in `plan_grants` schreiben (`source='stripe'`, `ref` = Abo-ID, Stufe nach dem Preis des Abos: `tierOfPrice`, ein unbekannter Preis gilt als Plus; Ende = Periodenende plus 3 Tage Kulanz).
4. Jede bezahlte Folgerechnung verlängert die Zeile. Ist die Rechnung offen oder das Abo überfällig, wird nicht verlängert, und die Stufe läuft von selbst aus.
5. Ein gekündigtes Abo endet zum Periodenende. Bei einer Anfechtung oder Rücklastschrift beendet Plenara das Abo bei Stripe sofort, und die Stufe endet sofort.
6. „Abo verwalten“ öffnet das Kundenportal von Stripe: zwischen Plus und Pro wechseln (nach oben sofort, der Unterschied wird anteilig sofort berechnet; nach unten zum Periodenende), kündigen, Zahlart ändern, Rechnungen. Die neue Stufe gilt erst, wenn die Rechnung dazu bezahlt ist (Meldung `customer.subscription.updated` bzw. `invoice.paid`).
7. Der Abgleich (`scripts/billing/reconcile.mjs`) liest alle Abos bei Stripe und führt `plan_grants` nach. Er fängt verpasste Meldungen auf.
8. Ein Konto mit laufendem, nicht gekündigtem Abo lässt sich erst nach der Kündigung löschen.
9. Mails über den Postausgang: zu jeder bezahlten Rechnung „Zahlung eingegangen“ (erste Rechnung: „Plus ist freigeschaltet“ bzw. „Pro ist freigeschaltet“, danach „… verlängert“, mit Betrag, nächster Abrechnung und Beleg von Stripe; Vorlage `plus_paid`). Der nächtliche Pflegejob schickt 3 Tage vor dem Ende „Ihr Plus endet in wenigen Tagen“, wenn Plus nicht verlängert wird: Abo gekündigt, Zahlung offen oder Freischaltung von Hand mit Ende (Vorlage `plus_ending`, einmal je Zeile, `scripts/accounts/maintenance.mjs`). Beide Mails lassen sich abbestellen: Link `/abbestellen#t=…` und Ein-Klick-Kopfzeilen wie bei den Benachrichtigungen (Token mit Bezug `b` in `notify_tokens`), Schalter „E-Mails zu Zahlungen und zum Ende von Plus“ im Profil unter „Stufe“ (`user_settings.billing_mails`, `billingMails` in `/api/me/settings`). Abbestellt wird nur die Mail; Freischaltung und Hinweisvermerk laufen weiter.
10. Kündigungsbutton nach § 312k BGB: „Verträge hier kündigen“ in der Fußzeile jeder Seite (auch im Menü „Mehr“) führt zu `/kuendigen`, ohne Anmeldung, in der Zugangssperre frei. Abgefragt werden Art (bei außerordentlicher der Grund), Vertrag (Plenara Plus), E-Mail-Adresse des Kontos und Zeitpunkt; der Knopf heißt „jetzt kündigen“. Danach zeigt die Seite die Erklärung mit Eingang (Datum, Uhrzeit) zum Drucken oder Speichern. `POST /api/billing/cancel` (`server/accounts/cancel.mjs`) antwortet für jede Adresse gleich; danach wird ein laufendes Abo bei Stripe zum Periodenende (`cancel_at_period_end`) oder zum späteren Wunschtag (`cancel_at`) beendet, der Nachweis in `cancellations` abgelegt (Adresse nur als HMAC, 3 Jahre) und die Bestätigung „Ihre Kündigung bei Plenara ist eingegangen“ geschickt (Vorlage `cancel_received`, nicht abbestellbar, auch ohne Konto). Außerordentliche Kündigungen und Fehler bei Stripe gehen zusätzlich an `OPERATOR_EMAIL`. Höchstens 5 Kündigungen je Anschluss in 15 Minuten und 3 Bestätigungen je Adresse am Tag.

Ohne die drei Werte `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` und `STRIPE_PRICE_PLUS` ist alles aus: Die Kontoseite zeigt keine Knöpfe, und die Routen antworten mit 503. Pro lässt sich nur mit `STRIPE_PRICE_PRO` buchen (`/api/me` meldet die buchbaren Stufen in `bookable`). Live-Schlüssel (`sk_live_…`) gelten nur mit `STRIPE_LIVE=1`.

## Einrichten mit dem Skript

Einmal im Stripe-Dashboard: Konto anlegen (für den Testmodus genügt die E-Mail-Adresse), oben die Sandbox bzw. den Testmodus wählen und unter Entwickler → API-Schlüssel den geheimen Schlüssel `sk_test_…` kopieren. Den veröffentlichbaren Schlüssel `pk_test_…` braucht Plenara nicht. Dann:

```bash
node scripts/billing/setup-stripe.mjs
```

Das Skript fragt nach dem Schlüssel (Eingabe als Sternchen) und erledigt den Rest:

1. prüft den Schlüssel bei Stripe; Live-Schlüssel lehnt es ab;
2. legt die Produkte „Plenara Plus“ mit dem Preis 2,99 € im Monat (Suchschlüssel `plenara_plus_monthly`) und „Plenara Pro“ mit 19,99 € im Monat (`plenara_pro_monthly`) an, falls es sie noch nicht gibt;
3. legt eine eigene Einstellung des Kundenportals an bzw. bringt sie auf den Stand (zwischen Plus und Pro wechseln, nach oben mit sofortiger anteiliger Rechnung, nach unten zum Periodenende; kündigen zum Periodenende, Zahlart ändern, Rechnungen, Name, Anschrift, Steuernummer) und trägt sie als `STRIPE_PORTAL_CONFIG` ein; das Dashboard muss dafür nicht gespeichert werden;
4. holt das Meldungsgeheimnis `whsec_…` von der Stripe CLI; fehlt die CLI, bietet es die Installation per winget an (`Stripe.StripeCli`), sonst lässt sich das Geheimnis einfügen;
5. schreibt `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`, `STRIPE_PORTAL_CONFIG` und `STRIPE_WEBHOOK_SECRET` in `.dev.vars` (nicht in Git); andere Zeilen bleiben.

Das Skript lässt sich jederzeit erneut starten; was es bei Stripe schon angelegt hat, nimmt es wieder. Zahlarten stellt Stripe im Dashboard ein (Einstellungen → Zahlungen → Zahlungsmethoden): Karte mit Apple Pay, Google Pay und Link genügt; PayPal kann dazu, SEPA-Lastschrift erst mit einem Jahrespreis (Begründung in der Recherche).

## Lokal starten

Meldungen an den Dev-Server weiterleiten, in einem eigenen Terminal, das offen bleibt:

```bash
node scripts/billing/listen.mjs
```

Das Skript startet `stripe listen` mit dem Schlüssel aus `.dev.vars` (ohne `stripe login`) für die sieben Meldungen, an `http://localhost:5173/api/billing/webhook` (anderer Port: `--port`). Danach den Dev-Server neu starten: Er liest `.dev.vars` beim Start und spielt dabei die Migration `0006` ein.

## Testen

1. Als `basic@plenara.test` anmelden (Dev-Login), `/konto/profil` öffnen und „Plus buchen · 2,99 € / Monat“ oder „Pro buchen · 19,99 € / Monat“ wählen (oder direkt `/konto/buchen` bzw. `/konto/buchen?stufe=pro`).
2. Bei Stripe mit Testkarte zahlen: `4242 4242 4242 4242`, ein beliebiges künftiges Ablaufdatum, eine beliebige Prüfnummer. Weitere Karten: `4000 0027 6000 3184` (3-D-Secure), `4000 0000 0000 0002` (abgelehnt), `4000 0000 0000 0259` (wird später angefochten).
3. Zurück auf der Kontoseite steht „Zahlung wird geprüft“, nach wenigen Sekunden „Danke, Plus ist freigeschaltet“. Im Terminal von `listen.mjs` stehen die Meldungen mit 200.
4. „Abo verwalten“ öffnet das Portal. Dort zu Pro wechseln: Stripe stellt den Unterschied sofort in Rechnung, nach der Meldung steht auf der Kontoseite die Stufe Pro. Nach dem Kündigen steht dort „Pro ist gekündigt und endet am …“.
5. **Verlängerung ohne Warten:** Abos aus dem Checkout haben keine Testuhr. Dafür im Dashboard unter Billing → Testuhren eine Simulation anlegen, darin einen Kunden mit Testkarte und ein Abo mit dem Preis „Plenara Plus“ und den Metadaten `user_id` = Konto-ID (z. B. `u_dev_pro` für `pro@plenara.test`). Die Meldung zum neuen Abo verknüpft es mit dem Konto. Die Uhr um einen Monat vorstellen: Die Meldung `invoice.paid` verlängert die Zeile in `plan_grants`.
6. **Abgleich:** `node scripts/billing/reconcile.mjs` liest ohne `ACCOUNTS_FILE` die lokale D1-Datei und `STRIPE_*` aus `.dev.vars` und gibt `{"seen":…,"linked":…}` aus.
7. **Stand ansehen:** Tabellen `billing_customers`, `subscriptions`, `billing_events` und `plan_grants` mit `source='stripe'` in der lokalen D1-Datei.

## Testmodus auf plenara.de (seit 26.10.2026)

Auf dem Server läuft dieselbe Sandbox wie lokal. Seit dem Abend des 26.10.2026 ohne `STRIPE_ADMINS_ONLY` und mit freier Registrierung (`ACCOUNTS_OPEN_SIGNUP=1`): Jedes Konto kann Plus (und nach dem Eintrag von `STRIPE_PRICE_PRO` auch Pro) mit Testkarten buchen; die Seite steht weiter hinter dem Seitenpasswort. Mit `STRIPE_ADMINS_ONLY=1` sehen nur Konten mit der Rolle admin „Plus buchen“ und das Portal; alle anderen merken nichts. So lässt sich der Ablauf mit dem eigenen Konto prüfen, ohne dass Testkonten Plus über die Testkarte bekommen.

- **Werte:** in `/etc/ratsmonitor/accounts.env` (root, 600; der Dienst `ratsmonitor` liest die Datei): `STRIPE_SECRET_KEY` (Testschlüssel), `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`, `STRIPE_PORTAL_CONFIG`, `STRIPE_WEBHOOK_SECRET` und `STRIPE_ADMINS_ONLY=1`. Danach `systemctl restart ratsmonitor`.
- **Webhook-Endpunkt:** bei Stripe für `https://plenara.de/api/billing/webhook` mit den sieben Meldungen aus `EVENTS` (`billing.mjs`); sein Geheimnis ist `STRIPE_WEBHOOK_SECRET` auf dem Server (ein anderes als das der lokalen CLI).
- **Caddy:** `/api/billing/webhook` steht in `@site_password` unter den Ausnahmen vom Seitenpasswort (`deploy/node/caddy/snippets.caddy`, auf dem Server `/etc/caddy/Caddyfile`).
- **Lokal und Server nebeneinander:** Beide erhalten die Meldungen derselben Sandbox. Abos, deren Konto es auf der jeweiligen Seite nicht gibt, überspringen Meldungen und Abgleich (`syncSubscription` ohne passendes Konto).
- **Ausschalten:** die `STRIPE_*`-Zeilen entfernen und den Dienst neu starten; den Endpunkt im Dashboard löschen.

## Vor dem Live-Betrieb

Nicht Teil der Testanbindung, aber nötig, bevor `STRIPE_LIVE=1` gesetzt wird:

- **Recht** (Recherche, Tabelle „Offene Punkte“): Bestellschaltfläche nach § 312j BGB, Widerrufsbutton nach § 356a BGB (der Kündigungsbutton nach § 312k BGB steht, siehe oben; ohne Seitenpasswort muss `/kuendigen` öffentlich bleiben), die beiden Erklärungen zum vorzeitigen Leistungsbeginn mit Nachweis (`consents` erweitern), AGB und Datenschutzerklärung mit Stripe.
- **Server:** `/api/billing/webhook` über https ohne Seitenpasswort erreichbar machen (Caddy; die Zugangssperre lässt die Route schon durch), im Dashboard einen Endpunkt mit den sieben Meldungen anlegen, Schlüssel in die Umgebungsdatei des Servers, Abgleich als täglichen Job in den Zeitplaner.
- **Mails und Belege:** eigene Mail bei fehlgeschlagener Zahlung über den Postausgang (Kündigung über `/kuendigen` wird schon bestätigt, über das Portal noch nicht), Rechnungen und Auszahlungsberichte ins eigene Archiv (8 Jahre), Rechnungseinstellungen im Dashboard (A4, Deutsch, Pflichtangaben).
- **Löschen:** `removeUser` (Kommandozeile, Pflegejob) kündigt kein Abo. Vorher ergänzen, dass laufende Abos bei Stripe beendet werden.

## Umstellung auf Plus und Pro (29.10.2026)

Vor dem Einspielen auf dem Server: Migration `drizzle-accounts/0009_tiers_plus_pro.sql` stellt alle Freischaltungen mit `pro` (bis dahin Plus, auch die Stripe-Testabos) auf `plus` um; Enterprise bleibt. Danach lokal `node scripts/billing/setup-stripe.mjs` erneut starten (legt „Plenara Pro“ an und erweitert das Kundenportal um den Wechsel) und die Preis-ID von Pro als `STRIPE_PRICE_PRO` in `/etc/ratsmonitor/accounts.env` eintragen, `systemctl restart ratsmonitor`. Ohne `STRIPE_PRICE_PRO` bleibt Pro auf Anfrage; Plus läuft weiter wie bisher.

**Ende-zu-Ende im Testmodus (29.10.2026, Sandbox, Kontendatei im Speicher):** Checkout-Sitzung Plus (2,99 €) und Pro (19,99 €) mit dem richtigen Preis; bezahltes Pro-Abo (`pm_card_visa` über die API) → echte Meldungen `customer.subscription.created` und `invoice.paid` an den Webhook → Stufe Pro, Mail „Pro ist freigeschaltet“; zweites Abo über Checkout abgelehnt; Wechsel-Bestätigung im Portal mit der bisherigen Einstellung 503 (kein Wechsel eingerichtet), mit einer Einstellung mit Wechsel 200; Wechsel Pro → Plus → Pro über die Meldungen `customer.subscription.updated` und `invoice.paid` je richtig, eine Zeile in `plan_grants`; Abgleich; Kündigung → Stufe Konto. In der Sandbox angelegt: Produkt „Plenara Pro“ mit Preis (`plenara_pro_monthly`, von `setup-stripe.mjs` wiederverwendet); drei abgeschaltete Portal-Einstellungen „Plenara E2E (vorübergehend)“. Die gemeinsame Portal-Einstellung ist unverändert.
