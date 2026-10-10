// Lena versteht eine Frage mit Regeln: Absicht, Ort, Zeit, Status, Thema. Keine Modelle, nichts wird geraten.
// Konzept: docs/produkt/lena-konzept.md. Messung: node scripts/lena/measure.mjs [--fehler]
import {LABEL_WORDS} from '../label-words.mjs';
import {LABELS} from '../labels.mjs';

export const LENA_VERSION='lena-rules-v1';
export const INTENTS=['suche','stand','entwicklung','vergleich','alarm','abdeckung','hilfe'];

/* Absichten: Muster mit Gewicht; die höchste Summe gewinnt, unter 2 Punkten bleibt die Absicht offen (dann Suche, wenn ein Thema da ist). */
const INTENT_RULES=[
 ['alarm',/sag(?:en sie)? (?:mir )?bescheid|gib (?:mir )?bescheid|bescheid (?:geben|sagen)|benachrichtig|alarm|informier\w* (?:sie )?mich|melde[nt]? (?:mir|mich)|auf dem laufenden|mitbekommen|verpassen|abonnier/i,3],
 ['vergleich',/vergleich|gegenüber|\bversus\b|\bvs\.?\b|\bgegen\b|unterschied|im verhältnis zu|wo (?:ist|gibt es) mehr|wo läuft mehr/i,3],
 ['entwicklung',/entwickel|entwicklung|trend|nimmt .{0,40}\b(?:zu|ab)\b|zunimmt|nimmt ab|abnimmt|mehr geworden|weniger geworden|häufiger|seltener|verbreitet|ausbreitung|im kommen|zunehmend|rückläufig|dynamik/i,3],
 ['abdeckung',/\bdabei\b|abgedeckt|abdeckung|erfasst|unterstützt|gibt es daten|hast du daten|habt ihr daten|haben sie daten|daten (?:zu|zum|zur|von|für|aus)\b|im portal|verfügbar|(?:kommune|gemeinde|stadt|kreis) (?:ist|gibt es|habt ihr|haben sie)/i,3],
 ['hilfe',/was (?:bedeutet|heißt|ist (?:ein|eine|der|die|das)\b)|bedeutung|erklär|was kostet|preis|tarif|kosten|wie funktioniert|wie läuft das|wie aktuell|wie kann ich|wie speicher|wie lege ich|wo finde ich|anleitung|hilfe/i,3],
 ['stand',/beschlossen|entschieden|abgelehnt|vertagt|angenommen|verabschiedet|wie steht es|(?:wie ist der|welcher|aktueller) (?:stand|status)|\bstand\b|\bstatus\b|wie weit|ergebnis|ausgang|durch\?$|wurde|ist .{0,40}(?:schon|bereits)/i,2],
 ['suche',/was gibt es|gibt es|was läuft|was liegt|suche|finde|zeig|liste|vorlagen|beschlüsse|anträge|themen|alles zu|neues zu|aktuelles|aktuell|welche/i,1],
];

/* Zeit: relative Angaben und Jahre; Ergebnis als from/to (ISO-Tage). */
const MONTHS={januar:1,februar:2,märz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12};
const DAY=86400000;
const iso=ms=>new Date(ms).toISOString().slice(0,10);
export function parseTime(text,now=Date.now()){
 const t=text.toLowerCase();let m;
 const take=(ms,matched)=>({from:iso(ms),to:iso(now),matched});
 if((m=t.match(/(?:in den |die |der )?letzten? (\d{1,3}) (tag|woche|monat|jahr)/)))return take(now-Number(m[1])*{tag:1,woche:7,monat:30,jahr:365}[m[2]]*DAY,m[0]);
 if((m=t.match(/(?:in der |diese[rn]? )woche/)))return take(now-7*DAY,m[0]);
 if((m=t.match(/(?:in diesem|diesen|im laufenden) monat/)))return take(now-30*DAY,m[0]);
 if((m=t.match(/(?:in diesem|dieses|im laufenden) jahr|\bheuer\b/)))return {from:iso(now).slice(0,4)+'-01-01',to:iso(now),matched:m[0]};
 if((m=t.match(/(?:letzte[sn]?|vergangene[sn]?|vorige[sn]?) (jahr|monat|woche)/))){const y=Number(iso(now).slice(0,4))-1;if(m[1]==='jahr')return {from:y+'-01-01',to:y+'-12-31',matched:m[0]};return take(now-(m[1]==='monat'?30:7)*DAY,m[0]);}
 if((m=t.match(/\bseit (januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)(?: (20\d\d))?/))){const y=m[2]||iso(now).slice(0,4);return {from:y+'-'+String(MONTHS[m[1]]).padStart(2,'0')+'-01',to:iso(now),matched:m[0]};}
 if((m=t.match(/\bseit (20\d\d)\b/)))return {from:m[1]+'-01-01',to:iso(now),matched:m[0]};
 if((m=t.match(/\b(?:im |in |aus )?(20\d\d)\b/))&&!/\d{1,2}\.\d{1,2}\.20\d\d/.test(t)&&!/(?:haushalt\w*|etat|wirtschaftsplan|stellenplan|nr\.?|nummer|programm) ?20\d\d/.test(t))return {from:m[1]+'-01-01',to:m[1]+'-12-31',matched:m[0]};
 return null;
}

