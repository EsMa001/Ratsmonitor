// Datenblatt und Sprechtext für ein Social-Video aus einem Bericht (Bauplan: docs/social/video-bauplan.md, Abschnitte 3, 7 und 8).
// Reine Funktion ohne Datenbank: liest nur, was im Bericht steht (Status, Gremien, Sitzungen, Auszug), und setzt feste Satzvorlagen ein.
// Nichts wird frei formuliert; fehlt etwas, steht es in `warnings` und das Video wird nicht gebaut (`ok: false`).

export const SHEET_VERSION='sheet-v1';

/** Wörter und Zusatzzeilen genau wie in Plenara (Bauplan, Abschnitt 5) */
export const STATUS={
 approved:{word:'Beschlossen',stamp:'BESCHLOSSEN',icon:'check',spokenWord:'beschlossen',extra:null,spokenExtra:null},
 rejected:{word:'Abgelehnt',stamp:'ABGELEHNT',icon:'cross',spokenWord:'abgelehnt',extra:null,spokenExtra:null},
 announced:{word:'Angekündigt',stamp:'ANGEKÜNDIGT',icon:'calendar',spokenWord:'angekündigt',extra:'Noch nicht beschlossen',spokenExtra:'Noch kein Beschluss.'},
 consulting:{word:'In Beratung',stamp:'IN BERATUNG',icon:'hourglass',spokenWord:'In Beratung',extra:'Noch nicht beschlossen',spokenExtra:'Noch kein Beschluss.'},
 recommended:{word:'Empfehlung',stamp:'EMPFEHLUNG',icon:'hourglass',spokenWord:'Empfehlung',extra:'Noch nicht beschlossen',spokenExtra:'Noch kein Beschluss.'},
 postponed:{word:'Vertagt',stamp:'VERTAGT',icon:'hourglass',spokenWord:'vertagt',extra:'Noch nicht entschieden',spokenExtra:'Noch keine Entscheidung.'},
 info:{word:'Zur Kenntnis',stamp:'ZUR KENNTNIS',icon:'doc',spokenWord:'zur Kenntnis',extra:'Keine Sachentscheidung',spokenExtra:'Keine Sachentscheidung.'},
 unknown:{word:'Stand offen',stamp:'STAND OFFEN',icon:'hourglass',spokenWord:'offen',extra:'Noch nicht beschlossen',spokenExtra:'Noch kein Beschluss.'},
};

/** Themen-Icon im Hook (Bauplan, Icon-Katalog); unbekannt: Pin */
export const THEME_ICON={bauen:'house',finanzen:'coin',mobilitaet:'road',bildung:'child',umwelt:'sun',soziales:'heart',kultur:'hall',sicherheit:'pin',verwaltung:'doc',wirtschaft:'coin'};
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const ONES=['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
const TENS=['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'];

/** Zahl als gesprochenes Wort (0 bis 999.999.999), für Jahre, Beträge und Nummern */
export function spokenNumber(n){
 n=Math.floor(n);
 if(n<20)return ONES[n];
 if(n<100){const o=n%10,t=TENS[Math.floor(n/10)];return o?(o===1?'ein':ONES[o])+'und'+t:t;}
 if(n<1000){const h=Math.floor(n/100),r=n%100;return (h===1?'einhundert':ONES[h]+'hundert')+(r?spokenNumber(r):'');}
 if(n<1e6){const k=Math.floor(n/1000),r=n%1000;return (k===1?'eintausend':spokenNumber(k)+'tausend')+(r?spokenNumber(r):'');}
 const m=Math.floor(n/1e6),r=n%1e6;return (m===1?'eine Million ':spokenNumber(m)+' Millionen ')+(r?spokenNumber(r):'').trim();
}
const ORD_SPECIAL={1:'ersten',2:'zweiten',3:'dritten',7:'siebten',8:'achten'};
/** „13“ → „dreizehnten“ (für „am dreizehnten Oktober“) */
export const spokenDay=d=>ORD_SPECIAL[d]||(d<20?spokenNumber(d)+'ten':spokenNumber(d)+'sten');
export const spokenDate=iso=>{const [,m,d]=iso.split('-').map(Number);return `${spokenDay(d)} ${MONTHS[m-1]}`;};
const shortDate=iso=>{const [y,m,d]=iso.split('-');return `${d}.${m}.${y.slice(2)}`;};
const SPOKEN_YEAR=/\b(19|20)\d{2}\b/g;
/** Text für die Stimme: Jahreszahlen und Beträge ausgeschrieben, „&“ und Kürzel ersetzt */
export function spoken(text){
 return String(text)
  .replace(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,-|,00)?\s?(?:€|Euro)/g,(_,n)=>spokenNumber(+n.replace(/\./g,''))+' Euro')
  .replace(/\b(\d+)\s?%/g,(_,n)=>spokenNumber(+n)+' Prozent')
  .replace(SPOKEN_YEAR,y=>spokenNumber(+y))
  .replace(/\bP&R\b/g,'P und R').replace(/&/g,' und ').replace(/\bff\.?/g,'und folgende')
  .replace(/\s+/g,' ').trim();
}

