// Texte der Adminseiten: Seitenköpfe, Fußzeilen, Erklärungen je Abschnitt, Zustands-, Spalten- und Begriffshilfen
// (requirements/admin-performance-konzept.md, Abschnitt 6). Texte mit Zahlen stehen im JSX.
import type {AdminPage} from '@/components/admin-chrome'; // nur als Typ: sonst Kreisimport
export const href=(page:string,params='')=>'/admin?seite='+page+(params?'&'+params:'');
export type Todo={label:string;href:string};
export type Help={title:string;sub?:string;how?:string[];howLabel?:string;todo?:Todo[]};

// ---- 6.1 Seitenköpfe und Fußzeilen --------------------------------------------------------------------------------
export const PAGE_HEAD:Record<AdminPage,{title:string;intro:string}>={
 todo:{title:'To-do-Liste',intro:'Alles, was vor dem Start noch zu tun ist. Abhaken, Termin eintragen, speichern; erledigte Einträge bleiben in der Liste.'},
 uebersicht:{title:'Übersicht',intro:'Zeigt, wie viele Gebiete und Einwohner Plenara erreicht: wo eine lesbare Quelle bekannt ist, wo schon Berichte gespeichert sind, wie weit sie zurückreichen und wie aktuell sie sind.'},
 abruf:{title:'Abruf & Verarbeitung',intro:'Zeigt je Gebiet, was gespeichert und aufbereitet ist, und startet die drei Stufen: Berichte abrufen, nach festen Regeln einordnen, mit KI aufbereiten. Jede Stufe startet nur auf Klick.'},
 atlas:{title:'Lückenatlas',intro:'Zeigt für alle Gebiete Deutschlands, ob Plenara ihre Ratsinformationen lesen kann, und wenn nicht, warum – mit dem nächsten Schritt, der die Lücke schließen könnte.'},
 qualitaet:{title:'Qualität & Betrieb',intro:'Zeigt, wo der Bestand einen zweiten Blick braucht: fehlende Einordnung, unklare Verfahrensstände, Doppelungen und Defekte. Dazu die letzten Abrufe, die Datensicherung und was technisch eingerichtet ist.'},
 hochrechnung:{title:'Hochrechnung',intro:'Schätzt, wie viele Berichte alle kommunalen Gremien in Deutschland pro Tag erzeugen und wie viel Text das ist. Grundlage für die Abschätzung der KI-Kosten.'},
 regeltexte:{title:'Regelbasierte Texte',intro:'Zeigt, bei wie vielen Artikeln die Zusammenfassung von der KI oder von festen Regeln stammt und wie die Themen-Labels zustande kamen. Die Seite zählt nur, was schon gespeichert ist.'},
 stichwoerter:{title:'Stichwörter',intro:'Zeigt, an welchen Wörtern die festen Regeln Sachgebiete erkennen, welche Begriffe in den Titeln stehen und welche Stichwörter die KI vergibt. Die Seite zählt nur, was schon gespeichert ist.'},
};
export const FOOT:Record<AdminPage,string>={
 todo:'Gespeichert wird in docs/todo/todos.json, nur am lokalen Dev-Server.',
 uebersicht:'Zahlen aus Quellenkatalog und Datenbank. Doppelt gelieferte Berichte, die zu einem Vorgang zusammengeführt wurden, zählen einmal.',
 abruf:'Doppelt gelieferte Berichte zählen einmal. Seitenaufrufe starten keinen Abruf.',
 atlas:'Anbindung und Gründe aus Quellenkatalog und Quellensuche, Berichte und Abrufe aus der Datenbank. Karten: © BKG (2026), dl-de/by-2-0.',
 qualitaet:'Zahlen aus der Datenbank; doppelt gelieferte Berichte zählen einmal. Technische Prüfungen ersetzen keine fachliche Bewertung.',
 hochrechnung:'Die Hochrechnung liest nur den gespeicherten Bestand und startet keinen Abruf.',
 regeltexte:'Zahlen aus der Datenbank; die Seite startet keine Analyse.',
 stichwoerter:'Die Seite zählt nur, was frühere Schritte gespeichert haben; sie startet keine Analyse.',
};
/** Stand-Zeile je Seite: Knopf, Hinweis und Zusatz hinter dem Datum („Stand … · Aktualisieren →“). */
export const STAND_ZEILE:Partial<Record<AdminPage,{action?:string;hint?:string;extra?:string}>>={
 uebersicht:{action:'Aktualisieren'},
 abruf:{action:'Aktualisieren'},
 atlas:{action:'Aktualisieren',extra:'Gründe aus der Quellensuche vom'},
 qualitaet:{action:'Aktualisieren'},
 hochrechnung:{action:'Neu berechnen'},
 regeltexte:{action:'Aktualisieren'},
 stichwoerter:{action:'Neu zählen',hint:'Liest alle Berichte; kann einige Minuten dauern.'},
};

// ---- 6.2 Allgemeine Zustandstexte ---------------------------------------------------------------------------------
export const ZUSTAND={
 nie:'Für diese Seite ist noch kein Stand gespeichert. Die Berechnung liest alle gespeicherten Berichte einmal; danach öffnet sich die Seite sofort.',
 nieAktion:'Jetzt berechnen',
 erstes:(done:number|string,total:number|string)=>`Vorberechnung läuft: ${done} von ${total} Gebieten. Die Zahlen erscheinen, sobald alle Gebiete berechnet sind.`,
 fehler:'Die Zahlen konnten nicht geladen werden. Es werden keine geschätzten Werte angezeigt.',
 fehlerAktion:'Erneut laden',
 fehlerNeu:(fehler:string,stand:string)=>`Neu berechnen ist fehlgeschlagen: ${fehler}. Angezeigt bleibt der Stand vom ${stand}.`,
 /** title an „≈ N geänderte Datensätze seither“ */
 veraltet:'Seit der Berechnung wurden Berichte gespeichert oder geändert. Die Zahlen stimmen für den genannten Stand; „Neu berechnen“ holt den Rest nach.',
 nachrechnen:(n:number|string)=>`Kennzahlen für ${n} Gebiete werden nachgerechnet …`,
 ohne0016:'Vorberechnung noch nicht eingerichtet (Migration 0016 fehlt).',
 /** title an „veraltet“ bei einer Prüfung der Qualitätsseite */
 pruefungVeraltet:'Der Bestand hat sich seit dieser Prüfung geändert.',
};
/** 6.7 Stand-Zeilen der Seiten mit gespeichertem Stand */
export const STAND_TEXT={
 stichwoerterOhneStand:'Noch kein Stand gespeichert. Das Zählen liest alle Berichte in Schritten und dauert etwa 2–3 Minuten; danach öffnet sich die Seite sofort.',
 jetztBerechnen:'Jetzt berechnen',
 bau:(p:number|string,done:number|string,total:number|string)=>`Wird neu berechnet: ${p} % (${done} von ${total} Gebieten) · Der bisherige Stand bleibt sichtbar, bis die Zählung fertig ist.`,
 angehalten:(p:number|string)=>`Angehalten bei ${p} %`,
 fortsetzen:'Fortsetzen',
};

// ---- Wiederverwendete Absätze -------------------------------------------------------------------------------------
const REICH1='Rückreichweite: Tage von der ältesten Sitzung mit gespeichertem Bericht bis heute. Stufen ab 25, 80, 165, 330 und 700 Tagen; die Grenzen liegen etwas unter vollen Monaten, weil ein Abruf „12 Monate rückwirkend“ knapp unter einem Jahr beginnt.';
const REICH2='Eine kurze Rückreichweite heißt meist nur, dass mit kurzem Zeitraum abgerufen wurde, nicht, dass die Quelle Lücken hat.';
const REICH3='Aktualität: Tage seit der jüngsten Sitzung mit gespeichertem Bericht. „Sitzung angekündigt“: Die jüngste gespeicherte Sitzung liegt in der Zukunft. Über 90 Tage ohne Sitzung: Das Gremium ruht, oder der Abruf bringt nichts Neues.';
const REICH4='„Keine Berichte“: angebunden, aber noch nichts gespeichert.';

