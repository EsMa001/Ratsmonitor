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

`build.mjs` übernimmt `verified-guessed.json`, `verified-guessed-own.json`, `verified-oparl.json`, `verified-search.json`, `verified-fix.json` und zuletzt `verified-website.json` (siehe „Websites ohne Ratsinformationssystem“) von selbst. Außerdem schreibt es die offenen Gebiete mit Grund nach `<DIR>open.json`, als Arbeitsliste für weitere Schritte.

**Gründe im Bericht** (`reasons.mjs`, reine Funktionen, getestet in `tests/source-reasons.test.mjs`). Ohne Übernahme zählt die Prüfung von `verified-search.json` und `verified-fix.json` (gezielt gesetzte Kandidaten), sobald sie etwas versucht hat; geratene Adressen nur mit erkanntem System oder robots-Sperre. Maßgeblich ist je Gebiet ein Eintrag der Prüfung: die letzte Seite mit erkanntem System, die das Gebiet nennt, sonst ein erkanntes System hinter robots-Sperre, die erste robots-Sperre, das letzte erkannte System, die erste Plattform-Adresse, die erste Adresse. Aus ihm kommen der Plattform-Grund (komuna, RIS-Portal, Kommune aktiv, ekom21), der robots-Grund und die gefundene Adresse (sonst der erste Kandidat aus `candidates.json`, `candidates-search.json`, `candidates-guessed-own.json`, `candidates-fix.json`); ein Gemeindelink auf das RIS-Portal des Kreises macht ein eigenes System nicht zum Plattform-Fall. Neue Gründe:

- ohne Link, nach `candidates.json`: „Keine offizielle Website in Wikidata (P856)“, „Offizielle Website antwortet Programmen nicht (HTTP 403/503)“ (höchstens 4 Seiten), „Website durchsucht, kein Link zu einem Ratsinformationssystem gefunden“ (ab 20 Seiten), sonst wie bisher; „Link auf der Website gefunden, noch nicht geprüft“;
- „Nur Links auf Vorlese-, Teilen-, App- oder Herstellerseiten gefunden, kein Ratsinformationssystem“ (die Prüfung hat alle Kandidaten als Dienst verworfen);
- „Kein Ratsinformationssystem erkennbar; Sitzungen nur als Webseite oder PDF“: Keine gelesene Seite nennt das Gebiet, keine wurde als System erkannt (kein Produkt, kein Leser, keine OParl, keine robots-Sperre) und keine liegt auf einer typischen RIS-Adresse (Kreisportal, CMS-Kalender, ePaper); ebenso, wenn alle verworfenen Kandidaten auf ePaper, Amtsblatt oder Kalender zeigen. Kandidaten für den Website-Leser (`REASONS='Kein Ratsinformationssystem'`);
- „Verlinkte Seite antwortet Programmen mit HTTP <Status>“ bzw. „… nicht (Zeitüberschreitung)“, wenn keine verlinkte Seite gelesen werden konnte;
- „SD.NET: Startseite erreichbar, Vorlagenliste antwortet mit HTTP <Status>“ (bei 403: „Zugriffsschutz (HTTP 403) …“), „More! Rubin gefunden, Abruf lieferte keine öffentlichen Tagesordnungspunkte“, „ALLRIS 3 erkannt; Leser noch nicht angewendet (Neuprüfung ausstehend)“; SessionNet nennt seine erste Meldung.

Ein Leser-Ergebnis geht dem ALLRIS-4-Fehler vor, ein Zuordnungsfehler den Gründen „SD.NET erwähnt …“ und „ALLRIS ohne erreichbare OParl-Schnittstelle“. Einträge mit fester Körperschaft (`body`, `bodies`) gelten nicht als mitbenutzt; Einträge eines Systems mit verschiedenen `bodies` sind verschiedene Adressen.

**Weitere Leser** (`server/integrations/readers.mjs`): ALLRIS 3, KIC-RIS (öffentliche Gast-Schnittstelle der React-App), TI-Generator, SessionNet 6 (öffentliche JSON-Schnittstelle), cron Ratsinfo für TYPO3, RIS München, PIWi Wiesbaden, PIO Offenbach und der Sitzungsdienst von mein-intra.net (`councilservice`). Jeder Leser hat eine Erkennung (`detect`), die aus Adresse und Seite die Felder des Katalogeintrags bildet; `verify.mjs` probiert sie als sechsten Schritt nach OParl, More! Rubin, SessionNet, SD.NET und ALLRIS 4, `collect-region.mjs` liest die Quellen damit.

