// Themenvorschläge für Social Media: regelbasiert aus den Suchkarten, ohne Modell.
// Gesucht werden Einzelfälle in einem Ort, die polarisieren (Tempo 30, Windrad, Bezahlkarte, Bürgerbegehren …).
// Je Eintrag zählt das stärkste Streitwort seines Titels, verstärkt durch Anzeichen für Streit (Bürgerbegehren,
// Antrag einer Fraktion) und durch den Status (abgelehnt und vertagt sind lauter als beschlossen).
// Je Tag höchstens `perDay` Einträge, je Ort und Tag höchstens einer, ein Ort höchstens einmal je Gruppe und Woche.

import calibrationFile from '../../shared/social-calibration.json' with {type:'json'};
import ratingsFile from '../../shared/social-ratings.json' with {type:'json'};

const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
const shift=(d,n)=>iso(Date.parse(d+'T00:00:00Z')+n*DAY);

/**
 * Gruppen polarisierender Themen: Name, Gewicht (1 bis 3), Begriffe als [Name, Muster auf dem kleingeschriebenen Titel,
 * Gewicht (sonst das der Gruppe), zweites Muster, das zusätzlich treffen muss]. Gewichte unter 2,8 bringen einen Eintrag
 * nur mit Verstärkern (Fraktionsantrag, abgelehnt, vertagt) über die Schwelle.
 */