// ---- 6.4 Auftrag (vor HELP, weil abruf.auftrag sie auflistet) ------------------------------------------------------
export const JOB_STATE_HELP:Record<string,string>={
 'Ausstehend':'Noch nicht begonnen.',
 'Läuft':'Wird gerade gelesen oder eingeordnet.',
 'Gespeichert':'Fertig, Ergebnis gespeichert.',
 'Teilstand gespeichert':'Ein Teil ist gespeichert; ein neuer Auftrag mit demselben Zeitraum setzt fort.',
 'Fehlgeschlagen':'Mit Fehler beendet; vorher Gespeichertes bleibt. Den Grund zeigt das Protokoll des letzten Abrufs.',
 'Keine Quelle':'Gebiet ohne angebundene Quelle; übersprungen.',
 'Ausgang prüfen':'Die Antwort ist unterwegs abgebrochen, etwa durch ein Zeitlimit. Ob etwas gespeichert wurde, zeigt die Gebietsliste nach „Aktualisieren“.',
 'Beendet':'Auftrag beendet; Gespeichertes bleibt.',
};

// ---- 6.3 bis 6.9 Abschnitte ---------------------------------------------------------------------------------------
export const HELP:Record<string,Help>={
 // Übersicht
 'uebersicht.verlauf':{title:'Wie hat sich die Abdeckung entwickelt?',
  sub:'Petrol: Gebiete mit lesbarer Quelle. Schwarz: Gebiete, aus denen schon Berichte gespeichert sind. Der Abstand zwischen beiden Linien sind angebundene Gebiete ohne Berichte.',
  how:['„Quelle angebunden“ folgt dem Quellenkatalog: ein Punkt je Änderung des Katalogs, jeweils gezählt gegen den heutigen Katalog. „Arbeitsstand“ in der Tabelle sind Änderungen, die noch nicht in Git übernommen sind.',
   '„Mit gespeicherten Berichten“ zählt ein Gebiet ab dem Tag, an dem sein erster Bericht gespeichert wurde. Dieses Datum gibt es erst seit Oktober 2026; früher gespeicherte Gebiete zählen ab dem ersten Tag der Reihe.',
   'Einwohner zählen nur auf Gemeindeebene.'],
  todo:[{label:'Angebundene Gebiete ohne Berichte abrufen',href:href('abruf','filter=empty')}]},
 'uebersicht.reichweite':{title:'Wie weit zurück und wie aktuell sind die Berichte?',
  sub:'Je angebundenem Gebiet: wie weit die gespeicherten Berichte zurückreichen und wann die jüngste Sitzung war. Der Umschalter zählt nach Gebieten oder nach Einwohnern.',
  how:[REICH1,REICH2,REICH3,REICH4],
  todo:[{label:'Gebiete unter 3 Monaten abrufen',href:href('abruf','filter=shallow')},{label:'Seit über 90 Tagen ohne Sitzung',href:href('abruf','filter=quiet')},{label:'Rückreichweite auf der Karte',href:href('atlas','farbe=reach')}]},
 'uebersicht.monate':{title:'Aus welchen Monaten stammen die Berichte?',
  sub:'Balken (linke Skala): Berichte je Monat, in dem sie erstmals auf einer Tagesordnung standen. Linie (rechte Skala): Gebiete mit mindestens einem solchen Bericht im Monat. Die letzten 24 Monate.',
  howLabel:'Wie lese ich das?',
  how:['Der linke Rand zeigt, wie weit die Abrufe zurückreichen. Einbrüche im Sommer sind Sitzungspausen. Monate nach dem heutigen enthalten bereits angekündigte Sitzungen.',
   'Berichte ohne gültigen Sitzungstag (fehlend oder fehlerhaft) fehlen im Diagramm; ihre Zahl steht darunter.']},
 'uebersicht.laender':{title:'Abdeckung nach Bundesland',
  sub:'Je Land: wie viele Gebiete eine lesbare Quelle haben und aus wie vielen schon Berichte gespeichert sind. Prozent: Anteil an allen Gebieten bzw. Einwohnern des Landes.',
  todo:[{label:'Offene Gebiete im Lückenatlas',href:href('atlas')}]},
 'uebersicht.groesse':{title:'Erreichen wir große und kleine Gebiete gleich gut?',
  sub:'Dieselben Zahlen nach Einwohnerzahl des Gebiets. Kreise stehen für sich und zählen keine eigenen Einwohner.',
  how:['Kleine Gemeinden haben oft kein eigenes Ratsinformationssystem und veröffentlichen nur im Amtsblatt oder auf ihrer Website; dort sind niedrige Werte zu erwarten.']},
 'uebersicht.weiter':{title:'Als Nächstes'},
 'uebersicht.begriffe':{title:'Begriffe',sub:'Die Fachwörter der Adminseiten, kurz erklärt.'},

 // Abruf & Verarbeitung
 'abruf.gebiete':{title:'Gebiete auswählen',
  sub:'Auf der Karte oder in der Liste anklicken. Die Filter grenzen die Liste ein; „Alle Treffer auswählen“ übernimmt die ganze gefilterte Liste, etwa ein Land oder alle angebundenen Gebiete ohne Berichte.',
  howLabel:'Wie lese ich die Liste?',
  how:['Zustand: Ergebnis des letzten Abrufs; mit der Maus darauf zeigen für die Erklärung.',
   'Übernahme: letzter Abruf, dessen Ergebnis gespeichert wurde. Letzter Versuch: letzter Abruf überhaupt, auch wenn er scheiterte.',
   'Sitzungen: älteste bis jüngste Sitzung mit gespeichertem Bericht.']},
 'abruf.stufen':{title:'Drei Stufen, jede startet nur auf Klick',
  sub:'Stufe 01 holt Berichte aus den Quellen, Stufe 02 ordnet sie nach festen Regeln ein, Stufe 03 erarbeitet Inhalte mit KI. Seitenaufrufe lesen nur den Status.',
  howLabel:'Wie läuft ein Auftrag?',
  how:['Ein Abruf liest bis zu 24 Gebiete gleichzeitig, höchstens zwei auf demselben Server, die Server mit den meisten Gebieten zuerst.',
   'Die Einordnung nach Regeln läuft in Paketen von 500 Berichten, bei „alle offenen Berichte“ über alle Gebiete hinweg, bei einer Auswahl Gebiet für Gebiet; jedes Paket wird sofort gespeichert.',
   'Schließen der Seite pausiert nach den laufenden Schritten; „Auftrag fortsetzen“ macht dort weiter.']},
 // Titel und Unterzeile des Auftrags sind dynamisch (Zeitraum, Fortschritt); hier nur die Erklärung der Zustände.
 'abruf.auftrag':{title:'Auftrag',howLabel:'Was bedeuten die Zustände?',how:Object.entries(JOB_STATE_HELP).map(([k,v])=>k+': '+v)},
 'abruf.kiauftrag':{title:'KI-Auftrag'},
 'abruf.verlauf':{title:'Wie viele Berichte sind gespeichert, wie viele kommen hinzu?',
  sub:'Bestand und Zulauf der gespeicherten Berichte, für die Auswahl auf der Karte oder für alle Gebiete.',
  how:['Zeitbezug „Erste Beratung“: Ein Bericht zählt an dem Tag, an dem er erstmals auf einer Tagesordnung stand. „Aufnahme in die Datenbank“: an dem Tag, an dem Plenara ihn zuerst gespeichert hat; dieses Datum gibt es erst seit Oktober 2026.',
   'Neu pro Woche = neu pro Tag × 7; hochgerechnet pro Jahr = neu pro Tag × 365. Der Jahreswert stimmt nur, wenn alle Gebiete der Auswahl für den ganzen Zeitraum abgerufen sind; sonst ist er zu niedrig.'],
  todo:[{label:'Gebiete mit kurzer Rückreichweite',href:href('abruf','filter=shallow')}]},

 // Lückenatlas
 'atlas.anbindung':{title:'Stand der Anbindung',
  sub:'Jedes Gebiet hat genau einen Grund. Ein Klick auf den Balken oder ein Kästchen zeigt nur diese Gebiete in Karte und Liste.',
  how:['„Angebunden“ und „Eingeschaltet, Live-Prüfung ausstehend“ sind keine Lücken; alle anderen Gründe sind offene Gebiete.',
   'Was ein Grund bedeutet und was ihn behebt, steht beim einzelnen Gebiet: in Karte oder Liste anklicken.']},
 'atlas.zugang':{title:'Bekommen wir Daten, und auf welchem Weg?',
  sub:'Ja: wird gelesen. Noch nicht: ein Leser fehlt. Nein: technische Sperre oder nichts gefunden.',
  how:['OParl ist die genormte Schnittstelle für Ratsinformationen und am zuverlässigsten. „Schnittstelle (API)“: eine andere Schnittstelle der Anwendung. „HTML-Seiten“: Plenara liest die öffentlichen Webseiten. robots.txt wird beim Gebiet festgehalten, seit dem 05.10.26 aber nicht mehr befolgt; technische Sperren werden beachtet.']},
 'atlas.reichweite':{title:'Wie weit zurück reichen die Berichte?',
  sub:'Älteste Sitzung mit gespeichertem Bericht, je angebundenem Gebiet. Ein Klick filtert Karte und Liste.',
  how:[REICH1,REICH2,REICH4]},
 'atlas.aktualitaet':{title:'Wie aktuell sind die Berichte?',
  sub:'Jüngste Sitzung mit gespeichertem Bericht, je angebundenem Gebiet. Ein Klick filtert Karte und Liste.',
  how:[REICH3,REICH4]},
 'atlas.verfahren':{title:'Was die Leseverfahren liefern',
  sub:'Je Leseverfahren: wie viele angebundene Gebiete es liest und was dabei herauskommt.',
  how:['Median je Gebiet: Die Hälfte der Gebiete mit Berichten hat weniger, die Hälfte mehr.',
   '„Ab 1 Jahr zurück“: älteste Sitzung mindestens 330 Tage zurück; Anteil an allen Gebieten des Verfahrens.',
   'Viele Teilstände oder Fehlschläge bei einem Verfahren deuten auf ein Problem im Leser. Wenig „ab 1 Jahr zurück“ heißt meist: nur mit kurzem Zeitraum abgerufen.'],
  todo:[{label:'Gebiete mit fehlgeschlagenem Abruf',href:href('abruf','filter=failed')}]},

 // Qualität & Betrieb
 'qualitaet.inhalt':{title:'Prüfliste und Einordnung',
  sub:'Wie weit die Berichte aufbereitet sind, wie sie sich auf Sachgebiete und Verfahrensstände verteilen, und welche einen zweiten Blick brauchen.',
  how:['Technische Prüfungen ersetzen keine fachliche Bewertung. Die Sachgebiete stammen aus den festen Regeln (Stufe 02). KI-Sachgebiete aus dem früheren Test mit Billerbeck werden getrennt gespeichert und auf den Berichtsseiten gegenübergestellt.',
   '„Alle, auch Titeltest“: Diese Zahlen enthalten Ergebnisse des früheren Tests, bei dem die KI nur den Titel sah. Auf der Seite „Abruf & Verarbeitung“ zählen nur Ergebnisse aus dem Inhalt.'],
  todo:[{label:'Offene Berichte nach Regeln einordnen',href:href('abruf')}]},
 'qualitaet.importe':{title:'Die letzten Abrufe',
  sub:'Die letzten 30 Läufe, die dieses System gestartet hat. Extern eingespielte Daten stehen im Quellenstand der Gebiete.',
  how:['„Status offen“: Der Lauf hat sich seit über 10 Minuten nicht zurückgemeldet und ist vermutlich abgebrochen; ein offener Auftrag lässt sich auf der Seite „Abruf & Verarbeitung“ fortsetzen oder beenden.',
   'Einträge: gelesene bzw. bearbeitete Berichte des Laufs.']},
 'qualitaet.export':{title:'Export und lokale Übernahme',sub:'Sichern Sie den Bestand als Datei oder übernehmen Sie einen geprüften Export lokal.'},
 'qualitaet.vollstaendig':{title:'Was ist wirklich gespeichert?',
  sub:'Prüft je Bericht zwölf Pflichtangaben; vollständig ist ein Bericht, wenn alle erfüllt sind. Die Prüfung liest nur, sie erstellt keine Einordnung und keine KI-Texte.',
  how:['Unbekannte Werte und Quellenlücken zählen nicht als vollständig. Anwesenheit bezieht sich auf die Sitzung, nicht auf einen einzelnen Tagesordnungspunkt. Zehn bloß aus Titeln abgeleitete Stichwörter erfüllen die Inhaltsanforderung nicht.'],
  todo:[{label:'Fehlende KI-Angaben: Stufe 03',href:href('abruf')},{label:'Fehlende Regel-Einordnung: Stufe 02',href:href('abruf')}]},
 'qualitaet.pruefung':{title:'Ist der Bestand in sich stimmig?',
  sub:'Vierzehn Prüfungen lesen den gespeicherten Bestand. Jede Prüfung läuft in Schritten, ihr Ergebnis bleibt gespeichert; nichts wird verändert oder zusammengeführt.',
  howLabel:'Was tun bei Treffern?',
  how:['Doppelungen: Der Leser trennt die Gremien eines gemeinsamen Systems nicht – Aufgabe für die Entwicklung.',
   'Defekte: Gebiet neu abrufen; bleibt der Fehler, den Leser prüfen (Entwicklung).',
   'Verwaiste Einträge: Bereinigung durch die Entwicklung.',
   'Hinweise: meist korrekte, gleichlautende Punkte; nur bei Auffälligkeiten prüfen.']},
 'qualitaet.betrieb':{title:'Was ist eingerichtet?',sub:'Was technisch eingerichtet ist und was zuletzt automatisch lief.'},

 // Hochrechnung (die Abschnittsüberschrift des Ergebnisses steht im JSX; hier die aus 6.8 und die Ladeüberschrift)
 'hochrechnung.leer':{title:'Noch keine Hochrechnung gespeichert',
  sub:'Die Berechnung nutzt die vorberechneten Zahlen je Gebiet und zieht die Spannen; das dauert wenige Sekunden. Danach zeigt die Seite das Ergebnis sofort, bis Sie neu rechnen lassen.'},
 'hochrechnung.ergebnis':{title:'Wie viele Berichte und wie viel Text fallen bundesweit pro Tag an?'},

 // Stichwörter
 'stichwoerter.regeln':{title:'Welche Sachbegriffe haben die Regeln erkannt?',
  sub:'Wörter im Originaltitel, an denen die festen Regeln ein Sachgebiet erkannt haben, und in wie vielen Berichten sie stehen.'},
 'stichwoerter.titel':{title:'Welche Begriffe stehen in den Titeln?',
  sub:'Begriffe, in die eine zweite Regel jeden Titel zerlegt; sie verbinden Berichte verschiedener Gebiete zum selben Thema.'},
 'stichwoerter.ki':{title:'Welche Stichwörter vergibt die KI?',
  sub:'Gewichtete Stichwörter, die ein KI-Agent je Bericht vergeben hat; die Gewichte eines Berichts ergeben zusammen 100.'},
};

