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
  ['Fahrradstraße',/fahrradstra(ß|ss)e|fahrradzone|radschnellweg|radspur|pop-up-radweg|protected bike/],
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
  ['Schließung',/(?<![a-zäöüß])schließung(?! (des|der) (öffentlichen|nichtöffentlichen|sitzung|versammlung|tagesordnung|beratung|rednerliste))|schliessung|stilllegung (des|der|von) (bad|schule|kita|bibliothek|krankenhaus|klinik|standort)|schließen (der|des) (bad|schule|kita|bibliothek|krankenhaus|klinik|standort|freibad|hallenbad|filiale|jugendzentrum|werk|geschäftsstelle)|einstellung des betriebs/,3],
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
 {id:'bauen',name:'Bauen & Flächen',weight:2,terms:[
  ['Großprojekt',/hochhaus|logistikzentrum|logistikpark|rechenzentrum|kiesabbau|kiesgrube|steinbruch|müllverbrennung/,2.2],
  ['Neubaugebiet',/flächenverbrauch|flächenversiegelung|nachverdichtung/,2.2],
  ['Funk / Strom',/mobilfunkmast|funkmast|hochspannungsleitung|stromtrasse|südlink|suedlink/,2.4],
  ['Umspannwerk',/umspannwerk/,1.5],
  ['Spielhalle / Rotlicht',/spielhalle|wettbüro|vergnügungsstätte|shisha|bordell|prostitution/,2.4],
 ]},
];

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

/**
 * @param {any} db @param {{id:string,name:string,shortName?:string}[]} regions
 * @param {{today?:string,days?:number,perDay?:number,minScore?:number,extraNames?:[string,string][]}} [o]
 */
export async function socialTopics(db,regions,{today=iso(Date.now()),days=30,perDay=3,minScore=2.8,extraNames=[]}={}){
 // extraNames: [[regionId,name],…] für Gebiete außerhalb des Katalogs (BKG-Liste in shared/de-regions.json)
 const names=new Map([...extraNames,...regions.map(r=>[r.id,r.shortName||r.name])]);
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
 const byDay=new Map(dayList.map(d=>[d,[]]));
 for(const c of picked){
  const l=byDay.get(c.date);
  if(!l||l.length>=perDay||l.some(x=>x.region_id===c.region_id))continue;
  l.push(c);
 }
 return {
  from,to:today,perDay,scanned:cards.length,matched:scored.length,
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
 return {
  id:c.id,title:c.title,date:c.date,status:c.status,region:names.get(c.region_id)||c.region_id,regionId:c.region_id,
  gremium:c.gremium||'',group:main.groupName,term:main.term,score:c.score,why,
  otherPlaces:Math.max(0,(termRegions.get(main.term)?.size||1)-1),
  link:'/beschluss/'+encodeURIComponent(c.id),search:'/?q='+encodeURIComponent(main.term),
 };
}
