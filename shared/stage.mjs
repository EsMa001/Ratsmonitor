// „Was geschieht“ (stage) mit einem Vorgang, quer zu den 10 Themen (requirements/plenara-x-konzept.md 5.2, Plan
// requirements/regel-schritt-plan.md Schritt 6): aus dem Titel, ein Wert je Vorgang, sonst 'sonst'. Ersetzt die Signale der
// Themenradare und die Radare Vergabe, Gebühren und Beteiligung. Messen: node scripts/stage-study/measure.mjs --set=stage-d
//
// Leitfaden (gilt für die Regel und für das Einordnen von Hand, in dieser Reihenfolge):
//  1. sonst: Straßennamen und Hausnummern, Tagesordnung, Sammelpunkte („Verschiedenes, Anfragen und Mitteilungen“).
//  2. bericht: der Punkt informiert, statt etwas zu entscheiden: Titel beginnt mit Bericht, Information, Sachstand,
//     Vorstellung, Bekanntgabe, Bilanz, Rückschau, Rückblick, Ergebnisse, Auswertung, Statistik; Antwort auf eine Anfrage;
//     Sachstand, Controlling, Quartals- oder
//     Beteiligungsbericht, mündlicher Bericht irgendwo im Titel. Auch wenn es um einen Bauantrag, den Haushalt oder ein
//     Vorhaben geht.
//  3. bauantrag: Vorhaben Dritter, über das die Gemeinde als Behörde befindet (Bauantrag, Bauvoranfrage, Befreiung,
//     Nutzungsänderung, Einvernehmen, wasser- oder immissionsschutzrechtliche Zulassung; Flurstück und Wohnhaus im Titel).
//  4. antrag: Antrag oder Anfrage aus der Politik (Fraktion, Partei, Ratsmitglied) oder der Einwohnerschaft (Anregung,
//     Eingabe, Einwohnerantrag, Bürgereingabe, Antrag eines Bürgers, Frage im Titel); ein Antrag mit Partei, Fraktion oder Gruppe irgendwo im Titel. Nicht: Anträge der
//     Verwaltung oder des Bürgermeisters.
//  5. foerderung: Geld an Dritte oder von Dritten: Zuschuss, Förderung, Sondermittel, Orts- und Bezirksmittel,
//     Förderprogramm, auch der Antrag
//     eines Vereins auf Geld.
//  6. antrag: sonst jeder Titel, der mit „Antrag“ beginnt.
//  7. vergabe: Ausschreibung, Vergabe, Beauftragung, Beschaffung, Anschaffung, Bau-, Planungs- und Ingenieurleistungen.
//  8. abgaben: Gebühren, Entgelte, Beiträge, Steuern und Hebesätze, Kalkulation.
//  9. vertrag: öffentlich-rechtliche Vereinbarung, Übertragung von Aufgaben.
// 10. haushalt: Haushalt, Wirtschaftsplan, Jahresabschluss und -ergebnis, über- und außerplanmäßig, Mittel, Kostenrahmen,
//     Darlehen, Entlastung, Entschuldung.
// 11. liegenschaft: Kauf, Verkauf, Pacht, Vorkaufsrecht, Erbbaurecht eines Grundstücks.
// 12. planung (Vorrang): Bauleitplanung, BauGB und Satzungen danach (Ergänzungs-, Sanierungssatzung), Planfeststellung,
//     Bedarfsplan, Entwurfs- und Ausführungsplanung; ein Titel, der mit dem Bebauungsplan beginnt, schon vor Nummer 3.
// 13. Danach das zuerst genannte Wort: Förderung, Planung (Konzept, Gutachten, Studie, Vorgehensweise), Bau (Neubau,
//     Sanierung, Ausbau, Neugestaltung, Bauvorhaben), Vertrag, Regelung (Satzung, Verordnung, Richtlinie, Geschäftsordnung),
//     Beteiligung (Bürgerbeteiligung, Befragung, Petition, Bürgerversammlung), Bericht, Anfrage.
export const STAGE_VERSION='stage-v4';
// Seit 22.10.2026 (Modell, requirements/begriffsbuch-kern.md Abschnitt 3) steht in report_rules.stage und x_cases.stage die
// Vorgangsart des Modells (PROCESS_STAGES); die Regel stageOf und ihre Werte (RULE_STAGES) gelten nur noch für Berichte, die das Modell
// noch nicht eingeordnet hat, und werden weiter benannt.
export const PROCESS_STAGES=[
 {id:'information',name:'Information'},
 {id:'political',name:'Antrag aus der Politik'},
 {id:'permit',name:'Genehmigung für Dritte'},
 {id:'planning',name:'Planung und Regelung'},
 {id:'build',name:'Bau und Vergabe'},
 {id:'money',name:'Geld'},
 {id:'contract',name:'Vertrag und Grundstück'},
 {id:'other',name:'Sonstiges'},
];
export const RULE_STAGES=[
 {id:'antrag',name:'Antrag und Anfrage'},
 {id:'planung',name:'Planung und Konzept'},
 {id:'vergabe',name:'Ausschreibung und Vergabe'},
 {id:'bau',name:'Bau und Sanierung'},
 {id:'abgaben',name:'Gebühren, Beiträge und Steuern'},
 {id:'foerderung',name:'Förderung und Zuschuss'},
 {id:'vertrag',name:'Vertrag und Vereinbarung'},
 {id:'regelung',name:'Satzung und Regelung'},
 {id:'haushalt',name:'Haushalt und Abschluss'},
 {id:'liegenschaft',name:'Grundstücke'},
 {id:'bauantrag',name:'Bauanträge Dritter'},
 {id:'beteiligung',name:'Beteiligung'},
 {id:'bericht',name:'Bericht und Sachstand'},
];
/** Werte für Auswahl und Gliederung: die Vorgangsarten */
export const STAGES=PROCESS_STAGES;
export const SONST='other';
/** „Sonstiges“ der Regel stageOf */
export const RULE_SONST='sonst';
export const stageName=id=>PROCESS_STAGES.find(s=>s.id===id)?.name||RULE_STAGES.find(s=>s.id===id)?.name||'Sonstiges';