// ---- 6.11 Begriffe ------------------------------------------------------------------------------------------------
export const TERMS:{term:string;text:string}[]=[
 {term:'Gebiet',text:'Eine Stadt, eine Gemeinde, ein Gemeindeverband (Samtgemeinde, Amt, Verbandsgemeinde, Verwaltungsgemeinschaft) oder ein Kreis. Berlin und Hamburg sind je ein Gebiet.'},
 {term:'Angebunden',text:'Plenara kennt für das Gebiet eine Quelle, die ein Programm lesen kann. Ob schon Berichte gespeichert sind, ist eine eigene Zahl.'},
 {term:'Offen',text:'Für das Gebiet gibt es noch keine lesbare Quelle. Den Grund zeigt der Lückenatlas.'},
 {term:'Bericht',text:'Ein öffentlicher Tagesordnungspunkt oder Vorgang eines Gremiums. Liefern Quellen denselben Vorgang doppelt, wird er zusammengeführt und zählt einmal.'},
 {term:'Gemeindeebene',text:'Einwohner zählen nur bei Städten, Gemeinden und Gemeindeverbänden. Ein Kreis umfasst seine Gemeinden; zählte er mit, wären Menschen doppelt gezählt.'},
 {term:'Stand',text:'Zeitpunkt, zu dem die angezeigten Zahlen berechnet wurden. „≈ N geänderte Datensätze seither“: Seitdem wurden Berichte gespeichert oder geändert; auch ein erneuter Abruf ohne neuen Inhalt zählt mit.'},
 {term:'Übernahme',text:'Der letzte Abruf, dessen Ergebnis gespeichert wurde.'},
 {term:'Letzter Versuch',text:'Der letzte Abruf überhaupt, auch wenn er scheiterte.'},
 {term:'Teilstand',text:'Berichte sind gespeichert, aber der letzte Abruf hat nicht alles gelesen, etwa wegen eines Zeitlimits.'},
 {term:'Revision',text:'Laufende Nummer des Datenbestands. Sie steigt mit jeder Änderung an Berichten, früheren Fassungen und Analysen und mit jedem gespeicherten Abruf, auch wenn er nichts Neues brachte. Gleiche Nummer heißt: seitdem nichts gespeichert.'},
 {term:'Sachgebiet',text:'Thema eines Berichts, etwa Schule oder Verkehr. Feste Regeln vergeben es aus dem Titel (Stufe 02), die KI aus dem Inhalt (Stufe 03). Im Code heißt es „Label“.'},
 {term:'Titeltest',text:'Früherer Versuch, bei dem die KI nur den Titel sah (Billerbeck). Seine Ergebnisse werden getrennt gespeichert und zählen bei „aus dem Inhalt“ nicht.'},
 {term:'Erster Tagesordnungstag',text:'Der Tag, an dem ein Bericht zum ersten Mal auf einer Tagesordnung stand.'},
 {term:'Rückreichweite',text:'Wie weit die gespeicherten Berichte eines Gebiets zurückreichen, gemessen an der ältesten Sitzung.'},
 {term:'Aktualität',text:'Wie lange die jüngste Sitzung mit gespeichertem Bericht zurückliegt.'},
 {term:'OParl',text:'Genormte Schnittstelle für Ratsinformationen, für Programme gedacht und am zuverlässigsten.'},
 {term:'Schnittstelle (API)',text:'Eine andere Schnittstelle der Anwendung, über die ein Programm Daten abfragt.'},
 {term:'HTML-Seiten',text:'Keine Schnittstelle vorhanden; Plenara liest die öffentlichen Webseiten des Ratsinformationssystems.'},
 {term:'robots.txt',text:'Datei, in der eine Website Wünsche an Suchprogramme äußert. Plenara hält sie fest, befolgt sie seit dem 05.10.26 aber nicht mehr; technische Sperren werden beachtet.'},
 {term:'Zugriffsschutz',text:'Das System sperrt Programme aus (HTTP 401/403, Web-Firewall, Anmeldung). Plenara umgeht das nicht; Daten gibt es nur mit Freischaltung.'},
 {term:'Leser',text:'Das Programm, das eine bestimmte Art Ratsinformationssystem lesen kann (im Code: Adapter oder Baustein).'},
 {term:'Quellensuche',text:'Automatische Suche nach dem Ratsinformationssystem jedes Gebiets; ihr letztes Ergebnis liefert die Gründe im Lückenatlas.'},
 {term:'Median',text:'Der mittlere Wert: Die Hälfte liegt darunter, die Hälfte darüber. Einzelne Ausreißer verschieben ihn kaum.'},
 {term:'Spanne',text:'Bereich, in dem 8 von 10 Rechendurchgängen der Hochrechnung lagen.'},
 {term:'Token',text:'Texteinheit, nach der KI-Anbieter abrechnen; meist ein Wortteil von wenigen Zeichen.'},
];

