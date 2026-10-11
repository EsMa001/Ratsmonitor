/**
 * Themenradare für plenara.X: je Radar Unterthemen (woran ein Vorgang erkannt wird) und Signale (was geschieht).
 * Erkannt wird am Titel, sonst am Beschlussvorschlag (nicht am ganzen Text: der nennt viele Nebenthemen). Daraus entstehen
 * Fakten (topic_facts, kind 'radar:<id>', value Unterthema, detail Signal; shared/topic-facts.mjs), ausgewertet von
 * server/integrations/analytics-radar.mjs und angezeigt von components/ratsmonitor/pages/analytics/ThemeRadarPage.tsx.
 * Ein Vorgang kann mehrere Unterthemen haben; das erste passende Signal zählt.
 * Neue Muster: FACTS_VERSION in shared/topic-facts.mjs erhöhen und scripts/pdf-store/facts.mjs laufen lassen; Test: tests/radars.test.mjs.
 */
const SIGNALS={
 vergabe:['Ausschreibung und Vergabe',/Ausschreibung|Vergabe|Auftragsvergabe|Beauftragung|beauftragt|Zuschlag|Rahmenvertrag|Beschaffung/i],
 gebuehren:['Gebühren und Entgelte',/Gebühr|Entgelt|Tarif|Kalkulation|Beitragssatz|Preis/i],
 vertrag:['Vertrag und Konzession',/Konzession|Vertrag|Vereinbarung|Kooperation|Übertragung|Gesellschaftsvertrag/i],
 bau:['Bau und Sanierung',/Neubau|Sanierung|Erneuerung|Ausbau|Erweiterung|Umbau|Errichtung|Herstellung|Instandsetzung|Bau\b|Baumaßnahme|Baubeschluss/i],
 planung:['Planung und Konzept',/Konzept|Planung|Plan\b|Gutachten|Studie|Machbarkeit|Strategie|Leitbild|Entwicklung/i],
 wirtschaft:['Wirtschaftsplan und Abschluss',/Wirtschaftsplan|Jahresabschluss|Lagebericht|Beteiligungsbericht/i],
 foerderung:['Förderung und Zuschuss',/Förder|Zuschuss|Zuschüsse|Zuwendung/i],
 regelung:['Regelung und Anordnung',/Anordnung|Regelung|Beschilderung|Einbahn|Satzung|Verordnung|Richtlinie/i],
 antrag:['Antrag aus der Politik',/Antrag (der|des|von)|Fraktion|Anfrage/i],
 erhoehung:['Erhöhung',/Erhöhung|Anhebung|erhöht|angehoben/i],
 senkung:['Senkung',/Senkung|gesenkt|Reduzierung|Absenkung/i],
 entwurf:['Entwurf und Einbringung',/Einbringung|Entwurf|Eckpunkte|Eckdaten/i],
 bericht:['Bericht und Controlling',/Bericht|Controlling|Sachstand|Prognose|Quartal/i],
 beschluss:['Beschluss',/Beschluss|Erlass|Feststellung|Entlastung/i],
 beteiligung:['Beteiligung und Dialog',/Beteiligung|Befragung|Workshop|Dialog|Versammlung|Werkstatt/i],
 kalkulation:['Kalkulation und Satzung',/Kalkulation|Bedarfsberechnung|Gebührensatzung|Satzung|Neufassung|Änderung|Festsetzung/i],
};
const S=(...keys)=>keys.map(k=>SIGNALS[k]);

