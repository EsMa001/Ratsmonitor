# Stripe im Testmodus

Stand: 26.10.2026. Testanbindung für Plus: Bezahlen mit Stripe Checkout, Freischaltung per Meldung (Webhook), Kundenportal. Es fließt kein echtes Geld. Für echte Zahlungen fehlen noch die Punkte unter „Vor dem Live-Betrieb“.

- Code: `server/accounts/billing.mjs`, Routen `app/api/billing/{checkout,portal,webhook}/route.ts`, Abgleich `scripts/billing/reconcile.mjs`, Einrichtung `scripts/billing/setup-stripe.mjs` und `listen.mjs`
- Kontendatei: `drizzle-accounts/0006_billing.sql` (`billing_customers`, `subscriptions`, `billing_events`, eine Zeile je Abo in `plan_grants`)
- Oberfläche: Abschnitt „Stufe“ auf `/konto/profil` (`Billing` in `components/ratsmonitor/components/PlanCards.tsx`)
- Tests: `tests/billing.test.mjs`
- Hintergrund und Wahl des Anbieters: `requirements/zahlungsdienste-recherche-2026-10-26.md`, Ablauf: `requirements/konten-konzept.md`, Abschnitt 9.1

## Was die Anbindung tut

1. „Plus buchen“ auf der Kontoseite legt eine Checkout-Sitzung bei Stripe an (`client_reference_id` = Konto-ID, E-Mail vorbelegt) und leitet dorthin. Karten- und Kontodaten gibt die Kundin nur bei Stripe ein.
2. Die Rückkehr auf `/konto/profil?zahlung=pruefen` schaltet nichts frei. Die Seite zeigt „Zahlung wird geprüft“ und fragt eine Minute lang `/api/me` nach.
3. Freigeschaltet wird nur über `POST /api/billing/webhook`: Signatur prüfen, Meldung einmal verarbeiten (`billing_events`), Abo bei Stripe neu abrufen, Zeile in `plan_grants` schreiben (`source='stripe'`, `ref` = Abo-ID, Ende = Periodenende plus 3 Tage Kulanz).
4. Jede bezahlte Folgerechnung verlängert die Zeile. Ist die Rechnung offen oder das Abo überfällig, wird nicht verlängert, und die Stufe läuft von selbst aus.
5. Ein gekündigtes Abo endet zum Periodenende. Bei einer Anfechtung oder Rücklastschrift beendet Plenara das Abo bei Stripe sofort, und die Stufe endet sofort.
6. „Abo verwalten“ öffnet das Kundenportal von Stripe: kündigen, Zahlart ändern, Rechnungen.
7. Der Abgleich (`scripts/billing/reconcile.mjs`) liest alle Abos bei Stripe und führt `plan_grants` nach. Er fängt verpasste Meldungen auf.
8. Ein Konto mit laufendem, nicht gekündigtem Abo lässt sich erst nach der Kündigung löschen.

Ohne die drei Werte `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` und `STRIPE_PRICE_PLUS` ist alles aus: Die Kontoseite zeigt keine Knöpfe, und die Routen antworten mit 503. Live-Schlüssel (`sk_live_…`) gelten nur mit `STRIPE_LIVE=1`.

## Einrichten mit dem Skript

Einmal im Stripe-Dashboard: Konto anlegen (für den Testmodus genügt die E-Mail-Adresse), oben die Sandbox bzw. den Testmodus wählen und unter Entwickler → API-Schlüssel den geheimen Schlüssel `sk_test_…` kopieren. Den veröffentlichbaren Schlüssel `pk_test_…` braucht Plenara nicht. Dann:

```bash
node scripts/billing/setup-stripe.mjs
```

Das Skript fragt nach dem Schlüssel (Eingabe als Sternchen) und erledigt den Rest:

1. prüft den Schlüssel bei Stripe; Live-Schlüssel lehnt es ab;
2. legt das Produkt „Plenara Plus“ mit dem Preis 2,99 € im Monat an (Suchschlüssel `plenara_plus_monthly`), falls es ihn noch nicht gibt;
3. legt eine eigene Einstellung des Kundenportals an (kündigen zum Periodenende, Zahlart ändern, Rechnungen, Name, Anschrift, Steuernummer) und trägt sie als `STRIPE_PORTAL_CONFIG` ein; das Dashboard muss dafür nicht gespeichert werden;
4. holt das Meldungsgeheimnis `whsec_…` von der Stripe CLI; fehlt die CLI, bietet es die Installation per winget an (`Stripe.StripeCli`), sonst lässt sich das Geheimnis einfügen;
5. schreibt `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PLUS`, `STRIPE_PORTAL_CONFIG` und `STRIPE_WEBHOOK_SECRET` in `.dev.vars` (nicht in Git); andere Zeilen bleiben.

Das Skript lässt sich jederzeit erneut starten; was es bei Stripe schon angelegt hat, nimmt es wieder. Zahlarten stellt Stripe im Dashboard ein (Einstellungen → Zahlungen → Zahlungsmethoden): Karte mit Apple Pay, Google Pay und Link genügt; PayPal kann dazu, SEPA-Lastschrift erst mit einem Jahrespreis (Begründung in der Recherche).

## Lokal starten

Meldungen an den Dev-Server weiterleiten, in einem eigenen Terminal, das offen bleibt:

```bash
node scripts/billing/listen.mjs
```

