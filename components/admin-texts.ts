// Texte der Adminseiten: Seitenköpfe, Fußzeilen, Erklärungen je Abschnitt, Zustands-, Spalten- und Begriffshilfen
// (requirements/admin-performance-konzept.md, Abschnitt 6). Texte mit Zahlen stehen im JSX.
import type {AdminPage} from '@/components/admin-chrome'; // nur als Typ: sonst Kreisimport
export const href=(page:string,params='')=>'/admin?seite='+page+(params?'&'+params:'');
export type Todo={label:string;href:string};
export type Help={title:string;sub?:string;how?:string[];howLabel?:string;todo?:Todo[]};

// ---- 6.1 Seitenköpfe und Fußzeilen --------------------------------------------------------------------------------
export const PAGE_HEAD:Record<AdminPage,{title:string;intro:string}>={
 start:{title:'Cockpit',intro:'Der Stand auf einen Blick: wie viel Plenara erreicht, ob die letzte Nacht durchgelaufen ist, was gerade läuft, was scheitert und ob der Platz reicht. Jede Zahl führt zu ihrer Seite.'},
 abdeckung:{title:'Abdeckung',intro:'Zeigt, wie viele Gebiete und Einwohner Plenara erreicht: wo eine lesbare Quelle bekannt ist, wo schon Berichte gespeichert sind, wie weit sie zurückreichen und wie aktuell sie sind.'},
 atlas:{title:'Lückenatlas',intro:'Zeigt für alle Gebiete Deutschlands, ob Plenara ihre Ratsinformationen lesen kann, und wenn nicht, warum – mit dem nächsten Schritt, der die Lücke schließen könnte.'},
 nacht:{title:'Letzte Nacht',intro:'Die Tagespipeline im Blick: welcher Job wann lief, was Abruf, Extraktion, Verarbeitung und Nacharbeit getan haben und welchen Weg die Berichte genommen haben.'},
 abruf:{title:'Abruf',intro:'Zeigt je Gebiet, was gespeichert ist, und holt Berichte von Hand: Gebiete wählen, Zeitraum wählen, Auftrag anlegen. Nachts ruft die Tagespipeline von selbst ab; diese Seite ist für alles Weitere.'},
 pdf:{title:'PDF-Import',intro:'Lädt die PDF-Dokumente der Berichte in die eigene Ablage, liest ihren Text und hält die feste Grenze von 80 GB ein. Zeigt, was gerade läuft, wie vollständig die Ablage ist, was fehlschlägt und warum, und startet Läufe von Hand.'},
 verarbeitung:{title:'KI-Aufbereitung',intro:'Zeigt, was die KI aus dem Inhalt der Unterlagen bearbeitet hat (Kurz- und Langfassung, Thema aus dem Inhalt) und welche Berichte für den Agenten bereitstehen. Die KI arbeitet nur über den Agentenablauf, nie von selbst.'},
 altbestand:{title:'Altbestand',intro:'Holt nach, was älter ist als der Tagesbereich oder vor dem 12.10.2026 gescheitert ist: Berichte rückwirkend abrufen, PDFs und Text extrahieren, alte Fehler erneut versuchen, Regeln neu anwenden. Nur auf Knopfdruck.'},
 regeltexte:{title:'Einordnungsmodell',intro:'Wie das Modell jeden Bericht einordnet (Art, Thema, Vorgangsart, Status und weitere Fragen), wie gut es gemessen ist und was der letzte Lauf getan hat. Dazu Zusammenfassung und Fakten, die Regeln bleiben. Die Seite zählt nur, was schon gespeichert ist.'},
 pruefliste:{title:'Prüfliste',intro:'Zeigt, wo der Bestand einen zweiten Blick braucht: Berichte ohne Thema, unklare Verfahrensstände und weitere Prüfgründe, je Gebiet. Dazu, wie viel als KI-Text gekennzeichnet und geprüft ist.'},
 bestand:{title:'Bestandsprüfung',intro:'Prüft, ob der gespeicherte Bestand vollständig und in sich stimmig ist: Pflichtangaben je Bericht, technische Prüfungen auf Doppelungen und Defekte. Dazu der Stand der Datenbank, die letzte Übernahme eines Exports und der vollständige Datenexport.'},
 steuerung:{title:'Steuerung',intro:'Die einzige Stelle mit Schaltern: alle Jobs, die auf dem Server von selbst laufen, nach Ablauf gruppiert. Hier schaltet man sie ein und aus, ändert ihre Zeit, startet sie einmal sofort oder hält sie an. Die übrigen Seiten zeigen nur Stand und Ergebnis und führen mit „Steuern →“ hierher.'},
 fehler:{title:'Fehler & Server',intro:'Der Fehlerspeicher aller Stufen an einem Ort: was gescheitert ist, warum und wann es erneut versucht wird, getrennt nach Tagesbereich und Altbestand. Dazu die Server, die gerade ausgelassen werden, und Fehler im eigenen Code.'},
 speicher:{title:'Speicher & Sicherungen',intro:'Zeigt, was auf der Festplatte des Servers wie viel Platz belegt: Datenbank und ihre größten Tabellen, PDF-Ablage, Sicherungen, Programmstände, OCR-Werkzeuge. Dazu, welche Sicherungen es gibt, wie groß und wie alt sie sind.'},
 todo:{title:'To-do-Liste',intro:'Aktuelle Aufgaben und nächste Vorhaben für Plenara.'},
 hochrechnung:{title:'Hochrechnung',intro:'Schätzt, wie viele Berichte alle kommunalen Gremien in Deutschland pro Tag erzeugen und wie viel Text das ist. Grundlage für die Abschätzung der KI-Kosten.'},
 social:{title:'Social Media',intro:'Schlägt je Tag bis zu drei Einzelfälle aus Orten vor, die polarisieren können. Ausgewählt über das Unterthema des Modells und seine gelernte Streitquote, verstärkt durch Fraktionsanträge und den Status (abgelehnt oder vertagt zählt mehr). Zu jedem Vorschlag gibt es einen kurzen Textentwurf aus festen Satzvorlagen. Ohne fremden Dienst; schwache Tage bleiben leer.'},
};
export const FOOT:Record<AdminPage,string>={
 start:'Jede Kachel liest denselben Stand wie ihre Seite; das Cockpit rechnet nichts und startet nichts.',
 abdeckung:'Zahlen aus Quellenkatalog und Datenbank. Doppelt gelieferte Berichte, die zu einem Vorgang zusammengeführt wurden, zählen einmal.',
 atlas:'Anbindung und Gründe aus Quellenkatalog und Quellensuche, Berichte und Abrufe aus der Datenbank. Karten: © GeoBasis-DE / BKG 2025, dl-de/by-2-0.',
 nacht:'Liest nur gespeicherte Stände: Laufbuch des Zeitplaners, Protokolle der Jobs und die Zählung der Wege (am Ende von „Einordnung, nachts“).',
 abruf:'Doppelt gelieferte Berichte zählen einmal. Seitenaufrufe starten keinen Abruf.',
 pdf:'Stand aus der letzten Zählung auf dem Server (scripts/pdf-store/stats.mjs), Fortschritt jede Minute. Die Knöpfe legen einen Auftrag an und stoßen den Server sofort an; ein weiterer Auftrag wartet, bis der laufende fertig ist.',
 verarbeitung:'Zahlen aus der Datenbank. Die KI arbeitet nur über den Agentenablauf; die Liste zeigt, was je Bericht bereitsteht.',
 altbestand:'Die Seite legt nur Wünsche ab; ausgeführt wird auf dem Server zwischen 10 und 22 Uhr (Jobs „Altbestand“, „OCR, tagsüber“, „PDF-Aufträge“).',
 regeltexte:'Zahlen aus der Datenbank; „Jetzt erstellen“ startet den Job auf dem Server.',
 pruefliste:'Zahlen aus der Datenbank; doppelt gelieferte Berichte zählen einmal.',
 bestand:'Technische Prüfungen ersetzen keine fachliche Bewertung. Die Seite ändert nichts am Bestand.',
 steuerung:'Die Timer auf dem Server fragen alle 10 Minuten (scripts/schedule.mjs); „Jetzt ausführen“ startet den Job sofort, auch wenn er ausgeschaltet ist (der Schalter stoppt nur die geplanten Zeiten). Uhrzeiten in deutscher Zeit.',
 fehler:'Aus dem Fehlerspeicher (Migration 0040, server/integrations/work-failures.mjs). „Erneut versuchen“ macht Einträge nur fällig; ausgeführt wird von der Nacharbeit bzw. dem Job „Altbestand“.',
 speicher:'Gemessen auf dem Server (scripts/server-disk.mjs) höchstens stündlich, Tabellen der Datenbank einmal am Tag. Die Seite löscht nichts.',
 todo:'Interne Projektplanung · Plenara',
 hochrechnung:'Die Hochrechnung liest nur den gespeicherten Bestand und startet keinen Abruf.',
 social:'Vorschläge aus den gespeicherten Berichten; vor einem Beitrag Zahl und Fundstellen prüfen. Die Seite startet keine Analyse.',
};

