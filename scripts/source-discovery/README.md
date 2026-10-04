# Quellensuche für den Quellenkatalog

Findet für jedes nicht angebundene Gebiet das Ratsinformationssystem, prüft es mit den echten Abrufprogrammen und schreibt bestätigte Quellen in `server/integrations/statewide-sources.json`. Kein Schritt schreibt in die Datenbank. Arbeitsdateien liegen in `tmp/source-discovery/` (nicht im Repository).

## Ablauf

```
node scripts/source-discovery/wikidata.mjs   # offizielle Websites je amtlichem Schlüssel (Wikidata)
node scripts/source-discovery/crawl.mjs      # Links zum Ratsinformationssystem auf den offiziellen Websites
node scripts/source-discovery/verify.mjs     # Systemart bestimmen, mit den Abrufprogrammen prüfen (3 Monate)
node scripts/source-discovery/build.mjs      # Katalogdatei und requirements/statewide-sources-report.md schreiben
node scripts/source-discovery/servers.mjs    # Adressen der Quellenrechner festhalten (Abrufplaner: höchstens zwei je Server)
node scripts/source-discovery/robots.mjs     # je Quelle festhalten, ob robots.txt den gelesenen Pfad erlaubt
node --test tests/*.test.mjs
```

`robots.mjs` fragt je Rechner einmal `/robots.txt` (Kennung des Abrufs, höchstens zwei gleichzeitig und höchstens eine Anfrage je Sekunde je Server) und schreibt das Urteil je Quelle nach `server/integrations/source-robots.json`: `erlaubt`, `verboten`, `keine` (keine robots.txt) oder `unklar` (keine Antwort; ein früheres Urteil bleibt dann stehen). `ONLY_NEW=1` fragt nur die Rechner von Quellen ohne Urteil, etwa nach einem `build.mjs`, das Quellen ergänzt hat. Regeln nach RFC 9309 in `server/integrations/robots.mjs`. Das Urteil wird festgehalten, aber noch nirgends angewendet; siehe README des Projekts, „robots.txt“.

Optional vor `build.mjs`: `guess.mjs` probiert für weiterhin offene Gebiete die üblichen Adressen (`ratsinfo.<domain>`, `sessionnet.owl-it.de/<name>/bi/` usw.). Die Treffer werden getrennt geprüft:

```
node scripts/source-discovery/guess.mjs
CANDIDATES=candidates-guessed.json OUT=verified-guessed.json node scripts/source-discovery/verify.mjs <id,id,…>
```

Mit `OWN_ONLY=1` fragt `guess.mjs` nur die eigene Domain des Gebiets (für Läufe über viele Gebiete, etwa alle Länder außer NRW): Die geteilten Rechner (owl-it, gremien.info, ratsinfomanagement.net, sitzung-online.de) bekämen sonst Tausende Anfragen, und mehrere von ihnen untersagen Programmen den Abruf per robots.txt. Antwortet ein typischer SessionNet-Rechnername (`ratsinfo.`, `buergerinfo.`, `sessionnet.`, `session.`, `sitzungsdienst.`) ohne System an der Wurzel, wird auch `bi/` dort gefragt.

`oparl-register.mjs` sucht offizielle OParl-Adressen, die ohne Link auf der Website bekannt sind: das Verzeichnis des OParl-Projekts (`endpoints.yml` in github.com/OParl/resources; Zuordnung nur über die amtlichen Schlüssel des Wikidata-Eintrags) und die OParl-Adresse von ekom21-Mandanten (`rim.ekom21.de/<mandant>/webservice/oparl/v1.1/system`), deren Seiten eine Web-Firewall für Programme sperrt. Adressen, deren robots.txt den Abruf untersagt, werden ausgelassen. `verify.mjs` fragt bei diesen Kandidaten nur die Schnittstelle selbst:

```
node scripts/source-discovery/oparl-register.mjs
CANDIDATES=candidates-oparl.json OUT=verified-oparl.json node scripts/source-discovery/verify.mjs
```

`build.mjs` übernimmt `verified-guessed.json`, `verified-guessed-own.json`, `verified-oparl.json`, `verified-search.json` und `verified-fix.json` von selbst. Außerdem schreibt es die offenen Gebiete mit Grund nach `<DIR>open.json`, als Arbeitsliste für weitere Schritte.