**Eingebetteter Sitzungsdienst (mein-intra.net, `councilservice`).** Viele kleine Gemeinden (vor allem in Sachsen, Thüringen, Brandenburg und Hessen, häufig mit einer Website von verwaltungsportal.de) zeigen ihre Sitzungen auf einer Seite der eigenen Website, die das System per Skript lädt (`<mandant>.mein-intra.net/export/js/initialize.js`, `initializeExport("<token>")`); verlinkt ist nur diese Seite (`…/ris.html?href=/councilservice/session/list`). `crawl.mjs` zählt deshalb einen Link mit `councilservice` auf der eigenen Website als Treffer und eine Seite, die das Skript einbettet, selbst als Kandidaten. Erkannt wird das System auf dieser Seite der Website (`detectCouncilservice`); der Katalogeintrag nennt System (`base`), Export-Schlüssel (`token`) und die Seite (`page`), auf die die Berichte verlinken. Vor dem 05.10.2026 übersah die Suche diese Gemeinden (Grund „kein Link“), etwa Sonnewalde.

**Höchstens zwei Anfragen je Server auch in der Linksuche.** Viele Gemeinde-Websites liegen bei wenigen Hostern (verwaltungsportal.de: rund 350 der offenen Gebiete auf zwei Adressen). Ohne Begrenzung antworteten sie dem Lauf vom 04.10.2026 für 110 Gebiete mit HTTP 403, die einzeln abgefragt erreichbar waren. `crawl.mjs` begrenzt deshalb wie `verify.mjs` je Domain und IP-Adresse. Auch das reichte verwaltungsportal.de nicht: Nach dem Lauf über die 1.598 Gebiete „kein Link“ (bis zu 21 Seiten je Website) antworteten seine Rechner unserer Kennung stundenlang mit „Zugriff verweigert“. Für solche Hoster gibt es einen behutsamen Modus: `HOME_ONLY=1` (nur die Startseite, auf der diese Websites den Sitzungsdienst im Menü verlinken), `SERVER_LIMIT=1` und `SERVER_PAUSE_MS=4000` (eine Anfrage je Server zur Zeit, danach eine Pause); `verify.mjs` versteht `SERVER_LIMIT` und `SERVER_PAUSE_MS` ebenso. Beispiel: `tmp/source-discovery-de/gentle-cs.ps1`.

**Kandidaten ohne Link der Website** (`candidates-search.json`): Adressen aus einer Websuche oder aus der Diagnose einzelner Gebiete. Sie tragen `guessed:'Websuche'`, wenn kein Link der offiziellen Website sie belegt; dann muss das System das Gebiet selbst nennen, und eine OParl-Körperschaft wird nicht allein deshalb zugeordnet, weil sie die einzige ist. Ein Kandidat mit `reader` wird direkt von diesem Leser geprüft (RIS München: die Anwendung antwortet auf Seitenabrufe mit Sitzungsadressen, die ihre robots.txt untersagt; der Leser hält die Sitzung als Cookie). `build.mjs` setzt bei solchen Quellen die Systemadresse als `verifiedSource` und vermerkt `foundBy`.

**Gremienfilter für OParl** (`organizations`): Führt ein OParl-System mehrere Räte als eine Körperschaft (Bremen: Landtag und Stadtbürgerschaft), liest der Leser mit `organizations: {include:[…], exclude:[…]}` nur Sitzungen, von deren Gremien mindestens eines auf ein `include`-Muster passt und keines auf ein `exclude`-Muster. Ein Muster ist ein Teil des Gremiennamens oder Kurznamens (Groß-/Kleinschreibung und ä/ae gleich) oder die volle Adresse der Organisation. Sitzungen ohne Gremium oder mit nicht lesbarem Gremium werden nicht übernommen; `coverage` zählt `filteredMeetings` (davon `mixedMeetings`: gemeinsame Sitzungen mit einem ausgeschlossenen Gremium) und `unassignedMeetings`. `verify.mjs` übernimmt `organizations` und `body` eines Kandidaten in den Eintrag. Handverlesene Kandidaten mit Begründung und Prüfaufruf liegen in `scripts/source-discovery/candidates/` (Pfad für `CANDIDATES` relativ zu `DIR`, etwa `CANDIDATES=../../scripts/source-discovery/candidates/bremen.json`).

**Viele Gebiete erneut prüfen**: `ONLY_FILE=<datei mit einer ID je Zeile>` für `crawl.mjs` und `verify.mjs` (eine Liste mit Tausenden IDs passt nicht in die Befehlszeile). Ergebnisse tragen einen Zeitstempel (`searchedAt`, `checkedAt`), damit ein Wächter nach einem Absturz die schon bearbeiteten Gebiete auslässt (`tmp/source-discovery-de/recrawl.ps1`, `rerun.ps1`).

Alle Schritte lassen sich mit einer kommagetrennten Liste von Gebiets-IDs auf einzelne Gebiete beschränken. `crawl.mjs`, `guess.mjs` und `verify.mjs` setzen einen abgebrochenen Lauf fort.

## Regeln

