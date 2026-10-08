# Entwürfe: Freischaltung bei Betreibern, die Programme technisch aussperren

Stand 05.10.2026. Entwürfe zur Anpassung und zum Versand durch den Projektinhaber. Platzhalter stehen in spitzen Klammern. Betreibernamen und Ansprechstellen sind vor dem Versand im Impressum zu prüfen; Personennamen stehen hier bewusst nicht.

## Ausgangslage

Seit dem 05.10.2026 hält Ratsmonitor robots.txt fest, befolgt sie aber nicht mehr. Grundlage ist eine rechtlich geprüfte Entscheidung des Projektinhabers: Öffentliche Ratsunterlagen deutscher Behörden dürfen automatisiert abgerufen werden, auch über HTML-Seiten, wenn es keine passende Schnittstelle gibt. Technische Sperren umgehen wir weiterhin nicht. Dazu gehören HTTP 401/403, Web-Firewalls, Zugriffsprüfungen im Browser, Anmeldungen und Mitgliederbereiche. Gebiete hinter einer solchen Sperre bleiben offen, bis der Betreiber freischaltet. Die Anfragen unten bitten genau darum.

Offene Gebiete je Betreiber (Prüfstand 04./05.10.2026):

| Betreiber (Adresse) | Gebiete | Antwort an Programme |
|---|---:|---|
| ratsinfomanagement.net (SD.NET) | 226 | HTTP 403 |
| kommune-aktiv.de | 140 | HTTP 403 |
| ekom21 (SD.NET bei ekom21) | 66 | Web-Firewall leitet auf eine Fehlerseite um; OParl des Herstellers je Kommune nicht aktiviert |
| ratsinformationsdienst.de | 11 | HTTP 403 |
| ALLRIS von CC e-gov (sitzung-online.de, ratsinfo-online.de, allris.net und Systeme mit ALLRIS 4) | rund 100, mit den Neuprüfungen vom 05.10.2026 | Zugriffsprüfung „Zugriff prüfen“, „zu viele Zugriffe“, HTTP 403 auf Kalenderseiten |
| Gemeinde-Websites bei verwaltungsportal.de | rund 275 | HTTP 403; eigener Entwurf: [verwaltungsportal-anfrage.md](verwaltungsportal-anfrage.md) |
| Bezirksverordnetenversammlungen Berlin | 10 Systeme | HTTP 403; eigener Entwurf: [berlin-freigabe-anfrage.md](berlin-freigabe-anfrage.md) |

## Gemeinsamer Textbaustein: So ruft Ratsmonitor ab

Diesen Absatz fügen alle Anfragen ein:

> **So rufen wir ab:** Jede Anfrage nennt das Projekt im User-Agent: `VorOrt-PoliticalTopics/0.5 (public council documents)` für den laufenden Abruf, `Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)` für die einmalige Prüfung einer Quelle. Wir verwenden keine Browser-Kennung. Je Server laufen höchstens zwei Anfragen gleichzeitig, mit festen Zeitbudgets je Abruf. Nach HTTP 403 wiederholen wir nicht; nach einer Überlastmeldung (HTTP 429, 503) folgt höchstens ein weiterer Versuch nach einer Pause. Bereits gelesene, unveränderte Sitzungen fragen wir nicht erneut ab. Wir lesen nur den öffentlichen Teil, also freigegebene Sitzungen, öffentliche Tagesordnungspunkte und Vorlagen. Den nichtöffentlichen Teil, Anmeldungen, Formulare und Suchfunktionen nutzen wir nicht. Jeder Vorgang verlinkt das Original. Zeitfenster und Höchstzahl der Anfragen richten wir gern nach Ihren Vorgaben aus.

## 1. ratsinfomanagement.net (SD.NET)

**Adressat:** Betreiber von ratsinfomanagement.net, `<laut Impressum, z. B. Hersteller oder Hosting-Dienstleister von SD.NET RIM>`. In Kopie optional eine betroffene Kommune.

**Betreff:** Öffentliche Ratsinformation auf ratsinfomanagement.net: Zulassung unseres Abrufs oder OParl

Sehr geehrte Damen und Herren,

wir betreiben Ratsmonitor, ein `<gemeinnütziges/privates>` Projekt. Es fasst öffentliche Vorgänge aus Gemeinderäten, Kreistagen und Gemeindeverbänden in ganz Deutschland verständlich zusammen und macht sie nach Orten durchsuchbar. Heute lesen wir die öffentlichen Unterlagen von rund `<Zahl>` Gebieten.

Rund 226 Städte, Gemeinden und Kreise veröffentlichen ihre Sitzungen über Ihre Plattform ratsinfomanagement.net. Unser Programm erhält dort auf die öffentlichen Seiten die Antwort HTTP 403. Eine Zugriffssperre umgehen wir nicht. Deshalb fehlen diese Kommunen bisher bei uns.

