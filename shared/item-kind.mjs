// Art eines Tagesordnungspunkts aus seinem Titel, die erste Regel nach Dokument und Text (Konzept plenara.X, Schritt 2):
//   formal      Sitzungsablauf: Eröffnung, Ladung, Beschlussfähigkeit, Tagesordnung, Niederschrift, Befangenheit, Schließung
//   collection  Sammelpunkt ohne einzelnes Thema: Mitteilungen, Anfragen, Verschiedenes, Berichte, Fragestunde
//   routine     Personen und Gremien: Wahlen, Besetzungen, Verpflichtung, Ausscheiden, Spendenannahme
//   subject     Sachpunkt; nur er bekommt ein Thema (shared/themes.mjs)
// Ein Sammelwort mit eigenem Gegenstand („Mitteilungen: Antrag … Böllerverbot“, „Information Sachstand Anbindung Carling“)
// ist ein Sachpunkt. Nur der Titel zählt; nichts hängt von einem späteren Schritt ab.
// Messen: node scripts/item-study/measure.mjs --set=item-dev [--fehler=neu]
export const ITEM_KIND_VERSION='item-kind-v4';

/** Titel ohne Nummerierung, Klammerzusätze am Anfang und Personen am Ende. */
export function cleanTitle(title){
 return String(title||'').normalize('NFKC').replace(/\s+/g,' ').trim()
  .replace(/^(?:\(?(?:öffentlich|öffentlicher teil|ö)\)?(?!\p{L})\s*[-–:]?\s*)/iu,'')
  .replace(/^(?:top\s*)?(?:[a-zö]?\s?\d+(?:\.\d+)*\.?|[ivx]+\.|[a-z]\))\s+(?=\p{L})/iu,'')
  .replace(/^(?:nachtrag:\s*\d{1,2}\.\d{1,2}\.\d{4}\s*)/i,'')
  // Zusatz einiger Systeme („… Vorlage ist noch nicht veröffentlicht worden.“): der eigentliche Titel entscheidet
  .replace(/\s*vorlage ist noch nicht veröffentlicht(?: worden)?\.?\s*$/i,'')
  .trim();
}