**Weitere Leser** (`server/integrations/readers.mjs`): ALLRIS 3, KIC-RIS (öffentliche Gast-Schnittstelle der React-App), TI-Generator, SessionNet 6 (öffentliche JSON-Schnittstelle), cron Ratsinfo für TYPO3, RIS München, PIWi Wiesbaden und PIO Offenbach. Jeder Leser hat eine Erkennung (`detect`), die aus Adresse und Seite die Felder des Katalogeintrags bildet; `verify.mjs` probiert sie als sechsten Schritt nach OParl, More! Rubin, SessionNet, SD.NET und ALLRIS 4, `collect-region.mjs` liest die Quellen damit.

**Kandidaten ohne Link der Website** (`candidates-search.json`): Adressen aus einer Websuche oder aus der Diagnose einzelner Gebiete. Sie tragen `guessed:'Websuche'`, wenn kein Link der offiziellen Website sie belegt; dann muss das System das Gebiet selbst nennen, und eine OParl-Körperschaft wird nicht allein deshalb zugeordnet, weil sie die einzige ist. Ein Kandidat mit `reader` wird direkt von diesem Leser geprüft (RIS München: die Anwendung antwortet auf Seitenabrufe mit Sitzungsadressen, die ihre robots.txt untersagt; der Leser hält die Sitzung als Cookie). `build.mjs` setzt bei solchen Quellen die Systemadresse als `verifiedSource` und vermerkt `foundBy`.

**Viele Gebiete erneut prüfen**: `ONLY_FILE=<datei mit einer ID je Zeile>` für `crawl.mjs` und `verify.mjs` (eine Liste mit Tausenden IDs passt nicht in die Befehlszeile). Ergebnisse tragen einen Zeitstempel (`searchedAt`, `checkedAt`), damit ein Wächter nach einem Absturz die schon bearbeiteten Gebiete auslässt (`tmp/source-discovery-de/recrawl.ps1`, `rerun.ps1`).

Alle Schritte lassen sich mit einer kommagetrennten Liste von Gebiets-IDs auf einzelne Gebiete beschränken. `crawl.mjs`, `guess.mjs` und `verify.mjs` setzen einen abgebrochenen Lauf fort.

## Regeln

