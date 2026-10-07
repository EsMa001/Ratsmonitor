# Browser-Import: Ratsinformationen hinter einer Browserprüfung lesen

Stand: 07.10.2026. Übernommen aus dem Land-Hadeln-Testpaket v3 und dessen Übergabe (`UEBERGABE_SDNET_RIM_GENERISCH.md`), eingebaut in die Leser dieses Projekts.

## Wofür

Rund 250 Ratsinformationssysteme (SD.NET RIM bei ratsinfomanagement.net, einzelne andere) stehen hinter der Browserprüfung einer Web Application Firewall. Jede Anfrage unseres Servers bekommt statt der Seite eine Prüfseite („Verifying your browser“, „rescaled WAF ⋅ Browser-Überprüfung“) oder HTTP 403; die OParl-Schnittstelle des Herstellers ist dort meist nicht aktiviert. Der Browser-Import liest die öffentlichen Seiten so, wie ein Mensch es tut: in einem sichtbaren, unveränderten Chromium (Playwright) auf dem Rechner des Inhabers. Er wartet die normale Browserprüfung ab und holt danach die Seiten aus derselben Sitzung.

Drei Entscheidungen bleiben getrennt (Übergabe, Abschnitt 4): die **Instanz** (`instances/<name>.json`: Herkunft, Einstieg, Gebiete, Grenzen), der **Adapter** (unsere vorhandenen Leser, zuerst `collectSdnet`) und der **Transport** (`transport.mjs`: eine `get(url, source)`-Funktion über die Browsersitzung). Es gibt keinen zweiten Crawler je Kommune: der Leser bleibt derselbe wie im Worker, nur der Abruf ist ein anderer.

## Regeln

- Kein Stealth, kein Proxy, keine Lösung von Aufgaben. Verlangt die Prüfung eine Handlung (CAPTCHA), läuft das Zeitlimit ab und der Lauf hält an. Die Prüfseite wird nie als Inhalt oder PDF gewertet.
- Die Zielseite wird positiv erkannt: gleicher Pfad und gleiche Abfrage, `readyState` complete, Systemtitel, nicht leerer Text, zwei gleiche Zustände hintereinander. „Loading …“ ist nicht bereit.
- Nur Adressen der Instanz (Herkunft und Basispfad), nacheinander, mindestens `delayMs` (1,2 s) Abstand, höchstens `maxRequests` je Lauf. HTTP 401, 403 und 429 oder eine zweite Prüfseite beenden den Lauf ohne Wiederholung.
- Gespeichert wird erst mit `apply`, und zwar wie eine historische Nachladung (`applyBackfill`: zusammenführen, nie ersetzen). Ein Lauf behauptet nur, was er gelesen hat: `scope` ist `complete_for_scope`, `limited` oder `stopped`.
- Der Worker ruft Quellen mit `transport: "browser"` nie ab (`collect-region.mjs`, `pipeline-jobs.mjs`); sie zählen als angebunden, ihre Berichte kommen vom Rechner des Inhabers in die lokale Datenbank und von dort über den Datenexport nach Produktion.

## Einrichten

```
pnpm install
pnpm exec playwright install chromium
```

Playwright ist eine Entwicklungsabhängigkeit (`package.json`); der Worker braucht sie nicht.

## Befehle

```
node scripts/browser-import/cli.mjs detect   --instance <name>
node scripts/browser-import/cli.mjs import   --instance <name> [--window 1w|1m|3m|12m] [--region <id,id>] [--headless]
node scripts/browser-import/cli.mjs apply    --instance <name> [--db <pfad.sqlite>]
node scripts/browser-import/cli.mjs record   --instance <name>
node scripts/browser-import/cli.mjs download --instance <name> [--max-documents 20]
```