Das Skript startet `stripe listen` mit dem Schlüssel aus `.dev.vars` (ohne `stripe login`) für die sieben Meldungen, an `http://localhost:5173/api/billing/webhook` (anderer Port: `--port`). Danach den Dev-Server neu starten: Er liest `.dev.vars` beim Start und spielt dabei die Migration `0006` ein.

## Testen

1. Als `basic@plenara.test` anmelden (Dev-Login), `/konto/profil` öffnen und „Plus buchen · 2,99 € / Monat“ wählen.
2. Bei Stripe mit Testkarte zahlen: `4242 4242 4242 4242`, ein beliebiges künftiges Ablaufdatum, eine beliebige Prüfnummer. Weitere Karten: `4000 0027 6000 3184` (3-D-Secure), `4000 0000 0000 0002` (abgelehnt), `4000 0000 0000 0259` (wird später angefochten).
3. Zurück auf der Kontoseite steht „Zahlung wird geprüft“, nach wenigen Sekunden „Danke, Plus ist freigeschaltet“. Im Terminal von `listen.mjs` stehen die Meldungen mit 200.
4. „Abo verwalten“ öffnet das Portal. Nach dem Kündigen steht auf der Kontoseite „Plus ist gekündigt und endet am …“.
5. **Verlängerung ohne Warten:** Abos aus dem Checkout haben keine Testuhr. Dafür im Dashboard unter Billing → Testuhren eine Simulation anlegen, darin einen Kunden mit Testkarte und ein Abo mit dem Preis „Plenara Plus“ und den Metadaten `user_id` = Konto-ID (z. B. `u_dev_pro` für `pro@plenara.test`). Die Meldung zum neuen Abo verknüpft es mit dem Konto. Die Uhr um einen Monat vorstellen: Die Meldung `invoice.paid` verlängert die Zeile in `plan_grants`.
6. **Abgleich:** `node scripts/billing/reconcile.mjs` liest ohne `ACCOUNTS_FILE` die lokale D1-Datei und `STRIPE_*` aus `.dev.vars` und gibt `{"seen":…,"linked":…}` aus.
7. **Stand ansehen:** Tabellen `billing_customers`, `subscriptions`, `billing_events` und `plan_grants` mit `source='stripe'` in der lokalen D1-Datei.

## Testmodus auf plenara.de (seit 26.10.2026, nur Admins)

Auf dem Server läuft dieselbe Sandbox wie lokal, aber nur Konten mit der Rolle admin sehen „Plus buchen“ und das Portal (`STRIPE_ADMINS_ONLY=1`); alle anderen merken nichts. So lässt sich der Ablauf mit dem eigenen Konto prüfen, ohne dass Testkonten Plus über die Testkarte bekommen.

- **Werte:** in `/etc/ratsmonitor/accounts.env` (root, 600; der Dienst `ratsmonitor` liest die Datei): `STRIPE_SECRET_KEY` (Testschlüssel), `STRIPE_PRICE_PLUS`, `STRIPE_PORTAL_CONFIG`, `STRIPE_WEBHOOK_SECRET` und `STRIPE_ADMINS_ONLY=1`. Danach `systemctl restart ratsmonitor`.
- **Webhook-Endpunkt:** bei Stripe für `https://plenara.de/api/billing/webhook` mit den sieben Meldungen aus `EVENTS` (`billing.mjs`); sein Geheimnis ist `STRIPE_WEBHOOK_SECRET` auf dem Server (ein anderes als das der lokalen CLI).
- **Caddy:** `/api/billing/webhook` steht in `@site_password` unter den Ausnahmen vom Seitenpasswort (`deploy/node/caddy/snippets.caddy`, auf dem Server `/etc/caddy/Caddyfile`).
- **Lokal und Server nebeneinander:** Beide erhalten die Meldungen derselben Sandbox. Abos, deren Konto es auf der jeweiligen Seite nicht gibt, überspringen Meldungen und Abgleich (`syncSubscription` ohne passendes Konto).
- **Ausschalten:** die `STRIPE_*`-Zeilen entfernen und den Dienst neu starten; den Endpunkt im Dashboard löschen.

## Vor dem Live-Betrieb

Nicht Teil der Testanbindung, aber nötig, bevor `STRIPE_LIVE=1` gesetzt wird:

- **Recht** (Recherche, Tabelle „Offene Punkte“): Bestellschaltfläche nach § 312j BGB, eigener Kündigungsbutton ohne Anmeldung nach § 312k BGB, Widerrufsbutton nach § 356a BGB, die beiden Erklärungen zum vorzeitigen Leistungsbeginn mit Nachweis (`consents` erweitern), AGB und Datenschutzerklärung mit Stripe.
- **Server:** `/api/billing/webhook` über https ohne Seitenpasswort erreichbar machen (Caddy; die Zugangssperre lässt die Route schon durch), im Dashboard einen Endpunkt mit den sieben Meldungen anlegen, Schlüssel in die Umgebungsdatei des Servers, Abgleich als täglichen Job in den Zeitplaner.
- **Mails und Belege:** eigene Mails über den Postausgang (Kündigung bestätigt, Zahlung fehlgeschlagen), Rechnungen und Auszahlungsberichte ins eigene Archiv (8 Jahre), Rechnungseinstellungen im Dashboard (A4, Deutsch, Pflichtangaben).
- **Löschen:** `removeUser` (Kommandozeile, Pflegejob) kündigt kein Abo. Vorher ergänzen, dass laufende Abos bei Stripe beendet werden.
