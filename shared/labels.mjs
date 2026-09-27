export const LABEL_VERSION='labels-v2';
export const CLASSIFIER_VERSION='title-rules-v2';
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
 ['bildung',/\bkiga\b|\bggs\b|\bkgs\b|kindertages|kindergarten|kita\b|elternbeitr|schul|ganztag|\bogs\b|weiterbildung|volkshochschule|betreuungsplatz/gi],
 ['bauen',/bebauungsplan|flächennutzungsplan|bauleitplan|baugebiet|wohnen|wohnhaus|wohneinheit|grundstück|flurstück|erschließung|erschliessung|baubeschluss|bauvorhaben|wohnraum|wohnung|wohnbau|bauland|städtebau|stadtentwickl|stadtteilentwickl|leerstand|bauantrag|baugenehmigung|denkmalschutz|sanierungsgebiet/gi],
 ['mobilitaet',/fußweg|fussweg|zebrastreifen|wirtschaftsweg|haltestell|bushalte|rad.?vorrang|buspark|parkausweis|parksituation|parkplatz|tempomess|tempo.?30|e.scooter|poller|pöller|p&r|straßenbeleuchtung|ampel|\bkvb\b|\bnwl\b|brücken|brücke|radverbindung|veloroute|fahrrad|gehweg|bürgersteig|halteverbot|geschwindigkeits|verkehrsberuhigung|unfallkommission|nahverkehr|öpnv|busverkehr|regionalbus|radverkehr|radweg|radschnell|straßen|strasse|verkehr|parken|parkraum|deutschlandticket|bahnverkehr/gi],
 ['umwelt',/grüngürtel|wegränder|laubabf|begrünung|grünordnung|nachhaltigkeitsbericht|\bbaum\b|recycling|lärmschutz|lärmbelastung|bäume|naturschutz|landschaftsplan|biodiversität|gewässer|abwasser|abfall|abfälle|abfällen|müll|grünfläche|baumfäll|baumschutz|artenschutz|trinkwasser|wasserwirtschaft|kläranlage/gi],
 ['klima',/energetisch|klimaschutz|klimaanpass|wärmeplan|energie|photovoltaik|windkraft|windpark|solaranlage|hitzeschutz|starkregen/gi],
 ['soziales',/geflüchtet|barrierefrei|mobile.{0,8}rampen|lsbti|antidiskriminier|lebenslagenbericht|istanbul.konvention|intergeschlecht|lesben|schwule|diversity|inklusiv|kinder[- ]+und[- ]+jugendparlament|sozial|integration|inklusion|jugendhilfe|jugendamt|jugendförder|asyl|flüchtling|obdachlos|wohnungslos|gleichstellung|behinderten|senioren/gi],
 ['gesundheit',/stillfreundlich|stillmöglichkeiten|arztpraxis|ärzte|gesundheit|\bpflege\b|pflegeheim|pflegebedürft|krankenhaus|medizin|suchtprävention|hospiz/gi],
 ['wirtschaft',/gewerbe|wirtschaftsförder|wirtschaftsentwick|arbeitsmarkt|beschäftigung|tourismus|einzelhandel|standortförder/gi],
 ['kultur',/künste|darstellende kunst|kultur|museum|bibliothek|bücherei|theater|musikschule|konzert|stadtarchiv|kunstverein/gi],
 ['sport',/boulebahn|badefahrten|\bsport|wassersport|zweifachhalle|dreifachhalle|turnhalle|jugendzentrum|familienferienprogramm|freizeit|schwimmbad|hallenbad|freibad|spielplatz|bäder|jugendtreff|wanderweg/gi],
 ['sicherheit',/böller|sicherheitskonzept|\bfriedhof\b|friedhofsverwaltung|grablicht|feuerwehr|brandschutz|katastrophenschutz|bevölkerungsschutz|rettungsdienst|rettungswache|ordnungs|polizei|gefahrenabwehr|kriminal/gi],
 ['finanzen',/\bfinanzen\b|sachinvestitionsmittel|infrastrukturgesetz|beteiligungen.{0,45}unternehmen|schenkung|haushalt|jahresabschluss|gesamtabschluss|steuer|verschuldung|kreditaufnahme|finanzbericht|finanzplanung|finanzcontrolling|kassenprüfung/gi],
 ['verwaltung',/verwaltungs|digitalisier|bürgerservice|personal|stellenplan|ratsarbeit|geschäftsordnung|gremienbesetzung|umbesetzung|wahlen|wahlordnung|hauptsatzung|datenschutz|informationssicherheit/gi]
];
// General headings are classified by their function, never guessed from committee names.
const routine=/^(?:(?:eröffnung|begrüßung|feststellung der (?:ordnungsgemäßen|beschlussfähigkeit|stimmberechtigung)|festsetzung der tagesordnung|genehmigung der (?:niederschrift|tagesordnung)|niederschrift (?:zur|über|der)|einführung und verpflichtung|bestellung.{0,30}schriftführ|anerkennung der tagesordnung|wahl.{0,25}schriftführ|entgegennahme von erklärungen gemäß § 31|genehmigung von dringlichkeitsentscheidungen)|bericht der verwaltung über die abschließende erledigung)/i;
const general=/^(?:(?:neue |mündliche |schriftliche |allgemeine )?(?:anfragen|anträge|mitteilungen|eingänge|informationen|berichte|entscheidungen|anhörungen|beschlussvorlagen|vorlagen)(?: und (?:anfragen|anträge|mitteilungen|eingänge))?(?:; eingänge)?(?: (?:der|des|von|aus|gemäß).*)?|verschiedenes|sonstiges|aktuelle stunde|fragestunde für einwohnerinnen und einwohner|einwohnerfragestunde(?: gemäß § 18.*)?|beantwortung von anfragen(?: aus .*sitzungen)?|behandlung von anträgen|anregungen(?: und beschwerden)? gemäß § 24.*|einwohneranträge gemäß § 25.*|bürgerbegehren und bürgerentscheide gemäß § 26.*)[.!]?$/i;
/** @param {any} t */
export function classifyTopic(t){
 const evidence=t.officialTitle||t.title||'';
 const title=evidence.normalize('NFKC').replace(/\s+[–—-]\s*(?:Frau|Herrn?)\s+[^;]+$/iu,'').trim();
 const hits=rules.map(([id,re])=>({id,words:[...new Set(title.match(re)||[])]})).filter(x=>x.words.length);
 let primary='unklar',reason='';
 const substantive=hits.filter(x=>!['finanzen','verwaltung'].includes(x.id));
 if(/bebauungsplan|flächennutzungsplan|bauleitplan/i.test(title))primary='bauen';
 else if(/musikschule/i.test(title)&&substantive.every(x=>['bildung','kultur'].includes(x.id)))primary='kultur';
 else if(/(?:grund|gesamt|real|haupt|förder)schule|kindertages|kindergarten|\bkiga\b|\bkita\b/i.test(title)&&substantive.every(x=>['bildung','mobilitaet'].includes(x.id))&&!/schulstraße|schulstrasse|schulweg|verkehr|radweg/i.test(title))primary='bildung';
 else if(/schulstraße|schulstrasse|schulwegsicher/i.test(title)&&substantive.every(x=>['bildung','mobilitaet'].includes(x.id)))primary='mobilitaet';
 else if(/barrierefrei/i.test(title)&&/haltestell|bushalte/i.test(title)&&substantive.every(x=>['soziales','mobilitaet'].includes(x.id)))primary='mobilitaet';
 else if(/\bbaum\b|bäume/i.test(title)&&substantive.every(x=>['umwelt','mobilitaet'].includes(x.id)))primary='umwelt';
 else if(substantive.length===1)primary=substantive[0].id;
 else if(!substantive.length&&routine.test(title)){primary='sitzung';reason='Formaler Sitzungs- oder Gremienpunkt; kein eigenes politisches Sachgebiet.';}
 else if(!substantive.length&&general.test(title)){primary='allgemein';reason='Allgemeiner Tagesordnungspunkt ohne benanntes Sachthema. Inhalt wird nicht aus dem Gremium abgeleitet.';}
 else if(!substantive.length&&hits.length===1)primary=hits[0].id;
 // A street/location alone is weak evidence. Only an explicit traffic action qualifies.
 else if(!substantive.length&&/pflaster|asphalt|aspahlt|fahrbahn|markierung|sanierung.{0,50}straße|ausbau.{0,50}straße|beleuchtung|straßenzustand/i.test(title)){
  primary='mobilitaet';reason='Konkrete Maßnahme an Verkehrsflächen oder öffentlicher Beleuchtung.';
 }
 const selected=hits.find(x=>x.id===primary);
 return {primary,secondary:hits.filter(x=>x.id!==primary).map(x=>x.id),version:LABEL_VERSION,method:CLASSIFIER_VERSION,evidence,sourceUrl:t.sourceUrl||'',reason:reason||(selected?'Erkannte Sachbegriffe: '+selected.words.join(', '):hits.length?'Mehrere mögliche Sachgebiete; Zuordnung offen.':'Titel benennt kein ausreichend eindeutiges Sachthema.'),classifiedAt:t.updatedAt||null};
}