- `detect`: Startseite öffnen, Zielseite erkennen, OParl-Adresse des Systems aus der Sitzung fragen (`disabled_confirmed`, `available`, `blocked`, `unknown`); Ergebnis in `detect.json`. Die Instanzdatei wird nicht verändert.
- `import`: je Gebiet der Instanz den Leser laufen lassen (`collectSdnet` mit dem Browser-Transport), Ergebnis als `<regionId>.json` im Format einer Nachladung, dazu `report.json`, `bericht.txt`, `lauf.log` und bei Abbruch HTML und Bildschirmfoto unter `diagnose/`.
- `apply`: die Ergebnisdateien in die lokale Datenbank des Dev-Servers einspielen (`.wrangler/state/…/*.sqlite`, sonst `--db`). Zweimal einspielen ändert nichts.
- `record`: für jedes Gebiet mit gelesenen Berichten eine angenommene Quelle mit `transport: "browser"` in `tmp/source-discovery-<land>/verified-browser.json`; danach wie gewohnt `build.mjs`, `servers.mjs`, `robots.mjs`, `scripts/dashboard/build.mjs`. Ohne gelesene Sitzung wird nichts eingetragen.
- `download`: die PDF-Dokumente der gelesenen Berichte aus der Sitzung holen, prüfen (Status, Herkunft, keine Prüfseite, `%PDF-` und `%%EOF`), je Adresse und je Inhalt einmal speichern (`downloads/`, `metadata.json`, `metadata.csv`). Noch nicht mit der Textverarbeitung verbunden.

Alle Ausgaben liegen unter `tmp/browser-import/<instanceId>/` (nicht im Repo).

## Instanzkonfiguration

`instances/<name>.json`, `schemaVersion` 1. Felder:

| Feld | Bedeutung |
| --- | --- |
| `instanceId`, `displayName` | Kennung (Kleinbuchstaben, Ziffern, Bindestriche) und Anzeigename des Portals. |
| `adapter` | Leser; vorerst `sdnet`. |
| `origin`, `basePath` | https-Herkunft ohne Pfad und Basispfad der Installation (getrennt, damit ein Unterpfad nicht verloren geht). |
| `entryPaths.start` | Einstiegsseite, die zuerst geöffnet wird (Standard `/vorlagen`). |
| `regions` | Gebiete des Katalogs, die dieses Portal liest: `id`, `name`, `kind`, `bodyAssignment` (`whole-instance`: alle Gremien des Portals). Ein Portal eines Verbands führt Unterlagen mehrerer Gemeinden; die Trennung je Gremium ist noch offen. |
| `access` | `transport` (nur `playwright-browser-fetch`), `headless` (Standard false: sichtbar), `oparlStatus` (`unknown`, `disabled_confirmed`, `available`, `blocked`; nie aus einer anderen Instanz übernehmen, `detect` liefert den Befund). |
| `limits` | `delayMs` (≥ 1000), `pageTimeoutMs`, `fetchTimeoutMs`, `maxFileMiB`, `maxRequests`, `maxDurationMs`, `maxDocuments`, `keepBrowserOpenMs`; Standardwerte in `core.mjs` (`LIMITS`). |
| `window` | Zeitraum des Lesers: `1w`, `1m`, `3m`, `12m`, `24m`. |
| `allowedDocumentOrigins` | vorerst nur die eigene Herkunft (der Abruf läuft same-origin in der Seite). |
| `outputDir` | Ausgabeordner, Standard `tmp/browser-import/<instanceId>`. |

Die Übergabe nennt in Abschnitt 5 ein Beispiel; die Werte einer Instanz stehen nur in ihrer eigenen Datei.

## Prüfstand

| Prüfung | Stand |
| --- | --- |
| Hilfsfunktionen (WAF deutsch/englisch, „Loading“, Pfad- und Abfrage-Identität, Basispfad, Dateinamen, PDF-Plausibilität, Konfigurationsgrenzen, OParl-Befund) | `tests/browser-import.test.mjs`, bestanden. |
| Transport (Reihenfolge und Abstand, nur Instanzadressen, WAF einmal neu öffnen, zweite Prüfseite und 401/403/429 halten an, Anfragelimit, Latin-1) | bestanden. |
| Ablauf ohne Browser (Attrappe der Sitzung, SD.NET-Seiten wie in `tests/sdnet.test.mjs`): detect, import, apply in das echte Schema, record, download, Abbruch durch 403 | bestanden. |
| Browsersitzung (`session.mjs`) gegen eine echte Instanz, Live-Abruf von Seiten und PDF | **nicht geprüft**; läuft nur auf dem Rechner des Inhabers mit sichtbarem Browser. |

Offen (Übergabe, Abschnitte 7 und 9): bedingte Folgeabrufe (ETag, Last-Modified), Dateiversionen, Zuordnung je Gremium in Verbandsportalen, Anbindung der heruntergeladenen PDF an die Textverarbeitung (`enrichDocument` nimmt einen eigenen `read`), weitere Adapter hinter derselben Prüfung.