// Sitzungsablauf: ein Verfahrenswort am Anfang und ein Gegenstand der Sitzung selbst
const PROC=/^(?:verlesen|verlesung|eröffnung|wiedereröffnung|begrüßung|feststellung|feststellen|festlegung|festsetzung|genehmigung|anerkennung|bestätigung|billigung|kenntnisnahme|kenntnisgabe|kontrolle|einwendung(?:en)?|abstimmung|beschluss(?:fassung)?|entscheidung|änderung(?:en|santräge)?|änderungs-?\s?(?:und|\/)\s?dringlichkeitsanträge|ergänzung(?:en)?|schließen|anträge auf|erweiterung(?:en)?|anmerkung(?:en)?|beratung|besprechung|behandlung|vorlage und kenntnisnahme|hinweise?|bekanntgabe|schließung|unterbrechung|anträge zur|dringlichkeitsanträge|tagesordnung|niederschrift|protokoll|sitzungsniederschrift|annahme|prüfung|verlesung|zustimmung zur|anwesenheit)\b/i;
const SESSION_OBJ=/niederschrift|protokoll|tagesordnung|beschlussfähig|ladung|einladung|einberufung|anwesen|mitwirkungsverbot|ausschließungsgr|ausschliessungsgr|befangen|interessenkonflikt|öffentlichen teil|nichtöffentlich|nicht öffentlich|sitzungsteil|ordnungsmäßigkeit|ordnungsgemäß|dringlichkeit|tagesordnungspunkt/i;
const FORMAL_ALONE=/^(?:eröffnung(?=$|[\s,;:.\/-]+(?:der |und |durch |feststell|begrüß|sitzung|tagesordn|ladung|beschlussfäh|anwesen|$))(?: der sitzung| und begrüßung)?|begrüßung|beschlussfähigkeit$|(?:schließung|schließen|beendigung|beenden)(?:$| der (?:öffentlichen |nichtöffentlichen |nicht öffentlichen )?sitzung\b)|sitzungseröffnung|sitzungsende|ende der sitzung|feststellung der tagesordnung|tagesordnung)\b/i;
const FORMAL_ANY=/(?:^(?:teil|abschnitt) [ivx\d]+$|^\p{L}*sitzung (?:de[rs]|vom|am)\b|^\p{L}*ausschusssitzung\b|^formalien\b|^beschlüsse$|^(?:bekanntgabe|mitteilung) von beschlüssen$|ausgeführte (?:rats)?beschlüsse|durchführung der beschlüsse|aussprache zum protokoll|zugeschalteten|tagesordnung entnehmen|altersvorsitz|stimmberechtig|geschäftsordnungsangelegenheit|beschlusskontrolle|beschlussverfolgung|offenen beschlüsse|vollzug der beschlüsse|(?:ausführung|umsetzung|erledigung) (?:der|gefasster|von) beschlüsse|stand der beschlussumsetzung|gefasste[nr]? beschlüsse|beschlüsse.{0,40}nicht\s?öffentlich|nicht\s?öffentlich.{0,40}beschlüsse|sitzungstermine|^einzelabstimmung$|^(?:nicht\s?)?öffentliche sitzung(?: \p{L}+)?$|^(?:abschluss|antritts|eröffnungs)?rede (?:de[rs]|von)\b|terminplanung.{0,30}sitzung|sitzungsplan|jahresplanung.{0,30}sitzung|(?:sitzungs|termin)kalender|zeitplan der sitzungen)/iu;
// Niederschrift, Öffentlichkeit, Regularien und Sitzungstermine ohne Verfahrenswort am Anfang („Protokollkontrolle“, „Einwände
// gegen die Niederschrift“, „Anfragen der Sitzungsteilnehmer zur Niederschrift“, „Wiederherstellung der Öffentlichkeit“; Bestand
// 14.10.2026: über 1.000 solche Punkte als Sachpunkt gezählt)
const SESSION_ITEM=/^(?:(?:eventuelle |etwaige |mögliche )?(?:einwände|einwendungen|anfragen der sitzungsteilnehmer|anfragen|fragen|anmerkung(?:en)?|hinweise) (?:gegen|zu[rm]?|über)\s(?:\p{L}+\s){0,6}?(?:sitzungs)?(?:niederschrift|protokoll)|zur (?:sitzungs)?niederschrift|entgegennahme (?:der|des) (?:niederschrift|protokolls)|protokoll(?:kontrolle|genehmigung|bestätigung|prüfung|abnahme)?\b|(?:sitzungs)?niederschrift(?:en)?\b|öffentlicher teil des protokolls|(?:beschluss\p{L}* (?:über|zum|zur) )?(?:den |die )?(?:ausschluss|herstellung|wiederherstellung) der öffentlichkeit|einladung zur (?:öffentlichen )?sitzung|(?:festlegung, )?bekanntgabe anstehende\S* termin|termin\S* und fristen|(?:geschäftsordnungs)?regularien|formalia|sitzungstermine|termine(?: \d{4}(?:\/\d{2,4})?)?$|terminplanung(?: \d{4}(?:\/\d{2,4})?)?$|terminplan (?:\d{4} )?für die sitzungen)/iu;
// Ein eigener Gegenstand im Titel macht aus einem Verfahrenswort einen Sachpunkt („Beschlussfassung über die Satzung …“)
const SUBJECT_CUE=/satzung|bebauungsplan|haushalt|vergabe|antrag der|antrag des|antrag von|hier:|betr\.|betreffend|zuschuss|förder|bauantrag|baugesuch|vertrag|konzept|\bplan\b|sanierung|neubau/i;

