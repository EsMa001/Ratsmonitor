# Entwurf: Freigabe der OParl-Schnittstellen der Berliner Bezirksverordnetenversammlungen

Stand 05.10.2026. Entwurf zur Anpassung und zum Versand durch den Projektinhaber. Platzhalter in spitzen Klammern. Adressen und Ansprechpersonen sind vor dem Versand zu prüfen; sie waren aus der Entwicklungsumgebung nicht abrufbar.

## Adressaten

1. **IT-Dienstleistungszentrum Berlin (ITDZ)** als Betreiber der Systeme der Bezirksverordnetenversammlungen (laut Recherche; vor dem Versand bestätigen).
2. **Senatskanzlei Berlin, Bereich Digitalisierung/Open Data**: Sie verantwortet daten.berlin.de, wo die Schnittstellen veröffentlicht sind.
3. **Open Data Informationsstelle Berlin (ODIS)**: zur Unterstützung; sie hat die BVV-Daten 2021 vorgestellt.
4. In Kopie die **Büros der zwölf Bezirksverordnetenversammlungen**, falls ITDZ oder Senatskanzlei auf die Bezirke verweisen.

## Text

**Betreff:** Freigabe der veröffentlichten OParl-Schnittstellen der Bezirksverordnetenversammlungen für Ratsmonitor

Sehr geehrte Damen und Herren,

wir betreiben Ratsmonitor, ein <gemeinnütziges/privates> Projekt, das öffentliche Vorgänge aus Gemeinderäten, Kreistagen und Bezirksvertretungen in ganz Deutschland verständlich zusammenfasst und nach Orten durchsuchbar macht. Heute lesen wir die öffentlichen Unterlagen von rund 2.100 Städten, Gemeinden, Gemeindeverbänden und Kreisen. Berlin fehlt bislang ganz.

Die Bezirke veröffentlichen die OParl-Schnittstellen ihrer Bezirksverordnetenversammlungen dankenswerterweise als offene Daten auf daten.berlin.de („Schnittstelle zum Informationssystem der BVV …“). Dieselben Rechner untersagen Programmen den Abruf jedoch per robots.txt und antworten mit HTTP 403. Wir halten uns an robots.txt und umgehen keine Zugriffssperren. Deshalb können wir die veröffentlichten Schnittstellen derzeit nicht nutzen.

Wir bitten um eine der folgenden Freigaben:

- **Variante A (bevorzugt):** eine Ausnahme in robots.txt für die OParl-Pfade und unsere Kennung, etwa
  ```
  User-agent: vorort-politicaltopics
  Allow: <OParl-Pfad, z. B. /oparl/>
  ```
  und die Zulassung dieser Kennung in der vorgeschalteten Zugriffssperre.
- **Variante B:** eine schriftliche Erlaubnis, die OParl-Schnittstellen mit unserer Kennung abzurufen, mit Angabe des Umfangs (alle Bezirke oder einzelne).

Zur Begründung der Sperre wird der Schutz der Systeme vor Überlast genannt (Schriftliche Anfrage 19/26786). Unser Abruf ist darauf ausgelegt:

- **Kennung:** Jede Anfrage nennt sich `VorOrt-PoliticalTopics/0.5 (public council documents)`. In robots.txt sind wir unter `vorort-politicaltopics` ansprechbar.
- **Last:** höchstens ein Import je Bezirk zur selben Zeit, darin höchstens fünf gleichzeitige Anfragen; keine Wiederholung nach HTTP 403, nach einer Überlastmeldung (HTTP 429, 503) höchstens ein weiterer Versuch nach einer Pause. Folgeimporte fragen bereits gelesene, unveränderte Sitzungen nicht erneut ab. Zeitfenster und Höchstzahl der Anfragen richten wir gern nach Ihren Vorgaben aus.
- **Umfang:** nur die OParl-Schnittstelle, nur öffentliche Sitzungen, Tagesordnungspunkte und Drucksachen. Keine Webseiten des Informationssystems, keine Formulare, keine Suche, keine nichtöffentlichen Teile, keine Personendaten über die öffentliche Funktion hinaus.
- **Quellenangabe:** Jeder Vorgang verlinkt das Original im Informationssystem des Bezirks.

Eine Freigabe tragen wir mit Stelle, Datum und Umfang in unseren Quellenkatalog ein. Ohne diesen Eintrag ruft unser Programm nichts ab. Für Rückfragen und eine Abstimmung über Zeitfenster oder Abrufhäufigkeit stehen wir gern zur Verfügung.

Mit freundlichen Grüßen
<Name>
<Projekt, Anschrift, E-Mail, Telefon>
<Projektseite>

## Nach einer Zusage

1. Variante A: `node scripts/source-discovery/stadtstaaten.mjs berlin` ausführen. Das Skript liest die OParl-Adressen von daten.berlin.de, prüft robots.txt je Bezirk und schaltet Berlin ein, sobald ein Bezirk lesbar ist.
2. Variante B: In `server/integrations/citystate-sources.json` beim Eintrag `de-11000000` das Feld `consent` ausfüllen, z. B. `{"by": "ITDZ Berlin, <Stelle>", "date": "2026-11-01", "scope": "OParl-Schnittstellen aller zwölf BVV", "source": "<Aktenzeichen oder Ablage der Zusage>"}`. Danach das Skript wie in Schritt 1 ausführen.
3. Danach `node scripts/source-discovery/servers.mjs`, `ONLY_NEW=1 node scripts/source-discovery/robots.mjs`, `node scripts/dashboard/build.mjs` und die Tests.

Quellen der Recherche: [requirements/laender-recherche/ni_nw_stadt.md](laender-recherche/ni_nw_stadt.md) (Abschnitt Berlin), daten.berlin.de-Datensätze, z. B. https://daten.berlin.de/datensaetze/schnittstelle-zum-informationssystem-der-bvv-pankow-von-berlin.