- **Nachweis statt Vermutung.** Eine Quelle wird nur übernommen, wenn das Abrufprogramm öffentliche Tagesordnungspunkte aus ihr liefert.
- **Zuordnung.** Der Link stammt von der offiziellen Website des Gebiets (Wikidata, Eigenschaft P856 zum amtlichen Schlüssel). Zusätzlich muss das System das Gebiet nennen: im Namen der OParl-Körperschaft, im amtlichen Schlüssel, in der Adresse oder im Seitentext. Eine Kreisseite gilt nie als Quelle einer Stadt. Geratene Adressen auf fremden Servern zählen nur mit Rückverweis auf die offizielle Website oder passendem amtlichem Schlüssel.
- **Gemeinsame Systeme.** Teilen sich mehrere Gebiete ein OParl-System, steht die Körperschaft fest im Katalogeintrag (`body`). Hat ein verlinktes System genau eine Körperschaft mit abweichendem Namen, wird diese fest zugeordnet und im Eintrag vermerkt.
- **Reihenfolge.** Offizielle OParl-Schnittstelle vor der Kalender-API von More! Rubin vor öffentlichen SessionNet-, SD.NET- oder ALLRIS-4-Seiten. Die Seiten werden nicht gelesen, wenn der Hersteller-Endpunkt für OParl antwortet; das Abrufprogramm prüft das bei jedem Abruf erneut.
- **Nebenan fragen statt raten.** Zeigt eine verlinkte Seite selbst keine Systemadresse (Weiterleitung per Skript, Rahmen, System an der Wurzel des Rechners), fragt die Prüfung die übliche Einstiegsseite `si0040` daneben, unter `/bi/` und an der Wurzel. Führt ein Link in den Anmeldebereich von SessionNet (`gi/`, `ri/`), wird der öffentliche Bereich `bi/` daneben geprüft. Ein mit `http://` angegebener Link wird auch über `https://` gefragt. SD.NET auf einer eigenen Adresse wird an seiner Vorlagenliste erkannt.
- **Keine Umgehung.** Antwortet eine Seite mit HTTP 403 oder einer Zugriffsprüfung, wird nur die offizielle OParl-Adresse gefragt. Es gibt keine erneuten Versuche und keine Browser-Kennung. Die Skripte nennen sich im `User-Agent` selbst. Zeigt ein ALLRIS-System die Zugriffsprüfung des Herstellers („Zugriff pruefen“) oder meldet es „Zu viele Zugriffe“, endet seine Prüfung sofort; der Bericht nennt das als Grund.
- **ALLRIS behutsam prüfen.** Bei `sitzung-online.de` betriebene Systeme sperren ein Netzwerk vorübergehend, wenn kurz nacheinander mehrere Anfragen ohne Sitzungs-Cookie kommen. Der Leser hält deshalb eine Sitzung je Abruf. Für die Prüfung heißt das: je Gebiet nur eine Adresse in die Kandidatenliste, keine wiederholten Läufe im Minutenabstand, und nach einer Sperre erst am nächsten Tag erneut prüfen. ALLRIS 4 wird an seinem Seitenordner erkannt (meist `/public/`, sonst der Ordner, den die offizielle Website verlinkt); Adressen auf `.asp` gehören zu ALLRIS 3, für das es keinen Leser gibt.
- **robots.txt.** Vor der ersten Seite eines Rechners liest `verify.mjs` dessen robots.txt (einmal je Rechner). Untersagt sie unseren Programmen den Pfad, wird er nicht gefragt; der Bericht nennt das als Grund. Das gilt auch für jede Weiterleitung (sie wird von Hand verfolgt), für die vom Hersteller üblichen OParl-Pfade und für die Adresse, die ein Leser am Ende liest.
- **Linksuche.** Ein Treffer nur über den Linktext („Ratssitzungen“, „Bürgerinfo“) beendet die Suche auf einer Website nicht mehr; erst ein Link, dessen Adresse ein Ratsinformationssystem erkennen lässt. Broschüren, Magazine, Formulare, Livestreams, Teilen-Links, App-Stores, Kartendienste und Herstellerseiten sind keine Kandidaten. In die Website eingebettetes ALLRIS 4 (`/allris/`, `…/si010`) wird erkannt.
- **SessionNet.** Ein Meta-Refresh der Startseite (`default.asp`) wird einmal verfolgt; als SessionNet gilt nur eine Seite mit dem Kennzeichen des Produkts (`sessionNetLandmark`), nicht eine CMS-Seite, die nur „si0040“ in ihrer Adresse wiederholt. Nennt die Startseite das Gebiet nicht, entscheidet die Infoseite des Systems; die Mandantenliste eines geteilten Systems zählt dabei nicht.
- **More! Rubin.** Die Körperschaftsliste (`organizations/bodies`) nennt das Gebiet auch dann, wenn Adresse und Startseite es nicht tun (`vgtt.gremien.info`); das zählt nur bei einem Link der offiziellen Website. Bei geteilten Systemen liest der Leser nur die Körperschaften des Gebiets (`bodies` im Katalogeintrag); ist die Liste nicht lesbar, wird nichts übernommen. `IGNORE_ROBOTS=1` schaltet die Prüfung ab. Seit dem 04.10.2026; ältere Prüfungen haben robots.txt nicht beachtet, siehe `robots.mjs` und README des Projekts.
- **Bestand bleibt.** `build.mjs` löscht keine Einträge. Einträge mit fest zugeordneter Körperschaft werden nicht überschrieben. Ausnahmen: Demo-Mandanten und doppelt vergebene Adressen (siehe unten).
- **Landkreise über ihre Gremien.** Nennen Adresse und Startseite weder den Kreis noch seinen Kreistag (etwa `muenchen.gremien.info` für den Landkreis München), entscheiden die gelesenen Sitzungen: Gremien wie Kreistag oder Kreisausschuss belegen das System des Kreises, die Gremien einer Stadt nicht. Gilt nur für Links von der offiziellen Website des Kreises.
- **Anmeldebereich.** Eine Adresse, die bei SessionNet auf die Anmeldung (`ylogon`) führt, ist der Bereich der Mandatsträger. Geprüft wird der öffentliche Teil daneben: `bi/` statt `gi/` oder `ri/`, `buergerinfo` statt `ratsinfo` (Ordner oder Rechnername), `sessionnetbi` statt `sessionnetri`.
- **Mitbenutzte Systeme.** Nennt der Teil der Adresse, der den Betreiber benennt (der erste Ordner bei Systemen mit einem Ordner je Gemeinde, sonst der Rechnername), eine andere Gemeinde und nicht die eigene, gehört das System dieser anderen Gemeinde oder ihrem Verband (`…/altshausen/bi/` für Fleischwangen). Die Leser können die Gremien eines gemeinsamen Systems nicht trennen; die mitbenutzende Gemeinde wird nicht angebunden, und das System zählt für alle Beteiligten als doppelt vergeben (`areas.mjs`, `foreignOwner`).
- **Doppelt vergebene Adressen** werden auch über die Dateien der Länder hinweg erkannt; geändert wird nur die Zieldatei.
- **Demo-Mandanten.** Eine Körperschaft wie „Stadt Musterstadt“ ist nie die Quelle eines Gebiets, auch nicht in einem früher geschriebenen Eintrag.
- **Namenszusätze.** „Dillingen a.d.Donau“, „Neumarkt i.d.OPf.“ oder „Neustadt in Sachsen“ werden auch ohne Zusatz erkannt. Links auf Vorlese- und Teilen-Dienste (readspeaker, WhatsApp …) sind keine Kandidaten.