const MAX_QUOTE=160;
const DECISION=/\b(bestätigt|beschließt|beschlossen|genehmigt|beauftragt|empfiehlt|stimmt|wird|werden|soll|sollen|ist vorgesehen)\b/i;
/** Auszug in Sätze zerlegen: an „[…]“ und an Satzenden (Satzende = Punkt, dann Leerzeichen und Großbuchstabe oder Anführungszeichen) */
const sentencesOf=t=>String(t||'').replace(/\s+/g,' ').split(/\s*\[…\]\s*|(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/).map(x=>x.replace(/^„|“$/g,'').trim()).filter(x=>x.length>=25);
/** Zitat: wörtlich aus dem Auszug. Erster Entscheidungssatz (Kernsatz zuerst, dann Auszug) mit höchstens 160 Zeichen; ist er länger,
 *  wird er vor einem Bindewort gekürzt und mit „[…]“ beendet. Nichts wird umformuliert. */
export function pickQuote(summary,exclude=[]){
 const list=[...sentencesOf(summary?.short),...sentencesOf(summary?.long)];
 const same=(a,b)=>a.slice(0,40)===b.slice(0,40);
 const dec=list.filter(x=>DECISION.test(x)&&!exclude.some(e=>same(x,e))),first=dec[0];
 if(!first)return null;
 if(first.length<=MAX_QUOTE)return first;
 const head=first.slice(0,MAX_QUOTE-4),cut=[...head.matchAll(/\s(?:als|zum|zur|und|für|insbesondere|sowie|gemäß)\s/g)].at(-1);
 if(cut&&cut.index>60)return head.slice(0,cut.index).replace(/[,;]$/,'')+' […]';
 return dec.find(x=>x.length<=MAX_QUOTE)||null;
}
/** Titel für Zeile 2: Teil vor „ - “ oder „:“, ohne „der Stadt/Landeshauptstadt <Ort>“ und ohne den Ortsnamen; höchstens 34 Zeichen, sonst null */
export function shortTitle(title,regionName){
 let t=String(title||'').split(/\s+[-–]\s+|:\s/)[0];
 const ort=regionName.replace(/^(Stadt|Gemeinde|Kreis|Landkreis)\s+/,'');
 t=t.replace(new RegExp(`\\s+(?:der|des)\\s+(?:Stadt|Landeshauptstadt|Gemeinde|Hansestadt)\\s+${ort}`,'gi'),'').replace(new RegExp(`\\b${ort}\\b`,'g'),'');
 t=t.replace(/\s+/g,' ').replace(/^[\s:,-]+|[\s:,-]+$/g,'');
 return t&&t.length<=34?t:null;
}
const AMOUNT=/(\d{1,3}(?:\.\d{3})+|\d+)(?:,-|,\d{2})?\s?(?:€|Euro)/g;

/**
 * @param {{title:string,status?:string,committee?:string,events?:{date:string,committee:string}[],ruleSummary?:{short?:string},theme?:{id?:string}}} topic
 * @param {{regionName:string,today:string,titleShort?:string}} o  titleShort: gekürzter Titel (höchstens 34 Zeichen) für Zeile 2
 */
export function videoSheet(topic,{regionName,today,titleShort}){
 const warnings=[],st=STATUS[topic.status]||STATUS.unknown;
 if(!STATUS[topic.status])warnings.push(`Status „${topic.status}“ unbekannt, gelesen als „Stand offen“`);
 const events=(topic.events||[]).filter(e=>/^\d{4}-\d\d-\d\d$/.test(e.date||'')).sort((a,b)=>a.date.localeCompare(b.date));
 const past=events.filter(e=>e.date<=today),future=events.filter(e=>e.date>today);
 const last=past.at(-1)||null,next=future[0]||null,before=past.length>1?past.at(-2):null;
 if(!last)warnings.push('keine beratene Sitzung');
 const quote=pickQuote(topic.ruleSummary);
 const norm=x=>String(x||'').toLowerCase().replace(/[^a-zäöüß0-9]+/g,' ').trim();
 if(!quote)warnings.push('kein Zitat (Auszug fehlt oder zu lang)');
 else if(norm(quote)===norm(topic.title)||norm(topic.title).startsWith(norm(quote)))warnings.push('Zitat wiederholt nur den Titel');
 const t2=(titleShort||shortTitle(topic.title,regionName)||'').trim();
 if(!t2)warnings.push(topic.title?'Titel lässt sich nicht auf 34 Zeichen kürzen':'kein Titel');
 else if(t2.length>34)warnings.push(`Titelzeile 2 hat ${t2.length} Zeichen (höchstens 34): Kurzform fehlt`);
 const proposal=!['approved','rejected'].includes(topic.status);
 const amounts=quote?[...quote.matchAll(AMOUNT)].map(m=>({text:m[1]+' €',spoken:spokenNumber(+m[1].replace(/\./g,''))+' Euro'})):[];
 // Sprechtext
 const w=s=>s.split(/\s+/).length,place=regionName;
 let hook=null;
 for(const f of [`${place}: ${spoken(t2)}. Stand: ${st.spokenWord}.`,`${place}: ${spoken(t2)}. Der Stand ist ${st.spokenWord}.`,`${place}: ${spoken(t2)}. Der aktuelle Stand ist ${st.spokenWord}.`]){
  const before=f.slice(0,f.lastIndexOf(st.spokenWord.split(' ')[0])).trim(),pos=(before?w(before):0)+1; // Position des Standworts
  if(pos>=5&&pos<=8){hook=f;break;}
 }
 if(!hook){hook=`${place}: ${spoken(t2)}. Der Stand ist ${st.spokenWord}.`;warnings.push('Standwort nicht als 5. bis 8. Wort der Hook-Szene');}
 const stand=[st.word==='Stand offen'?'Stand offen.':`${st.spokenWord[0].toUpperCase()+st.spokenWord.slice(1)}.`,st.spokenExtra,
  last?`Zuletzt beraten: ${last.committee}, am ${spokenDate(last.date)}.`:null,
  next?`Nächste Sitzung: ${next.committee}, ${spokenDate(next.date)}.`:null].filter(Boolean).join(' ');
 const kern=quote?spoken(quote):null;
 const quote2=quote?pickQuote(topic.ruleSummary,[quote.replace(/ \[…\]$/,'')]):null;
 const verlauf=past.slice(-3).map(e=>({date:e.date,datum:shortDate(e.date),committee:e.committee,result:String(e.result||'').trim()||null,spokenDay:spokenDay(+e.date.slice(8)),spoken:`Am ${spokenDate(e.date)}, ${e.committee}${e.result?': '+spoken(String(e.result).trim()):''}.`}));
 const verlaufText=verlauf.length?'Bisher: '+verlauf.map(v=>v.spoken).join(' '):null;
 const meta=[last&&`${last.committee} · zuletzt beraten am ${shortDate(last.date)}`,
  next?`${next.committee} · nächste Sitzung ${shortDate(next.date)}`:before?`Davor: ${before.committee} · ${shortDate(before.date)}`:null].filter(Boolean);
 return {version:SHEET_VERSION,ok:!warnings.length,warnings,
  ort:regionName,titel1:`${regionName}:`,titel2:t2,
  stand:{word:st.word,stamp:st.stamp,icon:st.icon,extra:st.extra,statusKey:STATUS[topic.status]?topic.status:'unknown'},
  zitat:quote,zitat2:quote2,verlauf,themaIcon:THEME_ICON[topic.theme?.id]||'pin',zitatHinweis:proposal?'Vorschlag aus der Vorlage':'Aus der Vorlage',
  betraege:amounts,meta,
  quelle:`Quelle: öffentliche Ratsunterlagen der Stadt ${regionName}`,
  sprechtext:{1:hook,2:kern,3:verlaufText,4:'',5:stand,6:'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'}};
}