- **Nachweis statt Vermutung.** Eine Quelle wird nur übernommen, wenn das Abrufprogramm öffentliche Tagesordnungspunkte aus ihr liefert.
- **Zuordnung.** Der Link stammt von der offiziellen Website des Gebiets (Wikidata, Eigenschaft P856 zum amtlichen Schlüssel). Zusätzlich muss das System das Gebiet nennen: im Namen der OParl-Körperschaft, im amtlichen Schlüssel, in der Adresse oder im Seitentext. Eine Kreisseite gilt nie als Quelle einer Stadt. Geratene Adressen auf fremden Servern zählen nur mit Rückverweis auf die offizielle Website oder passendem amtlichem Schlüssel.
- **Gemeinsame Systeme.** Teilen sich mehrere Gebiete ein OParl-System, steht die Körperschaft fest im Katalogeintrag (`body`). Hat ein verlinktes System genau eine Körperschaft mit abweichendem Namen, wird diese fest zugeordnet und im Eintrag vermerkt.
- **Reihenfolge.** Offizielle OParl-Schnittstelle vor der Kalender-API von More! Rubin vor öffentlichen SessionNet-, SD.NET- oder ALLRIS-4-Seiten. Die Seiten werden nicht gelesen, wenn der Hersteller-Endpunkt für OParl antwortet; das Abrufprogramm prüft das bei jedem Abruf erneut.
- **Nebenan fragen statt raten.** Zeigt eine verlinkte Seite selbst keine Systemadresse (Weiterleitung per Skript, Rahmen, System an der Wurzel des Rechners), fragt die Prüfung die übliche Einstiegsseite `si0040` daneben, unter `/bi/` und an der Wurzel. Führt ein Link in den Anmeldebereich von SessionNet (`gi/`, `ri/`), wird der öffentliche Bereich `bi/` daneben geprüft. Ein mit `http://` angegebener Link wird auch über `https://` gefragt. SD.NET auf einer eigenen Adresse wird an seiner Vorlagenliste erkannt. Antwortet ein SessionNet-Ordner oder -Rechner (`/sessionnet/`, `/bi/`, `buergerinfo`, `ratsinfo.`, `session.`, `sitzungsdienst.`, `…-sitzungsdienst.komm.one`) mit HTTP 404, gar nicht (Zeitlimit, Netzfehler) oder mit einer abgebrochenen Weiterleitungskette, wird die Einstiegsseite daneben genauso gesucht; ein Treffer ist der nächste Kandidat und durchläuft robots.txt, Zuordnung und Leser wie jeder andere. Nicht bei ALLRIS-Adressen (`sitzung-online.de`, `ratsinfo-online`, `.asp`-Programme). Antwortet ein Pfad eines More!-Rubin-Rechners (`gremien.info`, `more-rubin1.de`, `zv-kisa.de`) mit 404 oder gar nicht, ist die Wurzel des Rechners der nächste Kandidat. Regeln in `rules.mjs` (`followUpsAfterFailure`), Tests in `tests/source-discovery-rules.test.mjs`.
- **Keine Umgehung.** Antwortet eine Seite mit HTTP 401, 403 oder einer Zugriffsprüfung oder untersagt robots.txt die Adresse oder ein Weiterleitungsziel, wird nur die offizielle OParl-Adresse gefragt (bei robots.txt nur, wenn sie diese erlaubt); weder die Suche nebenan noch die Wurzel eines More!-Rubin-Rechners. Es gibt keine erneuten Versuche und keine Browser-Kennung. Die Skripte nennen sich im `User-Agent` selbst. Zeigt ein ALLRIS-System die Zugriffsprüfung des Herstellers („Zugriff pruefen“) oder meldet es „Zu viele Zugriffe“, endet seine Prüfung sofort; der Bericht nennt das als Grund.
- **ALLRIS behutsam prüfen.** Bei `sitzung-online.de` betriebene Systeme sperren ein Netzwerk vorübergehend, wenn kurz nacheinander mehrere Anfragen ohne Sitzungs-Cookie kommen. Der Leser hält deshalb eine Sitzung je Abruf. Für die Prüfung heißt das: je Gebiet nur eine Adresse in die Kandidatenliste, keine wiederholten Läufe im Minutenabstand, und nach einer Sperre erst am nächsten Tag erneut prüfen. ALLRIS 4 wird an seinem Seitenordner erkannt (meist `/public/`, sonst der Ordner, den die offizielle Website verlinkt). Zu ALLRIS 3 gehören Adressen auf `.asp`, Seiten, die `detectAllris3` erkennt (auch Ordneradressen wie `ratsinfo-online.net/<name>-bi/`, die die Startseite zeigen oder einrahmen), und Seiten, die nur `.asp`-Programme verlinken (`allrisGeneration` in `rules.mjs`). Sie liest der Leser für ALLRIS 3 (sechster Schritt); der ALLRIS-4-Leser und `/public/` werden dort nicht gefragt.
- **robots.txt.** Vor der ersten Seite eines Rechners liest `verify.mjs` dessen robots.txt (einmal je Rechner). Untersagt sie unseren Programmen den Pfad, wird er nicht gefragt; der Bericht nennt das als Grund. Das gilt auch für jede Weiterleitung (sie wird von Hand verfolgt), für die vom Hersteller üblichen OParl-Pfade und für die Adresse, die ein Leser am Ende liest.
- **Linksuche.** Ein Treffer nur über den Linktext („Ratssitzungen“, „Bürgerinfo“) beendet die Suche auf einer Website nicht mehr; erst ein Link, dessen Adresse ein Ratsinformationssystem erkennen lässt. Broschüren, Magazine, Formulare, Livestreams, Teilen-Links, App-Stores, Kartendienste, Branchenverzeichnisse (`findcity.de`) und Herstellerseiten sind keine Kandidaten (`CRAWL_SKIP` und `SERVICE` in `rules.mjs`). Ein Vorlese-Link (readspeaker, Parameter `url=`) oder Teilen-Link (x.com, Xing, Facebook …, `url=` bzw. `u=`) zählt als die Adresse, die er trägt, aber nur, wenn sie auf der Website des Gebiets liegt (gleiche registrierbare Domain wie die Website bzw. die verlinkende Seite): als Kandidat oder als weitere Seite der Website (`unwrapLink`). `verify.mjs` packt solche Links aus älteren Kandidatenlisten ebenso aus. In die Website eingebettetes ALLRIS 4 (`/allris/`, `…/si010`) wird erkannt.
- **SessionNet.** Ein Meta-Refresh der Startseite (`default.asp`) wird einmal verfolgt; als SessionNet gilt nur eine Seite mit dem Kennzeichen des Produkts (`sessionNetLandmark`), nicht eine CMS-Seite, die nur „si0040“ in ihrer Adresse wiederholt. Nennt die Startseite das Gebiet nicht, entscheidet die Infoseite des Systems; die Mandantenliste eines geteilten Systems zählt dabei nicht.
- **More! Rubin.** Die Körperschaftsliste (`organizations/bodies`) nennt das Gebiet auch dann, wenn Adresse und Startseite es nicht tun (`vgtt.gremien.info`); das zählt nur bei einem Link der offiziellen Website. Bei geteilten Systemen liest der Leser nur die Körperschaften des Gebiets (`bodies` im Katalogeintrag); ist die Liste nicht lesbar, wird nichts übernommen. `IGNORE_ROBOTS=1` schaltet die Prüfung ab. Seit dem 04.10.2026; ältere Prüfungen haben robots.txt nicht beachtet, siehe `robots.mjs` und README des Projekts.
- **Bestand bleibt.** `build.mjs` löscht keine Einträge. Einträge mit fest zugeordneter Körperschaft werden nicht überschrieben. Ausnahmen: Demo-Mandanten und doppelt vergebene Adressen (siehe unten).
- **Landkreise über ihre Gremien.** Nennen Adresse und Startseite weder den Kreis noch seinen Kreistag (etwa `muenchen.gremien.info` für den Landkreis München), entscheiden die gelesenen Sitzungen: Gremien wie Kreistag oder Kreisausschuss belegen das System des Kreises, die Gremien einer Stadt nicht. Gilt nur für Links von der offiziellen Website des Kreises.
- **Anmeldebereich.** Eine Adresse, die bei SessionNet auf die Anmeldung (`ylogon`) führt, ist der Bereich der Mandatsträger. Geprüft wird der öffentliche Teil daneben: `bi/` statt `gi/` oder `ri/` (auch als Endung eines Mandantenordners, `suelze_bi/` statt `suelze_ri/`), `buergerinfo` statt `ratsinfo` (Ordner oder Rechnername), `sessionnetbi` statt `sessionnetri`. Bei ALLRIS 3 ebenso: `ri/logon.asp`, `<name>-ri/logon.asp` und Ordneradressen in `ri/` oder `<name>-ri/` führen zu `bi/` bzw. `<name>-bi/` (`detectAllris3`).
- **Mitbenutzte Systeme.** Nennt der Teil der Adresse, der den Betreiber benennt (der erste Ordner bei Systemen mit einem Ordner je Gemeinde, sonst der Rechnername), eine andere Gemeinde und nicht die eigene, gehört das System dieser anderen Gemeinde oder ihrem Verband (`…/altshausen/bi/` für Fleischwangen). Die Leser können die Gremien eines gemeinsamen Systems nicht trennen; die mitbenutzende Gemeinde wird nicht angebunden, und das System zählt für alle Beteiligten als doppelt vergeben (`areas.mjs`, `foreignOwner`). Eine genannte Gemeinde, deren eigener Eintrag in den Quelldateien ein anderes System liest (anderer Rechner oder Mandantenordner), ist nicht Eigentümerin (Stadt Helmstedt liest `ris.stadt-helmstedt.de`, also gehört `ris-sg-gl-migration.edv-helmstedt.de` nicht ihr). Ohne eigenen Eintrag bleibt sie mögliche Eigentümerin: Dann belegt nichts, dass sie ein anderes System nutzt.
- **Doppelt vergebene Adressen** werden auch über die Dateien der Länder hinweg erkannt; geändert wird nur die Zieldatei.
- **Demo-Mandanten.** Eine Körperschaft wie „Stadt Musterstadt“ ist nie die Quelle eines Gebiets, auch nicht in einem früher geschriebenen Eintrag.
- **Namenszusätze.** „Dillingen a.d.Donau“, „Neumarkt i.d.OPf.“ oder „Neustadt in Sachsen“ werden auch ohne Zusatz erkannt. Links auf Vorlese- und Teilen-Dienste (readspeaker, WhatsApp …) sind selbst keine Kandidaten (siehe „Linksuche“).
- **Bindestrichnamen und Kurznamen.** Ein Bindestrichname zählt auch mit jedem Teil ab sechs Buchstaben, der nicht Name eines anderen Gebiets (oder Mitglieds) im Land ist („Schladen-Werla“ als `session.schladen.de`; „Wittlich“ in „Wittlich-Land“ zählt nicht, das ist die Stadt daneben). Kurznamen, unter denen ein System ein Gebiet führt, stehen in `identity-aliases.json` (`{"<id>": ["<alias>"]}`, etwa `gmh` für Georgsmarienhütte, `suelze` für Sülzetal), jeder von Hand belegt. Ein Kurzname zählt nur als ganzes Rechner-Label oder Pfadsegment, auch mit der Endung eines Mandantenordners (`suelze_bi/`), nie als Teil eines Worts; die Zuordnung heißt dann „Adresse (Alias)“.