export const GROUPS=[
 {id:'verkehr',name:'Verkehr',weight:3,terms:[
  ['Tempo 30',/tempo[ -]?30|tempo[ -]?20|tempolimit|geschwindigkeitsbegrenzung|geschwindigkeitsreduz|30 km\/h/],
  ['Fahrradstraße',/fahrradstra(ß|ss)e|fahrradzone|radschnellweg|radspur|pop-up-radweg|protected bike|fahrradstadt/],
  ['Autofrei',/autofrei|autoarm|verkehrsversuch|durchfahrtsverbot|sperrung der innenstadt|verkehrsberuhigung der innenstadt/],
  ['Parken',/wegfall (von |der )?parkpl|parkgebühr|anwohnerparken|parkraumbewirtschaft|parkplatzabbau|stellplatzsatzung|parkplätze (entfallen|wegfall)/,2.6],
  ['Busspur / Umweltspur',/busspur|umweltspur|umweltzone|citymaut/,2.4],
  ['Schulstraße / Poller',/schulstra(ß|ss)en\b|einrichtung einer schulstra|schulstra(ß|ss)e.{0,40}(sperr|autofrei|elternhaltestelle)|poller|modalfilter/,2.4],
 ]},
 {id:'energie',name:'Energie & Umwelt',weight:2.6,terms:[
  ['Windkraft',/windkraft|windrad|windräder|windenergie|windpark|windvorrang|\bwea\b|repowering.{0,60}(wea|wind)/,undefined,/^(?!.*(zuschuss|bezuschussung|schützengilde|e\.\s?v\.|förderverein)).*/s],
  ['Solarpark',/freiflächen-?(photovoltaik|pv|solar)|photovoltaik-?freifläche|solarpark|agri-?pv|pvfa/,2.4],
  ['Biogas / Speicher',/biogasanlage|batteriespeicher|großspeicher|wasserstofferzeugung|elektrolyseur/,2],
  ['Baumschutz',/baumfäll|baumschutzsatzung|baumerhalt|baumschutz/,2.4],
  ['Wärme',/wärmeplanung|nahwärme|heizungsgesetz|gasnetz/,1.2],
 ]},
 {id:'migration',name:'Migration & Soziales',weight:3,terms:[
  ['Unterkunft',/flüchtlingsunterkunft|geflüchtetenunterkunft|asylunterkunft|sammelunterkunft|containerdorf|notunterkunft|zeltstadt|gemeinschaftsunterkunft|unterbringung (von )?(geflüchtet|flüchtling|obdachlos)|aufnahme und unterbringung/],
  ['Bezahlkarte',/bezahlkarte/],
  ['Obdachlosigkeit',/obdachlos|wohnungslos|trinkerraum|drogenkonsumraum|bettelverbot|alkoholverbot|waffenverbotszone/,2.6],
  ['Integration',/einbürgerung|abschiebung|abschiebehaft|ankerzentrum|ausreisepflicht/,2.2],
 ]},
 {id:'identitaet',name:'Haltung & Symbole',weight:2.5,terms:[
  ['Gendern',/gendern|gendersprache|geschlechtergerechte sprache|genderstern|gender-?sternchen/],
  ['Moschee / Religion',/moschee|muezzin|gebetsruf|minarett|kopftuch|kirchenasyl/],
  ['Umbenennung',/umbenennung (der|des|von) .*(stra(ß|ss)e|platz|schule|weg)|straßenumbenennung|straßennamen|kolonial/],
  ['Flagge / Symbol',/regenbogenflagge|regenbogenfahne|\bpride\b|\bcsd\b|beflaggung|bundesflagge|flagge zeigen|kruzifix/],
  ['Rechtsextremismus',/brandmauer|rechtsextrem|demonstration gegen|gegen rechts/],
  ['Vielfalt / Demokratie',/vielfalt|demokratie|toleranz|antisemitismus|rassismus|diskriminierung|queer|weltoffen/,2.4],
  ['Tierschutz',/tierschutz|wildtierverbot|wildtiere im zirkus|zirkusverbot|taubenmanagement|taubenfütter|pelz/,2.6,/^(?!.*(tierschutzpartei|tierschutz-?partei|fraktion[^;]{0,40}tierschutz|tierschutz\s*[\/&]|die partei|tierschutz-?verein)).*/s],
 ]},
 {id:'geld',name:'Gebühren & Schließung',weight:2.5,terms:[
  ['Schließung',/(?<![a-zäöüß])schließung(?! (des|der|von) (öffentlichen|nichtöffentlichen|sitzung|versammlung|tagesordnung|beratung|rednerliste|gehweglücke|baulücke|lücke|radweglücke))(?!.{0,25}lücke)|schliessung|stilllegung (des|der|von) (bad|schule|kita|bibliothek|krankenhaus|klinik|standort)|schließen (der|des) (bad|schule|kita|bibliothek|krankenhaus|klinik|standort|freibad|hallenbad|filiale|jugendzentrum|werk|geschäftsstelle)|einstellung des betriebs/,3],
  ['Bad / Bibliothek',/hallenbad(?!str)|freibad|schwimmbad|schwimmhalle|stadtbibliothek|bücherei|musikschule|volkshochschule|stadtteilbibliothek|jugendzentrum|stadtteilzentrum/,2.5,/schließ|erhalt|zukunft|abriss|streichung|kürzung|einspar|defizit|sanierung|neubau|kosten|erhöhung|bürger|petition|rettung|verkauf/],
  ['Grundsteuer / Hebesatz',/grundsteuer|hebesatz|hebesätze|realsteuer|gewerbesteuer/,2.6],
  ['Streichung / Sparliste',/streichung (von|der|des|aller)|kürzung (der|von|des|aller)|haushaltskonsolidierung|konsolidierungsliste|sparpaket|sparliste|kürzungsliste|rotstift/,2.6],
  ['Eintrittspreise',/eintrittspreis|eintrittsgeld|badeeintritt|preiserhöhung|ticketpreis|fahrpreiserhöhung|tariferhöhung/,2.6],
  ['Gebührenerhöhung',/erhöhung (der |des |von )?(gebühr|beitr|steuer|entgelt|eintritt|elternbeitr|kita)|gebührenerhöhung|beitragserhöhung|straßenausbaubeitr/,2.8],
  ['Kita-Beiträge',/kita-?gebühr|elternbeitr|kita-?beitr/,1.6],
  ['Teurer Bau',/kostensteigerung|kostenexplosion|kostenüberschreitung|prestigeprojekt|millionengrab|baukostensteigerung/,2.8],
  ['Mehrkosten',/mehrkosten|nachtragsbewilligung/,1.5],
  ['Verkauf',/verkauf (des|der|von) (grundstück|gebäude|stadtwerke|anteile|wohnungen|rathaus|schule)|privatisierung|rekommunalisierung/,2.2],
 ]},
 {id:'beteiligung',name:'Bürgerbeteiligung',weight:3,terms:[
  ['Bürgerbegehren',/bürgerbegehren|bürgerentscheid|einwohnerantrag|volksbegehren|ratsbegehren|unterschriftensammlung|unterschriften|bürgerinitiative/,undefined,/^(?!.*(petitionsausschuss|geschäftsordnung|besetzung|bestellung der mitglieder)).*/s],
  ['Bürgerbegehren',/petition/,undefined,/^(?!.*(petitionsausschuss|geschäftsordnung|besetzung|bestellung der mitglieder|schülerbeförderung|kenntnisnahme|stellungnahme zur petition)).*(verbot|schließ|erhalt|abschaffung|gegen|kein|erhöhung|steuer|gebühr|tempo|windkraft|moschee|feuerwerk|bezahlkarte|rückbau|umbenennung|fällung|ausbau)/s],
  ['Rücktritt / Abwahl',/abwahl|rücktritt (des|der|von) (herrn |frau )?(bürgermeister|landrat|oberbürgermeister|stadträtin|stadtrat|gemeinderat|ratsherr|ratsfrau|beigeordnet|ortsvorsteher|fraktionsvorsitz)|misstrauensantrag|dienstaufsichtsbeschwerde|untersuchungsausschuss|abberufung (des|der|von) (bürgermeister|stadträtin|stadtrat|ersten|beigeordnet|ortsvorsteher|landrat)/],
  ['Anwohnerprotest',/\bprotest(?!ant)|widerstand gegen|anwohnerinitiative|kundgebung/,2.4],
 ]},
 {id:'politik',name:'Politik & Geld',weight:2.8,terms:[
  ['Aufwandsentschädigung',/aufwandsentschädigung|sitzungsgeld|fraktionszuwendung|fraktionsmittel|diäten|dienstwagen|dienstreise/,2.8,/^(?!.*(feuerwehr|inklusionsbeauftragt|gerätewart|wehrführ|ortsbrandmeister|schiedsperson|wahlhelfer)).*(ratsmitglied|rats-|stadtrat|gemeinderat|kreistag|fraktion|mandat|bürgermeister|abgeordnet|ortsvorsteher|dienstwagen|politik)/s],
  ['Ehrung / Aberkennung',/aberkennung|aberkennen|ehrenbürger.{0,50}(nazi|ns-|nationalsozial)|umstritten.{0,30}(ehrenbürger|straßenname|denkmal)/,2.8],
  ['Verpackungs- / Bettensteuer',/verpackungssteuer|übernachtungssteuer|bettensteuer|tourismusabgabe|citytax|zweitwohnungssteuer/,2.8],
  ['Hundesteuer',/hundesteuer|vergnügungssteuer/,1.8],
  ['Transparenz',/transparenz|livestream|sitzungsübertragung|übertragung der sitzung|informationsfreiheit/,2.4],
  ['Videoüberwachung',/videoüberwachung|kameraüberwachung|bodycam|überwachungskamera/,2.6,/innenstadt|marktplatz|bahnhof|park|kriminal|sicherheit|angstraum|rathausplatz|öffentlich|stadtgebiet|brennpunkt/],
  ['Feuerwerk',/böllerverbot|feuerwerksverbot|abbrennverbot|feuerwerk.{0,40}(verbot|einschränk)|silvesterfeuerwerk/,2.4],
 ]},
 {id:'alltag',name:'Alltag & Müll',weight:2.2,terms:[
  ['Sonntagsöffnung',/verkaufsoffene[rn]? sonntag|sonntagsöffnung|ladenöffnung|sonn- und feiertag/,2.6],
  ['Innenstadt / Handel',/innenstadt.{0,40}(leerstand|belebung|händler|einzelhandel)|einzelhandel|leerstand/,2.0],
  ['Müll',/müllgebühr|abfallgebühr|restmülltonne|biotonne|gelbe tonne|windeltonne|abfallwirtschaftssatzung/,2.4],
  ['Ampel / Übergang',/zebrastreifen|fußgängerüberweg|fußgängerampel|ampelanlage|lichtsignalanlage/,1.8],
  ['Radweg',/(?<!pop-up-)(?<!schnell)radweg|radwegebau|radverkehrsanlage/,1.8],
  ['Veranstaltung',/stadtfest|weihnachtsmarkt|kirmes|schützenfest|karneval|volksfest/,2.2,/abgesagt|absage|abgeschafft|verbot|streich|einspar|aus für|rettung|gefährdet/],
  ['Spielplatz',/spielplatz|bolzplatz|skatepark|jugendtreff/,1.8,/schließ|abriss|rückbau|beschwerde|lärm|streich|einspar/],
 ]},
 {id:'bauen',name:'Bauen & Flächen',weight:2,terms:[
  ['Großprojekt',/hochhaus|logistikzentrum|logistikpark|rechenzentrum|kiesabbau|kiesgrube|steinbruch|müllverbrennung/,2.2],
  ['Neubaugebiet',/flächenverbrauch|flächenversiegelung|nachverdichtung/,2.2],
  ['Funk / Strom',/mobilfunkmast|funkmast|hochspannungsleitung|stromtrasse|südlink|suedlink/,2.4],
  ['Umspannwerk',/umspannwerk/,1.5],
  ['Spielhalle / Rotlicht',/spielhalle|wettbüro|vergnügungsstätte|shisha|bordell|prostitution/,2.4],
 ]},
];

