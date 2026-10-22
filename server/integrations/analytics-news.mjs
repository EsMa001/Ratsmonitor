import {source,xState,PLACEHOLDER} from './plenara-x-query.mjs';
import {outcomeOf,NO_RESULT} from '../../shared/vote-result.mjs';
import {parseDecisions} from './analytics-decisions.mjs';
import {AnalyticsError} from './analytics-diffusion.mjs';
import {factsReady} from './analytics-factions.mjs';
import {cleanTitle,evidenceOf} from './social-topics.mjs';
import {subRate} from './social-model.mjs';
import {subtopicName} from '../../shared/themes.mjs';
import {where} from './member-place.mjs';

/*
 * Plenara.X – Newsradar: berichtenswerte Vorgänge der letzten 30 und nächsten 10 Tage (dieselben Filter wie die Suche),
 * nach Nachrichtenwert geordnet, je Vorgang eine Meldung im Agenturstil. Status, Unterthemen, Vorgangsart, Schritt und Antragsteller
 * aus dem Modell (seit 22.10.2026); Richtung „Erhöhung/Senkung“ und Abstimmungsart werden wörtlich aus Titel und Ergebnis gelesen. Ortsmarke,
 * Gremium und Datum aus den Sitzungen, der Kern nur aus wörtlichen Sätzen der Regel-Zusammenfassung (als Zitat), dazu
 * Fakten aus topic_facts (Fraktion, Förderung, Kita-Beiträge, Bauleitplanung), Unterthemen und „Was geschieht“ aus report_rules
 * (Gebühren, Haushaltssicherung, Steuern), Petitionen und Einwohneranträge aus dem Titel. Wohnungszahlen sind wie in der
 * Bauleitplanung ausgeblendet (zu oft Hintergrundwerte). Bei Gemeindeverbänden ist die Ortsmarke die Mitgliedsgemeinde,
 * deren Rat berät oder die der Titel nennt (where() wie in den Radaren).
 * Zwei Stufen: erst alle Vorgänge des Zeitraums (source(), x_cases) mit topic_facts vorbewerten (ohne Payload), dann nur für
 * die besten CANDIDATES die Berichte lesen (Abstimmungsergebnis, Zusammenfassung, Sitzungen) und die Meldung bauen.
 * Nachrichtenwert: Konflikt (abgelehnt, vertagt, nur mehrheitlich), Tragweite (Förderung, Beiträge, Gebühren,
 * Bürgerbegehren), Alltagsnähe (Stichwörter aus social-topics), Aktualität; ohne zitierbaren Kern deutlich weniger.
 * Höchstens PER_REGION Meldungen je Gebiet, damit nicht ein Ort die Liste füllt; bei wenigen Gebieten (eine Gemeinde, ein
 * kleiner Kreis) entsprechend mehr, sodass die Liste voll werden kann.
 */
