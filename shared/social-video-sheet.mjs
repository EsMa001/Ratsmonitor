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
/** Betrag: „241.000 €“, „241.000,- €“, „241.000,00 €“, auch „200.000,-“ ohne Eurozeichen */
const AMOUNT=/(\d{1,3}(?:\.\d{3})+|\d+)(?:,-(?:\s?(?:€|Euro))?|,00\s?(?:€|Euro)|\s?(?:€|Euro))/g;
const AMOUNT_LABELS=['Gesamtkosten','Kostenschätzung','Kosten','Förderung','Zuschuss','Zuwendung','Haushaltsmittel','Eigenanteil','Puffer'];
const SPOKEN_YEAR=/\b(19|20)\d{2}\b/g;
/** Text für die Stimme: Jahreszahlen und Beträge ausgeschrieben, „&“ und Kürzel ersetzt */
export function spoken(text){
 return String(text)
  .replace(AMOUNT,(_,n)=>spokenNumber(+n.replace(/\./g,''))+' Euro')
  .replace(/\b(\d+)\s?%/g,(_,n)=>spokenNumber(+n)+' Prozent')
  .replace(SPOKEN_YEAR,y=>spokenNumber(+y))
  .replace(/\bP&R\b/g,'Park und Ride').replace(/&/g,' und ').replace(/\bff\.?/g,'und folgende')
  .replace(/\s+/g,' ').trim();
}

const MAX_QUOTE=160;
const STRONG=/\b(beauftragt|beschließt|beschlossen|genehmigt|bestätigt|empfiehlt|zugestimmt|stimmt)\b/i;
const PROPOSAL=/\b(beschließt|empfiehlt|beauftragt|genehmigt|bestätigt|zugestimmt|beschlossen|vorgesehen|soll|sollen)\b|\b(?:wird|werden)\s+(?:\S+\s+){0,6}?(?:gestellt|beauftragt|eingestellt|vergeben|ausgeschrieben|errichtet|gebaut|umgesetzt|angelegt|erteilt|bewilligt|durchgeführt)\b/i;
const DECISION=/\b(bestätigt|beschließt|beschlossen|genehmigt|beauftragt|empfiehlt|stimmt|wird|werden|soll|sollen|ist vorgesehen)\b/i;
/** Auszug in Sätze zerlegen: an „[…]“ und an Satzenden (Satzende = Punkt, dann Leerzeichen und Großbuchstabe oder Anführungszeichen) */
const sentencesOf=t=>String(t||'').replace(/\s+/g,' ').split(/\s*\[…\]\s*|(?<=[.!?])(?<!\b\d{1,2}\.)(?<!\b(?:einschl|ggfls|ggf|bzw|ca|usw|Nr|Abs|Art|Zt|z|u|d|inkl|evtl|vgl|Std|Dr|Prof|Hr|Fr|ff|mind|max|insb|ggü|sog|zzgl|exkl)\.)\s+(?=[A-ZÄÖÜ„])/).map(x=>x.replace(/^„|“$/g,'').trim()).filter(x=>x.length>=25);
/** Zitat: wörtlich aus dem Auszug. Erster Entscheidungssatz (Kernsatz zuerst, dann Auszug) mit höchstens 160 Zeichen; ist er länger,
 *  wird er vor einem Bindewort gekürzt und mit „[…]“ beendet. Nichts wird umformuliert. */