Wir bitten um eine der folgenden Lösungen, in dieser Reihenfolge:

1. **OParl:** die Freischaltung der OParl-Schnittstelle von SD.NET (`webservice/oparl/v1.1/system`) für die öffentlichen Daten aller Mandanten, oder zumindest Auskunft, welche Kommunen sie freigeben müssten.
2. **Zulassung unserer Kennung** für die öffentlichen Seiten (Kalender, Sitzungen, Vorlagen), gern mit einer Obergrenze für Anfragen je Minute oder einem Zeitfenster.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## 2. Kommune aktiv (kommune-aktiv.de)

**Adressat:** Betreiber von kommune-aktiv.de, `<laut Impressum>`.

**Betreff:** Öffentliche Sitzungsinformationen auf kommune-aktiv.de: Zulassung unseres Abrufs

Sehr geehrte Damen und Herren,

wir betreiben Ratsmonitor, ein `<gemeinnütziges/privates>` Projekt für öffentliche Vorgänge aus Kommunalparlamenten in ganz Deutschland. 140 Kommunen veröffentlichen ihre Sitzungen über Ihre Plattform. Unser Programm erhält dort HTTP 403. Zugriffssperren umgehen wir nicht.

Wir bitten um eine der folgenden Lösungen:

1. **Eine Schnittstelle**, falls vorhanden (OParl oder ein anderer Export der öffentlichen Sitzungen), mit Angabe der Adresse.
2. **Die Zulassung unserer Kennung** für die öffentlichen Sitzungsseiten, gern mit Obergrenze.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## 3. ekom21 (SD.NET bei ekom21)

**Adressat:** ekom21 – KGRZ Hessen, `<zuständige Stelle Ratsinformation/SD.NET; vor dem Versand bestätigen>`. In Kopie optional der Hessische Städte- und Gemeindebund oder eine betroffene Kommune.

**Betreff:** OParl-Schnittstelle der SD.NET-Systeme bei ekom21 für öffentliche Daten

Sehr geehrte Damen und Herren,

66 hessische Kommunen und Kreise veröffentlichen ihre Sitzungen über SD.NET bei ekom21. Ihre öffentlichen Seiten leitet eine vorgeschaltete Web-Firewall für unser Programm auf eine Fehlerseite um. Die OParl-Schnittstelle des Herstellers (`rim.ekom21.de/<kommune>/webservice/oparl/v1.1/system`) ist für diese Kommunen nicht aktiviert. Bei einigen Kommunen ist sie aktiviert; diese lesen wir bereits über OParl.

Wir bitten darum,

1. die **OParl-Schnittstelle für die öffentlichen Daten** aller Kommunen zu aktivieren, die einverstanden sind, oder uns zu sagen, wie eine Kommune die Aktivierung beantragt; wir sprechen die Kommunen dann gern selbst an.
2. Falls OParl nicht in Frage kommt: **unsere Kennung in der Web-Firewall** für die öffentlichen Seiten zuzulassen.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## 4. ratsinformationsdienst.de

**Adressat:** Betreiber von ratsinformationsdienst.de, `<laut Impressum>`.

**Betreff:** Öffentliche Ratsinformation auf ratsinformationsdienst.de: Zulassung unseres Abrufs

Sehr geehrte Damen und Herren,

elf Kommunen veröffentlichen ihre Sitzungen über ratsinformationsdienst.de. Unser Programm erhält dort HTTP 403. Zugriffssperren umgehen wir nicht. Wir bitten um Auskunft über eine Schnittstelle (OParl) oder um die Zulassung unserer Kennung für die öffentlichen Seiten.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## 5. ALLRIS (CC e-gov) und ihre Kunden

**Adressat:** CC e-gov GmbH als Hersteller und Betreiber von sitzung-online.de und ratsinfo-online.de, `<zuständige Stelle; vor dem Versand bestätigen>`. Für Systeme, die Kommunen selbst betreiben (ALLRIS 4 mit „Zugriff prüfen“, etwa Region Hannover, Landkreis Hameln-Pyrmont, Engelskirchen), zusätzlich die jeweilige Kommune.

**Betreff:** OParl und öffentliche ALLRIS-Seiten: Zulassung unseres Abrufs

Sehr geehrte Damen und Herren,