const BACK=30,SPANS=[30,90,365],AHEAD=10,CANDIDATES=300,PER_REGION=2,DEFAULT_N=12,MAX_N=30;
// Förderung gibt es seit 15.10.2026 nicht mehr als Fakt (Stand bewilligt/beantragt war nur 36–64 % richtig)
// Fraktion aus x_cases (factions), die übrigen aus topic_facts über die Karten des Vorgangs
// Seit 22.10.2026 Schritt (Satzungsbeschluss) und Antragsteller (Einwohner) aus dem Modell (model_labels), nicht aus Fakt und Titel
const FACT_KINDS=['kita_fee'];
/* Signale aus readReport (report_rules, Migration 0035): Unterthemen und „Was geschieht“; Richtung und Art aus dem Titel */
const UP=/Erhöhung|Anhebung|erhöht|angehoben/i,DOWN=/Senkung|gesenkt|Reduzierung|Absenkung/i;
const day=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
// Personal- und Besetzungsfragen der Gremien sind keine Meldung (Formalien, die „Formalien ausblenden“ nicht erfasst)
const NOT_NEWS=/Schriftführ|Bestellung (einer|eines|des|der) |Wahl (der|des|eines|einer) (stellvertretend|Vorsitz|Mitglied|Schrift|sachkundig)|Benennung (von|der|des|eines|einer) |Besetzung (von|der|des) |Nachbesetzung|Umbesetzung|Ausschussumbesetzung/i;
// Reste aus dem PDF (Seitenzähler, Kopfzeilen) machen einen Satz unzitierbar
const PDF_NOISE=/Seite\s*-?\s*\d+\s*-?\s*(von\s*\d+)?|^\s*-\s*\d+\s*-|Drucksache|DS Seite|Vorlage\s*(Nr\.?|Nummer)|Sitzungsvorlage|Beratungsfolge|☐|☒/i;
export const PARTY={'CDU/CSU':'der CDU-Fraktion','SPD':'der SPD-Fraktion','Grüne':'der Fraktion der Grünen','FDP':'der FDP-Fraktion','AfD':'der AfD-Fraktion','Linke':'der Fraktion Die Linke','Freie Wähler und Wählergruppen':'einer Wählergemeinschaft','Volt':'der Volt-Fraktion','BSW':'der BSW-Fraktion','ÖDP':'der ÖDP-Fraktion','Die PARTEI':'der Fraktion Die PARTEI'};
// Ein Format für alle und je Tag einmal: ein neues Intl.DateTimeFormat je Aufruf kostete bei allen Vorgängen eines Zeitraums ¼ s
const LONG_DAY=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}),longDays=new Map();
const longDay=d=>{const k=d.slice(0,10);let v=longDays.get(k);if(v===undefined){v=LONG_DAY.format(new Date(k+'T12:00:00Z'));longDays.set(k,v);}return v;};