## Websites ohne Ratsinformationssystem

**Zweck.** Viele kleine Gemeinden und Gemeindeverbände haben kein Ratsinformationssystem (RIS) oder keines, das wir lesen dürfen. Zeit, Ort und Tagesordnung ihrer öffentlichen Sitzungen müssen sie trotzdem in allen Flächenländern ortsüblich bekanntmachen, und oft steht diese Bekanntmachung auf der eigenen Website: als Seite „Bekanntmachungen“ oder „Amtstafel“, als PDF der Einladung, als Niederschrift oder Sitzungsbericht, im Amts- oder Mitteilungsblatt auf der eigenen Website, im Nachrichten-Feed (RSS/Atom), im Veranstaltungskalender (iCal), in der WordPress-REST-API, als schema.org-Event oder in der `sitemap.xml`. `website.mjs` sucht diese Stellen und prüft sie mit dem Leser `website` (`server/integrations/website.mjs`, „Website der Kommune (öffentliche Bekanntmachungen)“). Die Ideen und Grenzen stehen in `requirements/website-leser-ideen.md`.

**Regeln.**

- **Nur die eigene Website.** Gelesen wird nur die offizielle Website (Wikidata P856; für Gemeindeverbände ohne eigene Website die der gleichnamigen bzw. ersten drei Mitgliedsgemeinden, wie `crawl.mjs`): der Rechner der Startseite ohne `www.`, seine Unterdomains und die Rechner, deren Unterdomain er ist, alle auf derselben registrierbaren Domain. Ein Nachbar unter einer gemeinsamen Domain (`b.vg-x.de` für `a.vg-x.de`) ist eine andere Website; der Leser nimmt ebenfalls nur diese Familie an (`siteAllowed`). Weiterleitungen werden von Hand verfolgt (`http` → `https`, `www` ↔ ohne `www`) und nur innerhalb der Website; eine Weiterleitung anderswohin beendet die Suche dort („Website nicht erreichbar“). Die Origin der erreichten Startseite wird `base`, weitere Origins der Website mit Funden stehen in `alsoFrom`. Verlagsplattformen, Cloud-Speicher und Teilen-Dienste werden nicht gelesen.
- **Links auf ein Ratsinformationssystem werden nie verfolgt**, auch nicht auf der eigenen Domain (`ratsinfo.<domain>`, `/buergerinfo/`, `si0040.asp`, `/allris/`, `/oparl/`, PIO, PIWi, RISI …; `isRisLink` in `server/integrations/website-feeds.mjs`, gemeinsam für Suche und Leser). Auch der Leser selbst liest keine solche Adresse, weder aus Listen, Feeds und Sitemaps noch als Ziel einer Weiterleitung. Deshalb prüft die Suche auch Gebiete, deren RIS Programmen den Abruf untersagt: Die Website ist eine eigene, öffentliche Veröffentlichung auf einem anderen Rechner; ihr Lesen umgeht keine Sperre des RIS-Betreibers, solange die robots.txt der Website es erlaubt und keine Seite des gesperrten Systems gelesen wird.
- **robots.txt** jeder Origin wird vor ihrer ersten Seite gelesen (RFC 9309, Produkt-Tokens `vorort-politicaltopics` und `ratsmonitor-sourcecatalog`). Verbotene Pfade werden nicht gefragt; untersagt sie die Startseite, wird das Gebiet mit „robots.txt der Website untersagt Programmen den Abruf“ vermerkt. Antwortet robots.txt mit 5xx oder gar nicht, wird von dieser Origin nichts gelesen. Die WordPress-API wird nur aufgenommen, wenn die Seite selbst auf sie verweist (`<link rel="https://api.w.org/">`) und robots.txt ihren Pfad erlaubt.
- **Nur der öffentliche Teil.** Übernommen wird ein Gebiet nur, wenn der Leser öffentliche Tagesordnungspunkte liefert und die Bekanntmachungen das Gebiet nennen (`coverage.namesArea`). Der Leser übernimmt einen Punkt nur mit eindeutigem Öffentlichkeitsnachweis; Seiten und Dokumente, die „nichtöffentlich“ nennen (auch „nö“, „N.Ö.“, `…_noe_…`, Umlaute in jeder Unicode-Schreibweise), liest weder die Suche noch der Leser. Im Text gilt „im Zweifel nichts“: Jede Zeile nach dem ersten Punkt, die den nichtöffentlichen Teil nennt (Überschrift in jeder Form, Satz, Zusatz „(nichtöffentlich)“ am Punkt, Kennzeichen N/NÖ in jeder Schreibweise), beendet den öffentlichen Teil; ein nachgestellter Hinweis auf schon gelesene Punkte verwirft die Sitzung; ein Sitzungskopf im nichtöffentlichen Teil beginnt keine neue Sitzung, außer er nennt einen anderen Tag und ein anderes Gremium.
- **Keine Umgehung.** Keine Formulare, keine Suchfunktion der Website (auch keine Links in die Suche, `isSearchLink`), keine Anmeldung, keine Browser-Kennung. Nach HTTP 403 oder 429 (auch auf robots.txt) wird die Origin für den Rest des Laufs nicht mehr gefragt; der Leser hält es im Import ebenso und meldet den Abruf nach 429 als fortsetzbar.
- **Rücksicht.** Höchstens zwei Anfragen gleichzeitig je Server (registrierbare Domain und IP-Adresse, wie `verify.mjs`) und mindestens eine Sekunde zwischen zwei Anfragen an denselben Server; Zeitlimit 15 s je Anfrage; HTML und XML höchstens 4 MB. Das gilt für jede einzelne Anfrage der Leserprüfung ebenso (`readerFetch` und `serverGate` in `website-plan.mjs`); sie fragt mit der Kennung der Suchskripte.