export const RADARS={
 versorgung:{
  name:'Versorgungsradar',icon:'droplet',
  kurz:'Energie, Wärme, Wasser, Abwasser, Abfall, Stadtwerke und Breitband: Konzessionen, Gebühren, Ausschreibungen und Ausbau.',
  topics:[
   ['Strom und Gas',/Konzessionsvertrag|Strom(netz|versorgung|konzession)?\b|Gas(netz|versorgung|konzession)\b|Stromnetz|Gasnetz|Netzbetreiber|Energieversorgung/i],
   ['Wärme',/Wärmeplanung|Wärmeplan|Fernwärme|Nahwärme|Wärmenetz|Wärmeversorgung|Heizzentrale/i],
   ['Trinkwasser',/Trinkwasser|Wasserversorgung|Wasserwerk|Hochbehälter|Wasserleitung|Wasserbezug|Wasserpreis/i],
   ['Abwasser',/Abwasser|Kläranlage|Kanal(netz|sanierung|isation)?\b|Niederschlagswasser|Regenwasser|Regenrückhalte|Schmutzwasser|Entwässerung/i],
   ['Abfall und Entsorgung',/Abfall|Müll(?!er)|Wertstoff|Entsorgung|Recycling|Biotonne|Sperrmüll|Wertstoffhof|Grünschnitt|Altkleider/i],
   ['Stadtwerke und Beteiligungen',/Stadtwerke|Eigenbetrieb|Zweckverband|Versorgungsbetrieb|Gemeindewerke|Beteiligungsbericht/i],
   ['Breitband',/Breitband|Glasfaser|Gigabit|Mobilfunk/i],
  ],
  signals:S('vertrag','gebuehren','vergabe','wirtschaft','bau','planung','foerderung'),
 },
 verkehr:{
  name:'Verkehrsradar',icon:'bus',
  kurz:'Straßen und Brücken, Radverkehr, Bus und Bahn, Tempo und Verkehrssicherheit, Parken und Gehwege.',
  topics:[
   ['Straßen und Brücken',/Straßenbau|Straßenausbau|Straßensanierung|Fahrbahn|Brücke|Kreisverkehr|Kreuzung|Ortsdurchfahrt|Erschließungsstraße|Deckensanierung|Straßenbeleuchtung/i],
   ['Radverkehr',/Radweg|Radverkehr|Fahrrad|Radschnellweg|Radstreifen|Schutzstreifen|Radabstell|Fahrradstraße/i],
   ['Bus und Bahn',/ÖPNV|Nahverkehr|Busverkehr|Buslinie|Bushaltestelle|Haltestelle|Bahnhof|Bürgerbus|Schülerbeförderung|Deutschlandticket|Rufbus|On-Demand|S-Bahn|Straßenbahn/i],
   ['Tempo und Verkehrssicherheit',/Tempo\s?\d|Geschwindigkeit|Verkehrsberuhigung|Schulweg|Zebrastreifen|Fußgängerüberweg|Querungshilfe|Ampel|Lichtsignal|Verkehrssicherheit|Blitzer|Verkehrsschau/i],
   ['Parken',/Parkplatz|Parkraum|Parkhaus|Parkgebühr|Anwohnerparken|Parkscheibe|Stellplatz/i],
   ['Gehwege und Barrierefreiheit',/Gehweg|Bürgersteig|Fußweg|Fußverkehr|barrierefreie?r? (Ausbau|Umbau|Haltestelle)/i],
   ['Verkehrsplanung',/Mobilitätskonzept|Verkehrskonzept|Verkehrsentwicklungsplan|Nahverkehrsplan|Lärmaktionsplan|Mobilitätsstation|Carsharing/i],
  ],
  signals:S('bau','planung','regelung','vergabe','foerderung','antrag','gebuehren'),
 },
 soziales:{
  name:'Vereins- und Sozialradar',icon:'handshake',
  kurz:'Zuschüsse an Vereine, Sportstätten, Jugend, Senioren, Inklusion, Integration und soziale Angebote.',
  topics:[
   ['Vereinsförderung',/Vereinsförderung|Vereinszuschuss|(Zuschuss|Zuschussantrag|Zuwendung|Förderantrag)[^,;:]{0,60}(Verein|e\.\s?V\.|Club|Initiative|Förderverein|Gemeinschaft)|Ehrenamtspauschale|Vereinsrichtlinie|Sportförderung/i],
   ['Sport und Bäder',/Sportplatz|Sporthalle|Turnhalle|Kunstrasen|Sportstätte|Sportanlage|Schwimmbad|Hallenbad|Freibad|Bäder|Sportverein/i],
   ['Jugend',/Jugendhilfe|Jugendzentrum|Jugendtreff|Jugendarbeit|Jugendpflege|Jugendrat|Jugendparlament|Spielplatz|Streetwork|Jugendhaus/i],
   ['Senioren und Pflege',/Senioren|Pflegeheim|Pflegestützpunkt|Altenpflege|Pflegeplanung|Pflegeeinrichtung|Altenhilfe|Mehrgenerationen|Demenz/i],
   ['Inklusion und Teilhabe',/Inklusion|Behinderung|Teilhabe|Barrierefreiheit|Behindertenbeirat|Gleichstellung/i],
   ['Integration und Geflüchtete',/Integration|Geflüchtete|Flüchtling|Asyl|Migration|Unterbringung von|Unterkunft/i],
   ['Armut und Grundversorgung',/Sozialticket|Sozialpass|\bTafel\b(?!n)|Tafel e\.\s?V|Lebensmitteltafel|Armut|Wohngeld|Obdachlos|Wohnungslos|Schuldnerberatung|Kleiderkammer/i],
   ['Kultur, Heimat und Ehrenamt',/Ehrenamt|Heimatverein|Heimat|Brauchtum|Kulturförderung|Musikschule|Bücherei|Bibliothek|Volkshochschule|Kulturverein/i],
  ],
  signals:S('foerderung','vertrag','bau','planung','gebuehren','antrag'),
 },
 vergabe:{
  name:'Vergaberadar',icon:'clipboardList',
  kurz:'Ausschreibungen, Vergaben und Beschaffungen: Bauleistungen, Planungs- und Ingenieurleistungen, Gutachten, Fahrzeuge und Dienstleistungen.',
  // Nur Vorgänge, deren Titel eine Vergabe oder Beschaffung nennt
  require:/Vergabe|Auftragsvergabe|Ausschreibung|Beauftragung|beauftragen|Zuschlag|Beschaffung|Rahmenvertrag|Auftrag (über|für|zur)|Vergabeermächtigung|Submission/i,
  topics:[
   ['Planungs- und Ingenieurleistungen',/Planungsleistung|Ingenieur|Architekt|Objektplanung|Fachplanung|HOAI|Tragwerk|Projektsteuerung|Generalplan/i],
   ['Gutachten und Beratung',/Gutachten|Studie|Beratung|Konzepterstellung|Konzept|Machbarkeit|Untersuchung|Analyse|Prüfung durch/i],
   ['Bauleistungen',/Bauleistung|Bauarbeiten|Rohbau|Tiefbau|Hochbau|Straßenbau|Gewerk|Sanierung|Neubau|Umbau|Erweiterung|Dach|Fenster|Heizung|Elektro|Pflaster/i],
   ['Fahrzeuge und Ausstattung',/Fahrzeug|Löschfahrzeug|Feuerwehr|Drehleiter|Bus\b|Ausstattung|Mobiliar|Möbel|Geräte|Hardware|Tablets|Software|IT-/i],
   ['Dienstleistungen',/Reinigung|Winterdienst|Catering|Verpflegung|Wartung|Pflege von|Dienstleistung|Schülerbeförderung|Sicherheitsdienst|Hausmeister/i],
   ['Energie und Versorgung',/Stromliefer|Gasliefer|Energieliefer|\bStrom\b|\bGas\b|Energie|Wärme/i],
  ],
  signals:[['Ausschreibung',/Ausschreibung|Ausschreibungsverfahren|Vergabeverfahren|Submission|ausgeschrieben|auszuschreiben/i],['Vergabe und Zuschlag',/Vergabe|Zuschlag|beauftragt|Beauftragung|Auftragserteilung/i],['Beschaffung',/Beschaffung|Ersatzbeschaffung|Anschaffung|Kauf/i],['Rahmenvertrag',/Rahmenvertrag/i]],
 },
 klima:{
  name:'Klima- und Energieradar',icon:'zap',
  kurz:'Wärmeplanung, Photovoltaik, Windenergie, Klimaschutzkonzepte, Klimaanpassung, Energieeffizienz und Ladeinfrastruktur.',
  topics:[
   ['Wärmeplanung',/Wärmeplanung|Wärmeplan|Wärmenetz|Fernwärme|Nahwärme/i],
   ['Photovoltaik',/Photovoltaik|PV-Anlage|PV-Freifläche|Solar|Balkonkraftwerk/i],
   ['Windenergie',/Windenergie|Windkraft|Windpark|Windrad|Windenergieanlage|WEA\b|Repowering/i],
   ['Klimaschutz',/Klimaschutzkonzept|Klimaschutz|Klimaneutral|Treibhausgas|CO2|Klimaschutzmanage|Energie- und Klima/i],
   ['Klimaanpassung',/Klimaanpassung|Klimafolgen|Hitze|Starkregen|Hochwasser|Schwammstadt|Entsiegelung|Baumpflanz|Dachbegrünung/i],
   ['Energieeffizienz und Sanierung',/energetische|Energieeffizienz|Energieeinspar|\bLED\b|Heizungsanlage|Wärmepumpe|Gebäudesanierung/],
   ['E-Mobilität',/Ladesäule|Ladeinfrastruktur|Ladestation|E-Mobilität|Elektromobilität|E-Auto|Wallbox/i],
  ],
  signals:S('planung','bau','foerderung','vergabe','regelung','antrag','vertrag'),
 },
 finanzen:{
  name:'Finanzlage',icon:'layers',
  kurz:'Haushalt und Nachträge, Haushaltssicherung, Steuern und Hebesätze, Kredite, Jahresabschlüsse und Umlagen.',
  // Haushalt ist hier das Thema: Sammelpunkte nur ohne Haushaltsbezug ausschließen
  collective:/\bAnfragen\b|Beantwortung|Mitteilung|Verschiedenes|Niederschrift|Tagesordnung/i,
  topics:[
   ['Haushalt und Nachtrag',/Haushaltssatzung|Haushaltsplan|Nachtragshaushalt|Nachtragssatzung|Doppelhaushalt|Haushaltsentwurf|^Haushalt 20\d\d|Haushaltsberatung/i],
   ['Haushaltssicherung',/Haushaltssicherung|Haushaltskonsolidierung|Konsolidierung|Sparliste|Haushaltssperre|Haushaltsstrukturkonzept|Fehlbetrag|Defizit/i],
   ['Steuern und Hebesätze',/Hebesatz|Hebesätze|Grundsteuer|Gewerbesteuer|Hundesteuer|Vergnügungssteuer|Zweitwohnungssteuer|Steuersatzung|Bettensteuer|Übernachtungssteuer|Verpackungssteuer/i],
   ['Kredite und Schulden',/Kredit|Darlehen|Liquiditätskredit|Kassenkredit|Verschuldung|Schulden|Bürgschaft|Kreditaufnahme|Umschuldung/i],
   ['Jahresabschluss und Bilanz',/Jahresabschluss|Gesamtabschluss|Eröffnungsbilanz|Bilanz|Entlastung des|Prüfungsbericht|Rechnungsprüfung/i],
   ['Umlagen',/Kreisumlage|Umlage|Finanzausgleich|Schlüsselzuweisung|Jugendamtsumlage/i],
   ['Außerplanmäßige Ausgaben',/außerplanmäßig|überplanmäßig|Mehraufwendung|Mehrauszahlung|Budgetüberschreitung/i],
  ],
  signals:S('erhoehung','senkung','entwurf','beschluss','bericht'),
 },
 beteiligung:{
  name:'Beteiligung',icon:'megaphone',
  kurz:'Einwohneranträge und Anregungen, Petitionen und Bürgerbegehren, Bürgerbeteiligung und Beiräte.',
  // Keine Quote: „beschlossen“ heißt, der Beschlussvorschlag wurde angenommen, und der lehnt eine Anregung oft ab
  noRate:true,
  // Beteiligung im Planverfahren (BauGB) ist Pflicht und gehört zur Bauleitplanung
  exclude:/Bebauungsplan|B-Plan|Flächennutzungsplan|Bauleitplan/i,
  topics:[
   ['Einwohneranträge und Anregungen',/Einwohnerantrag|Bürgerantrag|Anregung (gem\.|gemäß|nach) §|§\s*24\s*GO|Anregungen und Beschwerden|Bürgeranregung|Bürgereingabe|Anregung (von|eines|einer) (Bürger|Einwohner)|Antrag (von|eines|einer) (Bürger|Einwohner)/i],
   ['Petitionen und Bürgerbegehren',/Petition|Bürgerbegehren|Bürgerentscheid|Ratsbegehren|Unterschriftenliste|Unterschriftensammlung/i],
   ['Bürgerbeteiligung',/Bürgerbeteiligung|Bürgerdialog|Bürgerversammlung|Einwohnerversammlung|Bürgerwerkstatt|Bürgerbefragung|Einwohnerbefragung|Bürgerrat|Beteiligungskonzept|Bürgerhaushalt/i],
   ['Beiräte',/Jugendrat|Jugendparlament|Jugendbeirat|Seniorenbeirat|Seniorenvertretung|Integrationsrat|Integrationsbeirat|Behindertenbeirat|Ausländerbeirat|Kinder- und Jugendparlament/i],
  ],
  signals:S('beteiligung','antrag','regelung','beschluss'),
 },
 gebuehren:{
  name:'Gebührenradar',icon:'tag',
  kurz:'Abfall-, Abwasser-, Niederschlagswasser- und Wassergebühren, Straßenreinigung, Friedhof, Parken und Ausbaubeiträge: Kalkulation, Erhöhung und Senkung.',
  // Nur Vorgänge mit Gebühr, Entgelt oder Beitrag im Titel; Kita-Beiträge stehen im Kita-Radar, Tarife des Personals sind keine Gebühren
  require:/Gebühr|Entgelt|Tarif|Kalkulation|Wasserpreis|Wassergeld|Straßenausbaubeitr|Erschließungsbeitr|Ausbaubeitr|wiederkehrende Beitr|Anliegerbeitr/i,
  exclude:/Kita|Kindertages|Elternbeitr|Krippe|Kindergarten|Tagespflege|Tarifvertrag|Tarifabschluss|Tarifbeschäftigte|TVöD|Tarifeinigung|Entgeltgruppe|Entgeltumwandlung/i,
  // Gebühr ohne eines der Themen: „Weitere Benutzungsgebühren“
  fallback:'Weitere Benutzungsgebühren',
  topics:[
   ['Abfall',/Abfall|Müll(?!er)|Biotonne|Wertstoff/i],
   ['Schmutzwasser',/Abwasser|Schmutzwasser|Kanalbenutzung|Kanalgebühr|Entwässerung|Kläranlage|Fäkal|Grubeninhalt/i],
   ['Niederschlagswasser',/Niederschlag|Regenwasser|versiegelt/i],
   ['Trinkwasser',/Trinkwasser|\bWasser(gebühr|preis|geld|entgelt|versorgung|bezug|abgabe)|Wasserversorgungs/],
   ['Straßenreinigung und Winterdienst',/Straßenreinigung|Winterdienst/i],
   ['Friedhof und Bestattung',/Friedh[oö]f|Bestattung|Grabstätte|Grabnutzung/i],
   ['Parken',/Parkgebühr|Parkraum|Parkschein|Parkausweis|Bewohnerpark|Anwohnerpark|Parken|Parkhaus/i],
   ['Straßenausbau- und Erschließungsbeiträge',/Straßenausbaubeitr|Erschließungsbeitr|Ausbaubeitr|wiederkehrende Beitr|Anliegerbeitr/i],
   ['Bäder, Hallen und Sportstätten',/[a-zäöü]bad\b|Bäder|Freibad|Hallenbad|Solebad|Schwimm|Sporthalle|Sportstätte|Sportanlage|Sportplatz|Hallengebühr|Turnhalle/i],
   ['Bücherei, Musikschule und Kultur',/Bücherei|Bibliothek|Musikschule|Volkshochschule|\bVHS\b|Museum|Theater|Archiv/i],
   ['Schulkind- und Ferienbetreuung',/Ganztag|OGS|Mittagsbetreuung|Ferienbetreuung|Schulkindbetreuung|Betreuende Grundschule|Hortbetreuung|Nachmittagsbetreuung/i],
   ['Unterkünfte und Obdach',/Obdach|Unterkunft|Unterkünfte|Übergangsheim|Gemeinschaftsunterkunft|Unterbringung/i],
   ['Feuerwehr und Rettungsdienst',/Feuerwehr|Rettungsdienst|Brandverhütung|Brandsicherheit/i],
   ['Sondernutzung und Märkte',/Sondernutzung|Wochenmarkt|Jahrmarkt|Weihnachtsmarkt|Marktgebühr|Marktsatzung|Marktordnung|Märkte|Standgebühr|Standplatz/i],
   ['Bus- und Bahntarife',/Deutschlandticket|Tarifreform|Westfalentarif|Verkehrsverbund|Fahrpreis|Ticket|ÖPNV-Tarif|Gemeinschaftstarif/i],
  ],
  signals:S('erhoehung','senkung','kalkulation','antrag','bericht'),
 },
};
export const RADAR_IDS=Object.keys(RADARS);