/** Ortsangabe: Genitiv („der Stadt Coesfeld“) und kurz („Coesfeld“) */
export function place(name){
 const n=String(name||'');if(/^Kreis /.test(n))return {gen:'des Kreises '+n.slice(6),short:'Kreis '+n.slice(6)};
 const m=n.match(/^(Stadt|Gemeinde|Hansestadt|Landeshauptstadt|Samtgemeinde|Verbandsgemeinde|Ortsgemeinde|Marktgemeinde|Markt) (.+)$/);
 return m?{gen:`der ${m[1]} ${m[2]}`,short:m[2]}:{gen:n,short:n};
}
/** Gremium mit Artikel; ohne Ortsnamen im Namen mit Ort im Genitiv */
export function organ(committee,ort){
 const name=String(committee||'').trim();if(!name||/^Gremium\b|laut Originalquelle/i.test(name))return {nom:'Ein Gremium',dat:'einem Gremium'};
 const fem=/^(Bezirksvertretung|Kommission|Versammlung|Gemeindevertretung|Stadtverordnetenversammlung|Konferenz|Stadtvertretung)/i.test(name)||/(vertretung|kommission|versammlung|konferenz)$/i.test(name);
 const first=ort.short.split(/[ /(]/)[0];
 // „Haupt- und Finanzausschuss Verbandsgemeinde“ + „der Verbandsgemeinde Rodalben“: die Art nicht doppelt nennen
 const full=first&&name.toLowerCase().includes(first.toLowerCase())?name:`${name.replace(/\s+(Verbandsgemeinde|Samtgemeinde|Ortsgemeinde|Gemeinde|Stadt|Kreis|Amt)$/,'')} ${ort.gen}`;
 return fem?{nom:'Die '+full,dat:'der '+full}:{nom:'Der '+full,dat:'dem '+full};
}
/** Zitierfähiger Satz: ganzer Satz, kein Verweis auf Anlagen, ohne PDF-Reste und vorangestellten Betreff */
// Aufzählungsreste am Anfang („I3)“, „a)“, „Alternative 1 –“) und Tabellenzeilen („Std./72,10 €“, mehrere Beträge)
const FRAGMENT=/^\s*([A-Za-z]{0,2}\d{0,2}\)|[IVX]+\.|\d+\.\s|Alternative\s+\d|Variante\s+\d|Option\s+\d)|Std\.\/|\/\s*\d+,\d{2}\s*€|\s\|\s/;
const amounts=t=>(t.match(/\d\s*(?:€|Euro|EUR)\b/g)||[]).length;
export function quotable(x){
 const t=String(x||'').replace(/^.*?Beschlussvorschlag:\s*/i,'').replace(/^Betreff:?\s+/i,'').replace(/\s+/g,' ').trim();
 return /[.!?“”"]$/.test(t)&&!/verwiesen|als Anlage|siehe Anlage|s\.\s*Anlage|\(Anlage|Anlage\s*\d|beigefügt|anliegend/i.test(t)&&!PDF_NOISE.test(t)&&!FRAGMENT.test(t)&&amounts(t)<3&&t.length>40&&t.length<600?t:null;
}

// Ausgang einer Sitzung: eine Regel für Newsradar, Social Media und plenara.X Beschlüsse (shared/vote-result.mjs)
export {outcomeOf,NO_RESULT};
const STATUS_OUTCOME={approved:'beschlossen',rejected:'abgelehnt',postponed:'vertagt',info:'zur Kenntnis genommen',recommended:'empfohlen'};

/** Nachrichtenwert ohne Bericht (Stufe 1): Status, Fakten, Stichwörter, Datum */
function prescore(c,facts,today,week){
 const why=[];let score=0;const add=(n,text)=>{score+=n;why.push(text);};
 if(c.status==='rejected')add(25,'abgelehnt');else if(c.status==='postponed')add(15,'vertagt');
 const party=facts.filter(x=>x.kind==='faction');if(party.length)add(8,`Antrag ${party.map(p=>p.value).join(' und ')}`);
 const fee=facts.find(x=>x.kind==='kita_fee');if(fee&&fee.value!=='Neufassung')add(18,`Kita-Beiträge: ${fee.value}`);
 const t=c.title||'',subs=','+(c.subs||'')+',',raise=UP.test(t)&&!/\bkeine[nr]?\s+(Erhöhung|Anhebung)|nicht\s+(zu\s+)?erhöh/i.test(t);
 if((c.stage==='abgaben'||c.stage==='money')&&!subs.includes(',finanzen.steuer,')&&(raise||DOWN.test(t)))add(14,`Gebühren-${raise?'Erhöhung':'Senkung'}`);
 if(subs.includes(',finanzen.hsk,'))add(8,'Haushaltssicherung');
 if(subs.includes(',finanzen.steuer,')&&raise)add(12,'Steuererhöhung');
 if(String(c.appl||'').includes('"residents"'))add(12,'Antrag aus der Einwohnerschaft');
 if(c.step==='beschluss'&&subs.includes(',bauen.plan,'))add(8,'Bebauungsplan vor dem Satzungsbeschluss');
 // Streitthema: Unterthema des Modells mit deutlich höherer Streitquote als im Mittel (shared/social-calibration-model.json)
 const hot=String(c.subs||'').split(',').filter(Boolean).map(u=>({u,...subRate(u)})).filter(r=>r.n>=15&&r.rate>=r.base+0.08).sort((a,b)=>b.rate-a.rate)[0];
 if(hot)add(10,`Streitthema: ${subtopicName(hot.u)}`);
 // Titel ohne Gegenstand („Anregung“, „Antrag“) ergeben keine verständliche Überschrift
 const ct=cleanTitle(c.title||'',200);if(ct.length<20||/^(und|oder|sowie|bzw\.?|der|die|das|des|dem|den)\s/i.test(ct))add(-15,'Titel ohne Gegenstand');
 if(c.date>today)add(6,`steht am ${longDay(c.date)} an`);else if(c.date>=week)add(10,'in den letzten sieben Tagen');
 return {score,why};
}

/** Meldung im Agenturstil aus einem bewerteten Vorgang */
export function article({card,topic,facts,sentences,more,today,regionName,member=null}){
 /* ort: Gebiet des Ratsinformationssystems (Gremien, Quelle); mark: Ortsmarke, bei Verbänden die Mitgliedsgemeinde */
 const ort=place(regionName),mark=member?place(member):ort,all=[...(topic.events||[])].filter(e=>e?.date).sort((a,b)=>a.date.localeCompare(b.date));
 /* Platzhalter-Gremien neben einem benannten am selben Tag und doppelte Einträge zählen nicht */
 const seen=new Set(),events=all.filter(e=>{const d=e.date.slice(0,10),k=d+'|'+(e.committee||'');if(seen.has(k))return false;seen.add(k);
  return !(PLACEHOLDER.test(e.committee||'')&&all.some(x=>x!==e&&x.date.slice(0,10)===d&&!PLACEHOLDER.test(x.committee||'')));});
 const title=cleanTitle(topic.officialTitle||topic.title||card.title,200);
 /* Der erste Satz der Zusammenfassung wiederholt oft den Titel: ihn im Zitat weglassen */
 const raw=String(topic.officialTitle||topic.title||'').trim();
 const quote=sentences.map(x=>raw.length>10&&x.startsWith(raw)?x.slice(raw.length).replace(/^[\s.:;–-]+/,''):x).filter(x=>x.length>40);
 const cur=events.filter(e=>e.date.slice(0,10)<=today).at(-1)||events[0]||{date:card.date,committee:card.gremium};
 const next=events.find(e=>e.date.slice(0,10)>today);
 const o=organ(cur.committee||card.gremium,ort),past=cur.date.slice(0,10)<=today,when=longDay(cur.date);
 /* Ausgang nur der genannten Sitzung (ein „abgelehnt“ im Ortschaftsrat ist kein Beschluss des Rats); der Status des Vorgangs
    gilt nur, wenn diese Sitzung die letzte ist */
 const last=!events.some(e=>e.date.slice(0,10)>cur.date.slice(0,10));
 // Eine künftige Sitzung hat noch keinen Ausgang; hat eine Vorberatung abgelehnt, stammt ein „abgelehnt“ im Status von dort
 const outcome=!past?null:outcomeOf(cur.result)||outcomeOf(cur.description)||(last&&!events.some(e=>e.date.slice(0,10)<cur.date.slice(0,10)&&(outcomeOf(e.result)||outcomeOf(e.description))==='abgelehnt')?STATUS_OUTCOME[card.status]||null:null);
 const parties=facts.filter(x=>x.kind==='faction').map(p=>PARTY[p.value]||`der Fraktion ${p.value}`);
 const what=parties.length?`einen Antrag ${parties.join(' und ')}`:'die Vorlage';
 const low=x=>x.replace(/^Der /,'der ').replace(/^Die /,'die ').replace(/^Ein /,'ein ');
 // Datum mit Wochentag als Einschub: „am Mittwoch, 30. September, beschlossen“
 const lead=past?(outcome==='zurückgezogen'?`${o.nom} hat am ${when}, über ${what} beraten; sie wurde zurückgezogen.`.replace('; sie wurde',what==='die Vorlage'?'; sie wurde':'; er wurde'):outcome?`${o.nom} hat ${what} am ${when}, ${outcome}.`:`${o.nom} hat am ${when}, über ${what} beraten.`):`${o.nom} berät am ${when}, über ${what}.`;
 const body=[];
 const before=events.filter(e=>e.date.slice(0,10)<cur.date.slice(0,10));
 /* Was die vorberatenden Gremien entschieden haben, wenn es vom Bild abweicht (Ablehnung, Vertagung) */
 const prior=before.map(e=>outcomeOf(e.result)||outcomeOf(e.description)),num=n=>['','ein','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf'][n]||String(n);
 const rej=prior.filter(x=>x==='abgelehnt').length,post=prior.filter(x=>x==='vertagt'||x==='verwiesen').length;
 if(rej)body.push(rej>1?`In ${num(rej)} Vorberatungen war die Vorlage abgelehnt worden.`:'In einer Vorberatung war die Vorlage abgelehnt worden.');
 if(post)body.push(post>1?`Die Vorlage war zuvor ${num(post)}mal vertagt oder verwiesen worden.`:'Die Vorlage war zuvor einmal vertagt oder verwiesen worden.');
 // Zählt Sitzungen, nicht Gremien (derselbe Rat kann mehrfach beraten)
 if(before.length)body.push(before.length>1?`Zuvor war der Vorgang ${before.length}-mal beraten worden; zuletzt hat sich ${low(organ(before.at(-1).committee,ort).nom)} am ${longDay(before.at(-1).date)}, damit befasst.`:`Zuvor hatte sich ${low(organ(before[0].committee,ort).nom)} damit befasst.`);
 if(next&&past)body.push(`Als Nächstes berät ${low(organ(next.committee,ort).nom)} am ${longDay(next.date)}.`);
 return {
  id:card.id,region:member||regionName,place:mark.short,
  headline:`${mark.short}: ${title}${outcome?` – ${outcome}`:!past?' kommt auf die Tagesordnung':''}`,
  dateline:{place:mark.short,committee:cur.committee||card.gremium||'',date:cur.date.slice(0,10)},
  lead:`${mark.short}. ${lead}`,
  quote:(quote.length?quote:sentences).join(' '),more:more.slice(0,2).join(' '),body,
  source:`Ratsinformationssystem ${ort.gen}`,
 };
}

export async function news(db,catalog,params){
 const copy=new URLSearchParams(params);
 const n=Math.min(MAX_N,Math.max(1,Number(copy.get('n'))||DEFAULT_N));copy.delete('n');
 // Schnellwahl der Seite: 30, 90 oder 365 Tage zurück (ein Zeitraum im Filter geht vor)
 const back=SPANS.includes(Number(copy.get('days')))?Number(copy.get('days')):BACK;copy.delete('days');
 /* Ohne Zeitraum die letzten back (Standard BACK) und nächsten AHEAD Tage; „bis heute“ (die Suche ohne künftige Sitzungen) zählt als offen,
    denn was ansteht, gehört ins Newsradar */
 const own=!!copy.get('from');
 if(!own)copy.set('from',day(-back));
 if(!copy.get('to')||copy.get('to')===day(0))copy.set('to',day(AHEAD));
 copy.set('noformal','1');
 const f=parseDecisions(copy);
 if(!await factsReady(db))throw new AnalyticsError('Für diese Auswertung fehlt noch die Tabelle der Fakten (Migration 0025).',503);
 if(!(await xState(db)))throw new AnalyticsError('Die Zahlen für plenara.X werden gerade aufgebaut. Bitte später erneut versuchen.',503);
 /* Wie überall in plenara.X: Auswahl über source() (Sachvorgänge in x_cases, ohne private Bauanträge, mit künftigen Vorgängen,
    weil der Zeitraum über heute hinausgeht); Unterthemen und „Was geschieht“ aus x_cases, Fakten aller Karten des Vorgangs */
 const src=await source(db,catalog,f,{noPrivate:true,factions:true});
 const today=day(0),week=day(-7);
 /* Stufe 1: alle Vorgänge des Zeitraums mit ihren Fakten, ohne Payload */
 const ml=await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='model_labels'").first();
 const {results:rows}=await db.prepare(`SELECT x.card_id id,x.region_id region,x.date date,x.status status,x.stage stage,x.subs subs,x.factions factions,c.title title,c.gremium gremium${ml?',m.step step,m.applicants appl':''}
  FROM ${src.from} JOIN search_cards c ON c.id=x.card_id${ml?' LEFT JOIN model_labels m ON m.topic_id=x.card_id':''}`).bind(...src.args).all();
 const {results:factRows}=await db.prepare(`SELECT DISTINCT x.card_id id,fa.kind kind,fa.value value,fa.detail detail FROM ${src.from}
  JOIN report_rules rr ON rr.case_key=x.case_key JOIN topic_facts fa ON fa.topic_id=rr.topic_id AND fa.kind IN (${FACT_KINDS.map(()=>'?').join(',')})`).bind(...src.args,...FACT_KINDS).all();
 const factsOf=new Map();for(const x of factRows){const l=factsOf.get(x.id)||[];l.push({kind:x.kind,value:x.value,detail:x.detail});factsOf.set(x.id,l);}
 const pre=[];
 for(const c of rows){
  if(NOT_NEWS.test(c.title||''))continue;
  const facts=[...(c.factions?c.factions.split('\n').map(l=>{const [value,detail]=l.split('\t');return {kind:'faction',value,detail};}):[]),...(factsOf.get(c.id)||[])];
  const s=prescore(c,facts,today,week);pre.push({c,facts,...s});
 }
 pre.sort((a,b)=>b.score-a.score);
 /* Stufe 2: Berichte der besten Kandidaten lesen */
 const top=pre.slice(0,CANDIDATES),byId=new Map(catalog.map(r=>[r.id,r])),scored=[];
 for(let i=0;i<top.length;i+=40){
  const part=top.slice(i,i+40);
  const {results}=await db.prepare(`SELECT id,payload FROM topics WHERE id IN (${part.map(()=>'?').join(',')})`).bind(...part.map(p=>p.c.id)).all();
  const payload=new Map(results.map(r=>[r.id,r.payload]));
  for(const p of part){
   let t;try{t=JSON.parse(payload.get(p.c.id)||'null');}catch{t=null;}if(!t)continue;
   const ev=evidenceOf({events:t.events,event:t.event,records:t.sourceData?.records});
   const rule=t.ruleSummary,sentences=(rule?.short?.sentences||[]).map(quotable).filter(Boolean);
   const more=(rule?.long?.sentences||[]).map(quotable).filter(x=>x&&!sentences.includes(x));
   let {score}=p;const why=[...p.why];
   if(ev.result==='maj'){score+=12;why.push('nur mehrheitlich beschlossen');}
   else if(ev.result==='rej'&&p.c.status!=='rejected'){score+=25;why.push('in einer Sitzung abgelehnt');}
   else if(ev.result==='post'&&p.c.status!=='postponed'){score+=15;why.push('in einer Sitzung vertagt');}
   if((t.events||[]).length>=3){score+=5;why.push(`seit ${(t.events||[]).length} Sitzungen in Beratung`);}
   if(!sentences.length)continue; // ohne zitierbaren Kern keine Meldung
   scored.push({...p,t,ev,sentences,more,score,why});
  }
 }
 scored.sort((a,b)=>b.score-a.score||b.c.date.localeCompare(a.c.date));
 /* Je Gebiet höchstens so viele, dass die Gebiete mit Meldungen die Liste füllen können, mindestens PER_REGION */
 const cap=Math.max(PER_REGION,Math.ceil(n/Math.max(1,new Set(scored.map(x=>x.c.region)).size)));
 const items=[],per=new Map();
 for(const s of scored){
  const k=per.get(s.c.region)||0;if(k>=cap)continue;per.set(s.c.region,k+1);
  const regionName=byId.get(s.c.region)?.name||s.c.region,w=where(regionName,s.c.title,s.c.gremium,byId.get(s.c.region)?.members);
  items.push({...article({card:s.c,topic:s.t,facts:s.facts,ev:s.ev,sentences:s.sentences,more:s.more,today,regionName,member:w.key?w.label.replace(/ \(.*\)$/,''):null}),score:s.score,why:s.why});
  if(items.length>=n)break;
 }
 return {q:f.q,from:copy.get('from'),to:copy.get('to'),totals:{considered:rows.length,read:top.length,quotable:scored.length},items,own,rule:{back,ahead:AHEAD,perRegion:cap,candidates:CANDIDATES}};
}
