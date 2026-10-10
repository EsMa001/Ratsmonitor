import {LABEL_WORDS} from './label-words.mjs';
export const LABEL_VERSION='labels-v2';
export const CLASSIFIER_VERSION='title-rules-v4';
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
const rules=Object.entries(LABEL_WORDS).map(([id,words])=>[id,new RegExp(words.join('|'),'gi')]);
// General headings are classified by their function, never guessed from committee names.
const routine=/^(?:(?:eröffnung\b|begrüßung|feststellung der (?:ordnungsgemäßen|beschlussfähigkeit|stimmberechtigung)|festsetzung der tagesordnung|genehmigung der (?:niederschrift|tagesordnung)|niederschrift (?:zur|über|der|nr)|einführung und verpflichtung|bestellung.{0,30}schriftführ|anerkennung der tagesordnung|wahl.{0,25}schriftführ|entgegennahme von erklärungen gemäß § 31|genehmigung von dringlichkeitsentscheidungen)|bericht der verwaltung über die abschließende erledigung)/i;
// Besetzungen, Wahlen und Verabschiedungen: Gremien- und Ausschussnamen im Titel sind kein Sachthema.
const formal=/^(?:"[^"]+"\s*[-–:]\s*)?(?:nachwahl|neuwahl|neubesetzung|geschäftsordnungsangelegenheiten|erhöhung der aufwandsentschädigung|bildung des .{0,40}ausschuss|.{0,60}\bwahl (?:der|des|von|eines?) .{0,40}(?:vertreter|mitglied|stellvertret|vorsitz|vorstand)|.{0,80}stimmabgabe in der verbandsversammlung|vorbereitung ortsbegehung|amtseinführung|einführung, vereidigung|besetzung des ortsgericht|.{0,20}entschädigungssatzung|verzicht auf verpflegung|ergänzungswahl|neubestellung|nachrücken|widerstreit der interessen|beschlusskontrolle|sitzungskalender|terminierung|bekanntgabe .{0,60}(?:nichtöffentlich|ausschluss der öffentlichkeit)|bekanntmachung der .{0,40}nichtöffentlich|(?:einwendungen|einwände|anmerkungen) .{0,30}(?:niederschrift|protokoll)|behandlung von einwendungen|(?:genehmigung|annahme|beschlussfassung über evtl\. einwendungen gegen) .{0,30}(?:protokoll|niederschrift)|(?:änderungs)?anträge? (?:zur|auf ergänzung.{0,20}) tagesordnung|ausschluss der öffentlichkeit|themen für die nächste sitzung|termine? (?:der |für die )?nächste|besprechung der tagesordnung|bericht zur erledigung|rückblick auf die offenen punkte|aufgabenverteilung im|überweisungsaufträge|umsetzung von beschlüssen des|einführung, verpflichtung|antrag auf umbesetzung|genehmigung (?:eines|von) eilbedürftig|.{0,120}\bsitzungsgeld|niederschrift\b|feststellung der niederschrift|umbesetzung|ernennung|einführung und vereidigung|vereidigung|ausschüsse:|neubildung|bildung der ausschüsse|sitzungsausfall|(?:benennung|bestimmung|entsendung|berufung|bestellung|wahl|verpflichtung|verabschiedung|begrüßung|besetzung|neuaufnahme|zuteilung|verteilung|festlegung der (?:zahl|reihenfolge)|zusammensetzung)\b.{0,90}?(?:vertreter|mitglied|vorsitz|schriftführ|beirat|sachkundig|stellvertret|delegiert|beisitz|ausschuss|ausschüss|vorstand|beauftragt)|vorstellung der (?:fachabteilungen|aufgaben des (?:aus|bereich)|abteilungen)|aufgaben des ausschusses|rückblick auf die ausschussarbeit|schriftführung\b|übernahme der sitzungsleitung|kurze allgemeine einführung|festlegung der anzahl der ehrenamtlichen)/i;
const general=/^(?:(?:neue |mündliche |schriftliche |allgemeine )?(?:anfragen|anträge|mitteilungen|eingänge|informationen|berichte|entscheidungen|anhörungen|beschlussvorlagen|vorlagen)(?: und (?:anfragen|anträge|mitteilungen|eingänge))?(?:; eingänge)?(?: (?:der|des|von|aus|gemäß|zu|an).*)?|verschiedenes|ankündigungen.*|termine|kenntnisnahmen?|berichte\/informationen|vorberatungen.*|einbringen von eingaben|sachstandsberichte der verwaltung|berichte? (?:der|des) (?:verwaltung|bürgermeister\w*|amtsvorsteher\w*|ausschüsse|ausschussvorsitzenden|vorsitzenden)(?: bzw\..*|\/.*)?|(?:\d\. )?(?:einwohn|bürger)\w*?(?:\/innen)?-?(?:fragestunde|fragen|fragezeit)\b.*|mitteilungen und (?:beantwortung von )?anfragen.*|eingaben und anträge|sonstiges|aktuelle stunde|fragestunde für einwohnerinnen und einwohner|einwohnerfragestunde(?: gemäß § 18.*)?|beantwortung von anfragen(?: aus .*sitzungen)?|behandlung von anträgen|(?:neue )?anregungen(?: und beschwerden)?(?:\/anträge)? (?:gemäß|gem\.?|nach) § 24.*|neue anregungen\/anträge|mitteilungen und berichte.*|(?:beantwortung|antwort)(?: der verwaltung)?(?: liegt vor| vom .*)?|anfragen,? anregungen.*|anfragen der einwohner.*|eingänge und eingaben.*|einwohneranträge gemäß § 25.*|bürgerbegehren und bürgerentscheide gemäß § 26.*)[.!:]?$/i;
// Ohne Sachtreffer: Sitzungsvokabular irgendwo im Titel ist ein formaler Punkt; Berichts-, Mitteilungs- und Anfragenanfänge sind allgemeine Punkte.
const routineWords=/niederschrift|protokoll|tagesordnung|nichtöffentlich|beschlussfähigkeit|verpflichtung|vereidigung|amtseinführung|ausschussvorsitz|sitzungsteil|\bgremien\b|\bsitzung(?:en)?\b|(?:gefasste[nr]?|ausführung von) beschlüsse|stand der .{0,20}beschlüsse|termin(?:vereinbarung|abstimmung|ierung)|verabschiedung|neuwahl|nachwahl|umbesetzung|schriftführ/i;
const generalStart=/^(?:lfd\. ?nr\.? ?\d+ ?- ?)?(?:berichte?|mitteilung(?:en)?|information(?:en)?|anfragen?|antworten|nachfragen|bekanntmachungen|eingaben|anträge|termine?|verschiedenes|sonstiges|kenntnisnahmen?|bekanntgaben?)\b(?!:)/i;
const strongRoutine=/nichtöffentlich|gefasste[nr]? beschlüsse|beschlüsse.{0,30}gefasst|niederschrift|protokoll|tagesordnung(?!spunkten\))/i;
/** @param {any} t */
export function classifyTopic(t){
 const evidence=t.officialTitle||t.title||'';
 const title=evidence.normalize('NFKC').replace(/\s+[–—-]\s*(?:Frau|Herrn?)\s+[^;]+$/iu,'').trim();
 const text=title.replace(/\S+ausschuss(?:es|ses)?\b/gi,' ');
 const hits=rules.map(([id,re])=>({id,words:[...new Set(text.match(re)||[])]})).filter(x=>x.words.length);
 let primary='unklar',reason='';
 const substantive=hits.filter(x=>!['finanzen','verwaltung'].includes(x.id));
 // Bei mehreren Sachgebieten entscheidet das zuerst genannte, wenn die Begriffe nicht aufgezählt sind („Schul- und Sportförderung“ bleibt offen).
 const first=()=>{const at=hits.map(h=>({id:h.id,i:title.search(new RegExp(h.words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'i'))})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i);if(at.length<2)return '';const a=at[0],b=at.find(x=>x.id!==a.id&&substantive.some(h=>h.id===x.id));if(!b||!substantive.some(h=>h.id===a.id))return '';const gap=title.slice(a.i,b.i);return gap.length<=40&&/\b(?:und|sowie|oder|bzw)\b|[,\/&]/i.test(gap.slice(-25))?'':a.id;};
 if(/bebauungsplan|flächennutzungsplan|bauleitplan|\bfnp\b/i.test(title))primary=/wind(?:energie|kraft|park)|bürgerwind|photovoltaik|freiflächen|solar|pv-?park|pv-anlage|\bpv\b/i.test(title)?'klima':'bauen';
 else if(/nebentätigkeit/i.test(title))primary='verwaltung';
 else if(/haushalts(?:plan|satzung|entwurf|ausführung)|haushalt(?:s|es)?\b|jahresabschl|abschlussprüfer|\bwirtschaftsplan|investitionsplan|stellenplan|gewerbesteuer|gemeindefinanzierung|barzahlung/i.test(title.slice(0,100)))primary='finanzen';
 else if(/gesellschaftsvertr/i.test(title))primary='verwaltung';
 else if(formal.test(title))primary='sitzung';
 else if(/ehemalig|umnutzung|abbruch/i.test(title)&&(substantive.some(x=>x.id==='bauen')||/verkauf|abriss/i.test(title)))primary='bauen';
 else if(/schulhof|schulgelände/i.test(title))primary='bildung';
 else if(/musikschule/i.test(title)&&substantive.every(x=>['bildung','kultur'].includes(x.id)))primary='kultur';
 else if(/(?:grund|gesamt|real|haupt|förder)schule|schulhof|schulgelände|kindertages|kindergarten|\bkiga\b|\bkita\b/i.test(title)&&substantive.every(x=>['bildung','mobilitaet'].includes(x.id))&&!/schulstraße|schulstrasse|schulweg|verkehr|radweg/i.test(title))primary='bildung';
 else if(/schulstraße|schulstrasse|schulwegsicher/i.test(title)&&substantive.every(x=>['bildung','mobilitaet'].includes(x.id)))primary='mobilitaet';
 else if(/barrierefrei/i.test(title)&&/haltestell|bushalte/i.test(title)&&substantive.every(x=>['soziales','mobilitaet'].includes(x.id)))primary='mobilitaet';
 else if(/\bbaum\b|bäume/i.test(title)&&substantive.every(x=>['umwelt','mobilitaet'].includes(x.id)))primary='umwelt';
 else if(substantive.length===1)primary=substantive[0].id;
 else if(substantive.length>1&&first())primary=first();
 else if(!substantive.length&&routine.test(title)){primary='sitzung';reason='Formaler Sitzungs- oder Gremienpunkt; kein eigenes politisches Sachgebiet.';}
 else if(!substantive.length&&!/fragestunde|fragezeit/i.test(title)&&(strongRoutine.test(title)||(!generalStart.test(title)&&routineWords.test(title)))){primary='sitzung';reason='Formaler Sitzungs- oder Gremienpunkt; kein eigenes politisches Sachgebiet.';}
 else if(!substantive.length&&hits.some(x=>x.id==='finanzen'))primary='finanzen';
 else if(!hits.length&&(generalStart.test(title)||/fragestunde|fragezeit/i.test(title))&&!/\bhier:/i.test(title)){primary='allgemein';reason='Allgemeiner Tagesordnungspunkt ohne benanntes Sachthema. Inhalt wird nicht aus dem Gremium abgeleitet.';}
 else if(!substantive.length&&general.test(title)){primary='allgemein';reason='Allgemeiner Tagesordnungspunkt ohne benanntes Sachthema. Inhalt wird nicht aus dem Gremium abgeleitet.';}
 else if(!substantive.length&&hits.length===1)primary=hits[0].id;
 // A street/location alone is weak evidence. Only an explicit traffic action qualifies.
 else if(!substantive.length&&/pflaster|asphalt|aspahlt|fahrbahn|markierung|sanierung.{0,50}straße|ausbau.{0,50}straße|beleuchtung|straßenzustand/i.test(title)){
  primary='mobilitaet';reason='Konkrete Maßnahme an Verkehrsflächen oder öffentlicher Beleuchtung.';
 }
 const selected=hits.find(x=>x.id===primary);
 return {primary,secondary:hits.filter(x=>x.id!==primary).map(x=>x.id),version:LABEL_VERSION,method:CLASSIFIER_VERSION,evidence,sourceUrl:t.sourceUrl||'',reason:reason||(selected?'Erkannte Sachbegriffe: '+selected.words.join(', '):hits.length?'Mehrere mögliche Sachgebiete; Zuordnung offen.':'Titel benennt kein ausreichend eindeutiges Sachthema.'),classifiedAt:t.updatedAt||null};
}