const PARTY=String.raw`(?:spd|cdu|csu|fdp|afd|bsw|ödp|volt|grüne|grünen|linke|freie wähler|fwg|fw|uwg|piraten|bündnis)`;
const FIRST=[
 [RULE_SONST,/straßen(?:be)?nennung|straßenname|hausnummer|tagesordnung|^\W*(?:verschiedenes|sonstiges|kleinere)\b|^\W*(?:anfragen|mitteilungen)\s+(?:und|oder)\s+(?:anfragen|mitteilungen)/i],
 ['bericht',new RegExp(String.raw`^\W*(?:zur\s+)?(?:mündliche[nr]?\s+)?(?:mv:|mitteilungsvorlage|antwort|beantwortung|information(?:en)?\b|info\b|einblick|informatorisch|unterrichtung|sachst[aä]nd|bericht|mitteilung|vorstellung|bekanntgabe|bilanz|rückschau|rückblick|ergebnisse|auswertung|statistik|aktuelle[nrs]?\b|der aktuelle)|antwort (?:der verwaltung )?(?:auf|zu)|beantwortung|sachst[aä]nd|bearbeitungsst[aä]nd|quartalsbericht|finanzbericht|budgetbericht|controllingbericht|beteiligungsbericht|jahresbericht|controlling|mündliche[nr]? bericht`,'i')],
 ['planung',/^\W*(?:\d+\.\s*)?(?:änderung des\s+)?(?:vorhabenbezogene[nr]?\s+)?(?:bebauungsplan|b-plan|bauleitplanung|flächennutzungsplan)/i],
 ['bauantrag',/^(?!.*(?:widmung|einziehung|umstufung))(?:.*?)(?:\bbau(?:antr[aä]g|voranfrage|gesuch)|baugenehmigung|befreiung von den festsetzungen|isolierte befreiung|nutzungsänderung|vorbescheid|einvernehmen|§\s*36a?\s*baugb|immissionsschutzrechtlich|\bbimschg\b|wasserrechtlich|§\s*8\s*whg|\bflst\.?\s*\d|\bfl(?:st)?\.?\s?-?\s?nr\.?|\bflnr\b|flur-?nr|flurnummer|(?:ein|zwei|mehr)familien(?:wohn)?haus|\befh\b|\bcarport|tektur|^\W*bausachen|bauangelegenheiten|baurechtliche angelegenheiten|\(b\d{4}\/\d+\)|umnutzung|\baz\.?\s*[\d][\d-]{4,}|§\s*17[23]\s*baugb)/i],
 ['antrag',new RegExp(String.raw`fraktion(?:en)?\b|-fraktion|\b${PARTY}\b.{0,40}\bantr|\bantr\w*\b.{0,40}\b(?:${PARTY}|gruppe)\b|[\[(][^\])]{0,30}\b${PARTY}\b[^\])]{0,30}[\])]|^\W*(?:wie|was|warum|wann|wo|wer|welche\w*)\b[^?]{0,150}\?|antr\w*\s+(?:der|des|von)\s+(?:${PARTY}|ratsmitglied|stadtverordnete|gemeindevertreter|ortsbeirat|abg)|\bverfasser(?:in)?:|anregung(?:\/beschwerde)?\s+(?:nach|gem(?:äß|\.))\s*§|anregungen\s+(?:und|bzw\.?)\s+beschwerden|einwohnerantr|bürgerantr|bürgereingabe|antr(?:ag|äge)\s+(?:eine[rs]|von)\s+(?:bürger|einwohner)|\b(?:ratsherr|ratsfrau|ratsmitglied|abg\.)\s|\beingabe\b|antrag-?\s?nr|prüf(?:auftrag|antrag)|anfrage|fragt an|^\W*(?:frau|herr)\s|^\W*(?:gr|stv\.?|gv|rm)\s+\p{Lu}\p{L}+|\?\s*$`,'iu')],
 ['foerderung',/sondermittel|^\W*förderrichtlinie|antrag (?:auf )?finanzielle\w* (?:förderung|unterstützung)|förderprogramm|(?:ortsrats|ortsbeirats|bezirks|stadtteil)mittel|bezirksbudget|zuschussantrag|förderantrag|bezuschussung|fördergeld|fördermittel|antrag auf (?:[a-zäöüß]+ )?(?:gewährung|förderung|zuschuss|zuwendung)|förderbetrag|(?:jugend|sport|vereins|kultur)förderung|richtlinien? zur förderung|antr\w*\s+(?:(?:des|der|von)\s+)?[^,;:]{0,40}(?:e\.\s?v\.|verein|\btus\b|\bsv\b|\bffw\b|feuerwehr)|antrag auf \w*förderung/i],
 ['antrag',/^\W*(?:änderungs|zusatz|ergänzungs|dringlichkeits|erneuter |gemeinsamer )?antr(?:ag|äge)\b/i],
 ['vergabe',/vergabe|auswahl (?:eines|des|der|von) [a-zäöüß-]*(?:büros?|dienstleister[a-zäöüß]*|anbieter[a-zäöüß]*)|nachtragsangebot|nachtragsauftrag|\bgewerk\b|ausschreibung(?!\s+des\s+(?:flurstück|grundstück))|beauftragung|\bauftrag(?:s|es)?\b|zuschlag|beschaffung|anschaffung|submission|(?:bau|planungs|ingenieur|architekten|ausführungs)leistungen/i],
 ['abgaben',/gebühr|festlegung der preise|preisblatt|preisanpassung|entgelt|elternbeitr|ausbaubeitr|erschließungsbeitr|anliegerbeitr|hebesatz|hebesätze|grundsteuer|gewerbesteuer|hundesteuer|steuersatzung|zweitwohnungsteuer|vergnügungssteuer|kalkulation|wiederkehrende\w* beitr|beitragssatzung|erhebung von abgaben|abwasserabgabe|abgabensatzung/i],
 ['vertrag',/öffentlich-rechtliche[nr]? (?:vertrag|vereinbarung)|zweckvereinbarung|übertragung (?:der|von) aufgaben/i],
 ['haushalt',/haushalt|entlastung (?:des|der|von)|rückstellung|\bmittel\b|\betat[a-zäöüß]*|umlage\b|\bausgaben\b|kassenprüf|belegprüf|kassen- und belegprüf|mittelbereitstellung|mittelfreigabe|finanzübersicht|bilanzierungshilfe|refinanzierung|schlussabrechnung|betriebsabrechnung|billigung der abrechnung|wirtschaftsplan|jahresabschl|gesamtabschl|jahresrechnung|jahresergebnis|jahresüberschuss|kommunaler abschlüsse|außerplanmäßig|überplanmäßig|finanzplanung|investitionsprogramm|produktbereich|kostenstelle|budget|finanzmittel|betriebsplan|veranschlagung|rahmenzuweisung|stellenplan|verwendung (?:der|von) mitteln|kostenerhöhung|kostenrahmen|mehrkosten|mehraufwendung|gesperrter mittel|darlehen|entlastung der|entschuldung|altschulden/i],
 ['liegenschaft',/grundstück|rückübertragung|flurstück|vorkaufsrecht|erbbau|(?:veräußerung|\bverkauf|\berwerb\b)(?!.{0,40}(?:fahrzeug|anteil|aktie|geschäftsanteil|gesellschaft|lizenz|software))|\bpacht/i],
 ['planung',/bebauungsplan|flächennutzungsplan|bauleitplan|\bbaugb\b|träger öffentlicher belange|baugesetzbuch|veränderungssperre|planfeststellung|(?:ergänzungs|klarstellungs|innenbereichs|außenbereichs|entwicklungs|sanierungs)satzung|b-plan|f-plan|bedarfsplan|entwurfsplanung|ausführungsplanung|vorplanung/i],
];
const WORDS=[
 ['foerderung',/(?<!sprach|lese|wirtschafts|sprachstands|früh)förder|zuschuss|zuschüsse|zuwendung|projektaufruf|programms?\b|\bfonds\b|programmgebiet/i],
 ['planung',/(?<!zeit|personal|dienst|urlaubs|termin)planung|konzept|strategie|gutachten|untersuchung|\w*studie\b|fortschreibung|regionalplan|machbarkeit|leitbild|eckpunkte|anhörung|abwägung|rahmenplan|entwicklungsplan|vorgehensweise|\bvorgehen\b/i],
 ['bau',/neubau|sanierung|umgestaltung|rückbau|modernisierung|ersatz(?:neu)?bau|ersatzbrücke|ausbau|umbau|erweiterung|baumaßnahme|baubeschluss|bauvorhaben|spatenstich|herstellung|instandsetzung|errichtung|neuanlage|\berneuerung|neugestaltung|erschließung(?!sbeitr)/i],
 ['vertrag',/vertrag|vertrages|verträg|vereinbarung|konzession|beitritt/i],
 ['regelung',/satzung|verordnung|richtlinie|mietspiegel|neufassung|anordnung|geschäftsordnung/i],
 ['beteiligung',/petition|bürgerbegehren|einwohnerantrag|bürgerbeteiligung|öffentlichkeitsbeteiligung|befragung|bürgerumfrage|bürgerversammlung|einwohnerversammlung|workshop|bürgerdialog|bürgerwerkstatt|dialogformat/i],
 ['bericht',/bericht|zwischenstand|präsentation|\breporte?s?\b|\bstand\b|informationsvorlage|information(?:en)?\s+(?:zu|zur|über|der|des|durch|aus)|mitteilung|kenntnis|stellungnahme der verwaltung|ergebnisse/i],
];
/** @param {{title:string}} x  Nur der Titel: Betreff/Beschlussvorschlag senkte die Genauigkeit (Floskeln, gemessen 14.10.2026). */
export function stageOf({title}){
 const s=String(title||'');
 for(const [id,re] of FIRST)if(re.test(s))return id;
 let best=RULE_SONST,at=Infinity;
 for(const [id,re] of WORDS){const m=s.match(re);if(m&&m.index<at){at=m.index;best=id;}}
 return best;
}
