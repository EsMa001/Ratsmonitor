/**
 * Fakten aus Titel und Volltext eines Berichts für plenara.X (Tabelle topic_facts, drizzle/0025): welche Fraktion einen
 * Antrag oder eine Anfrage stellt (Fraktionsprofil) und welches Förderprogramm genannt wird, bewilligt oder beantragt
 * (Förderradar), Verfahrensschritt und geplante Wohneinheiten eines Bauleitplans (Bauleitplanung), Entscheidungen zu
 * Kita-Elternbeiträgen und neue Kita-Plätze (Kita-Radar). Rein regelbasiert; erkannt wird nur, was ausdrücklich dasteht. Gefüllt von scripts/pdf-store/facts.mjs
 * (lokale PDF-Ablage) und im Import, sobald er ein Dokument liest (refreshSummaries in server/services/sync.ts).
 * Neue Regeln: FACTS_VERSION erhöhen und das Skript erneut laufen lassen. Tests: tests/topic-facts.test.mjs.
 */
import {RADARS} from './radars.mjs';
export const FACTS_VERSION='facts-v9';
// Satzende: Punkt, Semikolon, Frage- oder Ausrufezeichen, danach ein Großbuchstabe; nicht nach Ziffern („zum 1.8. um 5 %“)
// und nicht nach Abkürzungen aus einem Buchstaben („e. V.“, „z. B.“)
const SENTENCE=/(?<=[^0-9][.;!?])(?<!(?:^|[\s(])\p{L}\.)\s+(?=[A-ZÄÖÜ„"])/u;
/* Sammelpunkte (Anfragen, Mitteilungen, Haushalt, Sachstandsberichte …) sprechen über viele Vorhaben und Fraktionen zugleich:
   aus ihnen wird nichts abgeleitet, außer ihr Titel nennt die Förderung selbst (Stichprobe 11.10.2026). */
export const COLLECTIVE=/\bAnfragen\b|Beantwortung|Mitteilung|Informationen|Verschiedenes|Niederschrift|Tagesordnung|Haushalt|Jahresabschluss|Beteiligungsbericht|Lagebericht|Sachstand|Statusbericht|Bericht (der|des|aus)|Berichte\b|Eingänge/i;

/* Parteifamilien. Lokale Wählergruppen heißen überall anders und werden zusammengefasst. */
export const PARTIES=[
 ['CDU/CSU',/\b(CDU|CSU)\b/],
 ['SPD',/\bSPD\b/],
 ['Grüne',/GR[ÜU]NEN?\b|Bündnis\s*90|\bB\s?90\b|\bGrüne\b/i],
 ['FDP',/\bFDP\b|\bFreie Demokraten\b/],
 ['AfD',/\bAfD\b/],
 ['Linke',/\bDIE LINKE\b|\b[Dd]ie Linke\b|\bLinke\b|\bLINKE\b/],
 ['BSW',/\bBSW\b|Bündnis Sahra Wagenknecht/],
 ['Freie Wähler und Wählergruppen',/Freie\s+Wähler|\bFWG\b|\bUWG\b|\bUBG\b|\bFBI\b|Wählergemeinschaft|Wählergruppe|Bürgerliste|Bürgerforum|Unabhängige/i],
 ['Volt',/\bVolt\b/],
 ['ÖDP',/\bÖDP\b/],
 ['Die PARTEI',/Die PARTEI\b/],
];
// Der Antragsteller steht in einer festen Wendung: „Antrag der SPD-Fraktion“, „Anfrage der Fraktion BÜNDNIS 90/DIE GRÜNEN“,
// „Antrag CDU-Fraktion“, „Fraktion DIE LINKE: Antrag …“. Nur diese Wendung wird nach Parteien abgesucht, nicht der ganze Text.
const KIND='(Antrag|Anträge|Änderungsantrag|Ergänzungsantrag|Dringlichkeitsantrag|Prüfauftrag|Anfrage|Große Anfrage|Kleine Anfrage|Anregung)';
const WHO='(Fraktion(?:en)?|Ratsfraktion|Kreistagsfraktion|Gruppe|Fraktionsgemeinschaft)';
const APPLICANT=[
 new RegExp(`${KIND}\\s*(?:der|des|von\\s+der|von|:)?\\s*([^\\n.;]{0,90}?${WHO}[^\\n.;]{0,70})`,'i'),
 new RegExp(`([^\\n.;]{0,60}-${WHO}|${WHO}\\s+[^\\n.;]{2,60})\\s*[:,–-]?\\s*${KIND}`,'i'),
];
/** Fraktionen als Antragsteller: {parties:[...], kind:'antrag'|'anfrage'} oder null. Mehrere bei gemeinsamen Anträgen. */
export function factionsOf(title,head=''){
 if(COLLECTIVE.test(String(title||'')))return null;
 for(const source of [String(title||''),String(head||'').slice(0,1500)]){
  for(const re of APPLICANT){
   const m=source.match(re);if(!m)continue;
   const phrase=m[0];
   const parties=PARTIES.filter(([,r])=>r.test(phrase)).map(([n])=>n);
   if(parties.length)return {parties,kind:/anfrage/i.test(phrase)?'anfrage':'antrag'};
  }
 }
 return null;
}

/* Förderprogramme: Name und Muster. Gezählt nur in Sätzen, die auch von Förderung sprechen (FUND). */
export const PROGRAMS=[
 ['Städtebauförderung',/Städtebauförderung|Lebendige Zentren|Sozialer Zusammenhalt|Wachstum und nachhaltige Erneuerung|Stadtumbau/i],
 ['Ganztagsausbau',/Ganztag/i],
 ['Klimaanpassung',/Klimaanpassung|Klimafolgenanpassung|Natürlicher Klimaschutz/i],
 ['Kommunalrichtlinie / NKI',/Kommunalrichtlinie|Nationale Klimaschutzinitiative|\bNKI\b/i],
 ['Radverkehr',/Radverkehr|Radwege|Stadt und Land|Radnetz/i],
 ['Denkmalförderung',/Denkmal/i],
 ['Sportstätten',/Sportstätte|Sportstättenförderung|Sportanlage|Investitionspakt Sport/i],
 ['Breitband und Digitales',/Breitband|Gigabit|Glasfaser|DigitalPakt|Digitalisierung/i],
 ['EU-Fonds (EFRE, ELER, ESF)',/\bEFRE\b|\bELER\b|\bESF\+?\b|Europäische[nr]? Fonds/i],
 ['LEADER und ländliche Entwicklung',/LEADER|Dorferneuerung|Dorfentwicklung|ländliche[nr]? Entwicklung|GAK\b/i],
 ['KfW',/\bKfW\b/],
 ['ÖPNV und Straßenbau (GVFG u. a.)',/\bGVFG\b|ÖPNV-Förderung|Straßenbauförderung|Gemeindeverkehrsfinanzierung/i],
 ['Wirtschaftsförderung (GRW)',/\bGRW\b|Gemeinschaftsaufgabe|regionale[nr]? Wirtschaftsstruktur/i],
 ['Kita und Schulbau',/Kita-Ausbau|Kindertagesbetreuung|Kitaausbau|Schulbau|Schulsanierung|Schulinfrastruktur/i],
 ['Energie und Wärme',/Wärmeplanung|Wärmenetz|\bBEG\b|\bBEW\b|Energieeffizienz|Photovoltaik|Solar/i],
 ['Feuerwehr und Katastrophenschutz',/Feuerwehr|Katastrophenschutz/i],
];
// Nur Geldwörter: „Förderung“ allein meint oft Arbeits-, Sprach- oder Vereinsförderung
const FUND=/(Fördermittel|Fördergeld|Förderprogramm|Förderantrag|Förderbescheid|Förderquote|Fördersumme|Förderbetrag|Förderzusage|Förderaufruf|Förderrichtlinie|Förderzuschuss|Zuwendungsbescheid|Zuwendung(?:en)? (?:des|der|aus|von|in Höhe)|Bundesmittel|Landesmittel|EU-Mittel|Bundesförderung|Landesförderung|Städtebaufördermittel|gefördert (?:mit|durch|aus|von))/i;
const GRANTED=/(bewilligt|Bewilligung|Zuwendungsbescheid|Förderbescheid|Fördermittelbescheid|Zusage|zugesagt|in Aussicht gestellt|erhalten|wurde gefördert|werden gefördert)/i;
const APPLIED=/(beantragt|beantragen|Förderantrag|Antrag auf Förderung|Antragstellung|Antrag auf Zuwendung|einzureichen|eingereicht|bewerben|Projektskizze)/i;
const RANK={granted:3,applied:2,mentioned:1};
// Formularfelder („Fördermittel beantragt: Nein Ja“, Ankreuzfelder) sagen nichts über den Vorgang
const FUND_FORM=/☐|☒|\b(Nein\s+Ja|Ja\s+Nein)\b|:\s*(ja|nein)\b|\bja\s*\/\s*nein\b/i;
// Bedingt bewilligt („vorbehaltlich der Förderzusage“, „sofern bewilligt“) ist noch nicht bewilligt
// Ausgehende Zuschüsse (die Kommune fördert Vereine, Träger, Projekte) sind kein Fördergeld für die Kommune (Bewertung 11.10.2026)
const OUTGOING=/\be\.\s?V\.|\bVerein\w*\s+(hat|haben|beantragt|beantragen|erhält|erhalten)|Antragsteller|Zuschussantrag|Vereinsförder|institutionelle[nr]? Förderung|Projektförderung|Förderrichtlinie der (Stadt|Gemeinde)|städtische[nr]? Zuschuss|Zuschuss der (Stadt|Gemeinde)|gewährt (die|der) (Stadt|Gemeinde|Kreis|Landkreis)|Zuweisung an/i;
const CONDITIONAL=/vorbehaltlich|sofern|falls|vorausgesetzt|im Falle|unter der Voraussetzung|nach Bewilligung|bei Bewilligung|nur nach/i;
/** Förderprogramme im Text: [{program, status:'granted'|'applied'|'mentioned'}]; Förderung ohne erkennbares Programm als „Sonstige Förderung“. */
export function fundingOf(text){
 const found=new Map();let any=null;
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
  if(!FUND.test(s)||FUND_FORM.test(s)||OUTGOING.test(s))continue;
  const status=GRANTED.test(s)&&!CONDITIONAL.test(s)?'granted':APPLIED.test(s)?'applied':'mentioned';
  let named=false;
  for(const [name,re] of PROGRAMS)if(re.test(s)){named=true;if(!found.has(name)||RANK[status]>RANK[found.get(name)])found.set(name,status);}
  if(!named&&(!any||RANK[status]>RANK[any]))any=status;
 }
 const out=[...found].map(([program,status])=>({program,status}));
 // Förderung ohne Programmnamen zählt nur, wenn sie bewilligt oder beantragt ist (bloße Erwähnungen sind zu ungenau)
 if(!out.length&&any&&any!=='mentioned')out.push({program:'Sonstige Förderung',status:any});
 return out;
}

/* Förderbeträge: nur ein Betrag, der unmittelbar an einem Förderwort hängt („Zuwendung in Höhe von 450.000 €“, „Fördermittel
   von 1,2 Mio. Euro“, „120.000 € Landesmittel“). Nicht dazwischen: Gesamtkosten, Eigenanteil, förderfähige Kosten, Prozent. */
const EURO_NUM=String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d+)?)\s*(Mio\.?|Millionen|Mrd\.?|Milliarden|T€|TEUR|Tsd\.?\s*(?:€|Euro|EUR)|Tausend\s*(?:€|Euro))?\s*(€|Euro|EUR)?`;
const FUND_WORD=String.raw`(?:Förder(?:summe|betrag|beträge|mittel|geld|ung|zuschuss|zusage|bescheid|antrag)|Zuwendung(?:en)?|Zuschuss|Zuschüsse|Zuschusses|Landesmittel|Bundesmittel|EU-Mittel|Landeszuschuss|Bundeszuschuss|gefördert|bewilligt)`;
const EURO_AFTER=new RegExp(FUND_WORD+String.raw`([^.;€]{0,60}?)(?:€\s*)?`+EURO_NUM,'g');
const EURO_BEFORE=new RegExp(EURO_NUM+String.raw`\s+(?:an\s+)?(?:Förder|Zuwendung|Zuschuss|Zuschüsse|Landesmittel|Bundesmittel|EU-Mittel|Landeszuschuss|Bundeszuschuss)`,'g');
const NOT_FUND_AMOUNT=/Gesamtkosten|Kosten|Anteil|volumen|zwischen|nicht gedeckt|Restbetrag|Differenz|verbleibend|Eigenmittel|Eigenleistung|Investition|Ausgaben|Aufwand|förderfähig|zuwendungsfähig|Bemessungsgrundlage|Haushalt|Bagatellgrenze|mindestens|höchstens|maximal|bis zu|pro |je |Prozent|%/i;
// Davor: Zuschüsse der Kommune selbst (an Vereine, Bäder, Stadtwerke) sind kein Fördergeld für sie
const OWN_BEFORE=/städtisch|gemeindlich|kommunal|eigene|der Stadt\s*$|der Gemeinde\s*$/i;
// Davor: Höchst- und Mindestbeträge einer Richtlinie
const LIMIT_BEFORE=/maximal|Höchst|höchstens|bis zu|mindestens|Mindest|\bmin\.|Bagatell|mehr als|über\s*$/i;
/* Ganze Sätze ohne Förderbetrag einer Kommune: Programmtöpfe und Aufrufe, Haushaltsformulare mit Ankreuzfeldern */
const NOT_FUND_SENTENCE=/stehen\b.{0,200}zur Verfügung|Projektaufruf|bundesweit|landesweit|Programmvolumen|Fördervolumen|Fördertopf|Gesamtvolumen|☐|☒|Sachkonto|Auszahlungen|Einzahlungen/i;
const toEuro=(num,unit,cur)=>{
 let v=Number(num.replace(/\./g,'').replace(',','.'));
 if(/^(Mio|Millionen)/.test(unit||''))v*=1e6;else if(/^(Mrd|Milliarden)/.test(unit||''))v*=1e9;else if(/^(T€|TEUR|Tsd|Tausend)/.test(unit||''))v*=1e3;else if(!cur)return 0;
 return v>=1000&&v<=2e8?Math.round(v):0;
};
/** Förderbeträge je Programm: [{program, euro}] (je Programm der größte genannte Betrag; ohne Programm „Sonstige Förderung“) */
export function fundingEuroOf(text){
 const out=new Map();
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
  // Sehr lange „Sätze“ sind Kopfzeilen, Formulare oder Tabellen ohne Satzzeichen
  if(s.length>400||!FUND.test(s)&&!/Zuwendung|Zuschuss|Landesmittel|Bundesmittel/.test(s)||NOT_FUND_SENTENCE.test(s)||OUTGOING.test(s))continue;
  let euro=0;
  for(const m of s.matchAll(EURO_AFTER)){const before=s.slice(Math.max(0,m.index-30),m.index);if(NOT_FUND_AMOUNT.test(m[1])||LIMIT_BEFORE.test(before)||OWN_BEFORE.test(before))continue;const v=toEuro(m[2],m[3],m[4]);if(v>euro)euro=v;}
  // „120.000 € Landesmittel“ nur in Fließtext: in Tabellen (drei und mehr Beträge) steht davor oft die Kostenzeile
  const tabular=(s.match(/\d\s*(?:€|Euro|EUR)/g)||[]).length>=3;
  if(!tabular)for(const m of s.matchAll(EURO_BEFORE)){if(LIMIT_BEFORE.test(s.slice(Math.max(0,m.index-30),m.index))||/Gesamt|Kosten|Summe|Saldo|volumen/i.test(s.slice(Math.max(0,m.index-30),m.index)))continue;const v=toEuro(m[1],m[2],m[3]);if(v>euro)euro=v;}
  if(!euro)continue;
  const names=PROGRAMS.filter(([,re])=>re.test(s)).map(([n])=>n);
  for(const n of names.length?names:['Sonstige Förderung'])if(euro>(out.get(n)||0))out.set(n,euro);
 }
 return [...out].map(([program,euro])=>({program,euro}));
}

/* Bauleitplanung: Plan und Verfahrensschritt aus dem Titel, sonst aus dem Beschlussvorschlag („… beschließt …“), nicht aus dem
   ganzen Text (der Verfahrensübersichten mit allen früheren Schritten enthält). Bei mehreren Schritten zählt der weiteste. */
const PLAN=/Bebauungsplan|B-Plan|Bebauungsplanes|Vorhaben- und Erschließungsplan|vorhabenbezogene[nr]? Bebauungsplan|Flächennutzungsplan|FNP/i;
export const STAGES=[
 ['Aufstellung',/Aufstellungsbeschluss|Aufstellung (des|eines|der)|Einleitung des Verfahrens/i],
 ['Frühzeitige Beteiligung',/frühzeitige|Vorentwurf|§\s*3\s*Abs\.?\s*1|§\s*4\s*Abs\.?\s*1/i],
 ['Offenlage',/Offenlage|öffentliche Auslegung|Offenlegung|Veröffentlichung im Internet|Entwurfsbeschluss|Auslegungsbeschluss|erneute Beteiligung|§\s*3\s*Abs\.?\s*2|§\s*4\s*Abs\.?\s*2/i],
 ['Abwägung',/Abwägung/i],
 ['Satzungsbeschluss',/Satzungsbeschluss|als Satzung|Feststellungsbeschluss|abschließende[nr]? Beschluss|§\s*10\s*Abs\.?\s*1/i],
];
const REPEAL=/Aufhebung (des|eines|der)\s+(Bebauungsplan|B-Plan|vorhabenbezogenen)|Aufhebungsbeschluss|Aufhebungssatzung/i;
const decision=text=>(String(text||'').replace(/\s+/g,' ').match(/(Beschlussvorschlag|beschließt|Beschluss:)[^]{0,600}/i)||[''])[0];
/** {stage, type, plan} oder null. type: 'Bebauungsplan' oder 'Flächennutzungsplan'; plan: Planbezeichnung (Nummer oder Name) zum Zusammenfassen. */
// Bauanträge im Plangebiet und Sammelberichte nennen den Plan, sind aber kein Planverfahren
// Ebenso Stellungnahmen zu Plänen der Nachbargemeinden (§ 2 Abs. 2 BauGB): dort geht es um fremde Pläne
const NOT_PLAN=/Bauantrag|Bauvoranfrage|Vorbescheid|Einvernehmen|§\s*36\s*BauGB|Befreiung|Nutzungsänderung|Genehmigungsfreistellung|Stellungnahme|Nachbargemeinde|Nachbarkommune|benachbarte|§\s*2\s*Abs\.?\s*2\s*BauGB/i;
export function planOf(title,text=''){
 const t=String(title||'');if(!PLAN.test(t)||NOT_PLAN.test(t)||COLLECTIVE.test(t))return null;
 const type=/Flächennutzungsplan|FNP/i.test(t)&&!/Bebauungsplan|B-Plan/i.test(t)?'Flächennutzungsplan':'Bebauungsplan';
 const pick=src=>{if(REPEAL.test(src))return 'Aufhebung';let best=null;for(const [name,re] of STAGES)if(re.test(src))best=name;return best;};
 const stage=pick(t)||pick(decision(text))||'Sonstiger Schritt';
 const no=t.match(/(?:Nr\.?|Nummer)\s*([0-9][0-9A-Za-z./ -]{0,12}?)(?=[\s,:;"„“(]|$)/);
 const name=t.match(/[„"“]([^"“”]{3,60})[”"“]/);
 return {stage,type,plan:(no?'Nr. '+no[1].trim():name?name[1].trim():t.replace(/\s+/g,' ').slice(0,80)).toLowerCase()};
}
/** Geplante Wohneinheiten (größte genannte Zahl in einem Satz mit Planungsbezug), sonst null */
export function housingOf(text){
 let best=null;
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
  if(!/(entsteh|geplant|vorgesehen|errichtet|Errichtung|ermöglich|Bau von|Neubau|realisier|insgesamt|ca\.|rund|bis zu|etwa)/i.test(s))continue;
  for(const m of s.matchAll(/(\d{1,4}(?:\.\d{3})?)\s*(?:bis\s*\d{1,4}\s*)?(?:neue[n]?\s+)?(Wohneinheiten|WE\b|Wohnungen)/g)){const v=Number(m[1].replace('.',''));if(v>=3&&v<=5000&&!(v>=1990&&v<=2100))best=Math.max(best||0,v);}
 }
 return best;
}

/* Kita: Beiträge nur in Sätzen mit Kita-Bezug (sonst Straßen-, Abwasser- oder Vereinsbeiträge) */
const KITA=/Kindertages|Kita|KiTa|Kindergarten|Krippe|Kinderkrippe|Tagespflege|Kinderbetreuung|U3|Ü3|Hort\b/;
const FEE=/Elternbeitr|Elternentgelt|Kita-Gebühr|Kitagebühr|Kita-Beitr|Kitabeitr|Betreuungsgebühr|Benutzungsgebühr|Gebührensatzung|Beitragssatzung|Beitragstabelle|Beitragsstaffel|Kostenbeitr|Beitragsfreiheit|beitragsfrei|gebührenfrei/i;
const MEAL=/Verpflegung|Essensgeld|Mittagessen|Verpflegungspauschale/i;
/** Entscheidung zu Kita-Elternbeiträgen: {direction, euro} oder null. direction: Erhöhung, Senkung, Beitragsfreiheit, Verpflegung, Neufassung. */
export function kitaFeeOf(title,text){
 const t=String(title||''),sents=[t,...String(text||'').replace(/\s+/g,' ').split(SENTENCE).slice(0,400)].filter(x=>FEE.test(x)&&(KITA.test(x)||KITA.test(t)));
 if(!sents.length||COLLECTIVE.test(t))return null;
 const all=sents.join(' ');
 // Der Titel hat Vorrang: „Reduzierung der Elternbeiträge“ bleibt eine Senkung, auch wenn der Text von Steigerungen spricht
 const byTitle=/beitragsfrei|Beitragsfreiheit|gebührenfrei/i.test(t)?'Beitragsfreiheit':/Erhöhung|Anhebung|Anpassung nach oben/i.test(t)?'Erhöhung':/Reduzierung|Senkung|Absenkung|Entlastung|Ermäßigung/i.test(t)?'Senkung':null;
 const direction=byTitle||(/beitragsfrei|Beitragsfreiheit|gebührenfrei/i.test(all)?'Beitragsfreiheit':/Erhöhung|erhöht|Anhebung|angehoben|Steigerung|steig/i.test(all)?'Erhöhung':/Senkung|gesenkt|Reduzierung|reduziert|Entlastung|Ermäßigung/i.test(all)?'Senkung':sents.every(x=>MEAL.test(x))?'Verpflegung':'Neufassung');
 // Ganze Zahl („1.000 €“ nicht als „000 €“), Monatsbeiträge bis 4 Stellen
 const eur=all.match(/(?<![\d.,])(\d{1,4}(?:,\d{2})?)\s*(?:€|Euro|EUR)/);
 return {direction,euro:eur?eur[1]:''};
}
/** Neue Kita-Plätze (größte Zahl in einem Satz mit Kita-Bezug und Ausbau), sonst null */
// Kein Ausbau: Schließung, Abbau, Unterkünfte für Geflüchtete (auch dort ist von Plätzen die Rede)
const NOT_PLACES=/Schließung|geschlossen|Abbau|abgebaut|Wegfall|Geflüchtete|Flüchtling|Asyl|Unterbringung|Unterkunft|Pflegeheim|Seniorenheim/i;
// Bedarfsplanungen und Berichte nennen den Gesamtbestand, keine neuen Plätze
const PLACES_REPORT=/Bedarfsplan|Situationsbericht|Bericht|Fortschreibung|Jugendhilfeplanung|Übersicht|Sachstand/i;
// Nur Vorgänge, die schon im Titel einen Ausbau nennen; sonst ist die Zahl meist der Bestand (Satzungen, Bedarfsanerkennung)
const PLACES_TITLE=/Neubau|Erweiterung|Ausbau|Errichtung|Umbau|Anbau|neue[nr]?\s+(Kita|Kindertages|Krippe|Kindergarten|Gruppe)|zusätzliche|Gruppe|Container|Interim|Modulbau/i;
export function kitaPlacesOf(title,text){
 const tt=String(title||'');if(COLLECTIVE.test(tt)||NOT_PLACES.test(tt)||PLACES_REPORT.test(tt)||!PLACES_TITLE.test(tt))return null;
 let best=null;
 for(const s of [String(title||''),...String(text||'').replace(/\s+/g,' ').split(SENTENCE)]){
  if(!KITA.test(s)||NOT_PLACES.test(s)||!/(neu|zusätzlich|entsteh|schaffen|Schaffung|Erweiterung|erweitert|Neubau|Ausbau|errichtet|Errichtung)/i.test(s))continue;
  for(const m of s.matchAll(/(\d{1,4})\s*(?:neue[n]?\s+|zusätzliche[n]?\s+)?(Betreuungsplätze|Kita-Plätze|Kitaplätze|Krippenplätze|Kindergartenplätze|U3-Plätze|Ü3-Plätze|Plätze)/g)){const v=Number(m[1]);if(v>=5&&v<=2000&&!(v>=1990&&v<=2100))best=Math.max(best||0,v);}
 }
 return best;
}

/* Themenradare (shared/radars.mjs): Unterthema aus dem Titel; bei sehr kurzen Titeln („Vorlage 12/26“) aus dem Beschlussvorschlag.
   Signal (was geschieht) aus Titel, sonst Beschlussvorschlag; ohne Signal „Sonstiges“. */
// In keinem Radar: Bauanträge Privater (Grundstück, Hausnummer) und Formalpunkte (Eröffnung, Verpflichtung, Beschlussfähigkeit)
const RADAR_SKIP=/Bauantrag|Baugesuch|Antrag auf Baugenehmigung|Bauvoranfrage|Befreiung von den Festsetzungen|Vorbescheid|formlose Anfrage|Fl\.-?\s?Nr|Flurstück|Nutzungsänderung|Eröffnung|Begrüßung|Beschlussfähigkeit|Verpflichtung (von|der|des)|Einführung und Verpflichtung|ordnungsgemäße[nr]? Einladung|Genehmigung der Niederschrift|Fragestunde/i;
/* Vor der Themenerkennung entfernen, was nur wie ein Thema aussieht: Straßennamen („Bahnhofstraße“ ist kein Bahnverkehr),
   Ortsnamen mit „Bad“ oder „Markt“ („Bad Honnef“ ist kein Schwimmbad) und die Floskel „Beratung und Beschlussfassung“ */
const NOT_TOPIC=/[\wäöüß-]*(straße|strasse|str\.|gasse|allee)\b|\b(Bad|Markt)\s+[A-ZÄÖÜ][\wäöüß-]+|(Vor)?[Bb]eratung\s+(und|sowie)\s+(ggf\.?\s+)?Beschluss\w*|zur\s+(Vor)?[Bb]eratung|Beratungsfolge/g;
export const topicText=t=>String(t||'').replace(NOT_TOPIC,' ');
export function radarFactsOf(title,text){
 const t=String(title||''),dec=decision(text),rows=[];
 if(RADAR_SKIP.test(t))return rows;
 for(const [id,r] of Object.entries(RADARS)){
  if((r.collective||COLLECTIVE).test(t)||r.exclude?.test(t)||(r.require&&!r.require.test(t)))continue;
  const src=topicText(t.replace(/\s+/g,' ').trim().split(' ').length<4?t+' '+dec:t);
  const topics=r.topics.filter(([,re])=>re.test(src)).map(([n])=>n);
  if(!topics.length&&r.fallback)topics.push(r.fallback);
  if(!topics.length)continue;
  const sig=(r.signals.find(([,re])=>re.test(t))||r.signals.find(([,re])=>re.test(dec))||['Sonstiges'])[0];
  for(const n of topics)rows.push({kind:'radar:'+id,value:n,detail:sig});
 }
 return rows;
}

/** Zeilen für topic_facts: {kind, value, detail} */
export function factsOf(title,text){
 const rows=[],collective=COLLECTIVE.test(String(title||''))&&!/Förder|Zuwendung|Zuschuss/i.test(String(title||''));
 const f=factionsOf(title,text);
 if(f)for(const p of f.parties)rows.push({kind:'faction',value:p,detail:f.kind});
 if(text&&!collective){
  const fund=fundingOf(text);
  for(const x of fund)rows.push({kind:'funding',value:x.program,detail:x.status});
  /* Betrag ohne Programm im selben Satz gehört zum Programm des Berichts, wenn er nur eines nennt */
  const named=fund.filter(x=>x.program!=='Sonstige Förderung'),euro=new Map();
  for(const x of fundingEuroOf(text)){const p=x.program==='Sonstige Förderung'&&named.length===1?named[0].program:x.program;if(x.euro>(euro.get(p)||0))euro.set(p,x.euro);}
  for(const [p,e] of euro)rows.push({kind:'funding_euro',value:p,detail:String(e)});
 }
 const plan=planOf(title,text);
 if(plan){rows.push({kind:'plan',value:plan.stage,detail:plan.type+'|'+plan.plan});const we=housingOf(text);if(we)rows.push({kind:'housing',value:'Wohneinheiten',detail:String(we)});}
 const fee=kitaFeeOf(title,text);if(fee)rows.push({kind:'kita_fee',value:fee.direction,detail:fee.euro});
 const places=kitaPlacesOf(title,text);if(places)rows.push({kind:'kita_places',value:'Plätze',detail:String(places)});
 rows.push(...radarFactsOf(title,text));
 return rows;
}