// Satzbausteine je Streitwort: [nach „zu“ (Dativ), nach „über“ (Akkusativ), Hashtag]
const FORMS={
 'Tempo 30':['Tempo 30','Tempo 30','Tempo30'],
 'Fahrradstraße':['einer Fahrradstraße','eine Fahrradstraße','Fahrradstraße'],
 'Autofrei':['einem Verkehrsversuch','einen Verkehrsversuch','Verkehrswende'],
 'Parken':['Parkgebühren und Parkraum','Parkgebühren und Parkraum','Parken'],
 'Busspur / Umweltspur':['einer Busspur','eine Busspur','ÖPNV'],
 'Schulstraße / Poller':['Schulstraßen und Pollern','Schulstraßen und Poller','Schulstraße'],
 'Windkraft':['Windkraftanlagen','Windkraftanlagen','Windkraft'],
 'Solarpark':['einer Freiflächen-Photovoltaikanlage','eine Freiflächen-Photovoltaikanlage','Solarpark'],
 'Biogas / Speicher':['einer Energieanlage','eine Energieanlage','Energiewende'],
 'Baumschutz':['Baumfällungen und Baumschutz','Baumfällungen und Baumschutz','Baumschutz'],
 'Wärme':['der Wärmeplanung','die Wärmeplanung','Wärmeplanung'],
 'Unterkunft':['einer Unterkunft für Geflüchtete','eine Unterkunft für Geflüchtete','Flüchtlingsunterkunft'],
 'Bezahlkarte':['der Bezahlkarte','die Bezahlkarte','Bezahlkarte'],
 'Obdachlosigkeit':['Obdachlosigkeit','Obdachlosigkeit','Obdachlosigkeit'],
 'Integration':['Einbürgerung und Abschiebung','Einbürgerung und Abschiebung','Migration'],
 'Gendern':['gendergerechter Sprache','gendergerechte Sprache','Gendern'],
 'Moschee / Religion':['einem Moscheebau','einen Moscheebau','Religion'],
 'Umbenennung':['einer Umbenennung','eine Umbenennung','Straßennamen'],
 'Flagge / Symbol':['Beflaggung öffentlicher Gebäude','Beflaggung öffentlicher Gebäude','Beflaggung'],
 'Rechtsextremismus':['Rechtsextremismus','Rechtsextremismus','Demokratie'],
 'Schließung':['einer Schließung','eine Schließung','Schließung'],
 'Bad / Bibliothek':['einer öffentlichen Einrichtung','eine öffentliche Einrichtung','Daseinsvorsorge'],
 'Grundsteuer / Hebesatz':['der Grundsteuer','die Grundsteuer','Grundsteuer'],
 'Gebührenerhöhung':['einer Gebührenerhöhung','eine Gebührenerhöhung','Gebühren'],
 'Kita-Beiträge':['den Kita-Beiträgen','die Kita-Beiträge','Kita'],
 'Teurer Bau':['steigenden Baukosten','steigende Baukosten','Baukosten'],
 'Mehrkosten':['Mehrkosten','Mehrkosten','Baukosten'],
 'Verkauf':['einem Verkauf','einen Verkauf','Stadtentwicklung'],
 'Bürgerbegehren':['einem Bürgerbegehren','ein Bürgerbegehren','Bürgerbegehren'],
 'Rücktritt / Abwahl':['einem Rücktritt oder einer Abwahl','einen Rücktritt oder eine Abwahl','Kommunalpolitik'],
 'Anwohnerprotest':['Protest von Anwohnern','Protest von Anwohnern','Bürgerprotest'],
 'Großprojekt':['einem Großprojekt','ein Großprojekt','Stadtentwicklung'],
 'Neubaugebiet':['Flächenverbrauch','Flächenverbrauch','Flächenverbrauch'],
 'Funk / Strom':['einem Funkmast oder einer Stromtrasse','einen Funkmast oder eine Stromtrasse','Infrastruktur'],
 'Umspannwerk':['einem Umspannwerk','ein Umspannwerk','Energiewende'],
 'Aufwandsentschädigung':['der Aufwandsentschädigung der Politik','die Aufwandsentschädigung der Politik','Kommunalpolitik'],
 'Ehrung / Aberkennung':['einer Ehrung','eine Ehrung','Erinnerungskultur'],
 'Streichung / Sparliste':['Kürzungen im Haushalt','Kürzungen im Haushalt','Haushalt'],
 'Eintrittspreise':['höheren Eintritts- und Fahrpreisen','höhere Eintritts- und Fahrpreise','Preise'],
 'Vielfalt / Demokratie':['Vielfalt und Demokratie','Vielfalt und Demokratie','Demokratie'],
 'Tierschutz':['Tierschutz','Tierschutz','Tierschutz'],
 'Transparenz':['mehr Transparenz in der Ratsarbeit','mehr Transparenz in der Ratsarbeit','Transparenz'],
 'Sonntagsöffnung':['verkaufsoffenen Sonntagen','verkaufsoffene Sonntage','Sonntagsöffnung'],
 'Innenstadt / Handel':['der Innenstadt und dem Einzelhandel','die Innenstadt und den Einzelhandel','Innenstadt'],
 'Verpackungs- / Bettensteuer':['einer neuen kommunalen Steuer','eine neue kommunale Steuer','Steuern'],
 'Hundesteuer':['der Hundesteuer','die Hundesteuer','Hundesteuer'],
 'Videoüberwachung':['mehr Sicherheit in der Innenstadt','mehr Sicherheit in der Innenstadt','Sicherheit'],
 'Feuerwerk':['einem Feuerwerksverbot','ein Feuerwerksverbot','Feuerwerk'],
 'Müll':['der Müllabfuhr und den Abfallgebühren','die Müllabfuhr und die Abfallgebühren','Müll'],
 'Ampel / Übergang':['einem Fußgängerübergang','einen Fußgängerübergang','Verkehrssicherheit'],
 'Radweg':['einem Radweg','einen Radweg','Radverkehr'],
 'Veranstaltung':['einer Veranstaltung','eine Veranstaltung','Stadtfest'],
 'Spielplatz':['einem Spielplatz','einen Spielplatz','Spielplatz'],
 'Spielhalle / Rotlicht':['Spielhallen und Vergnügungsstätten','Spielhallen und Vergnügungsstätten','Stadtentwicklung'],
};
const PARTIES=[
 [/\bafd\b/,{nom:'die AfD',gen:'der AfD'}],[/\bcdu\b|\bcsu\b/,{nom:'die CDU',gen:'der CDU'}],[/\bspd\b/,{nom:'die SPD',gen:'der SPD'}],
 [/bündnis ?90|\bgrünen?\b|b['’]?90/,{nom:'die Grünen',gen:'der Grünen',plural:true}],[/\bfdp\b/,{nom:'die FDP',gen:'der FDP'}],
 [/\blinke\b|\blinken\b|die linke/,{nom:'die Linke',gen:'der Linken'}],[/\bbsw\b/,{nom:'das BSW',gen:'des BSW'}],
 [/freie wähler|\bfw\b/,{nom:'die Freien Wähler',gen:'der Freien Wähler',plural:true}],[/\bvolt\b/,{nom:'Volt',gen:'von Volt'}],
];
const inPlace=r=>/^(Kreis|Landkreis) |-Kreis |kreis$|land$/i.test(r)&&!/^(Stadt|Gemeinde) /.test(r)?'im '+r:'in '+r;
const hashtag=t=>String(t).split(/[^A-Za-zÄÖÜäöüß0-9]+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
const cap=t=>t[0].toUpperCase()+t.slice(1);
// Hier stimmt der feste Satzbaustein immer; bei allen anderen Stichwörtern steht das Wort aus dem Titel („Thema „Schließzeiten““),
// weil die Bewertung zeigte, dass allgemeine Bausteine sonst Falsches behaupten (Schließzeiten als Schließung, Gewerbe- als Grundsteuer).
const SAFE_FORMS=new Set(['Tempo 30','Bezahlkarte','Windkraft','Fahrradstraße','Solarpark','Gendern','Moschee / Religion','Flagge / Symbol','Rechtsextremismus','Verpackungs- / Bettensteuer','Hundesteuer','Feuerwerk','Sonntagsöffnung']);
/**
 * Titel für den Aufhänger bereinigen: Nachtragskopf, Fraktionskopf („Antrag der CDU-Fraktion vom …:“), „hier:“, Aktenzeichen,
 * Klammern mit Daten und Paragraphen entfernen, auf höchstens `max` Zeichen an einer Wortgrenze kürzen.
 */
export function cleanTitle(title,max=130){
 let t=String(title||'').replace(/\s+/g,' ').trim();
 t=t.replace(/^Nachtrag:?\s*[\d.]+\s*(Nummer\s*\d+\s*)?/i,'');
 // Kopf „Antrag/Anfrage … :“ oder „… vom 24.06.2026 zur …“ nur entfernen, wenn danach noch ein Gegenstand folgt
 const heads=[
  /^(?:[A-ZÄÖÜ][\wäöüß]+-)?(?:Gemeinsamer |Gemeinsame )?(?:Änderungs-?|Ergänzungs-?|Beschluss-?|Dringlichkeits-?)?(?:antrag|anfrage|vorschlag)\b(?:\s+Nr\.?\s*[\w\/.-]+)?[^:–]{0,110}?(?:\s+[-–]\s+|\s*:\s+)(?:Fraktion\s+[A-ZÄÖÜ][\wäöüß/]+\s+)?/i,
  /^(?:Gemeinsamer |Gemeinsame )?(?:Änderungs-?|Ergänzungs-?|Beschluss-?|Dringlichkeits-?)?(?:antrag|anfrage|vorschlag)\b[^:–]{0,90}?vom\s+\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\s*(?:(?:zur|zum|zu|betr\.?|betreffend|bzgl\.?|bezüglich)\s+|\s*[:;,_/]\s*)/i,
  /^(?:[A-ZÄÖÜ][\wäöüß]+-)?(?:Gemeinsamer |Gemeinsame )?(?:Änderungs-?|Ergänzungs-?|Beschluss-?|Dringlichkeits-?)?(?:antrag|anfrage|vorschlag)\b[^:–]{0,110}?:\s+/i,
 ];
 heads.push(/^[A-ZÄÖÜ][\wäöüß]+-?(?:antrag|anfrage)\s+(?:zur|zum|zu|betr\.?|betreffend|bzgl\.?|bezüglich)\s+/i);
 heads.push(/^(?:antrag|anfrage)\s+(?:bzgl\.?|bezüglich|betr\.?|betreffend|zur|zum|zu|auf)\s+/i);
 heads.push(/^(?:(?:änderungs-?|ergänzungs-?|dringlichkeits-?)?(?:antrag|anfrage)|beschlussvorlage|beschlussantrag)\s+(?:der|des|von|vom)\s+[^,:;]{0,80}?\s+(?:betreffend|betr\.|bzgl\.|bezüglich)\s+/i);
 heads.push(/^(?:beschlussvorlage|beschlussantrag)\s+(?:der\s+)?(?:fraktion\s+)?[^-–:]{0,40}?\s+[-–]\s+/i);
 heads.push(/^beratung(?: und (?:ggf\.? )?beschluss(?:fassung)?)?\s+(?:über|zu|zum|zur)\s+(?:den |die |das |dem |der )?/i);
 heads.push(/^(?:antrag|anfrage) (?:der|des|von) [^,:]{0,70}?(?:fraktion|partei|gruppe|fraktionen)\s+(?:auf|zur|zum|zu|über|betr\.?|betreffend)\s+(?:die |den |das |eine |einen |ein )?/i);
 {const m2=/^(.{0,70}?(?:antrag|drucksache|vorlage)\s*(?:nr\.?\s*)?\d[^:]{0,60}):\s+(.{12,})$/i.exec(t);if(m2)t=m2[2];}
 for(const h of heads){const m=h.exec(t);if(m&&t.length-m[0].length>=8&&!/^(?:[\w-]+-)?fraktion\s*$/i.test(t.slice(m[0].length))){t=t.slice(m[0].length);break;}}
 t=t.replace(/(?:B(?:ü|ue?)ndnis|Bd\.) ?90 ?[\/-] ?(?:die )?gr(?:ü|ue?)nen/gi,'Grünen').replace(/partei mensch,? umwelt,? tierschutz/gi,'Tierschutzpartei');
 {const m5=/^([^:]{4,90}(?:fraktion|gruppe|grünen|cdu|spd|fdp|afd|wähler|linke)[^:]{0,60}):\s+(.{15,})$/i.exec(t);
  if(m5&&!/^\S*(antrag|anfrage)/i.test(m5[1])&&(m5[1].match(/fraktion|gruppe|cdu|spd|fdp|afd|grünen|wähler|linke|bvb|fwg|volt|bsw/gi)||[]).length>=2)t=m5[2];}
 // Zweiter Durchgang: „Antrag der <Fraktion/Gruppe/Partei …> [vom Datum] [zur/auf/betr.] Gegenstand“
 {const m4=/^(?:gemeinsamer?\s+)?\S*(?:antrag|anfrage)\s+(?:der|des|von|vom)\s+(?:\S+\s+){0,7}?(?:\S*fraktion\S*|gruppe|\S*partei|\S*grünen\S*|linke\S*|afd|cdu\S*|spd\S*|fdp|bsw|volt|fwg|ortsbeirat\S*)(?:(?:\s+(?:und|der|des|von)\s+|\s*[-–/,&]\s*|\s+)(?:die\s+)?(?:\S*fraktion\S*|gruppe|\S*partei|\S*grünen\S*|linke\S*|afd|cdu\S*|spd\S*|fdp|bsw|volt|fwg|wab))*(?:\s+(?:im|in|für)\s+(?:\S+\s+){0,6}?(?:rat|kreistag|stadtrat|gemeinde\S*|landkreis\S*|ortsbeirat|bv\s*\d+))?(?:\s+vom\s+\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4})?\s*[,;:–-]?\s*(?:(?:zum\s+thema|zur|zum|zu|auf|für|betreffend|betr\.|bzgl\.|über|aus)\s+)?/i.exec(t);
  if(m4&&t.length-m4[0].length>=12)t=t.slice(m4[0].length);}
 t=t.replace(/^beratung\s+(?=[A-ZÄÖÜ])/,'').replace(/^thema\s+/i,'');
 t=t.replace(/^(hier|betr\.?|betreff)\s*:?\s*/i,'');
 t=t.replace(/\((?:[^()]*?(?:\d{1,2}\.\d{1,2}\.\d{2,4}|eingang|aktenzeichen|az\.|vorlage|drucksache|§|ds\b|art\. ?\d|abs\. ?\d)[^()]*)\)/gi,'');
 t=t.replace(/\b(?:DS|Drucksache|Vorlage|Vorlagen?-?Nr\.?|Antrag Nr\.?|Nr\.)\s*[\w\/.-]*\d[\w\/.-]*/gi,'');
 {const m0=/^(.+?)\s+[-–]\s+(?:Antrag|Anfrage|Vorlage|Beschlussvorlage)\b.*$/i.exec(t);if(m0&&/\s.+\s/.test(m0[1]))t=m0[1];}
 t=t.replace(/\s*[•|]\s*(?:Antrag|Anfrage)\b.*$/i,'');
 t=t.replace(/\s+(?:Änderungs-?|Ergänzungs-?)?(?:Antrag|Anfrage)\s+(?:zur|zum|zu|der|des|von)$/i,'');
 t=t.replace(/\s*\((?:Antrag|Anfrage)\b[^)]*$/i,'');
 t=t.replace(/\bDS-\s*/g,'');
 t=t.replace(/^(?:und|sowie)\s+[^-–:]{0,40}\s[-–]\s+(?=.{12})/i,'');
 t=t.replace(/^[A-ZÄÖÜ][A-ZÄÖÜ .\/-]{2,30}\s+vom\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+(?=.{12})/,'');
 t=t.replace(/^eingegangen bei [^.]{0,60}?\bam \d{1,2}\.\d{1,2}\.\d{2,4}\s+(?:(?:zur|zum|zu|auf)\s+)?(?=.{12})/i,'');
 t=t.replace(/^liste zur sitzung [^.]{0,50}?\bam \d{1,2}\.\d{1,2}\.\d{2,4}\s+(?=.{12})/i,'');
 t=t.replace(/\s+Einr\.?:.*$/i,'').replace(/\s+ff\.?$/,'');
 t=t.replace(/^TOP\s*\d+[a-z]?\s*:\s*/i,'').replace(/^[^:]{3,30}:\s+hier\s*[-–]\s+(?=.{12})/i,'');
 t=t.replace(/^(?:Beschlussvorlage|Vorlage)\s+[\d\/.-]{4,}\s+(?=.{12})/i,'');
 t=t.replace(/(?:\s+[-–]\s+\S+)?\s+(?:gemäß|gemäss|gem\.|nach|i\. ?V\. ?m\.)\s+§.*$/i,'');
 t=t.replace(/^(?:Die\s+)?(?:Linke|Grünen|SPD|CDU|FDP|AfD)\s+zu(?:r|m)?\s+(?:Beschlussvorlage|Vorlage|Antrag)\s+[\d\/._A-Z-]{4,}\s*(?=.{12})/,'');
 t=t.replace(/^(?:Der|Die)\s+(?:Gemeinde|Stadt|Samtgemeinde)\s+\S+\s+(?:auf|zur|zum)\s+(?=.{12})/i,'').replace(/^Der\s+(?=\S+ung\b)/i,'').replace(/^Der\s+Fraktion\s+[^.]{3,40}?\s+vom\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+(?=.{12})/i,'');
 t=t.replace(/\s*\((?:(?:Antrag|Anfrage) (?:der )?)?(?:\S+-)?Fraktion[^)]*\)\s*$/i,'');
 t=t.replace(/["„“]?\s*,\s*(?:Änderungs-?|Ergänzungs-?)?(?:Antrag|Anfrage) (?:der|des|von)\b.*$/i,'');
 {const m3=/^(.{15,}?)\s+(?:Änderungs-?|Ergänzungs-?)?(?:Antrag|Anfrage)\s+(?:der|des|von)\s+(?:Fraktion|Fraktionen|Gruppe|Partei|CDU|SPD|FDP|AfD|Grünen|Linken|Freien)\b.*$/i.exec(t);if(m3)t=m3[1];}
 {
  const parts=t.split(/\s+hier\s*:\s*/i);
  if(parts.length>1){
   const formal=/§|GO NRW|Anregung|Beschwerde|Mitteilung|Drucksache|nach Art\./i;
   t=formal.test(parts[0])&&parts[1].length>=12?parts.slice(1).join(' '):parts[0];
  }
 }
 t=t.replace(/\s+(?:auf (?:den|dem) )?(?:Grundstück(?:en)?|Flurst(?:ück)?\.?|Flst\.?|Fl\.?-?\s?Nrn?\.?|Flurnummer|Gmk\.?|Gemarkung)\b.*$/i,'');
 t=t.replace(/,\s*(?:,\s*)+/g,', ').replace(/\s+,/g,',').replace(/^[,\s]+/,'');
 t=t.replace(/^(?:und|sowie)\s+[^:]{0,60}?(?:fraktion|partei)\b[^:]{0,40}?\bvom\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s*(?:betr\.?|betreffend|zu(?:m|r)?|:)?\s*/i,'');
 t=t.replace(/\s{2,}/g,' ').replace(/^[\s:;,.–-]+|[\s:;,.–-]+$/g,'');
 if(((t.match(/"/g)||[]).length)%2)t=t.replace(/"/g,'');
 t=t.replace(/„([^“]*)“/g,'‚$1‘').replace(/"([^"]*)"/g,'‚$1‘');
 t=t.replace(/^(?:Grünen|SPD|CDU|FDP|AfD|Linke|FWG|UWG)\b.{0,60}?\b(?:im|in der|in)\s+(?:Rat|Kreistag|Stadtrat|Gemeinderat)\b.{0,50}?\s+(?:zur|zum|zu|auf|für)\s+(?=.{12})/i,'');
 {const m6=/^‚([^‚‘]+)‘$/.exec(t);if(m6)t=m6[1];}
 if(t)t=t[0].toUpperCase()+t.slice(1);
 if(t.length>max){
  const cut=t.slice(0,max);
  // Bevorzugt an einer Satzgrenze kürzen, dann ohne „…“: ein vollständiger Teilsatz liest sich besser als ein abgebrochener
  {let best=-1;const re=/\s[–]\s|[;:]\s/g;let m;
   while((m=re.exec(cut)))if(m.index>=35&&m.index<=max-4&&!(cut.slice(0,m.index).split('(').length>cut.slice(0,m.index).split(')').length)&&(cut.slice(0,m.index).match(/[‚„"]/g)||[]).length%2===0)best=m.index;
   if(best>0)return cut.slice(0,best).replace(/[\s,;:–\/-]+$/,'');}
  const sp=cut.lastIndexOf(' ');
  const pu=Math.max(cut.lastIndexOf(', '),cut.lastIndexOf(': '),cut.lastIndexOf('; '),cut.lastIndexOf(' – '));
  const op=cut.lastIndexOf('(');
  const open=op>max*.4&&op>cut.lastIndexOf(')');
  t=cut.slice(0,open?op:pu>max*.5?pu:sp>max*.55?sp:max).replace(/[\s,;:–-]+$/,'');
  for(let i=0;i<3;i++)t=t.replace(/\s+(?:und|oder|der|des|die|das|dem|den|zur|zum|von|vom|für|mit|in|im|an|auf|am|bei|sowie|zu|um|als|ein|eine|einer|eines)$/i,'').replace(/[\s,;:–-]+$/,'');
  t+=' …';
 }
 return t;
}

/**
 * Aufhänger aus Ort, Akteur, Stand und dem bereinigten Titel in Anführungszeichen. Der Titel wird nicht umformuliert:
 * Die Bewertung durch unabhängige Bewerter zeigte, dass Umschreibungen (abgeschnittene Wörter, falsche Beugung, Fraktionsnamen
 * als Thema) häufiger Falsches behaupteten als ein knappes Zitat.
 */
export function draftText({title,status,region,term}){
 const f=FORMS[term];if(!f)return null;
 const [,,tag]=f;
 const low=title.toLowerCase();
 let parties=PARTIES.filter(([re])=>re.test(low)).map(x=>x[1]);
 if(parties.length>1&&/\b(zum|zu dem|gegen den|konkurrierend\w*|ersatz\w*)\b.{0,30}antrag/.test(low))parties=[];
 const isAnfrage=/\banfrage\b/.test(low)&&!/antrag/.test(low);
 const planning=PLANNING.test(title);
 const isReport=!isAnfrage&&!planning&&/^(sachstand|bericht|mitteilung|informationsvorlage|information (zu|über)|beantwortung)|sachstandsbericht|^(nachtrag[^a-z]*)?(sachstand|bericht)/.test(low.replace(/^nachtrag:?\s*[\d. ]*(nummer \d+\s*)?/,''));
 const isMotion=!isReport&&/antrag|vorstoß/.test(low)&&!isAnfrage;
 const place=inPlace(region);
 const At=cap(place);
 const quote=cleanTitle(title);
 if(quote.length<8||/^(der|die|das|des) (vergangenen|linke|grünen)\b/i.test(quote)||/(?<![\wäöüßÄÖÜ])(und|oder|der|des|zur|zum|von|für|mit)$/i.test(quote.replace(/ …$/,'')))return null;
 const bareHead=/^(antrag|anfrage|änderungsantrag|ergänzungsantrag)\b/i.test(quote)&&quote.length<60;
 const topicLabel=term.split(' / ')[0];
 const sep=bareHead?' ':': ';
 const q=bareHead?`zum Thema „${topicLabel}“`:`„${quote}“`;
 let text;
 if(parties.length&&parties.length<=2&&(isMotion||isAnfrage)){
  const nom=cap(parties.map(p=>p.nom).join(' und '));
  const gen=parties.map(p=>p.gen).join(' und ');
  const plural=parties.length>1||parties[0].plural;
  const subject=bareHead?`der Antrag ${gen} zum Thema „${topicLabel}“`:`der Antrag ${gen}`;
  if(isAnfrage)text=bareHead?`${nom} ${plural?'stellen':'stellt'} ${place} eine Anfrage zum Thema „${topicLabel}“`:`${nom} ${plural?'fragen':'fragt'} ${place}${sep}${q}`;
  else text={rejected:`${At} wurde ${subject} abgelehnt${bareHead?'':sep+q}`,
   postponed:`${At} wurde ${subject} vertagt${bareHead?'':sep+q}`,
   approved:`${At} wurde ${subject} angenommen${bareHead?'':sep+q}`,
   recommended:`${At} wurde ${subject} zur Annahme empfohlen${bareHead?'':sep+q}`}[status]||(bareHead?`${nom} ${plural?'stellen':'stellt'} ${place} einen Antrag zum Thema „${topicLabel}“`:`${nom} ${plural?'beantragen':'beantragt'} ${place}${sep}${q}`);
 }else if(isReport){
  text=`${At} gibt es einen Bericht${sep}${q}`;
 }else{
  text={rejected:`${At} abgelehnt${sep}${q}`,postponed:`${At} vertagt${sep}${q}`,approved:`${At} beschlossen${sep}${q}`,
   recommended:`${At} empfohlen${sep}${q}`}[status]||`${At} auf der Tagesordnung${sep}${q}`;
 }
 const label=SAFE_FORMS.has(term)?(term==='Verpackungs- / Bettensteuer'?'Kommunale Steuer':term.split(' / ')[0]):'';
 const ort=hashtag(region.replace(/^(Stadt|Gemeinde|Kreis|Landkreis) /,''));
 return {
  text,
  question:label?`${label} ${place}: Was meinen Sie?`:`Was meinen Sie dazu?`,
  hashtags:['#'+hashtag(tag),'#'+ort,'#Kommunalpolitik'],
  party:parties.length?parties.map(p=>p.nom.replace(/^(die|das) /,'')).join(' und '):null,
 };
}

const FORMAL=/^(einladung|niederschrift|bekanntgabe|genehmigung der niederschrift|anfragen|mitteilungen|verschiedenes|sonstiges|einwohnerfrag|verfahrensantrag|geschäftsordnungsantrag|vorlage wird nachgereicht)/i;
// Antrag einer Fraktion, Gruppe oder eines Ratsmitglieds: Oppositionsanträge enden in den Berichten deutlich öfter streitig
// (55 bis 80 % gegenüber 22 % im Mittel aller Vorgänge, Auswertung von 12 Monaten).
const PARTY_MOTION=/\b(afd|linke|grüne|grünen|cdu|csu|spd|fdp|bsw|fraktion|freie wähler|volt)[- ]?(antrag|anfrage)|antrag der (afd|linken|grünen|cdu|spd|fdp|fraktion)|ratsfraktion|ratsgruppe|kreistagsfraktion|bürgerschaftsfraktion|änderungsantrag|ergänzungsantrag|beschlussantrag|antrag der gruppe|antrag des (ratsmitglieds|ratsherrn|einzelmandats)|einzelratsmitglied|wählergemeinschaft|antrag (der|von) (frau|herrn)|fraktion[a-zäöüß]* (die|der|bündnis|b['’]90)/;
const STATUS_BOOST={rejected:1.5,postponed:1.3,approved:1.1,recommended:1.15,consulting:1,announced:.95,info:.8,unknown:.9};

/** Streitwörter eines Titels: [{group,groupName,term,weight}] */
export function matchTitle(title){
 const t=' '+title.toLowerCase()+' ';
 const hits=[];
 for(const g of GROUPS)for(const [term,re,w,need] of g.terms)if(re.test(t)&&(!need||need.test(t)))hits.push({group:g.id,groupName:g.name,term,weight:w??g.weight});
 return hits;
}

export function scoreCard(card){
 const title=card.title||'';
 if(title.length<20||FORMAL.test(title)||/verfahrensantrag|geschäftsordnungsantrag/i.test(title))return null;
 const hits=matchTitle(title);
 if(!hits.length)return null;
 hits.sort((a,b)=>b.weight-a.weight);
 let score=hits[0].weight;
 score+=Math.min(hits.length-1,2)*.4;
 const party=PARTY_MOTION.test(title.toLowerCase());
 if(party)score+=.5;
 score*=STATUS_BOOST[card.status]??.9;
 return {score:Math.round(score*100)/100,hits,party};
}

// ---- Ergebnisse aus den Berichten (events[].result): belegen, ob ein Vorgang streitig endete -----------------------
const R_REJ=/abgelehnt|nicht angenommen|nicht beschlossen|keine mehrheit|nicht empfohlen/i;
const R_POST=/vertagt|zurückgestellt|zurückgezogen|abgesetzt|verwiesen|überwiesen|ohne beschluss|vertagung/i;
const R_UNAN=/einstimmig|ohne gegenstimme|einvernehmlich|einhellig/i;
const R_MAJ=/mehrheitlich|mit mehrheit|gegen \d+ stimme|\d+ gegenstimme|stimmenmehrheit|bei \d+ (nein|gegen)|\d+ nein/i;
const R_OK=/beschlossen|empfohlen|zugestimmt|angenommen|genehmigt|zur kenntnis|kenntnis genommen|erledigt/i;
/** 'rej' | 'post' | 'maj' | 'unan' | 'ok' | null */
// Platzhalter der Importe („Ergebnis … nicht belegt“, „Sitzung steht noch aus“) sind kein Ergebnis
const NO_RESULT=/nicht belegt|steht noch aus|liegt als Dokument vor|ohne Beschluss geführt/i;
export function classifyResult(t){
 if(!t||NO_RESULT.test(t))return null;
 if(R_REJ.test(t))return 'rej';
 if(R_POST.test(t))return 'post';
 if(R_UNAN.test(t))return 'unan';
 if(R_MAJ.test(t))return 'maj';
 if(R_OK.test(t))return 'ok';
 return null;
}
const ORDER=['rej','post','maj','unan','ok'];
/** Stärkstes Ergebnis aller Sitzungen eines Vorgangs und Zahl der Sitzungen; payload-Felder events, event, sourceData.records. */
export function evidenceOf({events,event,records}){
 const texts=[];
 for(const e of events||[]){if(e?.result)texts.push(e.result);if(e?.description)texts.push(e.description);}
 if(event?.result)texts.push(event.result);
 for(const r of records||[]){if(r?.result)texts.push(r.result);if(r?.raw?.result)texts.push(r.raw.result);}
 const found=texts.map(classifyResult).filter(Boolean);
 return {result:ORDER.find(o=>found.includes(o))||null,sessions:(events||[]).length,text:texts.find(t=>classifyResult(t)===ORDER.find(o=>found.includes(o)))||''};
}
const parse=v=>{if(typeof v!=='string')return v;try{return JSON.parse(v);}catch{return null;}};
/** Beleg je Karte aus den Berichten, in Blöcken; fehlende Berichte ergeben keinen Eintrag. */
async function loadEvidence(db,ids){
 const out=new Map();
 try{
  for(let i=0;i<ids.length;i+=40){
   const part=ids.slice(i,i+40);
   const {results}=await db.prepare(`SELECT id,json_extract(payload,'$.events') ev,json_extract(payload,'$.event') e1,json_extract(payload,'$.sourceData.records') rec FROM topics WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part).all();
   for(const r of results||[])out.set(r.id,evidenceOf({events:parse(r.ev),event:parse(r.e1),records:parse(r.rec)}));
  }
 }catch{/* ohne Berichte keine Belege; die Eignung rechnet dann mit Status und Titel */}
 return out;
}

// ---- Eignung für Social Media (0 bis 100 %), nur aus festen Regeln --------------------------------------------------
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
// Alltagsnähe: je näher am Alltag der Leserinnen und Leser, desto eher wird geteilt.
const EVERYDAY={verkehr:20,geld:18,alltag:17,migration:16,beteiligung:16,politik:16,identitaet:15,energie:12,bauen:8};
const EVERYDAY_TERM={'Eintrittspreise':19,'Sonntagsöffnung':16,'Tierschutz':14,'Streichung / Sparliste':16,'Transparenz':10,'Vielfalt / Demokratie':12,'Innenstadt / Handel':14,'Tempo 30':20,'Grundsteuer / Hebesatz':20,'Schließung':19,'Bad / Bibliothek':18,'Bezahlkarte':16,'Kita-Beiträge':17,'Umspannwerk':6,'Wärme':8,'Mehrkosten':8,'Funk / Strom':9};
const JARGON=/§|flst\.|fl\.-?nr|flurst|bebauungsplan|vorhabenbezogen|satzung|drucksache|\bbv\b|\bvo\/|geschäftsordnung|haushaltssatzung|aufstellungsbeschluss|einvernehmen|\bnr\.\s?\d/i;
/** Streitquote eines Stichworts aus den Berichten der letzten 12 Monate, zum Mittel hin gezogen (wenig Belege = nah am Mittel). */
export function termRate(term,cal=calibrationFile){
 const base=cal.baseline?.contested??.29,t=cal.terms?.[term];
 if(!t||!t.res)return {rate:base,n:0,base};
 const k=25;
 return {rate:(t.contested*t.res+base*k)/(t.res+k),n:t.res,base,raw:t.contested};
}
/** Mittleres Urteil unabhängiger Bewerter (1 bis 5) zu einem Stichwort, zum Gesamtmittel hin gezogen. */
export function termRating(term,rat=ratingsFile){
 const mean=rat.mean??2.75,t=rat.terms?.[term];
 if(!t)return {value:mean,n:0,mean};
 const k=6;
 return {value:(t.eignung*t.n+mean*k)/(t.n+k),n:t.n,mean};
}
const SMALL_BODY=/ortsbeirat|ortsrat|ortschaftsrat|bezirksvertretung|bezirksausschuss|stadtteilbeirat|ortsgemeinderat|bezirksbeirat|ortsteilbeirat/i;
const PLANNING=/bebauungsplan|flächennutzungsplan|vorhabenbezogen|aufstellungsbeschluss|öffentliche auslegung|bauantrag|bauvoranfrage|einvernehmen|bauleitplan|\d+\. änderung des/i;
const STREET_WORD=/stra(ß|ss)e\b|str\.|\bweg\b|\bplatz\b|allee\b|\bring\b|damm\b|ufer\b/i;
/**
 * Eignung eines Eintrags als Social-Media-Beitrag in Prozent. Teile (Summe höchstens 100, danach Abzüge):
 * Themenwert 15 (Hälfte gelernte Streitquote aus den Berichten, Hälfte Urteil unabhängiger Bewerter), Streit im Vorgang 15,
 * Alltagsnähe 20, Reichweite des Ortes 15, Aktualität 15, Konkretheit 10, Verständlichkeit 10.
 * Abzüge (aus der Auswertung von 272 bewerteten Vorschlägen): Einzelstraße −5, Gremium eines Ortsteils −7, Planungsvorgang −5.
 */
export function fitScore(c,{today,population={},evidence=null,calibration=calibrationFile,ratings=ratingsFile}){
 const main=c.hits[0];
 const tr=termRate(main.term,calibration),rt=termRating(main.term,ratings);
 const rateNorm=clamp((tr.rate-.12)/(.6-.12)),ratingNorm=clamp((rt.value-1.8)/(3.6-1.8));
 const themenwert=Math.round(30*(.35*rateNorm+.65*ratingNorm));
 // Streit im Vorgang: Abstimmungsergebnis, sonst Status; dazu Fraktionsantrag und Sitzungsfolge
 const res=evidence?.result||({rejected:'rej',postponed:'post'}[c.status])||null;
 let vorgang={rej:11,post:9,maj:8,unan:0,ok:2}[res]??3;
 if(c.party)vorgang+=4;
 if((evidence?.sessions||0)>=3)vorgang+=2;
 vorgang=Math.min(15,vorgang);
 const alltag=.75*(EVERYDAY_TERM[main.term]??EVERYDAY[main.group]??10);
 const pop=population[c.region_id];
 const reach=pop?Math.round(10*clamp((Math.log10(pop)-3.5)/2.2)):5;
 const days=Math.max(0,Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(c.date+'T00:00:00Z'))/DAY));
 const fresh=days<=1?10:days<=3?9:days<=7?7:days<=14?4:2;
 const party=PARTIES.some(([re])=>re.test(c.title.toLowerCase()));
 const decisive=['rejected','postponed','approved','recommended'].includes(c.status)||['rej','post','maj'].includes(res);
 const concrete=(party?4:0)+(decisive?3:0)+(/antrag|beschlussvorlage|bürgerbegehren|petition/i.test(c.title)?2:0);
 let clear=10;
 if(JARGON.test(c.title))clear-=4;
 if(c.title.length>140)clear-=3;
 if(c.title.length<25)clear-=2;
 if((c.title.match(/;|\bhier\b|\bnach\b § /gi)||[]).length>=2)clear-=2;
 if(/^(änderungs|ergänzungs)antrag/i.test(c.title)&&!/ zu(m|r)? /i.test(c.title))clear-=3;
 clear=Math.max(0,clear);
 // Abzüge
 let abzug=0;const why=[];
 if(STREET_WORD.test(c.title)&&!/straßen(namen|umbenennung)/i.test(c.title)){abzug-=5;why.push('Einzelstraße');}
 if(SMALL_BODY.test(c.gremium||'')){abzug-=7;why.push('Gremium eines Ortsteils');}
 if(PLANNING.test(c.title)){abzug-=5;why.push('Planungsverfahren');}
 if(/satzung|hebesatz/i.test(c.title)&&!c.party&&!['rej','post','maj'].includes(res)&&!['rejected','postponed'].includes(c.status)){abzug-=15;why.push('Routinesatzung');}
 const parts=[
  {key:'thema',label:'Themenwert',points:themenwert,max:30},
  {key:'vorgang',label:'Streit im Vorgang',points:vorgang,max:15},
  {key:'alltag',label:'Alltagsnähe',points:Math.round(alltag),max:15},
  {key:'reichweite',label:'Reichweite',points:reach,max:10},
  {key:'aktuell',label:'Aktualität',points:fresh,max:10},
  {key:'konkret',label:'Konkretheit',points:concrete,max:10},
  {key:'klar',label:'Verständlichkeit',points:clear,max:10},
 ];
 if(abzug)parts.push({key:'abzug',label:'Abzüge ('+why.join(', ')+')',points:abzug,max:0});
 const evidenceText=[];
 if(tr.n>=15)evidenceText.push(`Bei „${main.term}“ endeten ${Math.round(100*(tr.raw??tr.rate))} % der Vorgänge streitig (Mittel aller Themen ${Math.round(100*tr.base)} %, ${tr.n} Vorgänge mit Ergebnis)`);
 if(evidence?.result)evidenceText.push({rej:'Antrag abgelehnt',post:'vertagt oder verwiesen',maj:'mehrheitlich beschlossen, nicht einstimmig',unan:'einstimmig beschlossen',ok:'beschlossen'}[evidence.result]+(evidence.sessions>1?`, ${evidence.sessions} Sitzungen`:''));
 const sum=parts.reduce((n,x)=>n+x.points,0);
 // Oberhalb von 62 Punkten gespreizt, damit starke Vorschläge sich von durchschnittlichen absetzen (Rangfolge bleibt gleich).
 const percent=sum<=62?sum:Math.round(62+(sum-62)*1.6);
 return {percent:Math.max(0,Math.min(100,percent)),raw:sum,parts,evidence:evidenceText};
}

/**
 * @param {any} db @param {{id:string,name:string,shortName?:string}[]} regions
 * @param {{today?:string,days?:number,perDay?:number,minScore?:number,minFit?:number,population?:Record<string,number>,extraNames?:[string,string][]}} [o]
 */
export async function socialTopics(db,regions,{today=iso(Date.now()),days=30,perDay=3,minScore=2.8,minFit=40,population={},extraNames=[]}={}){
 // extraNames: [[regionId,name],…] für Gebiete außerhalb des Katalogs (BKG-Liste in shared/de-regions.json)
 const names=new Map([...extraNames,...regions.map(r=>[r.id,r.kind==='district'&&!/kreis/i.test(r.shortName||'')?'Kreis '+(r.shortName||r.name.replace(/^(Landkreis|Kreis) /,'')):(r.shortName||r.name)])]);
 const from=shift(today,-(days-1));
 const {results}=await db.prepare("SELECT id,region_id,date,status,label,title,gremium FROM search_cards WHERE date BETWEEN ? AND ? AND formal=0").bind(from,today).all();
 const cards=results||[];
 const scored=[];
 // In wie vielen anderen Orten kam dasselbe Streitwort im Zeitraum vor? Einordnung, kein Auswahlkriterium.
 const termRegions=new Map();
 for(const c of cards){
  const s=scoreCard(c);
  if(!s)continue;
  scored.push({...c,...s});
  for(const h of s.hits){let set=termRegions.get(h.term);if(!set)termRegions.set(h.term,set=new Set());set.add(c.region_id);}
 }
 // Derselbe Vorgang liegt oft mehrfach vor (Vorlage und Tagesordnungspunkt): je Ort, Gruppe und Woche nur der stärkste.
 scored.sort((a,b)=>b.score-a.score||b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const seen=new Set(),picked=[];
 for(const c of scored){
  if(c.score<minScore)break;
  const g=c.hits[0].group;
  const week=Math.floor(Date.parse(c.date+'T00:00:00Z')/(7*DAY));
  const k=w=>c.region_id+'|'+g+'|'+w;
  if(seen.has(k(week))||seen.has(k(week-1))||seen.has(k(week+1)))continue;
  seen.add(k(week));picked.push(c);
 }
 const dayList=[];for(let d=from;d<=today;d=shift(d,1))dayList.push(d);
 const evidence=await loadEvidence(db,picked.map(c=>c.id));
 for(const c of picked)c.fit=fitScore(c,{today,population,evidence:evidence.get(c.id)||null});
 picked.sort((a,b)=>b.fit.percent-a.fit.percent||b.score-a.score||a.id.localeCompare(b.id));
 const byDay=new Map(dayList.map(d=>[d,[]]));
 for(const c of picked){
  if(c.fit.percent<minFit)continue;
  // Nicht strittige Satzungen (Hebesätze u. ä.) sind Routine und kein Social-Media-Thema
  if(c.fit.parts.some(p=>/Routinesatzung/.test(p.label)))continue;
  const l=byDay.get(c.date);
  if(!l||l.length>=perDay||l.some(x=>x.region_id===c.region_id))continue;
  // Dasselbe Stichwort am selben Tag nur, wenn der Vorschlag stark ist: mehr Abwechslung je Tag
  if(c.fit.percent<70&&l.some(x=>x.hits[0].term===c.hits[0].term))continue;
  l.push(c);
 }
 const chosen=[...byDay.values()].flat();
 const avgFit=chosen.length?Math.round(chosen.reduce((n,c)=>n+c.fit.percent,0)/chosen.length):null;
 return {
  from,to:today,perDay,scanned:cards.length,matched:scored.length,
  summary:{count:chosen.length,avgFit,strong:chosen.filter(c=>c.fit.percent>=70).length,daysWithTopic:[...byDay.values()].filter(l=>l.length).length,days:dayList.length,minFit},
  days:dayList.slice().reverse().map(d=>({date:d,topics:byDay.get(d).map(c=>topic(c,names,termRegions))})),
 };
}

function topic(c,names,termRegions){
 const main=c.hits[0];
 const why=[main.groupName+': '+main.term];
 for(const h of c.hits.slice(1,3))why.push(h.term);
 if(c.party)why.push('Antrag einer Fraktion');
 if(c.status==='rejected')why.push('abgelehnt');
 if(c.status==='postponed')why.push('vertagt');
 const region=names.get(c.region_id)||c.region_id;
 return {
  draft:draftText({title:c.title,status:c.status,region,term:main.term}),
  fit:c.fit,
  id:c.id,title:c.title,date:c.date,status:c.status,region,regionId:c.region_id,
  gremium:c.gremium||'',group:main.groupName,term:main.term,score:c.score,why,
  otherPlaces:Math.max(0,(termRegions.get(main.term)?.size||1)-1),
  link:'/beschluss/'+encodeURIComponent(c.id),search:'/suche?q='+encodeURIComponent(main.term.split(' / ')[0]),
 };
}