**Ablauf je Website.** robots.txt (Urteil und `Sitemap:`-Zeilen) → Startseite (CMS aus `<meta name="generator">`, Feeds, WordPress-API, JSON-LD) → höchstens drei Sitemap-Dateien (Teile eines Index mit Bezug zu Sitzungen, Politik oder Nachrichten zuerst) → Suche nach dem besten Link ab der Startseite über die Navigation (Bekanntmachung, Amtstafel, Amtsblatt, Mitteilungsblatt, Sitzung, Gemeinderat, Politik, Gremien, Rathaus …), höchstens `MAX_PAGES` Seiten, Tiefe 3. Jede Seite wird mit `listPageScore` bewertet; bis zu fünf Listenseiten (ab Wert 3, eine je Liste) gehen in den Eintrag. Feeds (höchstens 5) und iCal-Dateien (höchstens 3) zählen nur mit mindestens einem Eintrag, der nach einer Sitzung aussieht; eine Sitemap nur, wenn sie Adressen von Sitzungsdokumenten enthält. Danach prüft `collectWebsite` den Eintrag (Zeitraum `WINDOW`, Namen des Gebiets, seiner Kurzform und seiner Mitglieder).

**Aufruf** (nach `crawl.mjs` und `verify.mjs`, am besten nach einem ersten `build.mjs`, das `open.json` schreibt):

