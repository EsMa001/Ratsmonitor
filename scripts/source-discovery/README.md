# Quellensuche für den Quellenkatalog

Findet für jedes nicht angebundene Gebiet das Ratsinformationssystem, prüft es mit den echten Abrufprogrammen und schreibt bestätigte Quellen in `server/integrations/statewide-sources.json`. Kein Schritt schreibt in die Datenbank. Arbeitsdateien liegen in `tmp/source-discovery/` (nicht im Repository).

## Ablauf

```
node scripts/source-discovery/wikidata.mjs   # offizielle Websites je amtlichem Schlüssel (Wikidata)
node scripts/source-discovery/crawl.mjs      # Links zum Ratsinformationssystem auf den offiziellen Websites
node scripts/source-discovery/verify.mjs     # Systemart bestimmen, mit den Abrufprogrammen prüfen (3 Monate)
node scripts/source-discovery/build.mjs      # Katalogdatei und requirements/statewide-sources-report.md schreiben
node --test tests/*.test.mjs
```

Optional vor `build.mjs`: `guess.mjs` probiert für weiterhin offene Gebiete die üblichen Adressen (`ratsinfo.<domain>`, `sessionnet.owl-it.de/<name>/bi/` usw.). Die Treffer werden getrennt geprüft:

```
node scripts/source-discovery/guess.mjs
CANDIDATES=candidates-guessed.json OUT=verified-guessed.json node scripts/source-discovery/verify.mjs <id,id,…>
```

Alle Schritte lassen sich mit einer kommagetrennten Liste von Gebiets-IDs auf einzelne Gebiete beschränken. `crawl.mjs`, `guess.mjs` und `verify.mjs` setzen einen abgebrochenen Lauf fort.

## Regeln

- **Nachweis statt Vermutung.** Eine Quelle wird nur übernommen, wenn das Abrufprogramm öffentliche Tagesordnungspunkte aus ihr liefert.
- **Zuordnung.** Der Link stammt von der offiziellen Website des Gebiets (Wikidata, Eigenschaft P856 zum amtlichen Schlüssel). Zusätzlich muss das System das Gebiet nennen: im Namen der OParl-Körperschaft, im amtlichen Schlüssel, in der Adresse oder im Seitentext. Eine Kreisseite gilt nie als Quelle einer Stadt. Geratene Adressen auf fremden Servern zählen nur mit Rückverweis auf die offizielle Website oder passendem amtlichem Schlüssel.
- **Gemeinsame Systeme.** Teilen sich mehrere Gebiete ein OParl-System, steht die Körperschaft fest im Katalogeintrag (`body`). Hat ein verlinktes System genau eine Körperschaft mit abweichendem Namen, wird diese fest zugeordnet und im Eintrag vermerkt.
- **Reihenfolge.** Offizielle OParl-Schnittstelle vor der Kalender-API von More! Rubin vor öffentlichen SessionNet- oder SD.NET-Seiten. Die Seiten werden nicht gelesen, wenn der Hersteller-Endpunkt für OParl antwortet; das Abrufprogramm prüft das bei jedem Abruf erneut.
- **Keine Umgehung.** Antwortet eine Seite mit HTTP 403 oder einer Zugriffsprüfung, wird nur die offizielle OParl-Adresse gefragt. Es gibt keine erneuten Versuche und keine Browser-Kennung. Die Skripte nennen sich im `User-Agent` selbst.
- **Bestand bleibt.** `build.mjs` löscht keine Einträge. Einträge mit fest zugeordneter Körperschaft werden nicht überschrieben.

## Korrekturen am OParl-Verzeichnis

`nrw-sources.json` entsteht aus dem OParl-Verzeichnis (`scripts/build-nrw.py`). Geänderte Adressen und abgeschaltete Quellen stehen in `server/integrations/source-overrides.json`; `node scripts/apply-source-overrides.mjs` überträgt sie. `"method": "pending"` schaltet eine Quelle ab: Sie wird nicht mehr abgerufen und im Adminbereich als nicht angebunden gezeigt.

## Andere Gebietslisten

`crawl.mjs` und `verify.mjs` arbeiten ohne weitere Angaben auf den NRW-Gebieten in `tmp/source-discovery/`. Für die Stichprobe der Hochrechnung (siehe `scripts/estimate/README.md`) lassen sie sich umstellen:

- `DIR=tmp/sample/` – Arbeitsordner für Eingaben und Ergebnisse
- `AREAS=tmp/sample/areas.json` – Gebietsliste statt `shared/nrw-regions.json`
- `CANDIDATES=…` und `OUT=…` – abweichende Dateinamen für die Kandidaten und das Prüfergebnis (nur `verify.mjs`)
- `TRUST_LINK=1` – der Verweis von der offiziellen Website genügt als Zuordnung, wenn das System den Gebietsnamen nicht nennt (für Gemeindeverbände, die über eine Mitgliedsgemeinde gefunden wurden). Seiten, die erkennbar zu einem Kreis gehören, werden weiterhin keiner Stadt zugeordnet. Für den Katalog des Betriebs wird diese Einstellung nicht verwendet.
