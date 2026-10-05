# Entwurf: Zugang zu Gemeinde-Websites bei verwaltungsportal.de und zum Sitzungsdienst „councilservice“

Stand 05.10.2026. Entwurf zur Anpassung und zum Versand durch den Projektinhaber. Platzhalter in spitzen Klammern.

## Anlass

- Rund 350 der offenen Gebiete haben eine Website, die verwaltungsportal.de betreibt (zwei IP-Adressen, `144.76.55.199` und `178.63.30.37`, weitere einzeln). Viele davon zeigen ihre Sitzungen über den eingebetteten Sitzungsdienst von mein-intra.net (Modul „councilservice“), etwa Sonnewalde, Calau, Mulda/Sa. oder Werra-Suhl-Tal. Beide gehören erkennbar zur selben Software-Familie („portuna“ im Code beider Seiten).
- Unser Suchlauf am 05.10.2026 (bis zu 21 Seiten je Website, höchstens zwei Anfragen je Server gleichzeitig) wurde im Lauf des Vormittags mit „Zugriff verweigert“ (HTTP 403) beantwortet; die Sperre bestand um 10:54 Uhr und noch um 13:16 Uhr. 202 Gemeinden mit Sitzungsdienst auf der Startseite konnten deshalb nicht geprüft werden. Der Sitzungsdienst selbst (`<mandant>.mein-intra.net`) antwortete die ganze Zeit normal.
- Wir umgehen Sperren nicht (keine andere Kennung, keine andere Adresse). Die Gemeinden bleiben offen, bis der Betreiber den Zugang zulässt.

## Adressat

**Betreiber von verwaltungsportal.de und mein-intra.net:** `<Name laut Impressum; vor dem Versand bestätigen, z. B. über das Impressum einer betroffenen Gemeinde-Website>`. In Kopie optional eine betroffene Gemeinde (etwa die Stadt Sonnewalde), die ihre Sitzungen auf diesem Weg veröffentlicht.

## Text

**Betreff:** Zugriff von Ratsmonitor auf Gemeinde-Websites bei verwaltungsportal.de und auf den öffentlichen Sitzungsdienst

Sehr geehrte Damen und Herren,

wir betreiben Ratsmonitor, ein <gemeinnütziges/privates> Projekt, das öffentliche Vorgänge aus Gemeinderäten, Kreistagen und Gemeindeverbänden in ganz Deutschland verständlich zusammenfasst und nach Orten durchsuchbar macht. Heute lesen wir die öffentlichen Unterlagen von rund 2.100 Gebieten; jeder Vorgang verlinkt das Original.

Viele Gemeinden, deren Websites Sie betreiben, veröffentlichen ihre Sitzungen über den Sitzungsdienst von mein-intra.net, der in die Website eingebettet ist. Am 05.10.2026 haben wir diese Websites mit einem Suchprogramm nach dem Sitzungsdienst durchsucht. Dabei haben wir zu viele Seiten in zu kurzer Zeit abgerufen, und Ihre Systeme haben unsere Kennung gesperrt. Das bedauern wir. Wir haben unser Vorgehen daraufhin geändert:

- **Kennung:** Die Suche nennt sich `Ratsmonitor-SourceCatalog/1.0 (public council information; https://github.com/EsMa001/Ratsmonitor)`, der laufende Abruf `VorOrt-PoliticalTopics/0.5 (public council documents)`, nie mit einer Browser-Kennung. So können Sie unseren Abruf in Ihren Protokollen erkennen und gezielt zulassen oder begrenzen.
- **Last auf den Websites:** Je Gemeinde nur noch die Startseite und die eine Seite, die den Sitzungsdienst einbettet, einmalig beim Einrichten; eine Anfrage je Server zur Zeit, danach mindestens vier Sekunden Pause. Für rund 200 Gemeinden sind das etwa 400 Anfragen, verteilt über eine halbe Stunde. Danach rufen wir die Websites nicht mehr ab.
- **Sitzungsdienst:** Der laufende Abruf fragt nur die Schnittstelle, die die eingebettete Seite für jeden Besucher abfragt (Sitzungsliste eines Zeitraums, einzelne Sitzung, öffentliche Dateien), mit dem Export-Schlüssel der Website und ohne Anmeldung. Höchstens zwei Anfragen gleichzeitig für alle Gemeinden zusammen; bereits gelesene, unveränderte Sitzungen werden nicht erneut abgefragt.
- **Umfang:** nur freigegebene Sitzungen und öffentliche Tagesordnungspunkte. Punkte, die als nichtöffentlich gekennzeichnet oder ausgeblendet sind, und Dateien des nichtöffentlichen Teils übernehmen wir nicht.

Wir bitten Sie um eines der Folgenden:

1. **Aufhebung der Sperre** für unsere Kennung (und gegebenenfalls `<unsere IP-Adresse>`), gern mit einer Obergrenze, an die wir uns halten (Anfragen je Minute, Zeitfenster).
2. **Oder** eine Liste der Gemeinden, die den Sitzungsdienst öffentlich einbetten, mit der Adresse der jeweiligen Seite. Dann müssen wir die Websites gar nicht durchsuchen.
3. **Bestätigung**, dass Sie mit dem beschriebenen Abruf des öffentlichen Sitzungsdienstes einverstanden sind. Falls es eine vorgesehene Schnittstelle gibt (etwa OParl), nutzen wir lieber diese.

Für Rückfragen und eine Abstimmung über Zeitfenster oder Abrufhäufigkeit stehen wir gern zur Verfügung.

Mit freundlichen Grüßen
<Name, Funktion, Kontakt>