```
node scripts/source-discovery/website.mjs                              # alle offenen Gebiete
REASONS='kein Link|Kein unterstütztes' node scripts/source-discovery/website.mjs   # nur Gebiete mit diesen Gründen in open.json
node scripts/source-discovery/build.mjs
node scripts/source-discovery/servers.mjs
ONLY_NEW=1 node scripts/source-discovery/robots.mjs
node --test tests/*.test.mjs
```

**Umgebungsvariablen.** `DIR`, `LAND`, `AREAS` wie die anderen Schritte; eine kommagetrennte Liste von IDs als Argument oder `ONLY_FILE` (eine ID je Zeile) prüft genau diese Gebiete, auch bereits geprüfte; `REASONS` (regulärer Ausdruck auf den Grund in `<DIR>open.json`); `WINDOW` (Prüfzeitraum, Standard `3m`); `MAX_PAGES` (Seiten je Website, Standard 25); `WORKERS` (Gebiete gleichzeitig, Standard 12).

**Ergebnisse.** `<DIR>candidates-website.json` (je Gebiet und Website: CMS, bewertete Seiten, Listenseiten, Feeds, iCal, WordPress, Sitemaps, Protokoll) und `<DIR>verified-website.json` im Format von `verify.mjs`. Der Lauf setzt fort (schon geprüfte Gebiete werden ausgelassen), schreibt alle zehn Gebiete einen Zwischenstand und zählt am Ende Gebiete, Übernahmen, Gründe und die häufigsten CMS. Gründe ohne Übernahme: „robots.txt der Website untersagt Programmen den Abruf“, „Website antwortet Programmen mit HTTP 403“, „Website nicht erreichbar“, „Keine Seite mit Sitzungsbekanntmachungen gefunden“, „Bekanntmachungen gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar“ (mit Zahl der Dokumente ohne erkennbaren öffentlichen Teil und der nicht lesbaren), „Gefundene Bekanntmachungen nennen das Gebiet nicht“. Bei Gemeindeverbänden mit mehreren Mitglieds-Websites zählt der Grund der Website, die am weitesten kam.