// ---- 6.4 Filter, Kartenfarbe, Zustände ----------------------------------------------------------------------------
/** Hilfe zu den Listenfiltern der Abruf-Seite (all … selected) und den Filtern der Qualitätsseite (attention, html, closed). */
export const FILTER_HELP:Record<string,string>={
 all:'Alle Gebiete des Katalogs.',
 connected:'Gebiete mit einer Quelle, die Plenara lesen kann.',
 data:'Gebiete mit mindestens einem gespeicherten Bericht.',
 empty:'Quelle bekannt, aber noch kein Bericht gespeichert – Kandidaten für einen ersten Abruf.',
 issues:'Letzter Abruf gescheitert oder unvollständig, seit 7 Tagen keine neue Übernahme, noch keine Berichte, oder der Abruf hat Hinweise gespeichert.',
 partial:'Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen.',
 stale:'Die letzte erfolgreiche Übernahme ist mehr als 7 Tage her.',
 failed:'Der letzte Abruf endete mit einem Fehler; Gespeichertes bleibt.',
 shallow:'Angebunden, mit Berichten, deren älteste Sitzung weniger als 80 Tage zurückliegt.',
 quiet:'Angebunden, mit Berichten, aber seit über 90 Tagen keine gespeicherte Sitzung.',
 selected:'Nur die ausgewählten Gebiete.',
 // Filter von shared/admin.mjs (CSV-Export der Quellen); Wortlaut aus sourceHealth() und filterAdminSources() abgeleitet.
 attention:'Angebunden und noch ohne Berichte, nur teilweise gelesen, seit über 7 Tagen ohne neue Übernahme oder mit fehlgeschlagenem letztem Abruf.',
 html:'Gebiete, deren Daten Plenara aus öffentlichen HTML-Seiten liest. robots.txt wird nur festgehalten.',
 closed:'Keine Daten: Das System sperrt Programme aus (Zugriffsschutz), oder es ist kein Zugang bekannt.',
};
export const MAP_HELP:Record<string,string>={
 coverage:'Farbe = Ergebnis des letzten Abrufs. Teilstand: Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen; bei 12 und 24 Monaten setzt ein neuer Abruf mit demselben Zeitraum dort fort.',
 reach:'Älteste Sitzung mit gespeichertem Bericht. Eine kurze Reichweite heißt meist ein Abruf mit kurzem Zeitraum, keine lückenhafte Quelle. Schraffur: angebunden, noch ohne Berichte.',
 fresh:'Jüngste Sitzung mit gespeichertem Bericht. Liegt sie lange zurück, ruht das Gremium oder der Abruf bringt nichts Neues. Schraffur: angebunden, noch ohne Berichte.',
 access:'Wie Programme an die Daten kommen: OParl (genormte Schnittstelle), andere Schnittstelle (API) oder öffentliche HTML-Seiten. robots.txt wird nur festgehalten.',
 count:'Zahl der gespeicherten Berichte, gestaucht dargestellt (logarithmisch), damit auch kleine Gebiete sichtbar bleiben. Schraffur: keine Berichte.',
 rules:'Anteil der Berichte des Gebiets, die diesen Schritt fertig haben. Schraffur: keine Berichte.',
 summary:'Anteil der Berichte des Gebiets, die diesen Schritt fertig haben. Schraffur: keine Berichte.',
 aiLabel:'Anteil der Berichte des Gebiets, die diesen Schritt fertig haben. Schraffur: keine Berichte.',
 keywords:'Anteil der Berichte des Gebiets, die diesen Schritt fertig haben. Schraffur: keine Berichte.',
};
/** Legendeneinträge und Namen der Kartenfarben. Die Stufen von reach, fresh und count kommen aus dem Code. */
export const MAP_LEGEND={
 coverage:['Berichte, keine Lücke gemeldet','Teilstand','Letzter Abruf fehlgeschlagen','Angebunden, ohne Berichte','Nicht angebunden'],
 shares:['bis 20 %','über 20 bis 50 %','über 50 bis 80 %','über 80 %','keine Berichte'],
 hatched:'Schraffur',
 notConnected:'Nicht angebunden',
 none:'keine',
 more:'mehr',
} as const;
export const MAP_NAME:Record<string,string>={
 coverage:'Zustand des letzten Abrufs',reach:'Rückreichweite',fresh:'Jüngste Sitzung',access:'Zugang (OParl, API, HTML, Sperren)',count:'Anzahl Berichte',
 rules:'Anteil nach Regeln bearbeitet',summary:'Anteil mit KI-Zusammenfassung',aiLabel:'Anteil mit KI-Sachgebiet aus dem Inhalt',keywords:'Anteil mit zehn KI-Stichwörtern',
};
/** Zustände je Gebiet (Schlüssel = Text aus sourceHealth() in shared/admin.mjs). */
export const STATE_HELP:Record<string,string>={
 'Abruf fehlgeschlagen':'Der letzte Abruf endete mit einem Fehler. Die zuvor gespeicherten Berichte bleiben erhalten.',
 'Nicht angebunden':'Für das Gebiet ist keine lesbare Quelle eingetragen.',
 'Ohne Berichte':'Quelle bekannt, aber noch kein Bericht gespeichert.',
 'Teilstand':'Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen.',
 'Älter als 7 Tage':'Die letzte erfolgreiche Übernahme ist mehr als 7 Tage her.',
 'Ohne gemeldete Lücke':'Der letzte Abruf meldete weder Fehler noch Lücke. Das beweist nicht, dass die Quelle vollständig ist.',
 // Bis shared/admin.mjs umbenannt ist (6.13), liefert sourceHealth() noch die alten Texte.
 'Ohne Artikel':'Quelle bekannt, aber noch kein Bericht gespeichert.',
 'Datenstand älter':'Die letzte erfolgreiche Übernahme ist mehr als 7 Tage her.',
};