## Korrekturen am OParl-Verzeichnis

`nrw-sources.json` entsteht aus dem OParl-Verzeichnis (`scripts/build-nrw.py`). Geänderte Adressen und abgeschaltete Quellen stehen in `server/integrations/source-overrides.json`; `node scripts/apply-source-overrides.mjs` überträgt sie. `"method": "pending"` schaltet eine Quelle ab: Sie wird nicht mehr abgerufen und im Adminbereich als nicht angebunden gezeigt.

## Niedersachsen

Der Gebietskatalog entsteht mit `node scripts/build-nds.mjs` (Gemeinden auf Verwaltungsebene: Einheits- und Samtgemeinden, kreisfreie Städte, Landkreise). Die Quellensuche läuft mit eigenem Arbeitsordner und schreibt nach `server/integrations/nds-sources.json`:

```
export LAND=03 DIR=tmp/source-discovery-nds/ AREAS=shared/nds-regions.json
node scripts/source-discovery/wikidata.mjs
node scripts/source-discovery/crawl.mjs
node scripts/source-discovery/verify.mjs
TARGET=server/integrations/nds-sources.json REPORT=requirements/nds-sources-report.md TITLE="Quellen für Niedersachsen" node scripts/source-discovery/build.mjs
```

Samtgemeinden werden über ihren 9-stelligen Regionalschlüssel gefunden (Wikidata P1388). Das System einer Samtgemeinde führt meist auch die Räte ihrer Mitgliedsgemeinden; alle Vorgänge zählen zum Gebiet der Samtgemeinde.

## Übrige Länder

Der Gebietskatalog der 14 Länder außer NRW und Niedersachsen entsteht mit `node scripts/build-de.mjs` (`shared/de-regions.json`). `LAND` wählt die Gebiete aus dem Katalog: `de` für alle 14 Länder, ein Länderschlüssel (`09`) oder mehrere (`01,13`). Die Suche schreibt nach `server/integrations/de-sources.json`:

```
export LAND=de DIR=tmp/source-discovery-de/
node scripts/source-discovery/wikidata.mjs   # eine Abfrage je Land
node scripts/source-discovery/crawl.mjs
node scripts/source-discovery/verify.mjs
TARGET=server/integrations/de-sources.json REPORT=requirements/de-sources-report.md TITLE="Quellen für die übrigen Länder" node scripts/source-discovery/build.mjs
node scripts/source-discovery/servers.mjs
```

