/**
 * Einheitliche Begriffe der Server-Pipeline (Betriebsplan, Entscheidung 15.10.2026): ein Name je Ablauf, Stufe und Schritt, gleich
 * in Skripten (Schrittnamen in den Protokollen), Admin-Seiten (Jobs & Zeitpläne, PDF-Import, Themen & Texte, Pipeline-Debug,
 * Altbestand), Konzept (requirements/betriebsplan-konzept.md) und Ablaufbild (requirements/betriebsplan-ablauf.html).
 * Neue Schritte hier eintragen; ältere Namen bleiben als Alias, damit gespeicherte Protokolle weiter erkannt werden.
 */

/** Drei Abläufe */
export const FLOWS=Object.freeze({
 tages:{name:'Tagespipeline',what:'jede Nacht: holt und verarbeitet, was neu ist (Sitzungen der letzten 7 Tage, frühestens 12.10.2026)'},
 nacharbeit:{name:'Nacharbeit',what:'tagsüber automatisch: versucht erneut, was in der Tagespipeline gescheitert ist'},
 altbestand:{name:'Altbestand',what:'nur auf Knopfdruck: Älteres rückwirkend abrufen, extrahieren und verarbeiten, alte Fehler aufarbeiten'},
});

/** Drei Stufen, in dieser Reihenfolge */
export const PHASES=Object.freeze({
 abruf:{name:'Abruf',what:'Sitzungen und Berichte von der Quelle holen'},
 extraktion:{name:'Extraktion',what:'PDFs laden, Text lesen, Scans per OCR'},
 verarbeitung:{name:'Verarbeitung',what:'Einordnung, Regeln, Suche, KI'},
});

/** Schritte: id, Name, Stufe, kurz was er tut, frühere Namen in Protokollen */
export const STEPS=Object.freeze([
 {id:'backup',name:'Sichern',phase:null,what:'Datenbank sowie Index und Texte der PDF-Ablage sichern'},
 {id:'import',name:'Abruf',phase:'abruf',what:'Sitzungen und Berichte eines Gebiets von seiner Quelle holen'},
 {id:'pdf',name:'PDF laden',phase:'extraktion',what:'Hauptdokument eines Berichts in die PDF-Ablage laden',aliases:['Laden']},
 {id:'others',name:'Anlagen laden',phase:'extraktion',what:'übrige PDFs eines Berichts (Anlagen, Pläne) laden',aliases:['Laden übrige']},
 {id:'text',name:'Text lesen',phase:'extraktion',what:'Textebene der PDFs lesen',aliases:['Textebene']},
 {id:'ocr',name:'OCR',phase:'extraktion',what:'Seiten ohne Text (Scans) per Texterkennung lesen'},
 {id:'ocr-fetch',name:'OCR-Nachladen',phase:'extraktion',what:'für die OCR ein schon gelöschtes PDF kurz neu laden'},
 {id:'doctype',name:'Dokumentart',phase:'extraktion',what:'Art des Dokuments aus dem Textanfang nachtragen',aliases:['Art nachtragen']},
 {id:'budget',name:'Grenze halten',phase:'extraktion',what:'PDFs über der festen Grenze der Ablage löschen (Text bleibt)',aliases:['Budget']},
 {id:'stats',name:'Stand zählen',phase:null,what:'Zahlen des Reiters PDF-Import neu zählen',aliases:['Stand']},
 {id:'title',name:'Titel einordnen',phase:'verarbeitung',what:'Sachgebiet nach der Titelregel (Label der Suche)',aliases:['Titelregel']},
 {id:'rules',name:'Regeln anwenden',phase:'verarbeitung',what:'Art des Punkts, Thema, Regel-Zusammenfassung, Fakten je Bericht',aliases:['Regeln je Bericht']},
 {id:'search',name:'Suche aktualisieren',phase:'verarbeitung',what:'Wortliste der Suche nachführen',aliases:['Wortliste']},
 {id:'xcases',name:'Zahlen rechnen',phase:'verarbeitung',what:'Zahlen für plenara.X',aliases:['Zahlen für plenara.X']},
 {id:'ai',name:'KI',phase:'verarbeitung',what:'Kurz- und Langfassung und KI-Einordnung (Agent über MCP, von Hand)'},
 {id:'trace',name:'Wege zählen',phase:null,what:'zählen, welchen Weg die Berichte genommen haben (Pipeline-Debug)'},
]);
const byId=new Map(STEPS.map(s=>[s.id,s]));
/** Name eines Schritts */
export const stepName=id=>byId.get(id)?.name||id;
/** Ist ein gespeicherter Schrittname (auch ein alter) dieser Schritt? */
export const isStep=(name,id)=>{const s=byId.get(id);return !!s&&(name===s.name||!!s.aliases?.includes(name));};
/** Heutiger Name zu einem gespeicherten (auch alten) Schrittnamen; unbekannte bleiben, wie sie sind */
export const displayStep=name=>STEPS.find(s=>s.name===name||s.aliases?.includes(name))?.name||name;
/** Stufe eines Schritts (null für Rahmenschritte) */
export const stepPhase=id=>byId.get(id)?.phase??null;

/** Gründe im Fehlerspeicher (work-failures.mjs, classify) in Worten, mit dem, was daraufhin geschieht */
export const CLASS_TERMS=Object.freeze({
 blocked:{name:'Quelle bremst',then:'Server wartet 1 h bis 7 Tage, dann Stichprobe'},
 denied:{name:'Zugriff verweigert',then:'Server wartet 7 bzw. 30 Tage, dann „prüfen“'},
 transient:{name:'vorübergehend',then:'neuer Versuch nach 1 h, 6 h, 1 Tag, 3 Tagen'},
 gone:{name:'fehlt dauerhaft',then:'kein neuer Versuch (404, kein PDF, zu groß)'},
 slow:{name:'zu langsam',then:'ein zweiter Versuch mit 15 Minuten je Datei, danach nur die Textebene'},
 busy:{name:'Sperre im Haus',then:'neuer Versuch nach 10 Minuten'},
 internal:{name:'Fehler im eigenen Code',then:'neuer Versuch nach dem nächsten Deploy'},
});
/** Stufen eines Servers (source_hosts) */
export const HOST_TERMS=Object.freeze({ok:'liefert',bremsen:'bremst',gesperrt:'gesperrt',pruefen:'prüfen'});

/** Aufträge der PDF-Ablage (Reiter PDF-Import und Seite Altbestand; pdf-store-admin.mjs JOB_KINDS) als Knopf */
export const PDF_JOB_TERMS=Object.freeze({run:'Ältere Monate laden',retry:'Alte Fehler erneut versuchen',others:'Anlagen laden',texts:'Text lesen',ocr:'OCR des Altbestands'});
/** Arten der Läufe im Protokoll der PDF-Ablage (pdf-store-runs.kind) */
export const RUN_KIND_TERMS=Object.freeze({nightly:'Extraktion, nachts',run:'Ältere Monate laden',retry:'Alte Fehler erneut versuchen',others:'Anlagen laden',texts:'Text lesen',ocr:'OCR',fetch:'PDF laden (von Hand)',text:'Text lesen (von Hand)'});
/** Ergebnis eines Laufs */
export const RESULT_TERMS=Object.freeze({ok:'fertig',done:'fertig',failed:'mit Fehler',stopped:'angehalten',skipped:'ausgelassen'});
