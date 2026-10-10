export const LABEL_VERSION='labels-v2';
export const CLASSIFIER_VERSION='title-rules-v3';
export const LABELS=[
 {id:'bildung',name:'Bildung & Betreuung',color:'#2352ad'},
 {id:'bauen',name:'Bauen & Wohnen',color:'#945432'},
 {id:'mobilitaet',name:'Mobilität & Verkehr',color:'#2b6f91'},
 {id:'umwelt',name:'Umwelt & Natur',color:'#31774f'},
 {id:'klima',name:'Klima & Energie',color:'#527331'},
 {id:'soziales',name:'Soziales & Teilhabe',color:'#965775'},
 {id:'gesundheit',name:'Gesundheit & Pflege',color:'#7d609d'},
 {id:'wirtschaft',name:'Wirtschaft & Arbeit',color:'#86682e'},
 {id:'kultur',name:'Kultur',color:'#a14a60'},
 {id:'sport',name:'Sport & Freizeit',color:'#007f80'},
 {id:'sicherheit',name:'Sicherheit & Ordnung',color:'#965134'},
 {id:'finanzen',name:'Finanzen & Haushalt',color:'#526086'},
 {id:'verwaltung',name:'Verwaltung & Digitalisierung',color:'#64606e'},
 {id:'sitzung',name:'Sitzungsablauf & Gremienarbeit',color:'#697580',kind:'formal'},
 {id:'allgemein',name:'Allgemeine Anfragen & Mitteilungen',color:'#8a8176',kind:'general'},
 {id:'unklar',name:'Noch nicht eingeordnet',color:'#777777'}
];
export const labelName=id=>LABELS.find(x=>x.id===id)?.name||'Noch nicht eingeordnet';
// Specific subject phrases have precedence over incidental construction or finance words.
/** @type {[string,RegExp][]} */
const rules=[
 ['bildung',/\bkiga\b|\bggs\b|\bkgs\b|kindertages|kindergarten|kita\b|elternbeitr|schul|ganztag|\bogs\b|weiterbildung|volkshochschule|betreuungsplatz|erasmus|klassenfahrt|tagesausflüge|jugend und bildung|berufskolleg|schulleitung|kinderzahlen|anmeldeverhalten|\bbne\b|bildung für nachhaltige/gi],
 ['bauen',/bebauungsplan|flächennutzungsplan|bauleitplan|baugebiet|wohnen|wohnhaus|wohneinheit|grundstück|flurstück|erschließung|erschliessung|baubeschluss|bauvorhaben|wohnraum|wohnung|wohnbau|bauland|städtebau|stadtentwickl|stadtteilentwickl|leerstand|bauantrag|baugenehmigung|denkmalschutz|sanierungsgebiet|leerständ|entwicklungskonzept|erschließungsanlage|quartiersentwicklung|zweckentfremdung|denkmalbehörde|offenlage|bauleitplän|bauleitplanung/gi],
 ['mobilitaet',/fußweg|fussweg|zebrastreifen|wirtschaftsweg|haltestell|bushalte|rad.?vorrang|buspark|parkausweis|parksituation|parkplatz|tempomess|tempo.?30|e.scooter|poller|pöller|p&r|straßenbeleuchtung|ampel|\bkvb\b|\bnwl\b|brücken|brücke|radverbindung|veloroute|fahrrad|gehweg|bürgersteig|halteverbot|geschwindigkeits|verkehrsberuhigung|unfallkommission|nahverkehr|öpnv|busverkehr|regionalbus|radverkehr|radweg|radschnell|straßen|strasse|verkehr|parken|parkraum|deutschlandticket|bahnverkehr|stellplatz|ladeinfrastruktur|e-mobilität|mobilität|liniennetz|verkehrssicherheit|verkehrskonzept|widmungsverfahren|stadtbahn|kreuzung|umgehung|s-bahn|straßenendausbau|straßenbauprogramm|straßenbau|grunderneuerung|radweg|beleuchtung|nahverkehr|fahrradstraße|gleiserneuerung|mobilstation|bahnhof|\bbhf\b|personenunterführung|bürgerbus|zusatzfahrten|fahrspur|endausbau|erneuerung der [^.;]{0,40}straße|umgestaltung [^.;]{0,30}straße|\blinie \d|kreisstraße|kreisverkehr|fahrbahn/gi],
 ['umwelt',/grüngürtel|wegränder|laubabf|begrünung|grünordnung|nachhaltigkeitsbericht|\bbaum\b|recycling|lärmschutz|lärmbelastung|bäume|naturschutz|landschaftsplan|biodiversität|gewässer|abwasser|abfall|abfälle|abfällen|müll|grünfläche|baumfäll|baumschutz|artenschutz|trinkwasser|wasserwirtschaft|kläranlage|altkleider|landschaftsschutz|bnatschg|\branger\b|forstwirtschaft|\bigel|grünschnitt|elektroschrott|sperrmüll|ersatzgeld|entsiegel|depflaster|schottergärt|entwässerung|hochwasser|moorboden|\bheide\b|vorgärten|wiederherstellung der natur/gi],
 ['klima',/energetisch|klimaschutz|klimaanpass|wärmeplan|energie|photovoltaik|windkraft|windpark|solaranlage|hitzeschutz|starkregen|stromnetz|bürgerwind|windenergie|windrad|solar|kraftwerk/gi],
 ['soziales',/geflüchtet|barrierefrei|mobile.{0,8}rampen|lsbti|antidiskriminier|lebenslagenbericht|istanbul.konvention|intergeschlecht|lesben|schwule|diversity|inklusiv|kinder[- ]+und[- ]+jugendparlament|sozial|integration|inklusion|jugendhilfe|jugendamt|jugendförder|asyl|flüchtling|obdachlos|wohnungslos|gleichstellung|behinderten|senioren|jobcenter|\bkdu\b|kosten der unterkunft|bedarfe für unterkunft|frauenhaus|\bcsd\b|christopher street|gehörlos|eingliederungshilfe|demokratieförder|sozialleistung|bezahlkarte|interkulturell|verbraucherzentrale|senioren|behinderten|generationen|teilhabe|armut|jugendrat|seniorenvertretung|\bfrauen\b/gi],
 ['gesundheit',/stillfreundlich|stillmöglichkeiten|arztpraxis|ärzte|gesundheit|\bpflege\b|pflegeheim|pflegebedürft|krankenhaus|medizin|suchtprävention|hospiz|sucht(?:beratung|hilfe)|ersthelfer|herz-kreislauf|healthy|außerklinisch/gi],
 ['wirtschaft',/gewerbe|wirtschaftsförder|wirtschaftsentwick|arbeitsmarkt|beschäftigung|tourismus|einzelhandel|standortförder|\bleader\b|wirtschaftsfläch|wohnmobil|stadtmarketing/gi],
 ['kultur',/künste|darstellende kunst|kultur|museum|bibliothek|bücherei|theater|musikschule|konzert|stadtarchiv|kunstverein|ausstellung|archivgut|stadtarchiv|\bchor\b|städtepartnerschaft|partnerstadt|jubiläum|kunst(?!stoff|rasen)|stipendium|heimatpflege/gi],
 ['sport',/boulebahn|badefahrten|\bsport|wassersport|zweifachhalle|dreifachhalle|turnhalle|jugendzentrum|familienferienprogramm|freizeit|schwimmbad|hallenbad|freibad|spielplatz|bäder|jugendtreff|wanderweg|padel|tennis|skatepark|sportanlage|sportplatz|volleyball|fußball|turnverein|kleinspielfeld|spielfeld|sportstätte|spielplätze/gi],
 ['sicherheit',/böller|sicherheitskonzept|\bfriedhof\b|friedhofsverwaltung|grablicht|feuerwehr|brandschutz|katastrophenschutz|bevölkerungsschutz|rettungsdienst|rettungswache|ordnungs|polizei|gefahrenabwehr|kriminal|friedhofseinrichtung|friedhofsordnung|friedhofssatzung|einsatzfahrzeug|betteln|verunreinigung|vermüllung/gi],
 ['finanzen',/\bfinanzen\b|sachinvestitionsmittel|infrastrukturgesetz|beteiligungen.{0,45}unternehmen|schenkung|haushalt|jahresabschluss|gesamtabschluss|steuer|verschuldung|kreditaufnahme|finanzbericht|finanzplanung|finanzcontrolling|kassenprüfung|stundung|niederschlagung|geldforderung|stellenplan|zwischenbericht|kassenwart|sondervermögen|\betat\b|budget|investitionsplan|ergebnisplan|bilanzierungshilfe|\bnkf\b|jahresabschlussprüfung|wirtschaftsplan/gi],
 ['verwaltung',/verwaltungs|digitalisier|bürgerservice|personal|stellenplan|ratsarbeit|geschäftsordnung|gremienbesetzung|umbesetzung|wahlen|wahlordnung|hauptsatzung|datenschutz|informationssicherheit|organisationsstruktur|organigramm|nebentätigkeit|kennzahl|smart.?city|öffentlich-rechtliche vereinbarung|gebäudemanagement|servicezeiten|bürgerbüro|gesellschaftsvertr|beteiligungsunternehmen|betriebssatzung|organisationsuntersuchung|bezahldienst|digitale souveränität/gi]
];
// General headings are classified by their function, never guessed from committee names.
const routine=/^(?:(?:eröffnung|begrüßung|feststellung der (?:ordnungsgemäßen|beschlussfähigkeit|stimmberechtigung)|festsetzung der tagesordnung|genehmigung der (?:niederschrift|tagesordnung)|niederschrift (?:zur|über|der|nr)|einführung und verpflichtung|bestellung.{0,30}schriftführ|anerkennung der tagesordnung|wahl.{0,25}schriftführ|entgegennahme von erklärungen gemäß § 31|genehmigung von dringlichkeitsentscheidungen)|bericht der verwaltung über die abschließende erledigung)/i;
// Besetzungen, Wahlen und Verabschiedungen: Gremien- und Ausschussnamen im Titel sind kein Sachthema.
const formal=/^(?:niederschrift\b|feststellung der niederschrift|umbesetzung|ernennung|einführung und vereidigung|vereidigung|ausschüsse:|neubildung|bildung der ausschüsse|sitzungsausfall|(?:benennung|bestimmung|entsendung|berufung|bestellung|wahl|verpflichtung|verabschiedung|begrüßung|besetzung|neuaufnahme|zuteilung|verteilung|festlegung der (?:zahl|reihenfolge)|zusammensetzung)\b.{0,90}?(?:vertreter|mitglied|vorsitz|schriftführ|beirat|sachkundig|stellvertret|delegiert|beisitz|ausschuss|ausschüss)|vorstellung der (?:fachabteilungen|aufgaben des (?:aus|bereich)|abteilungen)|aufgaben des ausschusses|rückblick auf die ausschussarbeit|schriftführung\b|übernahme der sitzungsleitung|kurze allgemeine einführung|festlegung der anzahl der ehrenamtlichen)/i;
const general=/^(?:(?:neue |mündliche |schriftliche |allgemeine )?(?:anfragen|anträge|mitteilungen|eingänge|informationen|berichte|entscheidungen|anhörungen|beschlussvorlagen|vorlagen)(?: und (?:anfragen|anträge|mitteilungen|eingänge))?(?:; eingänge)?(?: (?:der|des|von|aus|gemäß).*)?|verschiedenes|sonstiges|aktuelle stunde|fragestunde für einwohnerinnen und einwohner|einwohnerfragestunde(?: gemäß § 18.*)?|beantwortung von anfragen(?: aus .*sitzungen)?|behandlung von anträgen|(?:neue )?anregungen(?: und beschwerden)?(?:\/anträge)? (?:gemäß|gem\.?|nach) § 24.*|neue anregungen\/anträge|mitteilungen und berichte.*|(?:beantwortung|antwort)(?: der verwaltung)?(?: liegt vor| vom .*)?|anfragen,? anregungen.*|anfragen der einwohner.*|eingänge und eingaben.*|einwohneranträge gemäß § 25.*|bürgerbegehren und bürgerentscheide gemäß § 26.*)[.!:]?$/i;
/** @param {any} t */
export function classifyTopic(t){
 const evidence=t.officialTitle||t.title||'';
 const title=evidence.normalize('NFKC').replace(/\s+[–—-]\s*(?:Frau|Herrn?)\s+[^;]+$/iu,'').trim();
 const hits=rules.map(([id,re])=>({id,words:[...new Set(title.match(re)||[])]})).filter(x=>x.words.length);
 let primary='unklar',reason='';
 const substantive=hits.filter(x=>!['finanzen','verwaltung'].includes(x.id));
 // Bei mehreren Sachgebieten entscheidet das zuerst genannte, wenn die Begriffe nicht aufgezählt sind („Schul- und Sportförderung“ bleibt offen).
 const first=()=>{const at=hits.map(h=>({id:h.id,i:title.search(new RegExp(h.words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i'))})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i);if(at.length<2)return '';const a=at[0],b=at.find(x=>x.id!==a.id&&substantive.some(h=>h.id===x.id));if(!b||!substantive.some(h=>h.id===a.id))return '';const gap=title.slice(a.i,b.i).slice(0,30);return /\b(?:und|sowie|oder|bzw)\b|[,\/&]/i.test(gap)?'':a.id;};
 if(/bebauungsplan|flächennutzungsplan|bauleitplan|\bfnp\b/i.test(title))primary='bauen';
 else if(/haushalts(?:plan|satzung|entwurf|ausführung)|haushaltes|jahresabschluss|wirtschaftsplan|investitionsplan|stellenplan|gewerbesteuer|gemeindefinanzierung|barzahlung/i.test(title.slice(0,80)))primary='finanzen';
 else if(formal.test(title))primary='sitzung';
 else if(/musikschule/i.test(title)&&substantive.every(x=>['bildung','kultur'].includes(x.id)))primary='kultur';
 else if(/(?:grund|gesamt|real|haupt|förder)schule|kindertages|kindergarten|\bkiga\b|\bkita\b/i.test(title)&&substantive.every(x=>['bildung','mobilitaet'].includes(x.id))&&!/schulstraße|schulstrasse|schulweg|verkehr|radweg/i.test(title))primary='bildung';
 else if(/schulstraße|schulstrasse|schulwegsicher/i.test(title)&&substantive.every(x=>['bildung','mobilitaet'].includes(x.id)))primary='mobilitaet';
 else if(/barrierefrei/i.test(title)&&/haltestell|bushalte/i.test(title)&&substantive.every(x=>['soziales','mobilitaet'].includes(x.id)))primary='mobilitaet';
 else if(/\bbaum\b|bäume/i.test(title)&&substantive.every(x=>['umwelt','mobilitaet'].includes(x.id)))primary='umwelt';
 else if(substantive.length===1)primary=substantive[0].id;
 else if(substantive.length>1&&first())primary=first();
 else if(!substantive.length&&routine.test(title)){primary='sitzung';reason='Formaler Sitzungs- oder Gremienpunkt; kein eigenes politisches Sachgebiet.';}
 else if(!substantive.length&&hits.some(x=>x.id==='finanzen'))primary='finanzen';
 else if(!substantive.length&&general.test(title)){primary='allgemein';reason='Allgemeiner Tagesordnungspunkt ohne benanntes Sachthema. Inhalt wird nicht aus dem Gremium abgeleitet.';}
 else if(!substantive.length&&hits.length===1)primary=hits[0].id;
 // A street/location alone is weak evidence. Only an explicit traffic action qualifies.
 else if(!substantive.length&&/pflaster|asphalt|aspahlt|fahrbahn|markierung|sanierung.{0,50}straße|ausbau.{0,50}straße|beleuchtung|straßenzustand/i.test(title)){
  primary='mobilitaet';reason='Konkrete Maßnahme an Verkehrsflächen oder öffentlicher Beleuchtung.';
 }
 const selected=hits.find(x=>x.id===primary);
 return {primary,secondary:hits.filter(x=>x.id!==primary).map(x=>x.id),version:LABEL_VERSION,method:CLASSIFIER_VERSION,evidence,sourceUrl:t.sourceUrl||'',reason:reason||(selected?'Erkannte Sachbegriffe: '+selected.words.join(', '):hits.length?'Mehrere mögliche Sachgebiete; Zuordnung offen.':'Titel benennt kein ausreichend eindeutiges Sachthema.'),classifiedAt:t.updatedAt||null};
}