**In `build.mjs`.** Ein Website-Eintrag wird nur übernommen, wenn kein anderes Prüfergebnis das Gebiet schon übernommen hat (`verified-website.json` wird zuletzt gelesen). Nicht übernommene Website-Prüfungen ergänzen im Bericht die Gründe ohne Ratsinformationssystem (ohne Link, nur Dienste-Links, nur Webseite oder PDF) um „; Website geprüft: <Grund> (<Datum>)“; die Zusammenfassung zählt ohne den Teil in Klammern. Zwei Gebiete mit derselben Website (ein Verband und seine Mitgliedsgemeinde) gelten wie bei anderen Quellen als doppelt vergeben, und eine Website, deren Adresse eine andere Gemeinde nennt, als mitbenutzt (`foreignOwner`). `robots.mjs` prüft für den Leser `website` den Pfad der ersten Listenseite (auf deren Origin).

**Grenzen.** Kommunale Websites waren aus der Entwicklungsumgebung nicht erreichbar; Suche und Leser sind mit nachgebildeten Seiten getestet (`tests/website-*.test.mjs`), die erste Messung liefert der erste Lauf. Ergebnisse sind weniger vollständig als die eines RIS (keine Vorlagen, selten Abstimmungen). Gescannte PDF ohne Textebene, Bekanntmachungen nur im Schaukasten oder nur im Amtsblatt eines Verlags, Inhalte, die erst ein Skript nachlädt, und Seiten hinter einer Suche bleiben unsichtbar. Eine Kommune, deren Website auf eine neue Domain umgezogen ist, wird erst gefunden, wenn Wikidata die neue Adresse nennt. Die Pflichtbekanntmachung der Verwaltungsgemeinschaft oder des Amtes für ihre Mitglieder wird noch keinem Mitglied zugeordnet.

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
- Berlin und Hamburg sind je ein Gebiet und werden nicht durchsucht (`skipReason` in `areas.mjs`): Ein von der Stadt verlinktes System gehört einer Bezirksversammlung, nicht der ganzen Stadt. Beide stehen von Hand in `server/integrations/citystate-sources.json` und werden mit `stadtstaaten.mjs` geprüft: Hamburg über das Transparenzportal, Berlin über die OParl-Schnittstellen der Bezirke, soweit robots.txt oder eine Freigabe es erlaubt (README des Projekts, Abschnitt „Berlin und Hamburg“).
- Lange Läufe stürzen auf manchen Rechnern ohne Meldung ab. `crawl.mjs` und `verify.mjs` setzen fort; ein Wächter wie `tmp/source-discovery-de/run.ps1` startet sie neu. Nie zwei `verify.mjs` gleichzeitig: Beide schreiben `verified.json`.
- Eine einzelne Liste nachprüfen: `node scripts/source-discovery/verify.mjs <id,id,…>` (prüft auch bereits geprüfte Gebiete erneut).
- **Plattform-Adressen raten** (`guess-platforms.mjs`): komm.one (`<name>-sitzungsdienst.komm.one`) und KISA (`ris-<name>.zv-kisa.de`) beantworten DNS nur für vorhandene Mandanten; die Suche kommt deshalb ohne Last auf den Plattformen aus. Beide Systeme verlinken die Website der Gemeinde nicht. Eine geratene Adresse wird nur Kandidat, wenn der Name im Land eindeutig ist; `verify.mjs` muss dann wie immer den Gebietsnamen im System finden und öffentliche Tagesordnungspunkte lesen. Aufruf: `LAND=de DIR=… node scripts/source-discovery/guess-platforms.mjs`, danach `CANDIDATES=candidates-guessed.json OUT=verified-guessed.json` für `verify.mjs`; `build.mjs` übernimmt `verified-guessed.json` von selbst.
- **Rücksicht auf Plattformen.** Nach rund einer Stunde Such- und Prüfverkehr nahm komm.one am 04.10.2026 keine Verbindungen von unserem Netzwerk mehr an; drei Stunden später antwortete `www.komm.one` wieder, die Mandantenrechner (`…-sitzungsdienst.komm.one`) noch nicht. 36 geratene komm.one-Adressen sind deshalb noch ungeprüft (`tmp/source-discovery-de/kommone-ids.txt`), ebenso die robots.txt der 158 komm.one-Quellen. Vor einem neuen Lauf einen Mandantenrechner einmal fragen. Wiederholte Läufe gegen dieselbe Plattform zeitlich strecken; `tmp/source-discovery-de/verify-paced.ps1` prüft eine ID-Liste paarweise mit Pause.