// ---- 6.5 Lückenatlas ----------------------------------------------------------------------------------------------
export const ATLAS_TODO:Record<string,{sie?:string;dev?:string}>={
 ok:{sie:'Nichts. Neue Berichte holt ein Abruf auf der Seite „Abruf & Verarbeitung“.'},
 nolink:{dev:'Mit den korrigierten Suchregeln neu prüfen; Kandidaten der Länderrecherche prüfen; Systeme bei Dienstleistern über öffentliche Zertifikatsverzeichnisse finden; Leser für Gemeinde-Websites.'},
 website:{dev:'Leser für Gemeinde-Websites, sobald die Freigabe geprüft ist.'},
 robots:{dev:'Mit dem Prüfskript (verify.mjs) neu prüfen.'},
 blocked:{sie:'Gemeinde oder Dienstleister um Freischaltung der OParl-Schnittstelle bitten (etwa ratsinfomanagement.net, Kommune aktiv, ekom21).'},
 noreader:{dev:'Leser für RIS-Portal und komuna bauen; Gebiete mit ALLRIS 3 und korrigierter Linksuche neu prüfen; Leser für häufige unbekannte Systeme.'},
 readfail:{dev:'Erneut prüfen; Mandant oder Pfad korrigieren.'},
 shared:{dev:'Gremien eines gemeinsamen Systems je Gemeinde trennen, wie es der OParl-Gremienfilter für Bremen schon kann.'},
 consent:{dev:'Freigegebene Gebiete (consents.mjs) mit dem Prüfskript prüfen; bei einer Freischaltung zuerst den Betreiber abwarten.'},
 ready:{sie:'Gebiet abrufen („Abrufen →“). Findet der Abruf nichts, nennt er den Grund.',dev:'Prüfskript ausführen (Befehl steht im Grund).'},
 special:{sie:'Berlin: Freigabe der Bezirke bzw. des ITDZ anfragen.',dev:'Hamburg: Transparenzportal anbinden, sobald entschieden ist, ob die Bezirke eigene Gebiete werden.'},
 other:{dev:'Quellensuche für das Gebiet ausführen.'},
};
/** Weitere Texte des Atlas */
export const ATLAS_TEXT={
 laden:'Alle Gebiete werden mit Anbindung, Grund und Berichtsstand geladen …',
 umschalter:['Anbindung','Zugang','Berichte','Reichweite','Aktualität'],
 kartenhilfe:'Mausrad oder Plus/Minus zoomt, Ziehen verschiebt, Klick zeigt das Gebiet.',
 legendeBerichte:['Berichte gespeichert','Teilstand','Letzter Abruf fehlgeschlagen','Angebunden, ohne Berichte','Nicht angebunden'],
 betreiber:'Betreiber (Adresse des Systems)',
 betreiberHilfe:'Internetadresse, unter der das gefundene System läuft; nur offene Gebiete, ab 3 Gebieten. Viele offene Gebiete beim selben Betreiber: Eine Freischaltung oder ein Leser öffnet sie alle.',
 neupruefung:'Neuprüfung',
 neupruefungTitle:'Seit der letzten Prüfung gibt es einen neuen Leser oder bessere Suchregeln; das Gebiet sollte neu geprüft werden.',
 felder:{
  'Gemeindeschlüssel':'Amtlicher Gemeindeschlüssel (AGS)',
  'Verfahren':'Leseverfahren, dahinter der Zugangsweg, wenn er abweicht',
  'Freigabe':'Datum der schriftlichen Zustimmung von Gemeinde oder Betreiber',
  'Geprüft':'Tag der letzten Prüfung der Quelle',
 } as Record<string,string>,
 bloecke:{grund:'Grund laut Quellensuche',warum:'Warum diese Lücke besteht',bedeutung:'Was das heißt',sie:'Was Sie tun können',dev:'Aufgabe für die Entwicklung',zugang:'Zugang für Programme',neu:'Neuprüfung vorgesehen',kandidaten:'Kandidaten aus der Länderrecherche (ungeprüft)'},
};