export function pickQuote(summary,exclude=[]){return pickQuoteFull(summary,exclude)?.text||null;}
export function pickQuoteFull(summary,exclude=[]){
 const list=[...sentencesOf(summary?.short),...sentencesOf(summary?.long)];
 const same=(a,b)=>a.slice(0,40)===b.slice(0,40);
 const dec0=list.filter(x=>DECISION.test(x)&&!exclude.some(e=>same(x,e))),dec=[...dec0.filter(x=>STRONG.test(x)),...dec0.filter(x=>!STRONG.test(x))],first=dec[0];
 if(!first)return null;
 const R=text=>({text,src:first});
 if(first.length<=MAX_QUOTE)return R(first);
 // zu lang: zuerst einen langen Satzanfang vor dem Entscheidungsverb (Gremiumsname) mit […] auslassen, damit der Beschluss selbst vollständig bleibt
 const sv=first.match(STRONG);
 if(sv&&sv.index>45&&!/;|\b(?:wird|werden|ist|sind)\b/.test(first.slice(0,sv.index))){const cand=first.slice(0,sv.index).trim().split(/\s+/).slice(0,2).join(' ')+' […] '+first.slice(sv.index);if(cand.length<=MAX_QUOTE)return R(cand);}
 // dann nach dem ersten Komma hinter einem Verb kürzen („… wird gestellt […]“), wenn der Satzteil davor ein Verb enthält
 const comma=[...first.matchAll(/,\s/g)].map(m=>m.index).find(i=>i>=60&&i<=MAX_QUOTE-6);
 if(comma&&/\b(?:wird|werden|empfiehlt|beschließt|beauftragt|bestätigt|genehmigt|soll|sollen)\b/.test(first.slice(0,comma)))return R(first.slice(0,comma)+' […]');
 const head=first.slice(0,MAX_QUOTE-4),cut=[...head.matchAll(/\s(?:als|zum|zur|und|für|insbesondere|sowie|gemäß)\s/g)].at(-1);
 if(cut&&cut.index>60){let t=head.slice(0,cut.index).replace(/[,;]$/,'');while(/\s(?:und|oder|die|der|das|den|dem|des|ein|eine|zu|zur|zum|mit|für|von|im|in|an|auf|nach|bei|als|sowie)$/i.test(t))t=t.replace(/\s\S+$/,'');return R(t+' […]');}
 const alt=dec.find(x=>x.length<=MAX_QUOTE);return alt?{text:alt,src:alt}:null;
}
/** Titel für Zeile 2: Teil vor „ - “ oder „:“, ohne „der Stadt/Landeshauptstadt <Ort>“ und ohne den Ortsnamen; höchstens 34 Zeichen, sonst null */
export function shortTitle(title,regionName){
 let t=String(title||'').split(/\s+[-–]\s+|:\s/)[0];
 t=t.replace(/^(?:Beratung und )?(?:Beschlussfassung|Beschluss)(?:\s+(?:über|zu|zur|zum))?\s+(?:(?:den|die|das|der|dem)\s+)?/i,'');
 const ort=regionName.replace(/^(Stadt|Gemeinde|Kreis|Landkreis)\s+/,'');
 t=t.replace(new RegExp(`\\s+(?:der|des)\\s+(?:Stadt|Landeshauptstadt|Gemeinde|Hansestadt)\\s+${ort}`,'gi'),'').replace(new RegExp(`\\b${ort}\\b`,'g'),'');
 t=t.replace(/\s+/g,' ').replace(/^[\s:,-]+|[\s:,-]+$/g,'');
 if(t.length>34){const m=t.match(/^(.+?)\s+(?:für|zur|zum|zu|im|in)\s+(.*)$/);
  if(m){const yr=(m[2].match(/\b(20\d{2})\b/)||[])[1];const c=yr&&!m[1].includes(yr)?`${m[1]} ${yr}`:m[1];if(c.length<=34)t=c;}}
 return t&&t.length<=34?t[0].toUpperCase()+t.slice(1):null;
}

/**
 * @param {{title:string,status?:string,committee?:string,events?:{date:string,committee:string}[],ruleSummary?:{short?:string},theme?:{id?:string}}} topic
 * @param {{regionName:string,today:string,titleShort?:string}} o  titleShort: gekürzter Titel (höchstens 34 Zeichen) für Zeile 2
 */