## Kandidaten aus der Länderrecherche

`candidates/research-2026-10-{de,nds,nrw}.json` enthalten 106 Adressen für 100 offene Gebiete aus der Recherche vom 05.10.2026 ([requirements/laender-recherche.md](../../requirements/laender-recherche.md)): Systeme, die die Website nicht verlinkt (digitalfabriX, sitzung-mv.de, KITU, kdgoe, rznk.de), Verbands- und Kreissysteme, OParl bei ekom21. Jede Adresse trägt unter `research` Art, Hinweis und Beleg. Sie stammen aus Suchtreffern und sind ungeprüft; übernommen wird ein Gebiet erst, wenn `verify.mjs` System und Gebiet nachweist. Geprüft wird vom Rechner des Projektinhabers, je Land in dessen Arbeitsordner:

```
export LAND=de DIR=tmp/source-discovery-de/
cp scripts/source-discovery/candidates/research-2026-10-de.json $DIR/candidates-research.json
CANDIDATES=candidates-research.json OUT=verified-research.json node scripts/source-discovery/verify.mjs
node scripts/source-discovery/build.mjs
node scripts/source-discovery/servers.mjs
ONLY_NEW=1 node scripts/source-discovery/robots.mjs
node --test tests/*.test.mjs
```

Für Niedersachsen (`research-2026-10-nds.json`) und NRW (`research-2026-10-nrw.json`) gelten `LAND`, `DIR`, `AREAS` und die `build.mjs`-Variablen der Abschnitte „Niedersachsen“ und „Ablauf“ (NRW). `verified-research.json` zählt in `build.mjs` wie die Websuche (`TARGETED_FILES` in `reasons.mjs`); ein zweiter Lauf prüft nur Gebiete, die dort noch fehlen.

`candidates/bremen.json` ist ein Vorschlag für die Stadtbürgerschaft über den Gremienfilter (`organizations`). Vor der Übernahme sind die Gremiennamen am System abzulesen (`pruefaufruf` in der Datei).

**Neuprüfliste.** 136 schon geprüfte Gebiete sind nach den Korrekturen an Suche und Prüfung (Abschnitt „Regeln“) erneut zu prüfen; der Grund je Gebiet steht in `candidates/neupruefung-2026-10-gruende.txt`. `neupruefung-2026-10-<land>.txt` (113 de, 19 nds, 4 nrw) gehen an `verify.mjs`, `neupruefung-2026-10-crawl-<land>.txt` (33 de, 5 nds, 1 nrw) vorher an `crawl.mjs`, weil sich dort die Linksuche geändert hat:

```
ONLY_FILE=scripts/source-discovery/candidates/neupruefung-2026-10-crawl-de.txt node scripts/source-discovery/crawl.mjs
ONLY_FILE=scripts/source-discovery/candidates/neupruefung-2026-10-de.txt node scripts/source-discovery/verify.mjs
```

Danach wie oben `build.mjs`, `servers.mjs`, `robots.mjs` und die Tests. Für Systeme bei `sitzung-online.de` gilt „ALLRIS behutsam prüfen“: ein Lauf, nach einer Sperre erst am nächsten Tag weiter. komm.one-Gebiete, deren Prüfung „keine öffentlichen Tagesordnungspunkte“ meldet, sind eine Leserfrage, keine neue Adresse.

## Andere Gebietslisten

`crawl.mjs` und `verify.mjs` arbeiten ohne weitere Angaben auf den NRW-Gebieten in `tmp/source-discovery/`. Für die Stichprobe der Hochrechnung (siehe `scripts/estimate/README.md`) lassen sie sich umstellen:

- `DIR=tmp/sample/` – Arbeitsordner für Eingaben und Ergebnisse
- `AREAS=tmp/sample/areas.json` – eigene Gebietsliste statt der Gebiete des Katalogs (`LAND`, ohne Angabe NRW)
- `CANDIDATES=…` und `OUT=…` – abweichende Dateinamen für die Kandidaten und das Prüfergebnis (nur `verify.mjs`)
- `TRUST_LINK=1` – der Verweis von der offiziellen Website genügt als Zuordnung, wenn das System den Gebietsnamen nicht nennt (für Gemeindeverbände, die über eine Mitgliedsgemeinde gefunden wurden). Seiten, die erkennbar zu einem Kreis gehören, werden weiterhin keiner Stadt zugeordnet. Für den Katalog des Betriebs wird diese Einstellung nicht verwendet.