/* Status: die Statuswörter der App (shared/types.ts STATUS). */
export const STATUS_WORDS=[
 ['approved',/beschlossen|angenommen|verabschiedet|zugestimmt|genehmigt|entschieden/i,'Beschlossen'],
 ['rejected',/abgelehnt|verworfen|gescheitert/i,'Abgelehnt'],
 ['postponed',/vertagt|verschoben|zurückgestellt/i,'Vertagt'],
 ['recommended',/empfohlen|empfehlung/i,'Empfehlung'],
 ['consulting',/in (?:der )?beratung|beraten wird|wird beraten|diskutiert|behandelt/i,'In Beratung'],
 ['announced',/angekündigt|geplant|auf der tagesordnung|steht an|kommt/i,'Angekündigt'],
];
export const STATUS_NAMES={announced:'Angekündigt',consulting:'In Beratung',recommended:'Empfehlung',approved:'Beschlossen',rejected:'Abgelehnt',postponed:'Vertagt',info:'Zur Kenntnis',unknown:'Stand offen'};
export function parseStatus(text){for(const [id,re] of STATUS_WORDS){const m=text.match(re);if(m)return {status:id,matched:m[0]};}return null;}

/* Ort: Namen aus dem Gebietskatalog, längster Treffer zuerst; „Köln-Esch“ fällt auf Köln zurück; „Kreis X“ bevorzugt den Kreis. */
const norm=s=>s.toLowerCase().normalize('NFKC').replace(/ß/g,'ss').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/[^a-z0-9 -]+/g,' ').replace(/\s+/g,' ').trim();
const PREFIX=/^(?:stadt|gemeinde|kreis|landkreis|samtgemeinde|verbandsgemeinde|markt|flecken|hansestadt|landeshauptstadt|universitätsstadt|kreisstadt|große kreisstadt|region|städteregion|regionalverband|amt|verwaltungsgemeinschaft|bezirk) /i;
const placeIndexes=new WeakMap();
function placeIndex(catalog){
 let idx=placeIndexes.get(catalog);if(idx)return idx;
 idx=new Map();
 const add=(key,r,score)=>{if(!key)return;const list=idx.get(key)||[];if(!list.some(x=>x.r===r))list.push({r,score});idx.set(key,list);};
 for(const r of catalog){
  const bare=(r.name||'').replace(PREFIX,'');
  const names=new Set([r.shortName,r.name,bare,bare.replace(/\s*\(.*\)\s*/g,' ').trim(),(r.shortName||'').replace(/\s*\(.*\)\s*/g,' ').trim()].filter(Boolean));
  for(const n of names){const k=norm(n),score=/\(/.test(bare)&&!/\(/.test(n)?2:3;add(k,r,score);if(k.includes(' '))add(k.replace(/ /g,'-'),r,score);}
  for(const m of r.members||[])add(norm(m.name.replace(PREFIX,'')),r,1);
 }
 placeIndexes.set(catalog,idx);return idx;
}
const PLACE_STOP=new Set(['bescheid','stand','status','trend','vergleich','thema','dabei','daten','pro','basis','plenara','ratsmonitor','lena','mir','mich','uns','sie','ich','ist','gibt','und','oder','wie','was','wann','wer','wo','der','die','das','den','dem','des','ein','eine','einen','einem','einer','mit','von','vom','für','auf','aus','bei','nach','über','seit','bis','zum','zur','zu','in','im','an','am']);
export function findPlaces(text,catalog,{max=2}={}){
 const idx=placeIndex(catalog),words=norm(text).split(' ').filter(Boolean),found=[];const used=new Set();
 const wantKreis=/\b(?:land)?kreis(?:es)?\b/i.test(text);
 for(let n=4;n>=1;n--)for(let i=0;i+n<=words.length;i++){
  if([...Array(n)].some((_,k)=>used.has(i+k)))continue;
  const slice=words.slice(i,i+n);if(n===1&&(PLACE_STOP.has(slice[0])||slice[0].length<3||/^(?:am|an|auf|zum|zur|der|dem|hinter|vor|unter)$/.test(words[i-1]||'')))continue;
  let key=slice.join(' ');let hit=idx.get(key);
  if(!hit&&n===1&&key.includes('-'))hit=idx.get(key.split('-')[0]);
  if(!hit)continue;
  const top=Math.max(...hit.map(x=>x.score));let regions=hit.filter(x=>x.score===top).map(x=>x.r);
  if(regions.length>1&&wantKreis){const pref=regions.filter(r=>r.kind==='district');if(pref.length)regions=pref;}
  if(regions.length>1&&!wantKreis){const pref=regions.filter(r=>r.kind==='city');if(pref.length)regions=pref;}
  found.push({regions,matched:slice.join(' '),ambiguous:regions.length>1});for(let k=0;k<n;k++)used.add(i+k);
  if(found.length>=max)return found;
 }
 return found;
}

/* Thema: Rest der Frage ohne Füllwörter, Absichts-, Zeit-, Status- und Ortswörter; dazu die Sachgebiete, deren Wörter treffen. */
const FILLER=new Set(['beantragt','behandelt','diskutiert','beim','nimmt','als','wenn','geht','neue','neuen','neuer','steht','räten','kreises','durch','los','um','etwas','mitteilungen','anfragen','daten','portal','dabei','hast','habt','räte','kommt','kommen','seitdem','sich','sein','seine','seinem','seiner','ihre','ihrer','ihrem','unser','unsere','unserer','euch','dich','der','die','das','den','dem','des','ein','eine','einen','einem','einer','und','oder','aber','mit','von','vom','für','auf','aus','bei','nach','über','seit','bis','zum','zur','zu','in','im','an','am','ist','sind','war','waren','wird','werden','wurde','wurden','hat','haben','gibt','es','ich','du','sie','wir','ihr','mir','mich','uns','man','was','wie','wann','wo','wer','welche','welcher','welches','ob','dass','denn','noch','schon','bereits','auch','nur','sehr','mal','bitte','danke','hallo','hi','hey','lena','mein','meine','meinem','meiner','dort','hier','da','so','dazu','davon','darüber','etwas','alles','neues','aktuelles','aktuell','thema','themen','sache','sachen','vorgang','vorgänge','vorlage','vorlagen','beschluss','beschlüsse','antrag','anträge','sitzung','sitzungen','rat','ausschuss','gemeinde','stadt','kreis','kommune','region','gebiet','ort','jahr','jahre','monat','monate','woche','wochen','tag','tage','letzte','letzten','letzter','diese','diesem','dieser','dieses','diesen','gerade','zurzeit','derzeit','eigentlich','denn','doch','ja','nein','nicht','kein','keine','mehr','weniger','viel','viele','stand','status','dabei','daten','zeig','zeige','zeigen','finde','suche','such','liste','sag','sagen','gib','geben','bescheid','erzähl','erkläre','erklär','bedeutet','heißt','kostet','pro','basis','plenara','ratsmonitor','informier','informiere','benachrichtige','alarm','melde','vergleiche','vergleich','entwickelt','entwicklung','trend','zum','laufen','läuft','liegt','liegen','worden','geworden']);
export function parseTopic(text,{drop=[],dropWords=new Set()}={}){
 let t=' '+text.toLowerCase()+' ';
 for(const d of drop)if(d)t=t.replace(d.toLowerCase(),' ');
 if(dropWords.size)t=' '+t.split(/\s+/).filter(w=>!dropWords.has(norm(w.replace(/[?!.,;:]+$/,'')))).join(' ')+' ';
 for(const [,re] of INTENT_RULES)if(!re.source.includes('.{'))t=t.replace(new RegExp(re.source,'gi'),' ');
 const words=t.replace(/[^\p{L}\p{N}\- ]+/gu,' ').split(/\s+/).filter(w=>(w.length>=3||/^\d{2,}$/.test(w))&&!FILLER.has(w));
 const topic=words.join(' ');
 const labels=Object.entries(LABEL_WORDS).filter(([,ws])=>new RegExp(ws.join('|'),'i').test(topic)).map(([id])=>id);
 return {topic,labels};
}
export const labelName=id=>LABELS.find(l=>l.id===id)?.name||'';

/** @param {string} question @param {any[]} catalog */
export function parseQuestion(question,catalog,now=Date.now()){
 const q=String(question||'').normalize('NFKC').replace(/\s+/g,' ').trim().slice(0,200);
 const scores={};for(const [id,re,w] of INTENT_RULES)if(re.test(q))scores[id]=(scores[id]||0)+w;
 const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
 let intent=ranked.length&&ranked[0][1]>=2?ranked[0][0]:'';
 const time=parseTime(q,now),status=parseStatus(q);
 const places=findPlaces(q,catalog,{max:intent==='vergleich'?2:1});
 const {topic,labels}=parseTopic(q,{drop:[time?.matched,status?.matched],dropWords:new Set(places.flatMap(p=>p.matched.split(' ')))});
 /* Statuswort allein ist eine Standfrage; Hilfe ohne Ort und ohne Treffer bleibt Hilfe */
 if(!intent&&status)intent='stand';
 if(!intent)intent=topic||places.length?'suche':'';
 if(intent==='stand'&&!topic&&!status)intent='suche';
 const needsPlace=['abdeckung','vergleich'].includes(intent)&&places.length<(intent==='vergleich'?2:1);
 const ambiguous=places.find(p=>p.ambiguous)||null;
 return {version:LENA_VERSION,question:q,intent,scores,places,place:places[0]||null,time,status:status?.status||'',topic,labels,needsPlace,ambiguous};
}