export function videoSheet(topic,{regionName,today,titleShort,kommune}){
 const warnings=[],st=STATUS[topic.status]||STATUS.unknown;
 if(!STATUS[topic.status])warnings.push(`Status „${topic.status}“ unbekannt, gelesen als „Stand offen“`);
 const ortName=regionName.replace(/^(Stadt|Gemeinde|Verbandsgemeinde|Kreis|Landkreis)\s+/,'');
 const cleanC=c=>String(c||'').replace(new RegExp(`\\s+(?:(?:Stadt|Gemeinde|Verbandsgemeinde)\\s+)?${ortName}$`),'').trim();
 const STATUSWORT=/^(stand offen|in beratung|beschlossen|abgelehnt|angekündigt|vertagt|empfehlung|zur kenntnis)$/i;
 const seen=new Set();
 const events=(topic.events||[]).filter(e=>/^\d{4}-\d\d-\d\d$/.test(e.date||'')).map(e=>({...e,committee:cleanC(e.committee),result:STATUSWORT.test(String(e.result||'').trim())?null:e.result}))
  .filter(e=>{const k=e.date+'|'+e.committee;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>a.date.localeCompare(b.date));
 const past=events.filter(e=>e.date<=today),future=events.filter(e=>e.date>today);
 const last=past.at(-1)||null,next=future[0]||null,before=past.length>1?past.at(-2):null;
 if(!last)warnings.push('keine beratene Sitzung');
 const q1=pickQuoteFull(topic.ruleSummary),quote=q1?.text||null;
 const norm=x=>String(x||'').toLowerCase().replace(/[^a-zäöüß0-9]+/g,' ').trim();
 if(!quote)warnings.push('kein Zitat (Auszug fehlt oder zu lang)');
 else if(norm(quote)===norm(topic.title)||norm(topic.title).startsWith(norm(quote)))warnings.push('Zitat wiederholt nur den Titel');
 const t2=(titleShort||shortTitle(topic.title,regionName)||'').trim();
 if(!t2)warnings.push(topic.title?'Titel lässt sich nicht auf 34 Zeichen kürzen':'kein Titel');
 else if(t2.length>34)warnings.push(`Titelzeile 2 hat ${t2.length} Zeichen (höchstens 34): Kurzform fehlt`);
 const proposal=!['approved','rejected'].includes(topic.status);
 const amounts=[];
 const quote2=q1?pickQuote(topic.ruleSummary,[q1.src]):null;
 [quote,quote2].forEach((src,qi)=>{if(!src)return;let from=0;for(const m of src.matchAll(AMOUNT)){
  const before=src.slice(from,m.index),after=src.slice(m.index+m[0].length,m.index+m[0].length+30),hit=AMOUNT_LABELS.map(k=>({k,i:before.lastIndexOf(k)})).filter(x=>x.i>=0).sort((a,b)=>b.i-a.i)[0];
  const value=+m[1].replace(/\./g,'');from=m.index+m[0].length;
  let label=hit?hit.k:null;
  if(label){const pre=before.slice(0,hit.i).trim().split(/\s+/).at(-1)||'';
   if(/^(voraussichtlich|geschätzt|geplant|erwartet)\w*$/i.test(pre))label=pre[0].toUpperCase()+pre.slice(1)+' '+label;
   else if(/^\s*geschätzt/.test(after)&&/kosten/i.test(label))label='Geschätzte '+label;}
  if(!amounts.some(a=>a.value===value))amounts.push({text:m[1]+' €',value,spoken:spokenNumber(value)+' Euro',label,inZitat:qi===0});}});
 const days=next?Math.round((Date.UTC(...next.date.split('-').map((x,i)=>i===1?+x-1:+x))-Date.UTC(...today.split('-').map((x,i)=>i===1?+x-1:+x)))/864e5):null;
 // Sprechtext
 const w=s=>s.split(/\s+/).length,place=regionName;
 // Hook: Standwort gleich im ersten Satz („Beschlossen in Dresden: Hitzeaktionsplan …“), so schlägt der Stempel in der ersten Sekunde ein
 const hw=st.word==='Zur Kenntnis'?'Zur Kenntnis genommen':st.word;
 const hook=`${hw} in ${place}: ${spoken(t2)}.`;
 const stand=[st.word==='Stand offen'?'Stand offen.':`${st.spokenWord[0].toUpperCase()+st.spokenWord.slice(1)}.`,st.spokenExtra,
  last?`Zuletzt beraten: ${last.committee}, am ${spokenDate(last.date)}.`:null,
  next?`Nächste Sitzung: ${next.committee}, am ${spokenDate(next.date)}.`:null].filter(Boolean).join(' ');
 const kern=quote?spoken(quote):null;
 const verlauf=past.slice(-3).map(e=>({date:e.date,datum:shortDate(e.date),committee:e.committee,result:String(e.result||'').trim()||null,spokenDay:spokenDay(+e.date.slice(8)),spoken:`Am ${spokenDate(e.date)}, ${e.committee}${e.result?': '+spoken(String(e.result).trim()):''}.`}));
 const verlaufText=verlauf.length?'Bisher: '+verlauf.map(v=>v.spoken).join(' '):null;
 const meta=[last&&`${last.committee} · zuletzt beraten am ${shortDate(last.date)}`,
  next?`${next.committee} · nächste Sitzung ${shortDate(next.date)}`:before?`Davor: ${before.committee} · ${shortDate(before.date)}`:null].filter(Boolean);
 return {version:SHEET_VERSION,ok:!warnings.length,warnings,
  ort:regionName,titel1:`${regionName}:`,titel2:t2,
  stand:{word:st.word,stamp:st.stamp,icon:st.icon,extra:st.extra,statusKey:STATUS[topic.status]?topic.status:'unknown'},
  zitat:quote,zitat2:quote2,verlauf,themaIcon:THEME_ICON[topic.theme?.id]||'pin',zitatHinweis:proposal&&quote&&PROPOSAL.test(quote)?'Vorschlag aus der Vorlage':'Aus der Vorlage',
  betraege:amounts,naechste:next?{committee:next.committee,datum:shortDate(next.date),tage:days}:null,meta,
  quelle:`Quelle: öffentliche Ratsunterlagen der ${kommune||`Stadt ${regionName}`}`,
  sprechtext:{1:hook,2:kern,3:verlaufText,4:'',5:stand,6:'Beschlüsse und Unterlagen zu Ihrem Ort finden Sie bei Plenara.'}};
}