viele Kommunen veröffentlichen ihre Sitzungen mit ALLRIS. Bei rund 100 offenen Gebieten verhindert eine Sperre den Abruf durch unser Programm, darunter die Großstädte Kiel (www.kiel.sitzung-online.de) und Hagen (allris.hagen.de) mit „Zugriff prüfen“ sowie Herne (herne.allris.net), das Programmen auch auf dem OParl-Pfad mit HTTP 403 antwortet (Stand 07.10.2026). Dazu gehören die Zugriffsprüfung „Zugriff prüfen“ in ALLRIS 4, die Meldung „zu viele Zugriffe“ und HTTP 403 auf den Kalenderseiten von ALLRIS 3 (sitzung-online.de, ratsinfo-online.de, allris.net). Solche Sperren umgehen wir nicht. Wo ALLRIS eine OParl-Schnittstelle anbietet, lesen wir bevorzugt diese.

Wir bitten um

1. Auskunft, wie Kommunen die **OParl-Schnittstelle** von ALLRIS für öffentliche Daten freischalten, und gegebenenfalls deren Freischaltung für die gehosteten Systeme;
2. die **Zulassung unserer Kennung** in der Zugriffsprüfung bzw. Sperre für die öffentlichen Seiten, gern mit Obergrenze; unser Leser hält dabei je Abruf eine Sitzung (Cookie) wie ein Browser.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## 6. hannit (Stadt und Region Hannover)

**Adressat:** hannit, IT-Dienstleister der Region Hannover, `<zuständige Stelle laut Impressum von ris.hannit.de; vor dem Versand bestätigen>`. In Kopie optional die Büros des Rates der Landeshauptstadt und der Regionsversammlung.

**Betreff:** Ratsinformationen von Stadt und Region Hannover: Zulassung eines automatisierten Abrufs

Sehr geehrte Damen und Herren,

Sie betreiben das Ratsinformationssystem von Landeshauptstadt und Region Hannover (ALLRIS unter ris.hannit.de/public/). Seit Anfang Oktober 2026 antwortet es Programmen mit der Zugriffsprüfung „Zugriff prüfen“; eine OParl-Schnittstelle fanden wir nicht (`/oparl/system` antwortet mit HTTP 404, Stand 07.10.2026). Die Zugriffsprüfung umgehen wir nicht. Damit bleiben Stadt und Region, zusammen rund 1,7 Millionen Einwohner, in Ratsmonitor ohne Berichte.

Wir bitten um

1. die Freischaltung der **OParl-Schnittstelle** von ALLRIS für die öffentlichen Daten beider Körperschaften, oder
2. die **Zulassung unserer Kennung** in der Zugriffsprüfung für die öffentlichen Seiten, gern mit Obergrenze und festem Zeitfenster.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## 7. Einzelne Städte: Herne und Wolfsburg

**Adressat:** das Büro des Rates der jeweiligen Stadt bzw. die für das Ratsinformationssystem zuständige Stelle, `<laut Impressum des Systems; vor dem Versand bestätigen>`.

**Betreff:** Ratsinformationssystem der Stadt `<Herne | Wolfsburg>`: Zugang für einen automatisierten Abruf öffentlicher Unterlagen

Sehr geehrte Damen und Herren,

Ratsmonitor bereitet öffentliche Ratsunterlagen deutscher Kommunen auf und verlinkt jeden Vorgang mit dem Original. Ihr Ratsinformationssystem lässt unseren Abruf derzeit nicht zu:

- **Herne** (herne.allris.net): Die öffentlichen Seiten und der OParl-Pfad antworten Programmen mit HTTP 403.
- **Wolfsburg** (ratsinfor.stadt.wolfsburg.de): Die OParl-Schnittstelle leitet seit dem 07.10.2026 auf die Anmeldung um; am 06.10.2026 antwortete `/oparl/bodies` noch mit HTTP 500.

Eine Sperre umgehen wir nicht. Wir bitten darum, die OParl-Schnittstelle für die öffentlichen Daten freizuschalten oder unsere Kennung für die öffentlichen Seiten zuzulassen. Falls die Umleitung auf die Anmeldung (Wolfsburg) nicht beabsichtigt ist, genügt ein Hinweis, wann die Schnittstelle wieder erreichbar ist.

`<Textbaustein „So rufen wir ab“>`

Mit freundlichen Grüßen
`<Name, Funktion, Kontakt>`

## Nach einer Zusage

1. Die Zusage mit Gebiet, Land, Datum, Umfang „freischaltung“, Kanal, Stelle (als Rolle), Adresse und Betreiber in die Freigabeliste eintragen. Die Liste liegt außerhalb des Quellcodes (`tmp/freigaben/`); das Register schreibt `node scripts/source-discovery/consents.mjs <liste.csv>` nach `tmp/freigaben/register.json`.
2. Die betroffenen Gebiete neu prüfen, wie in [scripts/source-discovery/README.md](../scripts/source-discovery/README.md) unter „Freigaben, Funde von Hand und Plattform-Mandanten“ beschrieben, danach `build.mjs`, `servers.mjs`, `ONLY_NEW=1 robots.mjs`, den Lückenatlas und die Tests.
