# Ladezeitkorrektur · 27.09.2026

Ausgangsstand: Website v25 / Anforderungen v0.18. Korrektur: Anforderungen v0.19. Datenbasis: 24.921 kanonische Artikel aus 43 Gebieten; Standardauswahl Billerbeck, Bildung & Betreuung, 01.10.2025–27.09.2026.

## Beobachtung im Betrieb

Ein erfolgreicher Aufruf von `/analysen` benötigte laut Worker-Protokoll 6.123 ms, davon 3.173 ms CPU-Zeit. Mehrere `/mitteilungen`-Aufrufe wurden abgebrochen; der längste nach 51.018 ms bei nur 6 ms CPU-Zeit. Die Abbrüche belegen Wartezeit, aber allein keine konkrete Datenbankstörung. Eine modulglobale noch laufende Initialisierungs-Promise konnte nach einem abgebrochenen Request spätere Requests binden. Dieser Mechanismus wurde entfernt und durch einen Regressionstest abgesichert.

## Gemessene Datenmengen

Lokale Vorher-/Nachher-Messung mit identischen Eingaben. Angegeben sind Bytewerte vor Transportkompression, soweit nicht anders benannt.

| Messgröße | Vorher | Nachher | Reduktion |
|---|---:|---:|---:|
| Analyse-Daten aus SQLite | 21.721.891 B | 11.475.646 B | 47.2 % |
| Daten für Analysefilter | 1.028.820 B | 41.916 B | 95.9 % |
| Daten für Kartenkomponente | 454.828 B | 139.066 B | 69.4 % |
| HTML aus React-SSR | 1.115.573 B | 64.360 B | 94.2 % |
| HTML. separat gzip-komprimiert | 253.008 B | 11.532 B | 95.4 % |

Die reine lokale Auswertungsberechnung benötigte im protokollierten Lauf rund 223 ms vorher und 62 ms nachher. Die lokale SQLite-Projektion benötigte rund 185 ms bzw. 264 ms: Die zusätzliche Prüfung bestehender Labels verschiebt etwas Arbeit in SQL, reduziert aber den Datentransport und die nachfolgende Verarbeitung. Dies sind einzelne Vergleichsläufe, keine statistischen Perzentile oder gemessene Nutzerladezeiten.

## Umsetzung

- Filter und Karte erhalten eigene, begrenzte Datenobjekte statt mehrfach vollständiger Analyseantworten.
- Treffer und lokale Artikellisten werden beim Öffnen mit höchstens 30 Einträgen nachgeladen; geänderte Listenstände werden erkannt. Alle Einträge und Originalverweise bleiben erreichbar.
- Die Karte und ihre Geometrien werden erst nahe dem sichtbaren Bereich geladen; Fehler bleiben auf den Kartenbereich begrenzt.
- Wiederverwendete Labels müssen zur aktuellen Regel-/Katalogversion und exakt zum Originaltitel passen. Sonst erfolgt eine neue Klassifikation.
- Ein Cache hält ausschließlich fertige öffentliche Ergebnisse für höchstens 30 Sekunden und maximal drei Auswahlen. Laufende I/O-Promises werden nicht übernommen; Backend-Importe invalidieren gespeicherte Ergebnisse.
- Der neue partielle SQLite-Index wird nach `EXPLAIN QUERY PLAN` für Gebietsanzahlen und Entscheidungsfilter verwendet. Die Vorschau überträgt höchstens zwei unterschiedliche anstehende Sitzungen.
- Die Bereitschaft der Datenbankinitialisierung wird gemeinsam über vier Versionsmarker geprüft. Offene Initialisierungsanfragen werden nicht zwischen Requests geteilt; ein atomarer Initialimport-Lock verhindert konkurrierende Schreiber.

## Nachweise und Grenzen

Der vollständige Vergleich der alten und neuen Analyseergebnisse ist identisch, einschließlich Verteilungen, Monatsmix, Geografie, Vergleichen und aller Treffer. Der Initialimport bleibt idempotent. Regressionstests prüfen Label-Wiederverwendung, begrenzte Client-Daten, Vollständigkeit der nachgeladenen Listen, Cache-Ablauf und -Invalidierung, Anfragen nach einer festhängenden Initialisierung sowie die begrenzte Sitzungsvorschau.

HTML-Messungen stammen aus `renderToStaticMarkup` mit echten Komponenten. Sie enthalten nicht den zusätzlichen RSC-Datenstrom oder die vollständigen JavaScript-Dateien. Die Größen der separat übergebenen Client-Daten sind deshalb zusätzlich ausgewiesen und dürfen nicht zur HTML-Größe addiert und als vollständiger Netzwerktransfer ausgegeben werden. Die Datenmenge der Erstansicht sinkt; beim Scrollen oder Öffnen von Listen werden weiterhin benötigte Daten nachgeladen. Es wurden keine Artikel gelöscht und keine historischen Auswertungszeiträume verkürzt. Eine Endgeräte- und Produktionsmessung nach der Veröffentlichung steht noch aus.
