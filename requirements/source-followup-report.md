# Nachprüfung der sieben Quellen mit Datenlücken

Stand: 27.09.2026. Vergleich des versionierten Bestands vor und nach dem gezielten Folgeimport. Keine Live-Datenbankmessung; keine Vollständigkeitszusage.

Vorher: Revision 5f74c5f840137a66, Quellcode ae96fbb0d936c6ede63d5d944b4ece6917893536. Nachher: Revision e20c38018e3addf1.

**127 zusätzliche kanonische Artikel; neuer Gesamtbestand 24.921.** Die Zahl datenführender Gebiete bleibt bei 43 (39 Kommunen, vier Kreise).

| Gebiet | Vorher | Nachher | Veränderung | Verbleibende Hinweise |
| --- | ---: | ---: | ---: | --- |
| Stadt Rheine | 894 | 894 | +0 | 14; Teilstand |
| Gemeinde Everswinkel | 203 | 203 | +0 | 2; Teilstand |
| Stadt Sassenberg | 405 | 405 | +0 | 1; Teilstand |
| Stadt Waltrop | 291 | 292 | +1 | Keine gemeldet |
| Stadt Ennigerloh | 617 | 617 | +0 | 1; Teilstand |
| Gemeinde Beelen | 216 | 216 | +0 | 2; Teilstand |
| Stadt Ochtrup | 363 | 489 | +126 | 4; Teilstand |

## Behobene Ursachen

Der öffentliche SessionNet-Einstieg leitet einige Sitzungstermine von der Tagesordnung auf eine Informationsseite um. Diese Weiterleitungen werden jetzt innerhalb des freigegebenen HTTPS-Hosts und Portalpfads geprüft und bis zu drei Mal verfolgt. Alle Schritte teilen sich ein Zeitbudget. Fremde Hosts, Anmeldedaten in URLs, andere Pfade, HTTP-Downgrades und Schleifen werden abgewiesen. Eine Zugangssperre wird weiterhin nicht umgangen.

Wenn das Portal erklärt, dass Sitzungsdetails noch nicht freigegeben sind, lautet der Quellenhinweis entsprechend. Solche Termine bleiben eine Datenlücke. Es werden weder Artikel erfunden noch fehlende Tagesordnungen als leere, vollständige Sitzungen gewertet.

Der OParl-Import erhält einen bereits eindeutig öffentlichen Tagesordnungspunkt auch dann, wenn seine Vorlagenverknüpfung nicht abgerufen werden konnte. Verfügbar bleiben Originaltitel, Sitzung, veröffentlichter Ergebnistext und tatsächlich erreichbare Dokumentverweise. Fehlende Vorlageninhalte werden nicht ergänzt. Die Zuordnung bleibt offen und der Quellenstand unvollständig. Sobald die amtliche Beziehung später eingelesen wird, führt die vorhandene Identitätslogik die Einträge zusammen und erhält alte Artikellinks.

## Grenzen

Ochtrups Listenlimit bleibt sichtbar. Nicht freigegebene Sitzungsdetails und weiterhin fehlerhafte Portalantworten können durch diesen Import nicht ersetzt werden. Dropdowns zeigen weiterhin tatsächliche Artikelzahlen und Teilstände. Die neuen Datensätze erhalten Regelklassifikationen; es wurden keine neuen KI-Labels oder KI-Zusammenfassungen erstellt. Der regelmäßige Hintergrundimport bleibt unaktiviert.

## Hinweise je Quelle

### Stadt Rheine

- Sitzungsdetails noch nicht öffentlich freigegeben: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7448
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7634
- Sitzungsdetails noch nicht öffentlich freigegeben: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7631
- Sitzungsdetails noch nicht öffentlich freigegeben: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7521
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7527
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7520
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7483
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7455
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7451
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7433
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7378
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7230
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7074
- Keine lesbare öffentliche Tagesordnung: https://www.rheine-buergerinfo.de/si0057.asp?__ksinr=7284

### Gemeinde Everswinkel

- Keine lesbare öffentliche Tagesordnung: https://sessionnet.owl-it.de/everswinkel/bi/si0057.asp?__ksinr=861
- Keine lesbare öffentliche Tagesordnung: https://sessionnet.owl-it.de/everswinkel/bi/si0057.asp?__ksinr=845

### Stadt Sassenberg

- Keine lesbare öffentliche Tagesordnung: https://session.sassenberg.de/sessionnet/bi/si0057.php?__ksinr=913

### Stadt Waltrop

Keine technischen Probleme im letzten Abruf gemeldet.

### Stadt Ennigerloh

- Sitzungsdetails noch nicht öffentlich freigegeben: https://sessionnet.owl-it.de/ennigerloh/bi/si0057.asp?__ksinr=3612

### Gemeinde Beelen

- Keine lesbare öffentliche Tagesordnung: https://sessionnet.owl-it.de/beelen/bi/si0057.asp?__ksinr=2350
- Keine lesbare öffentliche Tagesordnung: https://sessionnet.owl-it.de/beelen/bi/si0057.asp?__ksinr=2337

### Stadt Ochtrup

- Listenlimit erreicht; Quelle noch nicht vollständig eingelesen.
- Verknüpfung: The operation was aborted due to timeout
- Verknüpfung: Zeitbudget der Quelle erreicht
- Nicht aufgelöste Vorlagenverknüpfungen: mehrere Tagesordnungspunkte derselben Vorlage können getrennt erfasst sein. Die Vorgangszählung ist deshalb ein vorläufiger Teilstand.

Reproduzieren: `node scripts/report-source-followup.mjs`. Ausgangszahlen und frühere Hinweise: `requirements/import-followup-baseline.json`.