// ---- 6.2 Allgemeine Zustandstexte ---------------------------------------------------------------------------------
export const ZUSTAND={
 fehler:'Die Zahlen konnten nicht geladen werden. Es werden keine geschätzten Werte angezeigt.',
 fehlerNeu:(fehler:string,stand:string)=>`Neu berechnen ist fehlgeschlagen: ${fehler}. Angezeigt bleibt der Stand vom ${stand}.`,
 /** title an „veraltet“ bei einer Prüfung der Qualitätsseite */
 pruefungVeraltet:'Der Bestand hat sich seit dieser Prüfung geändert.',
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
 // Abdeckung (früher „Übersicht“; die Schlüssel behalten den alten Namen)
 'uebersicht.verlauf':{title:'Wie hat sich die Abdeckung entwickelt?',
  sub:'Petrol: Gebiete mit lesbarer Quelle. Schwarz: Gebiete, aus denen schon Berichte gespeichert sind. Der Abstand zwischen beiden Linien sind angebundene Gebiete ohne Berichte.',
  how:['„Quelle angebunden“ folgt dem Quellenkatalog: ein Punkt je Änderung des Katalogs, jeweils gezählt gegen den heutigen Katalog. „Arbeitsstand“ in der Tabelle sind Änderungen, die noch nicht in Git übernommen sind.',
   '„Mit gespeicherten Berichten“ zählt ein Gebiet ab dem Tag, an dem sein erster Bericht gespeichert wurde. Dieses Datum gibt es erst seit Oktober 2026; früher gespeicherte Gebiete zählen ab dem ersten Tag der Reihe.',
   '„Genug Berichte“ (Orange-Braun) zählt je Tag die Gebiete, die im Mittel der letzten 30 bzw. 90 Tage mindestens 0,1 Berichte je 1.000 Einwohner und Monat haben, nach Sitzungstag: eine Gemeinde mit 10.000 Einwohnern braucht dafür einen Bericht im Monat, ein Kreis mit 300.000 Einwohnern 30. Die Schwelle ist bewusst niedrig; darüber ist ein Gebiet vernünftig angebunden.',
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
 'uebersicht.begriffe':{title:'Begriffe',sub:'Die Fachwörter der Adminseiten, kurz erklärt.'},

 // Abruf
 'abruf.gebiete':{title:'Gebiete auswählen',
  sub:'Auf der Karte oder in der Liste anklicken. Die Filter grenzen die Liste ein; „Alle Treffer auswählen“ übernimmt die ganze gefilterte Liste, etwa ein Land oder alle angebundenen Gebiete ohne Berichte.',
  howLabel:'Wie lese ich die Liste?',
  how:['Zustand: Ergebnis des letzten Abrufs; mit der Maus darauf zeigen für die Erklärung.',
   'Übernahme: letzter Abruf, dessen Ergebnis gespeichert wurde. Letzter Versuch: letzter Abruf überhaupt, auch wenn er scheiterte.',
   'Sitzungen: älteste bis jüngste Sitzung mit gespeichertem Bericht.']},
 'abruf.stufen':{title:'Berichte abrufen',
  sub:'Holt Berichte für die Auswahl oder für alle angebundenen Quellen. Nachts ruft die Tagespipeline einen Tag zurück ab (sonntags einen Monat); hier geht es um alles Weitere. Seitenaufrufe lesen nur den Status.',
  howLabel:'Wie läuft ein Auftrag?',
  how:['Ein Abruf liest bis zu 24 Gebiete gleichzeitig, höchstens zwei auf demselben Server, die Server mit den meisten Gebieten zuerst.',
   '„Im Hintergrund abrufen“ legt den Auftrag nur an; der Importprozess auf dem Server arbeitet ihn ab, auch wenn die Seite geschlossen ist.',
   'Ein Abruf, den diese Seite selbst ausführt, pausiert beim Schließen nach den laufenden Schritten; „Auftrag fortsetzen“ macht dort weiter.']},
 // Verarbeitung
 'verarbeitung.regeln':{title:'Nach Regeln',
  sub:'Das Modell ordnet jeden Bericht ein (Art, Thema, Vorgangsart, Hauptdokument), danach schreiben feste Regeln Zusammenfassung und Fakten. Lokal, ohne fremden Dienst. Nachts von selbst, für Berichte mit neuen Eingaben.',
  how:['Der Job „Einordnung, nachts“ wendet zuerst das Modell auf geänderte Berichte an, schreibt dann Zusammenfassung und Fakten je Bericht und führt danach Suche und Zahlen für plenara.X nach.',
   '„Alle neu erstellen“ (nach geänderten Regeln) steht auf „Einordnungsmodell“ und im Altbestand.']},
 'verarbeitung.ki':{title:'Mit KI',
  sub:'Die KI startet nie von selbst. Ein Agent liest die gespeicherten Originaltexte über die interne MCP-Verbindung; diese Liste zeigt je Bericht, was schon vorliegt, und liefert die IDs für den Auftrag.',
  how:['Ablauf des Agenten: list, claim, read, submit (requirements/ai-processing.md). Kurzfassung, Langfassung und KI-Thema werden immer gemeinsam gespeichert.']},
 // Titel und Unterzeile des Auftrags sind dynamisch (Zeitraum, Fortschritt); hier nur die Erklärung der Zustände.
 'abruf.auftrag':{title:'Auftrag',howLabel:'Was bedeuten die Zustände?',how:Object.entries(JOB_STATE_HELP).map(([k,v])=>k+': '+v)},
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

 // Prüfliste und Bestandsprüfung (früher „Qualität & Betrieb“)
 'qualitaet.inhalt':{title:'Prüfliste und Einordnung',
  sub:'Wie weit die Berichte aufbereitet sind, wie sie sich auf Themen und Verfahrensstände verteilen, und welche einen zweiten Blick brauchen.',
  how:['Technische Prüfungen ersetzen keine fachliche Bewertung. Die Themen stammen aus dem Modell (Job „Einordnung, nachts“). Themen der KI und Einordnungen von Hand gehen vor.',
   '„Alle, auch Titeltest“: Diese Zahlen enthalten Ergebnisse des früheren Tests, bei dem die KI nur den Titel sah. Auf der Seite „Verarbeitung“ zählen nur Ergebnisse aus dem Inhalt.'],
  todo:[{label:'Offene Berichte einordnen',href:href('regeltexte')}]},
 'qualitaet.importe':{title:'Die letzten Abrufe',
  sub:'Die letzten 30 Läufe, die dieses System gestartet hat. Extern eingespielte Daten stehen im Quellenstand der Gebiete.',
  how:['„Status offen“: Der Lauf hat sich seit über 10 Minuten nicht zurückgemeldet und ist vermutlich abgebrochen; ein offener Auftrag lässt sich auf dieser Seite fortsetzen oder beenden.',
   'Einträge: gelesene bzw. bearbeitete Berichte des Laufs.']},
 'qualitaet.export':{title:'Datenbank und Übernahme',sub:'Stand der Datenbank und ob in sie ein geprüfter Export übernommen wurde.'},
 'qualitaet.vollstaendig':{title:'Was ist wirklich gespeichert?',
  sub:'Prüft je Bericht elf Pflichtangaben; vollständig ist ein Bericht, wenn alle erfüllt sind. Die Prüfung liest nur, sie erstellt keine Einordnung und keine KI-Texte.',
  how:['Unbekannte Werte und Quellenlücken zählen nicht als vollständig. Anwesenheit bezieht sich auf die Sitzung, nicht auf einen einzelnen Tagesordnungspunkt.'],
  todo:[{label:'Fehlende KI-Angaben',href:href('verarbeitung','#verarbeitung-ki')},{label:'Fehlende Einordnung',href:href('regeltexte')}]},
 'qualitaet.pruefung':{title:'Ist der Bestand in sich stimmig?',
  sub:'Vierzehn Prüfungen lesen den gespeicherten Bestand. Jede Prüfung läuft in Schritten, ihr Ergebnis bleibt gespeichert; nichts wird verändert oder zusammengeführt.',
  howLabel:'Was tun bei Treffern?',
  how:['Doppelungen: Der Leser trennt die Gremien eines gemeinsamen Systems nicht – Aufgabe für die Entwicklung.',
   'Defekte: Gebiet neu abrufen; bleibt der Fehler, den Leser prüfen (Entwicklung).',
   'Verwaiste Einträge: Bereinigung durch die Entwicklung.',
   'Hinweise: meist korrekte, gleichlautende Punkte; nur bei Auffälligkeiten prüfen.']},

 // Hochrechnung (die Abschnittsüberschrift des Ergebnisses steht im JSX; hier die aus 6.8 und die Ladeüberschrift)
 'hochrechnung.leer':{title:'Noch keine Hochrechnung gespeichert',
  sub:'Die Berechnung nutzt die vorberechneten Zahlen je Gebiet und zieht die Spannen; das dauert wenige Sekunden. Danach zeigt die Seite das Ergebnis sofort, bis Sie neu rechnen lassen.'},
 'hochrechnung.ergebnis':{title:'Wie viele Berichte und wie viel Text fallen bundesweit pro Tag an?'},

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
 {term:'Thema',text:'Eines der 10 Themen eines Berichts, etwa Bildung & Betreuung oder Mobilität & Verkehr. Das Modell vergibt es (Seite „Einordnungsmodell“), die KI aus dem Inhalt (Seite „Verarbeitung“). Formalien, Sammelpunkte und Routine haben keins. Im Code heißt es „Label“.'},
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
};
/** Zustände je Gebiet (Schlüssel = Text aus sourceHealth() in shared/admin.mjs). */
export const STATE_HELP:Record<string,string>={
 'Abruf fehlgeschlagen':'Der letzte Abruf endete mit einem Fehler. Die zuvor gespeicherten Berichte bleiben erhalten.',
 'Nicht angebunden':'Für das Gebiet ist keine lesbare Quelle eingetragen.',
 'Ohne Berichte':'Quelle bekannt, aber noch kein Bericht gespeichert.',
 'Teilstand':'Berichte gespeichert, aber der letzte Abruf hat nicht alles gelesen.',
 'Älter als 7 Tage':'Die letzte erfolgreiche Übernahme ist mehr als 7 Tage her.',
 'Ohne gemeldete Lücke':'Der letzte Abruf meldete weder Fehler noch Lücke. Das beweist nicht, dass die Quelle vollständig ist.',
};

// ---- 6.5 Lückenatlas ----------------------------------------------------------------------------------------------
export const ATLAS_TODO:Record<string,{sie?:string;dev?:string}>={
 ok:{sie:'Nichts. Neue Berichte holt ein Abruf auf der Seite „Abruf“.'},
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

// ---- 6.6 Prüfliste und Bestandsprüfung -----------------------------------------------------------------------------
export const REVIEW_HELP:Record<string,string>={
 labels:'Sachpunkt ohne Thema: Das Modell hat kein sicheres Thema vergeben („Sonstiges“). Formalien zählen nicht dazu.',
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
 aiLabel:'Die KI hat ein eigenes Thema vergeben.',
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
 // bestehen (oparl.mjs qualityCheck: Quelle, Verfahrensstand, Länge der Kurzfassung, Öffentlichkeit; bei älteren KI-Zusammenfassungen, bis 20.10.2026 ai-summary.mjs: dazu Belege und KI-Gegenprüfung).
 'Textprüfung bestanden':'Alle automatischen Prüfungen des Berichts sind bestanden (Quelle, Verfahrensstand, Länge der Kurzfassung, Öffentlichkeit; bei KI-Zusammenfassungen zusätzlich Belege und KI-Gegenprüfung). Ein reiner Quellenüberblick besteht sie nicht.',
 'KI-Inhaltsanalyse abgeschlossen':'Die KI hat die Unterlagen gelesen und eine Analyse gespeichert.',
 'Zu wenig lesbarer Text':'Die Unterlagen enthielten zu wenig lesbaren Text, etwa nur einen Scan.',
 // geprüft: "stale" setzt article-record.mjs, wenn sich Titel, Verfahrensstand, Beratungen oder die verlinkten Unterlagen ändern (analysisSignature), nicht der Inhalt der Dateien.
 'KI-Analyse veraltet':'Titel, Verfahrensstand, Beratungen oder verlinkte Unterlagen des Berichts haben sich seit der KI-Analyse geändert.',
 'KI-Sachgebiete (alle, auch Titeltest)':'Von der KI vergebenes Thema, getrennt von dem der Regeln gespeichert.',
};
export const QUALITY_TEXT={
 sachgebiete:'Themen',
 sachgebieteNotiz:'Nach dem Modell (vor ihm KI und Einordnung von Hand), Anteil an allen Berichten. „Sonstiges“: Sachpunkte ohne Thema; Formalien sind nicht mitgezählt.',
 unbekannt:'Aus der Quelle geht nicht hervor, wie weit der Vorgang ist.',
 pruefliste:'Prüfliste',
 prueflisteNotiz:'Bis zu 25 zuletzt geänderte Berichte, die zum Prüfgrund passen. Die Links öffnen den Bericht in einem neuen Tab.',
 treffer:(n:number|string)=>`${n} Berichte passen zu diesem Prüfgrund.`,
 trefferOffen:'Trefferzahl wird nachgerechnet; gezeigt werden Treffer unter den 5.000 zuletzt geänderten Berichten.',
 gebiet:'Gebiet',
 alleGebiete:'Alle Gebiete mit Berichten',
 leer:'Noch keine Abrufe protokolliert. Abrufe starten Sie oben auf dieser Seite.',
 art:{'Labels & Themenmerkmale':'Einordnung nach Regeln','Quellenimport':'Abruf'} as Record<string,string>,
 /** title an „Status offen“ = Abschnitt qualitaet.importe, erster Absatz */
 statusOffen:'Der Lauf hat sich seit über 10 Minuten nicht zurückgemeldet und ist vermutlich abgebrochen; ein offener Auftrag lässt sich auf der Seite „Abruf“ fortsetzen oder beenden.',
 exportTitel:'Gesamten Berichtsbestand sichern',
 exportErgebnis:(a:number|string,b:number|string,c:number|string)=>`${a} von ${b} Berichten erfüllen alle Pflichtangaben. ${c} brauchen Ergänzungen.`,
 datenbank:'Revision: laufende Nummer des Datenbestands. Archivierte Fassungen: frühere Stände geänderter Berichte. Zusammengeführte Verweise: doppelt gelieferte Berichte, die auf einen anderen zeigen.',
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

// ---- Abruf: Protokoll ------------------------------------------------------------------------------------------
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
 linkAbruf:'… auf der Seite „Abruf“ auswählen',
 schritt3:'Je mehr Einwohner ein Gebiet hat, desto mehr Berichte entstehen, aber nicht im gleichen Maß. Die Kurve beschreibt diesen Zusammenhang; beide Achsen sind gestaucht (logarithmisch), damit kleine und große Gebiete zugleich lesbar sind.',
 // geprüft: shared/estimate.mjs fitLevel(): scatter = Standardabweichung der Abweichungen im Logarithmus; ×/÷ f = exp(scatter), das gilt für etwa zwei Drittel der Beispiele (so steht es auch in admin-estimate.tsx).
 streuung:(f:number|string)=>`Etwa zwei Drittel der Beispiele liegen höchstens um das ${f}-Fache über oder unter der Kurve.`,
 schritt5:'(ein Beispiel kann mehrfach gezogen werden)',
 schritt6:'Leser',
 schritt7:'ein zweites Zählverfahren (o200k)',
 neuRechnen:'bis Sie neu rechnen lassen',
};

