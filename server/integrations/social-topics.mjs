// Themenvorschläge für Social Media: regelbasiert aus den Suchkarten, ohne Modell.
// Gesucht werden Einzelfälle in einem Ort, die polarisieren (Tempo 30, Windrad, Bezahlkarte, Bürgerbegehren …).
// Je Eintrag zählt das stärkste Streitwort seines Titels, verstärkt durch Anzeichen für Streit (Bürgerbegehren,
// Antrag einer Fraktion) und durch den Status (abgelehnt und vertagt sind lauter als beschlossen).
// Je Tag höchstens `perDay` Einträge, je Ort und Tag höchstens einer, ein Ort höchstens einmal je Gruppe und Woche.

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
  ['Windkraft',/windkraft|windrad|windräder|windenergie|windpark|windvorrang|\bwea\b|repowering.{0,60}(wea|wind)/],
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
 ]},
 {id:'geld',name:'Gebühren & Schließung',weight:2.5,terms:[
  ['Schließung',/(?<![a-zäöüß])schließung(?! (des|der|von) (öffentlichen|nichtöffentlichen|sitzung|versammlung|tagesordnung|beratung|rednerliste|gehweglücke|baulücke|lücke|radweglücke))(?!.{0,25}lücke)|schliessung|stilllegung (des|der|von) (bad|schule|kita|bibliothek|krankenhaus|klinik|standort)|schließen (der|des) (bad|schule|kita|bibliothek|krankenhaus|klinik|standort|freibad|hallenbad|filiale|jugendzentrum|werk|geschäftsstelle)|einstellung des betriebs/,3],
  ['Bad / Bibliothek',/hallenbad(?!str)|freibad|schwimmbad|schwimmhalle|stadtbibliothek|bücherei|musikschule|volkshochschule|stadtteilbibliothek|jugendzentrum|stadtteilzentrum/,2.5,/schließ|erhalt|zukunft|abriss|streichung|kürzung|einspar|defizit|sanierung|neubau|kosten|erhöhung|bürger|petition|rettung|verkauf/],
  ['Grundsteuer / Hebesatz',/grundsteuer|hebesatz|hebesätze|gewerbesteuer/,2.6],
  ['Gebührenerhöhung',/erhöhung (der |des |von )?(gebühr|beitr|steuer|entgelt|eintritt|elternbeitr|kita)|gebührenerhöhung|beitragserhöhung|straßenausbaubeitr/,2.8],
  ['Kita-Beiträge',/kita-?gebühr|elternbeitr|kita-?beitr/,1.6],
  ['Teurer Bau',/kostensteigerung|kostenexplosion|kostenüberschreitung|prestigeprojekt|millionengrab|baukostensteigerung/,2.8],
  ['Mehrkosten',/mehrkosten|nachtragsbewilligung/,1.5],
  ['Verkauf',/verkauf (des|der|von) (grundstück|gebäude|stadtwerke|anteile|wohnungen|rathaus|schule)|privatisierung|rekommunalisierung/,2.2],
 ]},
 {id:'beteiligung',name:'Bürgerbeteiligung',weight:3,terms:[
  ['Bürgerbegehren',/bürgerbegehren|bürgerentscheid|einwohnerantrag|volksbegehren|ratsbegehren|unterschriftensammlung|unterschriften|bürgerinitiative|petition/],
  ['Rücktritt / Abwahl',/abwahl|rücktritt (des|der|von) (herrn |frau )?(bürgermeister|landrat|oberbürgermeister|stadträtin|stadtrat|gemeinderat|ratsherr|ratsfrau|beigeordnet|ortsvorsteher|fraktionsvorsitz)|misstrauensantrag|dienstaufsichtsbeschwerde|untersuchungsausschuss|abberufung (des|der|von) (bürgermeister|stadträtin|stadtrat|ersten|beigeordnet|ortsvorsteher|landrat)/],
  ['Anwohnerprotest',/\bprotest(?!ant)|widerstand gegen|anwohnerinitiative|kundgebung/,2.4],
 ]},
 {id:'politik',name:'Politik & Geld',weight:2.8,terms:[
  ['Aufwandsentschädigung',/aufwandsentschädigung|sitzungsgeld|fraktionszuwendung|fraktionsmittel|diäten|dienstwagen|dienstreise/,2.8,/^(?!.*(feuerwehr|inklusionsbeauftragt|gerätewart|wehrführ|ortsbrandmeister|schiedsperson|wahlhelfer)).*(ratsmitglied|rats-|stadtrat|gemeinderat|kreistag|fraktion|mandat|bürgermeister|abgeordnet|ortsvorsteher|dienstwagen|politik)/s],
  ['Ehrung / Aberkennung',/aberkennung|aberkennen|ehrenbürger.{0,50}(nazi|ns-|nationalsozial)|umstritten.{0,30}(ehrenbürger|straßenname|denkmal)/,2.8],
  ['Verpackungs- / Bettensteuer',/verpackungssteuer|übernachtungssteuer|bettensteuer|tourismusabgabe|citytax|zweitwohnungssteuer/,2.8],
  ['Hundesteuer',/hundesteuer|vergnügungssteuer/,1.8],
  ['Videoüberwachung',/videoüberwachung|kameraüberwachung|bodycam|überwachungskamera/,2.6,/innenstadt|marktplatz|bahnhof|park|kriminal|sicherheit|angstraum|rathausplatz|öffentlich|stadtgebiet|brennpunkt/],
  ['Feuerwerk',/böllerverbot|feuerwerksverbot|abbrennverbot|feuerwerk.{0,40}(verbot|einschränk)|silvesterfeuerwerk/,2.4],
 ]},
 {id:'alltag',name:'Alltag & Müll',weight:2.2,terms:[
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
const zu=d=>d.startsWith('der ')?'zur '+d.slice(4):d.startsWith('dem ')?'zum '+d.slice(4):'zu '+d;
const hashtag=t=>String(t).split(/[^A-Za-zÄÖÜäöüß0-9]+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
const cap=t=>t[0].toUpperCase()+t.slice(1);
// Straßennamen: ein Wort auf -straße/-allee/-platz/-damm/-ufer/-weg oder „Name-er Straße“; keine Gattungswörter.
const STREET=/\b([A-ZÄÖÜ][A-Za-zäöüß]+(?:-[A-ZÄÖÜ][A-Za-zäöüß]+)*(?:straße|allee|platz|damm|ufer|weg|ring)|[A-ZÄÖÜ][a-zäöüß-]+er Straße)\b/;
const NOT_STREET=/^(Gehweg|Radweg|Fußgängerüberweg|Feldweg|Wirtschaftsweg|Rettungsweg|Fahrradweg|Umweg|Zuweg|Waldweg|Bürgerweg|Radschnellweg|Schulstraße|Fahrradstraße|Kreisstraße|Landesstraße|Bundesstraße|Staatsstraße|Hauptstraße|Zuwegung|Fußweg|Wanderweg|Spielplatz|Marktplatz|Sportplatz|Parkplatz|Bolzplatz|Kirchplatz)$/;
// Sprechendere Gegenstände je nach Wortlaut des Titels.
const OVERRIDE={
 'Bürgerbegehren':[[/petition/,'einer Petition','eine Petition'],[/einwohnerantrag/,'einem Einwohnerantrag','einen Einwohnerantrag'],
  [/bürgerentscheid/,'einem Bürgerentscheid','einen Bürgerentscheid'],[/unterschriften|unterschriftensammlung/,'einer Unterschriftensammlung','eine Unterschriftensammlung'],
  [/bürgerinitiative/,'einer Bürgerinitiative','eine Bürgerinitiative'],[/volksbegehren/,'einem Volksbegehren','ein Volksbegehren']],
 'Fahrradstraße':[[/pop-up-radweg/,'einem Pop-up-Radweg','einen Pop-up-Radweg'],[/radschnellweg/,'einem Radschnellweg','einen Radschnellweg'],[/radspur/,'einer Radspur','eine Radspur'],[/fahrradstadt/,'der Fahrradstadt-Planung','die Fahrradstadt-Planung']],
 'Unterkunft':[[/obdachlos|wohnungslos/,'der Unterbringung Obdachloser','die Unterbringung Obdachloser'],
  [/flüchtling|geflüchtet|asyl/,'einer Unterkunft für Geflüchtete','eine Unterkunft für Geflüchtete'],[/./,'einer Unterkunft','eine Unterkunft']],
};
const WORD_TERMS=new Set(['Bad / Bibliothek','Großprojekt','Funk / Strom','Verkauf','Teurer Bau','Neubaugebiet','Anwohnerprotest']);
function matchedWord(title,term){
 for(const g of GROUPS)for(const [t,re] of g.terms){
  if(t!==term)continue;
  const m=re.exec(' '+title.toLowerCase()+' ');
  if(!m)return '';
  const start=m.index-1,end=start+m[0].length;
  let a=Math.max(0,start),b=Math.min(title.length,end);
  while(a>0&&/[A-Za-zÄÖÜäöüß-]/.test(title[a-1]))a--;
  while(b<title.length&&/[A-Za-zÄÖÜäöüß-]/.test(title[b]))b++;
  const w=title.slice(a,b).replace(/^-+|-+$/g,'');
  return w.length>2&&w.length<30?cap(w):'';
 }
 return '';
}

/** Kurzer Vorschlagstext aus festen Vorlagen: Partei (falls im Titel), Status, Streitwort, Ort. Keine freie Formulierung. */
export function draftText({title,status,region,term}){
 const f=FORMS[term];if(!f)return null;
 let [dat,akk,tag]=f;
 const low=title.toLowerCase();
 const ov=OVERRIDE[term]?.find(([re])=>re.test(low));
 if(ov){dat=ov[1];akk=ov[2];}
 else if(WORD_TERMS.has(term)){const w=matchedWord(title,term);if(w){dat=`dem Thema „${w}“`;akk=`das Thema „${w}“`;}}
 // Schließung: den Gegenstand aus dem Titel übernehmen („Schließung des Großmarktes“)
 if(term==='Schließung'){
  const m=/[Ss]chließung (des|der|von) ([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?: [A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)?)/.exec(title);
  if(m){dat=`der Schließung ${m[1].toLowerCase()} ${m[2]}`;akk=`die Schließung ${m[1].toLowerCase()} ${m[2]}`;}
 }
 const parties=PARTIES.filter(([re])=>re.test(low)).map(x=>x[1]);
 const antrag=/antrag|anfrage|vorstoß/.test(low);
 const place=inPlace(region);
 const At=cap(place);
 let text;
 if(antrag&&parties.length&&parties.length<=2){
  const nom=parties.map(p=>p.nom).join(' und ');
  const gen=parties.map(p=>p.gen).join(' und ');
  const motion=`der Antrag ${gen} ${zu(dat)}`;
  const verb=parties.length>1||parties[0].plural?'haben':'hat';
  text={rejected:`${At} wurde ${motion} abgelehnt.`,
   postponed:`${At} wurde ${motion} vertagt.`,
   approved:`${At} wurde ${motion} angenommen.`,
   recommended:`${At} wurde ${motion} zur Annahme empfohlen.`}[status]||`${cap(nom)} ${verb} ${place} einen Antrag ${zu(dat)} gestellt.`;
 }else{
  text={rejected:`${At} wurde ein Antrag ${zu(dat)} abgelehnt.`,
   postponed:`${At} wurde die Entscheidung ${zu(dat)} vertagt.`,
   approved:`${At} gab es einen Beschluss ${zu(dat)}.`,
   recommended:`${At} gibt es eine Empfehlung ${zu(dat)}.`}[status]||`${At} wird über ${akk} beraten.`;
 }
 const street=STREET.exec(title)?.[1];
 if(street&&!NOT_STREET.test(street)&&street.length<40&&!(term==='Schulstraße / Poller'&&/^Schulstra/.test(street)))text=text.replace(/\.$/,` (${street}).`);
 const ort=hashtag(region.replace(/^(Stadt|Gemeinde|Kreis|Landkreis) /,''));
 return {
  text,
  question:`${term.split(' / ')[0]} ${place}: Was meinen Sie?`,
  hashtags:['#'+hashtag(tag),'#'+ort,'#Kommunalpolitik'],
  party:parties.length?parties.map(p=>p.nom.replace(/^(die|das) /,'')).join(' und '):null,
 };
}

const FORMAL=/^(einladung|niederschrift|bekanntgabe|genehmigung der niederschrift|anfragen|mitteilungen|verschiedenes|sonstiges|einwohnerfrag)/i;
// Antrag einer Fraktion oder Partei: deutet auf Streit hin.
const PARTY_MOTION=/\b(afd|linke|grüne|grünen|cdu|csu|spd|fdp|bsw|fraktion|freie wähler|volt)[- ]?(antrag|anfrage)|antrag der (afd|linken|grünen|cdu|spd|fdp|fraktion)/;
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
 if(title.length<20||FORMAL.test(title))return null;
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

// ---- Eignung für Social Media (0 bis 100 %), nur aus festen Regeln --------------------------------------------------
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
// Alltagsnähe: je näher am Alltag der Leserinnen und Leser, desto eher wird geteilt.
const EVERYDAY={verkehr:20,geld:18,alltag:17,migration:16,beteiligung:16,politik:16,identitaet:15,energie:12,bauen:8};
const EVERYDAY_TERM={'Tempo 30':20,'Grundsteuer / Hebesatz':20,'Schließung':19,'Bad / Bibliothek':18,'Bezahlkarte':16,'Kita-Beiträge':17,'Umspannwerk':6,'Wärme':8,'Mehrkosten':8,'Funk / Strom':9};
const JARGON=/§|flst\.|fl\.-?nr|flurst|bebauungsplan|vorhabenbezogen|satzung|drucksache|\bbv\b|\bvo\/|geschäftsordnung|haushaltssatzung|aufstellungsbeschluss|einvernehmen|\bnr\.\s?\d/i;
/**
 * Eignung eines Eintrags als Social-Media-Beitrag in Prozent, in sechs Teilen (Summe höchstens 100):
 * Streitpotenzial 30, Alltagsnähe 20, Reichweite des Ortes 15, Aktualität 15, Konkretheit 10, Verständlichkeit 10.
 */
export function fitScore(c,{today,population={}}){
 const main=c.hits[0];
 const streit=Math.round(30*clamp((c.score-2.5)/3));
 const alltag=EVERYDAY_TERM[main.term]??EVERYDAY[main.group]??10;
 const pop=population[c.region_id];
 const reach=pop?Math.round(15*clamp((Math.log10(pop)-3.5)/2.2)):7;
 const days=Math.max(0,Math.round((Date.parse(today+'T00:00:00Z')-Date.parse(c.date+'T00:00:00Z'))/DAY));
 const fresh=days<=1?15:days<=3?13:days<=7?10:days<=14?6:3;
 const party=PARTIES.some(([re])=>re.test(c.title.toLowerCase()));
 const street=STREET.exec(c.title)?.[1];
 const decisive=['rejected','postponed','approved','recommended'].includes(c.status);
 const concrete=(party?4:0)+(street&&!NOT_STREET.test(street)?3:0)+(decisive?3:0);
 let clear=10;
 if(JARGON.test(c.title))clear-=4;
 if(c.title.length>140)clear-=3;
 if(c.title.length<25)clear-=2;
 if((c.title.match(/;|\bhier\b|\bnach\b § /gi)||[]).length>=2)clear-=2;
 clear=Math.max(0,clear);
 const parts=[
  {key:'streit',label:'Streitpotenzial',points:streit,max:30},
  {key:'alltag',label:'Alltagsnähe',points:alltag,max:20},
  {key:'reichweite',label:'Reichweite',points:reach,max:15},
  {key:'aktuell',label:'Aktualität',points:fresh,max:15},
  {key:'konkret',label:'Konkretheit',points:concrete,max:10},
  {key:'klar',label:'Verständlichkeit',points:clear,max:10},
 ];
 return {percent:parts.reduce((n,x)=>n+x.points,0),parts};
}

/**
 * @param {any} db @param {{id:string,name:string,shortName?:string}[]} regions
 * @param {{today?:string,days?:number,perDay?:number,minScore?:number,minFit?:number,population?:Record<string,number>,extraNames?:[string,string][]}} [o]
 */
export async function socialTopics(db,regions,{today=iso(Date.now()),days=30,perDay=3,minScore=2.8,minFit=40,population={},extraNames=[]}={}){
 // extraNames: [[regionId,name],…] für Gebiete außerhalb des Katalogs (BKG-Liste in shared/de-regions.json)
 const names=new Map([...extraNames,...regions.map(r=>[r.id,r.kind==='district'&&!/kreis/i.test(r.shortName||'')?'Kreis '+(r.shortName||r.name.replace(/^(Landkreis|Kreis) /,'')):(r.shortName||r.name)])]);
 const from=shift(today,-(days-1));
 const {results}=await db.prepare("SELECT id,region_id,date,status,label,title,gremium FROM search_cards WHERE date BETWEEN ? AND ? AND label!='sitzung'").bind(from,today).all();
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
 for(const c of picked)c.fit=fitScore(c,{today,population});
 picked.sort((a,b)=>b.fit.percent-a.fit.percent||b.score-a.score||a.id.localeCompare(b.id));
 const byDay=new Map(dayList.map(d=>[d,[]]));
 for(const c of picked){
  if(c.fit.percent<minFit)continue;
  const l=byDay.get(c.date);
  if(!l||l.length>=perDay||l.some(x=>x.region_id===c.region_id))continue;
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
