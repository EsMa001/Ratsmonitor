/**
 * Fakten aus Titel und Volltext eines Berichts für plenara.X (Tabelle topic_facts, drizzle/0025): welche Fraktion einen
 * Antrag oder eine Anfrage stellt (Fraktionsprofil) und welches Förderprogramm genannt wird, bewilligt oder beantragt
 * (Förderradar). Rein regelbasiert; erkannt wird nur, was ausdrücklich dasteht. Gefüllt von scripts/pdf-store/facts.mjs
 * (lokale PDF-Ablage) und im Import, sobald er ein Dokument liest (refreshSummaries in server/services/sync.ts).
 * Neue Regeln: FACTS_VERSION erhöhen und das Skript erneut laufen lassen. Tests: tests/topic-facts.test.mjs.
 */
export const FACTS_VERSION='facts-v2';
/* Sammelpunkte (Anfragen, Mitteilungen, Haushalt, Sachstandsberichte …) sprechen über viele Vorhaben und Fraktionen zugleich:
   aus ihnen wird nichts abgeleitet, außer ihr Titel nennt die Förderung selbst (Stichprobe 11.10.2026). */
export const COLLECTIVE=/\bAnfragen\b|Beantwortung|Mitteilung|Informationen|Verschiedenes|Niederschrift|Tagesordnung|Haushalt|Jahresabschluss|Sachstand|Statusbericht|Bericht (der|des|aus)|Berichte\b|Eingänge/i;

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
/** Förderprogramme im Text: [{program, status:'granted'|'applied'|'mentioned'}]; Förderung ohne erkennbares Programm als „Sonstige Förderung“. */
export function fundingOf(text){
 const found=new Map();let any=null;
 for(const s of String(text||'').replace(/\s+/g,' ').split(/(?<=[.;!?])\s+/)){
  if(!FUND.test(s))continue;
  const status=GRANTED.test(s)?'granted':APPLIED.test(s)?'applied':'mentioned';
  let named=false;
  for(const [name,re] of PROGRAMS)if(re.test(s)){named=true;if(!found.has(name)||RANK[status]>RANK[found.get(name)])found.set(name,status);}
  if(!named&&(!any||RANK[status]>RANK[any]))any=status;
 }
 const out=[...found].map(([program,status])=>({program,status}));
 // Förderung ohne Programmnamen zählt nur, wenn sie bewilligt oder beantragt ist (bloße Erwähnungen sind zu ungenau)
 if(!out.length&&any&&any!=='mentioned')out.push({program:'Sonstige Förderung',status:any});
 return out;
}

/** Zeilen für topic_facts: {kind, value, detail} */
export function factsOf(title,text){
 const rows=[],collective=COLLECTIVE.test(String(title||''))&&!/Förder|Zuwendung|Zuschuss/i.test(String(title||''));
 const f=factionsOf(title,text);
 if(f)for(const p of f.parties)rows.push({kind:'faction',value:p,detail:f.kind});
 if(text&&!collective)for(const x of fundingOf(text))rows.push({kind:'funding',value:x.program,detail:x.status});
 return rows;
}