// ---- 6.6 Qualität & Betrieb ---------------------------------------------------------------------------------------
export const REVIEW_HELP:Record<string,string>={
 labels:'Kein Sachgebiet oder „unklar“: Die Regeln fanden im Titel kein Thema.',
 status:'Aus der Quelle geht nicht hervor, ob beraten, beschlossen oder abgelehnt wurde.',
 identity:'Quellen nennen für denselben Bericht verschiedene amtliche Vorgänge; er wurde deshalb nicht zusammengeführt.',
 summaries:'Eine Unterlage ist nicht lesbar, oder die KI-Analyse ist gescheitert, veraltet oder fand zu wenig Text.',
};
export const FIELD_HELP:Record<string,string>={
 processedAt:'Zeitpunkt der letzten Bearbeitung ist gespeichert.',
 region:'Der Bericht ist einem Gebiet zugeordnet.',
 committee:'Das beratende Gremium ist bekannt.',
 participants:'Für jede Sitzung des Berichts ist die Anwesenheit mit Quelle belegt.',
 reference:'Eine Vorgangsnummer ist da, oder es ist belegt, dass die Quelle keine führt.',
 process:'Der Verfahrensstand ist bekannt.',
 title:'Der amtliche Titel aus der Quelle ist gespeichert.',
 summary:'KI-Analyse abgeschlossen, mit Kurz- und Langfassung und Belegstellen.',
 originals:'Mindestens ein https-Link zur Quelle oder zu einer Unterlage.',
 ruleLabel:'Die festen Regeln haben den Bericht eingeordnet; auch „unklar“ zählt.',
 aiLabel:'Die KI hat ein eigenes Sachgebiet vergeben.',
 keywords:'Zehn Stichwörter aus dem Inhalt der Unterlagen, Gewichte zusammen 100.',
};
export const FIELD_FOOT='Vorhanden: Berichte, die die Angabe erfüllen. Offen: Berichte, denen sie fehlt.';
export const QUALITY_EXPLAIN:Record<string,string>={
 eventDateMismatch:'Das Datum, nach dem Listen und Zeiträume sortieren, weicht vom Sitzungsdatum im Bericht ab.',
 mergeChain:'Das Ziel eines zusammengeführten Berichts ist selbst zusammengeführt (Verweis auf einen Verweis); Leser lösen nur eine Stufe auf.',
 orphanAnalyses:'Ältere Analysefassungen, deren Bericht nicht mehr existiert.',
 orphanVersions:'Archivierte Fassungen, deren Bericht nicht mehr existiert.',
};
/** Zahlen der Inhaltsqualität: neuer Name → title */
export const QUALITY_FIGURE_HELP:Record<string,string>={
 'Als KI-Text gekennzeichnet':'Berichte, deren Text als KI-Zusammenfassung gekennzeichnet ist, aus allen bisherigen Verfahren.',
 'Ohne KI-Kennzeichnung':'Alle übrigen Berichte.',
 'Mit PDF-Unterlage':'Berichte mit mindestens einer verlinkten PDF-Datei.',
 // geprüft: quality.passed ist bei Quellenüberblicken immer false; es wird true, wenn alle automatischen Prüfungen des Berichts
 // bestehen (oparl.mjs qualityCheck: Quelle, Verfahrensstand, Länge der Kurzfassung, Öffentlichkeit; ai-summary.mjs: dazu Belege und KI-Gegenprüfung).
 'Textprüfung bestanden':'Alle automatischen Prüfungen des Berichts sind bestanden (Quelle, Verfahrensstand, Länge der Kurzfassung, Öffentlichkeit; bei KI-Zusammenfassungen zusätzlich Belege und KI-Gegenprüfung). Ein reiner Quellenüberblick besteht sie nicht.',
 'KI-Inhaltsanalyse abgeschlossen':'Die KI hat die Unterlagen gelesen und eine Analyse gespeichert.',
 'Zu wenig lesbarer Text':'Die Unterlagen enthielten zu wenig lesbaren Text, etwa nur einen Scan.',
 // geprüft: "stale" setzt article-record.mjs, wenn sich Titel, Verfahrensstand, Beratungen oder die verlinkten Unterlagen ändern (analysisSignature), nicht der Inhalt der Dateien.
 'KI-Analyse veraltet':'Titel, Verfahrensstand, Beratungen oder verlinkte Unterlagen des Berichts haben sich seit der KI-Analyse geändert.',
 'KI-Sachgebiete (alle, auch Titeltest)':'Von der KI vergebenes Sachgebiet, getrennt von dem der Regeln gespeichert.',
 'KI-Stichwortprofile (alle, auch Titeltest)':'Gewichtete Stichwörter der KI, auch aus dem Titeltest.',
};
export const QUALITY_TEXT={
 sachgebiete:'Sachgebiete',
 sachgebieteNotiz:'Nach den festen Regeln (Stufe 02), Anteil an allen Berichten. „Unklar“: Die Regeln fanden im Titel kein Sachgebiet.',
 unbekannt:'Aus der Quelle geht nicht hervor, wie weit der Vorgang ist.',
 pruefliste:'Prüfliste',
 prueflisteNotiz:'Bis zu 25 zuletzt geänderte Berichte, die zum Prüfgrund passen. Die Links öffnen den Bericht in einem neuen Tab.',
 treffer:(n:number|string)=>`${n} Berichte passen zu diesem Prüfgrund.`,
 trefferOffen:'Trefferzahl wird nachgerechnet; gezeigt werden Treffer unter den 5.000 zuletzt geänderten Berichten.',
 gebiet:'Gebiet',
 alleGebiete:'Alle Gebiete mit Berichten',
 leer:'Noch keine Abrufe protokolliert. Abrufe starten Sie auf der Seite „Abruf & Verarbeitung“.',
 art:{'Labels & Themenmerkmale':'Einordnung nach Regeln','Quellenimport':'Abruf'} as Record<string,string>,
 /** title an „Status offen“ = Abschnitt qualitaet.importe, erster Absatz */
 statusOffen:'Der Lauf hat sich seit über 10 Minuten nicht zurückgemeldet und ist vermutlich abgebrochen; ein offener Auftrag lässt sich auf der Seite „Abruf & Verarbeitung“ fortsetzen oder beenden.',
 sprungleiste:['Inhaltsqualität','Abrufe','Datenbank','Duplikate & Defekte','Betrieb','Quellen als CSV','Website ansehen'],
 exportTitel:'Gesamten Berichtsbestand sichern',
 exportText:'Enthält alle gespeicherten Berichte …',
 exportErgebnis:(a:number|string,b:number|string,c:number|string)=>`${a} von ${b} Berichten erfüllen alle Pflichtangaben. ${c} brauchen Ergänzungen.`,
 datenbank:'Revision: laufende Nummer des Datenbestands. Archivierte Fassungen: frühere Stände geänderter Berichte. Zusammengeführte Verweise: doppelt gelieferte Berichte, die auf einen anderen zeigen.',
 kiSchnittstelle:'KI-Schnittstelle',
 kiAn:'Zugang eingerichtet',
 kiAus:'Zugang nicht eingerichtet',
 push:'Benachrichtigungen im Browser. Ein gespeichertes Abonnement ist kein Nachweis einer zugestellten Nachricht.',
 analysiert:(n:number|string,m:number|string)=>`${n} Berichte analysiert. ${m} stehen in dieser Auswahl noch aus. Ein weiterer Lauf startet erst mit Ihrem nächsten Klick.`,
 uebernommen:(n:number|string)=>`${n} Berichte zur Textverarbeitung übernommen.`,
};

