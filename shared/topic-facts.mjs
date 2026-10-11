/**
 * Fakten aus Titel und Volltext eines Berichts für plenara.X (Tabelle topic_facts, drizzle/0025): welche Fraktion einen
 * Antrag oder eine Anfrage stellt (Fraktionsprofil) und welches Förderprogramm genannt wird, bewilligt oder beantragt
 * (Förderradar), Verfahrensschritt und geplante Wohneinheiten eines Bauleitplans (Bauleitplanung), Entscheidungen zu
 * Kita-Elternbeiträgen und neue Kita-Plätze (Kita-Radar). Rein regelbasiert; erkannt wird nur, was ausdrücklich dasteht. Gefüllt von scripts/pdf-store/facts.mjs
 * (lokale PDF-Ablage) und im Import, sobald er ein Dokument liest (refreshSummaries in server/services/sync.ts).
 * Neue Regeln: FACTS_VERSION erhöhen und das Skript erneut laufen lassen. Tests: tests/topic-facts.test.mjs.
 */
export const FACTS_VERSION='facts-v3';
// Satzende: Punkt, Semikolon, Frage- oder Ausrufezeichen, danach ein Großbuchstabe; nicht nach Ziffern („zum 1.8. um 5 %“)
const SENTENCE=/(?<=[^0-9][.;!?])\s+(?=[A-ZÄÖÜ„"])/;
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
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
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
 const eur=all.match(/(\d{1,4}(?:,\d{2})?)\s*(?:€|Euro|EUR)/);
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

/** Zeilen für topic_facts: {kind, value, detail} */
export function factsOf(title,text){
 const rows=[],collective=COLLECTIVE.test(String(title||''))&&!/Förder|Zuwendung|Zuschuss/i.test(String(title||''));
 const f=factionsOf(title,text);
 if(f)for(const p of f.parties)rows.push({kind:'faction',value:p,detail:f.kind});
 if(text&&!collective)for(const x of fundingOf(text))rows.push({kind:'funding',value:x.program,detail:x.status});
 const plan=planOf(title,text);
 if(plan){rows.push({kind:'plan',value:plan.stage,detail:plan.type+'|'+plan.plan});const we=housingOf(text);if(we)rows.push({kind:'housing',value:'Wohneinheiten',detail:String(we)});}
 const fee=kitaFeeOf(title,text);if(fee)rows.push({kind:'kita_fee',value:fee.direction,detail:fee.euro});
 const places=kitaPlacesOf(title,text);if(places)rows.push({kind:'kita_places',value:'Plätze',detail:String(places)});
 return rows;
}
