/*
 * Begriffe eines Titels für plenara.X (Themennetz, Ortsvergleich, Trends): Wörter ab 4 Buchstaben ohne Füll- und Sitzungswörter,
 * Schlüssel vereinheitlicht (klein, ohne Akzente, ß → ss), angezeigt in der ersten Schreibweise. Beim Bau von x_cases einmal je
 * Vorgang aus dem Titel seiner Karte abgelegt (Spalte terms, Migration 0042), damit die Seiten nur noch zählen.
 */
const STOP=new Set('aber alle allen aller alles als also auch auf aus bei beim bis dass dem den der des die diese diesem diesen dieser dieses doch durch ein eine einem einen einer eines für gegen hat haben ihre ihrem ihren ihrer ist kann mit nach nicht noch nur oder ohne sich sind über und unter vom von vor wird wurde zum zur zwischen sowie sowohl weitere weiteren weiterer weiteres neue neuen neuer neues dazu hierzu hierfür dafür dagegen darüber darauf daraus davon damit wegen innerhalb außerhalb bezüglich betreffend gemäß nr nummer vom im am an zu so wie was wer wo wenn dann denn mehr sehr schon bereits'.split(' '));
/* Formalien tragen nichts zum Thema bei */
const FORMAL=new Set('sitzung sitzungen niederschrift niederschriften protokoll tagesordnung tagesordnungspunkt mitteilung mitteilungen anfrage anfragen anfragen antrag anträge antrags beschluss beschlüsse beschlussvorlage vorlage vorlagen vorlagenummer verschiedenes bekanntgaben bekanntgabe genehmigung feststellung eröffnung öffentlich öffentliche öffentlichen nichtöffentlich nichtöffentlichen teil ortsrat ortsrates gemeinderat gemeinderates stadtrat stadtrates kreistag kreistages rat rates ausschuss ausschusses fachausschuss einwohnerfragestunde fragestunde top punkt hier änderung beteiligung stellungnahme beratung entwurf gemeinde stadt gmbh sachlichen aufstellung beschlussfassung kenntnisnahme bericht berichte information informationen verfahren januar februar märz april mai juni juli august september oktober november dezember montag dienstag mittwoch donnerstag freitag samstag sonntag informativ beschliessend beschließend beschließende beschließender flst herr herrn frau fraktion fraktionen grünen grüne bündnis linke linken freie freien wähler wählergemeinschaft wählergruppe'.split(' '));
export const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replaceAll('ß','ss');
export const tokens=title=>{
 const found=new Map();
 for(const raw of String(title).split(/[^A-Za-zÀ-ÿ]+/)){
  if(raw.length<4)continue;
  const w=raw.toLowerCase();
  if(STOP.has(w)||FORMAL.has(w))continue;
  const key=norm(w);
  if(!found.has(key))found.set(key,w);
 }
 return found;
};
/** Spalte x_cases.terms: „Schlüssel<TAB>Wort“ je Zeile */
export const termsText=title=>[...tokens(title)].map(([k,w])=>k+'\t'+w).join('\n');
/** @returns {Map<string,string>} wie tokens(title) */
export const parseTerms=s=>new Map(s?String(s).split('\n').map(l=>l.split('\t')):[]);