// ---- Spaltenhilfen -------------------------------------------------------------------------------------------------
/** title der Spaltenköpfe. Übersicht (Länder- und Größentabelle): Spaltenname; Verfahrenstabelle des Atlas: „verfahren.“ + Spaltenname. */
export const COL_HELP:Record<string,string>={
 'Gebiete':'Städte, Gemeinden, Gemeindeverbände und Kreise im Katalog.',
 'Angebunden':'Gebiete mit einer Quelle, die Plenara lesen kann; Balken = Anteil.',
 'Mit Berichten':'Gebiete mit mindestens einem gespeicherten Bericht.',
 'Einwohner angebunden':'Anteil der Einwohner (Gemeindeebene), die in einem angebundenen Gebiet leben.',
 'Einwohner mit Berichten':'Anteil der Einwohner (Gemeindeebene) in Gebieten mit gespeicherten Berichten.',
 'verfahren.Gebiete':'angebundene Gebiete mit diesem Verfahren',
 'verfahren.Mit Berichten':'mindestens ein Bericht; Anteil an den Gebieten des Verfahrens',
 'verfahren.Berichte':'gespeicherte Berichte zusammen',
 'verfahren.Median je Gebiet':'mittlere Zahl der Berichte der Gebiete mit Berichten',
 'verfahren.Ab 1 Jahr zurück':'älteste Sitzung ≥ 330 Tage zurück; Anteil an allen Gebieten des Verfahrens',
 'verfahren.Teilstand':'Gebiete mit Teilstand',
 'verfahren.Abruf fehlgeschlagen':'Gebiete, deren letzter Abruf scheiterte',
};

// ---- Übersicht: Fußnoten, Notizen, Links ----------------------------------------------------------------------------
export const UEBERSICHT_TEXT={
 // geprüft gegen shared/coverage.mjs:12-20: Einwohner zählen nur bei kind==='city' (Städte, Gemeinden, Gemeindeverbände); Kreise (kind 'district') nicht.
 fussnote:'Einwohner zählen nur bei Städten, Gemeinden und Gemeindeverbänden; ein Kreis umfasst seine Gemeinden. Ist nur der Kreis angebunden, zählen seine Einwohner hier nicht mit.',
 balken:'Balken: Petrol = angebunden, Schwarz = mit Berichten.',
 kennzahlen:'Abdeckung heute',
 legendeMonate:['Berichte','Gebiete mit Berichten im Monat'],
 reichweite:(deep:number|string,shallow:number|string)=>`${deep} Gebiete reichen mindestens ein Jahr zurück, ${shallow} weniger als drei Monate.`,
 aktualitaet:(current:number|string,quiet:number|string)=>`${current} Gebiete hatten in den letzten 30 Tagen eine Sitzung oder haben eine angekündigt, ${quiet} seit über 90 Tagen keine.`,
 monate:(undated:number|string)=>`${undated} Berichte ohne gültigen Sitzungstag (fehlend oder fehlerhaft) sind nicht enthalten.`,
 verlauf:(undatedAreas:number|string)=>`${undatedAreas} Gebiete wurden vor Oktober 2026 gespeichert und zählen ab dem ersten Tag der Reihe.`,
 weiterOffen:(n:number|string)=>`${n} offene Gebiete: warum, und was sie schließen könnte`,
 weiterAbruf:'Angebundene Gebiete ohne Berichte abrufen',
 weiterPruefliste:'Prüfliste, letzte Abrufe, Datenbank',
};

// ---- Abruf & Verarbeitung: Stufen, Rückfragen, Protokoll ----------------------------------------------------------
export const STUFEN={
 regeln:'Feste Regeln ordnen jeden Bericht anhand seines amtlichen Titels einem Sachgebiet zu und zerlegen den Titel in Begriffe für den Vergleich zwischen Gebieten. Ohne KI, ohne Kosten. Jedes Paket von 500 Berichten wird sofort gespeichert; Sie können jederzeit pausieren und später dort fortsetzen.',
 regelnFortschritt:(a:number|string,b:number|string)=>`${a} von ${b} Berichten nach Regeln bearbeitet`,
 regelnKlein:(c:number|string)=>`${c} offen · gilt für den ganzen Bestand, nicht nur für Ihre Auswahl`,
 regelnKnopf:'Alle offenen Berichte einordnen',
 regelnAuswahl:(n:number|string,m:number|string)=>`Nur die Auswahl: ${n} offene Berichte in ${m} Gebieten`,
 ki:'Ein KI-Agent Ihrer Wahl liest die Originalunterlagen der Auswahl. Sie laden den Auftrag herunter, starten ihn selbst in Ihrem Projekt und lesen das Ergebnis hier wieder ein.',
 kiSchritte:['KI-Zusammenfassung','KI-Sachgebiet aus dem Inhalt','Zehn gewichtete Stichwörter'],
 kiSchrittZeile:(a:number|string,b:number|string,c:number|string)=>`${a} von ${b} gespeichert · ${c} ohne ausreichende Quelle`,
 kiQuelleTitel:'Was heißt „ohne ausreichende Quelle“?',
 kiQuelle:'Ein früherer Versuch fand zu wenig lesbaren Text, etwa nur einen Titel oder einen Scan. Diese Berichte werden erst wieder angefordert, wenn sich ihre Quelldaten ändern – oder mit dem Haken „erneut versuchen“, der nur nach einer Änderung am Verfahren sinnvoll ist.',
 kiAnzahlLabel:'Berichte je KI-Auftrag',
 kiAnzahl:['10 · Testlauf','25 Berichte','50 Berichte','100 Berichte','Alle offenen Berichte'],
 kiHaken:'Berichte ohne ausreichende Quelle erneut versuchen',
 kiKlein:'Je Bericht werden nur die fehlenden Schritte angefordert, zuerst nie exportierte Berichte. Ein offener Auftrag reserviert seine Berichte bis zur Übernahme oder zum Verwerfen.',
 kiPrepared:'Reserviert – der Download allein ist keine erfolgreiche Bearbeitung. Geben Sie den Auftrag an Ihren KI-Agenten und lesen Sie die Ergebnisse hier ein; mehrere Teildateien sind möglich. Solange Berichte fehlen, bleibt der Auftrag offen.',
};
export const AUFTRAG_TITEL={
 abruf:(zeitraum:string)=>`Abrufauftrag · ${zeitraum} rückwirkend`,
 alle:(zeitraum:string)=>`Abruf aller Quellen in Deutschland · ${zeitraum} rückwirkend`,
 regeln:'Einordnung nach Regeln · alle offenen Berichte',
 status:{running:'Läuft',paused:'Pausiert – wartet auf Ihren Start',done:'Beendet'},
};
export const CONFIRM={
 alleAbrufen:{title:'Alle angebundenen Quellen abrufen?',text:(n:number|string)=>`Der Abruf liest ${n} Gebiete und belegt die Datenbank, solange er läuft. Sie können jederzeit pausieren; Gespeichertes bleibt.`,confirmLabel:'Abruf starten'},
 beenden:{title:'Offenen Auftrag beenden?',text:'Bereits Gespeichertes bleibt erhalten; noch nicht begonnene Gebiete werden nicht mehr abgerufen.',confirmLabel:'Beenden'},
 kiVerwerfen:{title:'KI-Auftrag verwerfen?',text:'Die reservierten Berichte werden wieder frei, stehen aber hinter bisher nicht exportierten Berichten. Vorhandene Analyseergebnisse bleiben erhalten.',confirmLabel:'Verwerfen'},
};
export const ABRUF_TEXT={
 zeile:(uebernahme:string,versuch:string,von:string,bis:string)=>`Übernahme ${uebernahme} · Letzter Versuch ${versuch} · Sitzungen ${von} bis ${bis}`,
 verarbeitung:'Verarbeitung & Quellenhinweise',
 verarbeitungZeilen:['Nach Regeln bearbeitet','KI-Zusammenfassung','KI-Sachgebiet aus dem Inhalt','Zehn KI-Stichwörter aus dem Inhalt'],
 verarbeitungKlein:'Die drei KI-Zahlen zählen nur, was aus dem Inhalt der Unterlagen entstand; der frühere Titeltest zählt hier nicht.',
 // geprüft: issues machen einen Abruf unvollständig (complete = issues.length===0 …), warnings nicht (z. B. allris.mjs, citystates.mjs).
 hinweise:'Hinweise: Der Abruf meldet, dass etwas fehlt oder nicht gelesen wurde. Warnungen: Auffälligkeiten, die den Abruf nicht unvollständig machen.',
 keineHinweise:'Keine Abrufhinweise gespeichert. Das bestätigt keine vollständige Quelle.',
 zeitbezug:{event:'Erste Beratung (Sitzungsdatum)',import:'Aufnahme in die Datenbank'},
 zeitbezugImport:'Zeigt, wann Plenara Berichte geholt hat, nicht wann sie entstanden.',
 verlaufNotizen:{
  bestand:(n:number|string)=>`Berichte bis heute; dazu ${n} für schon angekündigte Sitzungen`,
  proTag:(tage:number|string,x:number|string,mit:number|string)=>`Durchschnitt über ${tage} Kalendertage · ${x} an den ${mit} Tagen mit Zulauf`,
  proWoche:(dd:string,n:number|string)=>`pro Tag × 7 · Spitzenwoche ab ${dd}: ${n}`,
  proJahr:(dd:string,n:number|string)=>`pro Tag × 365 · Spitzentag ${dd}: ${n}`,
 },
};
/** Protokoll des letzten Abrufs (admin-run-debug.tsx) */
export const PROTOKOLL={
 knopf:'Protokoll des letzten Abrufs',
 ausblenden:'Protokoll ausblenden',
 fehler:'Das Protokoll konnte nicht geladen werden.',
 aria:(name:string)=>`Protokoll: ${name}`,
 feld:'Zeitraum · Leser',
 howTitel:'Was bedeuten die Angaben?',
 how:[
  'Leser: das Programm für diese Art Ratsinformationssystem.',
  'Unverändert übersprungen: Sitzungen, die sich seit dem letzten Abruf nicht geändert haben, werden nicht erneut gelesen.',
  'Wartezeit: Summe aller Antwortzeiten; Anfragen laufen teils gleichzeitig, deshalb kann sie länger sein als der Abruf.',
  // geprüft: requestKind() in server/integrations/import-trace.mjs und die Integrationen kennen si, to, vo und do; kp und pe kommen im Code nicht vor.
  'Art: Seitentyp, aus der Adresse gelesen. SessionNet und ALLRIS benennen Seiten mit Kürzeln, z. B. si = Sitzungen, to = Tagesordnung, vo = Vorlagen, do = Dokumente; „oparl“ = OParl-Schnittstelle; „api …“ = Schnittstelle der Anwendung.',
 ],
 fuss:'Aufgezeichnet wird der jeweils letzte Abruf eines Gebiets; ältere Läufe stehen mit ihren Kennzahlen darunter.',
};