- Ein Land nach dem anderen ist möglich (`LAND=09`), nötig ist es nicht: Die Begrenzung gilt je Server, und die großen Betreiber arbeiten bundesweit. `build.mjs` behält vorhandene Einträge; ein späterer Lauf über weitere Länder ergänzt die Datei.
- Die Prüfung hält höchstens zwei Anfragen gleichzeitig je Server (Domain des Betreibers und IP-Adresse), wie der Abruf. Der Lauf über 4.455 Gebiete am 04.10.2026 brauchte rund 45 Minuten (Linksuche 20, Prüfung 25).
- Ist die Suche für ein Land abgeschlossen, gehört es in `LANDS` (`shared/lands.mjs`): Erst dann wertet die Hochrechnung dort den Katalog aus statt der Stichprobe. Seit dem 04.10.2026 sind das alle Länder außer Berlin und Hamburg.
- Berlin und Hamburg sind je ein Gebiet und werden nicht durchsucht (`skipReason` in `areas.mjs`): Ein von der Stadt verlinktes System gehört einer Bezirksversammlung, nicht der ganzen Stadt. Beide nutzen dort ALLRIS 3, für das es keinen Leser gibt.
- Lange Läufe stürzen auf manchen Rechnern ohne Meldung ab. `crawl.mjs` und `verify.mjs` setzen fort; ein Wächter wie `tmp/source-discovery-de/run.ps1` startet sie neu. Nie zwei `verify.mjs` gleichzeitig: Beide schreiben `verified.json`.
- Eine einzelne Liste nachprüfen: `node scripts/source-discovery/verify.mjs <id,id,…>` (prüft auch bereits geprüfte Gebiete erneut).
- **Plattform-Adressen raten** (`guess-platforms.mjs`): komm.one (`<name>-sitzungsdienst.komm.one`) und KISA (`ris-<name>.zv-kisa.de`) beantworten DNS nur für vorhandene Mandanten; die Suche kommt deshalb ohne Last auf den Plattformen aus. Beide Systeme verlinken die Website der Gemeinde nicht. Eine geratene Adresse wird nur Kandidat, wenn der Name im Land eindeutig ist; `verify.mjs` muss dann wie immer den Gebietsnamen im System finden und öffentliche Tagesordnungspunkte lesen. Aufruf: `LAND=de DIR=… node scripts/source-discovery/guess-platforms.mjs`, danach `CANDIDATES=candidates-guessed.json OUT=verified-guessed.json` für `verify.mjs`; `build.mjs` übernimmt `verified-guessed.json` von selbst.
- **Rücksicht auf Plattformen.** Nach rund einer Stunde Such- und Prüfverkehr nahm komm.one am 04.10.2026 keine Verbindungen von unserem Netzwerk mehr an; drei Stunden später antwortete `www.komm.one` wieder, die Mandantenrechner (`…-sitzungsdienst.komm.one`) noch nicht. 36 geratene komm.one-Adressen sind deshalb noch ungeprüft (`tmp/source-discovery-de/kommone-ids.txt`), ebenso die robots.txt der 158 komm.one-Quellen. Vor einem neuen Lauf einen Mandantenrechner einmal fragen. Wiederholte Läufe gegen dieselbe Plattform zeitlich strecken; `tmp/source-discovery-de/verify-paced.ps1` prüft eine ID-Liste paarweise mit Pause.

## Andere Gebietslisten

`crawl.mjs` und `verify.mjs` arbeiten ohne weitere Angaben auf den NRW-Gebieten in `tmp/source-discovery/`. Für die Stichprobe der Hochrechnung (siehe `scripts/estimate/README.md`) lassen sie sich umstellen:

- `DIR=tmp/sample/` – Arbeitsordner für Eingaben und Ergebnisse
- `AREAS=tmp/sample/areas.json` – eigene Gebietsliste statt der Gebiete des Katalogs (`LAND`, ohne Angabe NRW)
- `CANDIDATES=…` und `OUT=…` – abweichende Dateinamen für die Kandidaten und das Prüfergebnis (nur `verify.mjs`)
- `TRUST_LINK=1` – der Verweis von der offiziellen Website genügt als Zuordnung, wenn das System den Gebietsnamen nicht nennt (für Gemeindeverbände, die über eine Mitgliedsgemeinde gefunden wurden). Seiten, die erkennbar zu einem Kreis gehören, werden weiterhin keiner Stadt zugeordnet. Für den Katalog des Betriebs wird diese Einstellung nicht verwendet.