// Sammelpunkte: der ganze Titel ist ein Sammelwort (mit Absender, Datum, Paragraf)
const WHO='(?:der|des|von|aus|gem\\.?|gemäß|lt\\.?|laut|nach|für|an|im|in|bzw\\.)\\b(?!.*(?:\\bbetr\\b|betreffend|hier:|„|"|zum thema|bezüglich|hinsichtlich|\\szu[mr]?\\s)).*';
// Einzahl („Bericht“, „Anfrage“) nur allein; mit Absender ist ein Bericht oft ein Sachpunkt („Bericht des Fördermanagements“)
const COLLECTION_WORDS='(?:neue |mündliche |schriftliche |allgemeine |sonstige |weitere |aktuelle |öffentliche |kurze |kleine |wichtige ){0,2}(?:(?:einwohner\\p{L}*|einwohnenden|bürger\\p{L}*|zuhörer|rats|stadtrats|gemeinderats|fraktions|sachstand|mitteilungs)?(?:anfragen|fragen|mitteilungen|mitteilungsvorlagen|bekanntgaben|informationen)|aussprache|anfragen|anträge|mitteilungen|mitteilung|information|bekanntgabe|anfrage|eingänge|eingaben|informationen|berichte|berichterstattung|bekanntgaben|bekanntmachungen|entscheidungen|anhörungen|anregungen|beschwerden|beschlussvorlagen|vorlagen|kenntnisnahmen?|informationsvorlagen|anmerkungen|termine|terminabstimmungen|wünsche|fragen|antworten|beantwortung(?: von anfragen)?|verschiedenes|sonstiges|allgemeines|weiteres|aktuelles|informationsaustausch|einwohnerfragen|bürgeranfragen|bürgerfragen|anliegen)';
const SINGLE=/^(?:anfrage|antrag|mitteilung|information|bericht|bekanntgabe|kenntnisnahme|beantwortung|entscheidung)$/i;
const COLLECTION=new RegExp(`^${COLLECTION_WORDS}(?:\\s*(?:,|und|u\\.|\\/|;|sowie|&|-)\\s*${COLLECTION_WORDS})*(?:\\s*\\(.*\\))?(?:\\s+(?:zum weiteren vorgehen|${WHO}))?[.!:]?$`,'iu');
const COLLECTION_OTHER=/^(?:[\p{L}\s\/*:.\d-]{0,45}(?:fragestunde|fragezeit|bürgerviertelstunde|einwohnerfragen)\b.*|[\p{L}\/-]*fragerunde(?: für (?:die )?\p{L}+)?$|(?:einwohner|bürger)\w*\s+(?:fragen|anfragen)\b.*|(?:fragen|anfragen)(?: und (?:anregungen|hinweise|wünsche))? (?:der|von) (?:einwohner|bürger)\p{L}*(?: und (?:einwohner|bürger)\p{L}*)?(?:\s+(?:zu (?:den |der )?(?:\p{L}+ )?(?:punkten|beratungspunkten|tagesordnung\p{L}*|beratungsgegenst\p{L}*|angelegenheiten)\b.*|\(.*\)))?$|beschlussvorlagen\b.*|fraktionsanträge|(?:behandlung|beratung und beschlussfassung über|beratung über) (?:von )?(?:bauvoranfragen und )?bauanträge(?:n|) ?(?:und bauvoranfragen)?$|bekanntgabe von beschlüssen\b.*|vorbe(?:ratung|reitung) (?:der|für die) (?:\p{L}+ )?sitzung\b.*|entgegennahme (?:von |der )?(?:mündlichen |schriftlichen )?(?:anfragen|anträgen|anregungen)\b.*|antworten der verwaltung\b.*|verwaltungsbericht|\p{L}*angelegenheiten$|hinweise(?:\s*\/\s*|\s+und\s+)allgemeines|gemeinderatsfragestunde|(?:aktuelle )?\p{L}*viertelstunde|stadtverordnetenfragestunde|aktuelle stunde|(?:in )?angelegenheiten (?:der|des) (?:stadtverwaltung|verwaltung|gemeindeverwaltung|verwaltungsausschusses|bürgermeisters?|magistrats?)\b.*|beratung zu aktuellen themen|(?:genehmigung von )?(?:eil|dringlichkeits)entscheidungen|dringliche vorlagen|ortsteilbezogene themen|worte zum jahres\w*.*|persönliche (?:mitteilungen|erklärungen).*|berichte?\/themen|berichte? aus den (?:ausschüssen|fachausschüssen|arbeitskreisen|arbeitsgruppen|ortsräten|gremien|jugendverbänden|verbänden).*|.*-unbesetzt-|vorlagen und anträge zur anhörung|vorberatung von .*vorlagen.*|beratung zu beschlussvorlagen|bürger\*?innen tragen ihre anliegen vor|einwohnende melden sich zu wort|umsetzung der empfehlungen aus den letzten sitzungen.*|informationen über sachbehandlungen.*|mitteilungen der verwaltung bzw\..*)$/iu;
// „Bericht des Bürgermeisters“ ohne Gegenstand; mit „zum/zur/über …“ ein Sachpunkt
const REPORT_OF=/^(?:mündliche[rn]? |aktuelle[rn]? |schriftliche[rn]? )?(?:bericht|berichte|berichterstattung|information(?:en)?|mitteilung(?:en)?|bekanntgaben?)\s+(?:des|der|durch (?:den|die))\s+(?:\w+\s){0,3}?(?:bürgermeister\w*|oberbürgermeister\w*|bürgervorsteher\w*|stadtpräsident\w*|ortsvorsteher\w*|ortsbürgermeister\w*|landrat\w*|landrätin|amtsdirektor\w*|amtsvorsteher\w*|bezirksbürgermeister\w*|samtgemeindebürgermeister\w*|verbandsgemeindebürgermeister\w*|verwaltung|stadtverwaltung|gemeindeverwaltung|kreisverwaltung|magistrat\w*|vorsitzenden|ausschussvorsitzenden|vorsitzende[rn]?|vorstands?|vorständin|verbandsvorsteher\w*|geschäftsführ\w*|betriebsleitung|werkleitung|kämmer\w*|beigeordneten|dezernent\w*|ortschaftsrat\w*|ortsrat\w*|ausschüsse)\b(?!.{0,6}\s(?:zum|zur|über(?! (?:[\p{L}-]+ ){0,2}(?:angelegenheiten|themen|vorgänge|beschlüsse|mitteilungen|ausführung))|zu(?! \p{L}*angelegenheiten)|betr|hinsichtlich)\b)(?:.*?)$/iu;
const REPORT_ON=/^(?:bericht|berichte|information(?:en)?|mitteilung(?:en)?)\s+(?:(?:der|des) \w+ )?(?:und )?über (?:[\p{L}-]+ ){0,2}(?:angelegenheiten|themen|vorgänge|beschlüsse|mitteilungen|ausführung)\b/iu;

// Personen und Gremien
const ROUTINE=[
 /^(?:\S+\s){0,3}?(?:wahl|wahlen|neuwahl|nachwahl|ersatzwahl|wiederwahl)\b(?!\s*(?:kreis|bezirk|vorschl|plakat|lokal|ergebnis|prüfung|helfer|organisation|ordnung|recht))(?!.*(?:kommunalwahl|bundestagswahl|landtagswahl|europawahl))/i,
 /^(?:\S+\s){0,3}?(?:bestellung|bestellen|benennung|entsendung|berufung|abberufung|ernennung|ernennungen|vereidigung|verpflichtung|amtseinführung|pflichtenbelehrung|belehrung|besetzung|neubesetzung|umbesetzung|nachbesetzung|umbildung|neubildung)\b(?!.{0,40}(?:satzung|konzept|rücklage|sondervermögen|richtlinie|planungs|budget|arbeitsgruppe zur))/i,
 /(?:umbesetzung|nachbesetzung|neubesetzung|ausschussbesetzung|gremienbesetzung|zusammensetzung) (?:de[rs]|von|in)\b/i,
 /^\p{L}*(?:umbesetzungen|nachbesetzungen|neubesetzungen)\b|^\p{L}+(?:umbesetzung|nachbesetzung|neubesetzung)\b|(?:anzahl|zahl) der ausschüsse|mitgliederstärke der ausschüsse|ausschüsse und deren mitgliederstärke|sitzungsgeld\p{L}*.{0,60}spende/iu,
 /^(?:\S+\s){0,2}?(?:einführung|bildung)\b.{0,12}\b(?:und verpflichtung|de[rs] (?:neue[nr]? |neu gewählte[nr]? )?(?:bürgermeister|ortsvorsteher|ratsmitglied|mitglied|ausschüsse|ausschusses|beirat|ältestenrat|beigeordnet|gemeinderät|stadtrat|stadträt|ortschaftsrät|kreisrät))/i,
 /schriftführ|protokollant|zahl der (?:weiteren|stellvertretenden) (?:bürgermeister|beigeordneten)|stellvertretende[rn]? (?:bürgermeister|vorsitz|ortsvorsteher|landrat|amtsdirektor|verbandsvorsteher)|vertretungsregelung des|vorsitzende[rn]? de[rs] \w*ausschuss|festlegung de[rs] vorsitzenden/i,
 /mandatsveränderung|vertretung (?:der stadt|der gemeinde|des kreises) .{0,40}in (?:den )?(?:organen|gremien|gesellschaften)|zahl der (?:ausschussmitglieder|sachkundigen)|fraktionssprecher|ausscheiden|nachrücke|nachfolge(?:r|rin)? (?:im|in den|für den)|sitzverlust|mandatsniederlegung|niederlegung des mandats|rücktritt|hinderungsgr|gültigkeit der wahl|wahlprüfung|verabschiedung (?:der|des|von) (?:ausscheidend|ehemalig|bisherig)|ehrenamtliche[rn]? richter|schöff|schiedsperson|schiedsm[aä]nn|feldgeschworen/i,
 /^bildung des wahlausschusses\b/i,
 /^(?:\S+\s){0,3}?bestätigung\b.{0,40}\bwahl (?:de[rs]|zu[mr])\b/i,
 /^vorstellung (?:de[rs] |einer |eines )?(?:neue[nr]?|neu gewählte[nr]?)\s+(?:\p{L}*leitung\b|mitarbeiter|leiter|betriebsleiter|geschäftsführer|amtsleiter|fachbereichsleiter|bürgermeister|kollegin|kollegen|beauftragt)/i,
 /(?:annahme|genehmigung|einzelgenehmigung)\b.{0,40}(?:spenden?\b|zuwendungen|schenkungen|sponsoring)|(?:spenden|sponsoring)-?\/?\s?(?:und )?(?:sponsoring)?verfahren|^(?:spenden|zuwendungen)(?:annahme)?\b|§\s*(?:94|78|73|44|25)\s*abs\.?\s*\d.{0,30}(?:gemo|sächsgemo|kv m-v|kverf)?.{0,20}(?:spende|zuwendung)|vertragsverhältnisse der .{0,30}mit ratsmitgliedern|verträge mit (?:mandatsträgern|ratsmitgliedern)/i,
 /\s[-–]\s*(?:herrn?|frau)\s+\p{Lu}[^;]*$/u,
 // Verabschiedung und Ehrung von Personen (nicht „Verabschiedung des Haushalts“)
 /^(?:ehrung(?:en)?|nachrufe?|gratulation\p{L}*|verabschiedungen)(?:\s+und\s+(?:ehrung(?:en)?|verabschiedung(?:en)?))?$|^(?:ehrung|ehrungen|verabschiedung|verabschiedungen)\b(?!.{0,60}(?:haushalt|satzung|plan|resolution|konzept|leitbild|richtlinie|ordnung|erklärung|programm))\s+(?:von |der |des |eines |einer |ehemalige|ausgeschiedene|langjährige|verdiente)/iu,
];

/** Art eines Tagesordnungspunkts aus dem Titel. @returns {'formal'|'collection'|'routine'|'subject'} */
export function itemKind(title){
 const t=cleanTitle(title),l=t.toLowerCase();
 if(!t)return 'collection';
// Einzeln geführte Einwohnerfragen („Tore am Schulstandort - Herr Messing“): Frage einer Person, kein eigener Sachpunkt
 if(/\s[-–]\s*(?:Herr|Frau|AM|RM|StR|StRin|GR|GRin|KR|SV)\s+\p{Lu}[\p{L}.'-]*(?:\s+\p{Lu}[\p{L}.'-]*)?\s*$/u.test(t))return 'routine';
 // Sammelwort mit eigenem Gegenstand nach Doppelpunkt oder Gedankenstrich: Sachpunkt, wenn der Rest selbst keiner ist
 const m=t.match(/^([^:–]{3,60}?)\s*(?::|\s[-–]\s)\s*(.{12,})$/);
 if(m&&(COLLECTION.test(m[1])||REPORT_OF.test(m[1])||/^(?:bekanntgabe|information|mitteilung|bericht)\b/i.test(m[1]))){const rest=itemKind(m[2]);if(rest==='subject')return 'subject';}
 // „Angelegenheiten der Gemeindewerke GmbH hier: Abberufung und Bestellung …“: der Gegenstand nach „hier:“ entscheidet bei Personen
 const h=t.match(/\bhier:\s*(.{8,})$/i);if(h&&ROUTINE.some(re=>re.test(h[1])))return 'routine';
 if(FORMAL_ALONE.test(l)&&!SUBJECT_CUE.test(l))return 'formal';
 if(/^(?:eröffnung|begrüßung|wiedereröffnung)\b/.test(l)&&SESSION_OBJ.test(l))return 'formal';
 if(PROC.test(l)&&SESSION_OBJ.test(l.slice(0,140))&&!SUBJECT_CUE.test(l))return 'formal';
 if(FORMAL_ANY.test(l))return 'formal';
 if(SESSION_ITEM.test(l)&&!SUBJECT_CUE.test(l))return 'formal';
 if(ROUTINE.some(re=>re.test(t)))return 'routine';
 const parts=t.split(/\s*(?:,|;|\s[-–]\s)\s*/).filter(Boolean);
 if(parts.length>1&&parts.every(x=>x!==t&&itemKind(x)!=='subject')){const k=parts.map(itemKind);return k.includes('collection')?'collection':k[0];}
 if(SINGLE.test(t)||COLLECTION.test(t)||COLLECTION_OTHER.test(t)||REPORT_OF.test(t)||REPORT_ON.test(t))return 'collection';
 return 'subject';
}
/** Kurzform für Messungen: f, s, r, t */
export const itemCode=title=>({formal:'f',collection:'s',routine:'r',subject:'t'})[itemKind(title)];