// ---- title-Texte einzelner Kennzahlen und Spalten -----------------------------------------------------------------
export const TITLES={
 revision:'Revision: laufende Nummer des Datenbestands; sie steigt mit jedem Speichern, auch bei einem Abruf ohne neue Berichte.',
 token:'Token: Texteinheit, nach der KI-Anbieter abrechnen; meist ein Wortteil von wenigen Zeichen.',
 gewicht:'Gewichtssumme geteilt durch die Zahl der Berichte. Hoch heißt: Das Stichwort ist dort meist zentral.',
 uebernahme:'Der letzte Abruf, dessen Ergebnis gespeichert wurde.',
 versuch:'Der letzte Abruf überhaupt, auch wenn er scheiterte.',
 /** todo.ueberfaellig (12 px unter dem Fortschritt) */
 ueberfaellig:'Überfällig: Der Termin liegt vor heute, und der Eintrag ist nicht erledigt.',
};

// ---- 6.8 Hochrechnung ---------------------------------------------------------------------------------------------
export const HOCHRECHNUNG={
 kurz:(perDay:string,low:string,high:string,connectedShare:string)=>`Kurz gesagt: Alle kommunalen Gremien in Deutschland bringen zusammen rund ${perDay} neue Berichte (Tagesordnungspunkte) pro Tag auf, Spanne ${low} bis ${high}. Mit den heutigen Quellen könnte Plenara davon etwa ${connectedShare} lesen. Nur ein Teil ist gezählt, der Rest hochgerechnet; die Marken „gezählt“, „gerechnet“ und „angenommen“ zeigen, worauf jede Zahl beruht.`,
 leerKnopf:'Jetzt berechnen',
 vorVorberechnung:(done:number|string,total:number|string)=>`Die Hochrechnung ist erst möglich, wenn die Zahlen je Gebiet vorberechnet sind (${done} von ${total}).`,
 standExtra:(sampleCount:number|string,from:string,to:string)=>` · ${sampleCount} Beispiele mit vollständigem Jahr · ${from} bis ${to}`,
 lesbar:(n:number|string)=>`rund ${n} Berichte pro Tag mit den vorhandenen Anbindungen; große Gebiete zählen mehr, weil sie mehr Berichte haben`,
 schritt2:'Sobald ein Gebiet mit „12 Monate“ abgerufen ist, zählt es nach dem nächsten „Neu berechnen“ als Beispiel.',
 linkAbruf:'… auf der Seite „Abruf & Verarbeitung“ auswählen',
 schritt3:'Je mehr Einwohner ein Gebiet hat, desto mehr Berichte entstehen, aber nicht im gleichen Maß. Die Kurve beschreibt diesen Zusammenhang; beide Achsen sind gestaucht (logarithmisch), damit kleine und große Gebiete zugleich lesbar sind.',
 // geprüft: shared/estimate.mjs fitLevel(): scatter = Standardabweichung der Abweichungen im Logarithmus; ×/÷ f = exp(scatter), das gilt für etwa zwei Drittel der Beispiele (so steht es auch in admin-estimate.tsx).
 streuung:(f:number|string)=>`Etwa zwei Drittel der Beispiele liegen höchstens um das ${f}-Fache über oder unter der Kurve.`,
 schritt5:'(ein Beispiel kann mehrfach gezogen werden)',
 schritt6:'Leser',
 schritt7:'ein zweites Zählverfahren (o200k)',
 neuRechnen:'bis Sie neu rechnen lassen',
};

// ---- 6.9 Stichwörter, 6.10 To-do und Anmeldung -------------------------------------------------------------------
export const STICHWOERTER_NOTES={
 berichte:'Doppelungen einmal gezählt',
 sachbegriffe:(n:number|string)=>`in ${n} Berichten · Wörter, an denen die Regeln ein Sachgebiet erkannt haben`,
 titelbegriffe:(n:number|string)=>`aus ${n} ausgewerteten Berichten · verbinden gleiche Themen über Gebiete hinweg`,
 ki:(n:number|string)=>`aus ${n} Stichwortprofilen`,
};
export const RAHMEN={
 anmelden:{title:'Geschützter Bereich',text:'Melden Sie sich mit ChatGPT an, um die Administration zu öffnen.',knopf:'Mit ChatGPT anmelden'},
 keinZugriffLink:'Konto wechseln',
 fehler:{title:'Administration nicht erreichbar',text:'Die Zugangsprüfung hat gerade nicht geantwortet. Bitte versuchen Sie es gleich noch einmal.',knopf:'Erneut versuchen'},
};
