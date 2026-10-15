// Zahlen für plenara.X (Tabelle x_cases, Migration 0036): eine Zeile je Vorgang, damit GET /api/x nicht über alle Karten zählt.
// Gebaut einmal je Lauf des Jobs rule-texts (Schritt 3, scripts/plenara-x/build-x-cases.mjs), nach den Regeln je Bericht und der
// Wortliste; Thema von Hand oder KI und neue Karten erscheinen im Atlas mit dem nächsten Lauf. Nur Node (node:sqlite).
// Regeln wie bisher in plenara-x-query.mjs: Vorgang = report_rules.case_key, ungelesene Karte: Gebiet + Titel; nur Sachpunkte
// (itemKind subject, ungelesen: keine Formalie nach search_cards.formal); Werte der Karte mit der letzten Sitzung bis zum Bautag.
import {SIGNALS} from './plenara-x-signals.mjs';
import {readResult} from './analytics-decisions.mjs';
import {termsText} from './x-terms.mjs';
import {privateBuild} from '../../shared/topic-facts.mjs';
export const X_CASES_KEY='x-cases';
/** Stand der Zahlen für den Zwischenspeicher der Route (atRevisionStale): ändert sich nur mit einem neuen Bau, nicht mit jedem Import */
export const X_REVISION_SQL="SELECT coalesce((SELECT value FROM system_state WHERE key='x-cases'),'') AS revision";

const BUILD=`SELECT coalesce(r.case_key,c.region_id||'|'||lower(c.title)) k,c.region_id g,max(c.date) d,c.label l,coalesce(r.stage,'') s,
 coalesce(r.subs,'') u,c.status st,c.id id,count(*) n,r.topic_id IS NULL un
 FROM search_cards c LEFT JOIN report_rules r ON r.topic_id=c.id
 WHERE c.date<>'' AND c.date<=? AND coalesce(r.item_kind,CASE WHEN c.formal=1 THEN 'formal' ELSE 'subject' END)='subject'
 GROUP BY k`;
/* Künftige Vorgänge (wie in der Suche): nur angesetzt, noch keine Sitzung bis heute; Datum ist die erste anstehende Sitzung.
   Alle Seiten sehen sie nur, wenn ihr Zeitraum über heute hinausgeht (source() setzt sonst „bis heute“), derzeit der Newsradar. */
const FUTURE=BUILD.replace('max(c.date) d','min(c.date) d').replace('c.date<=?','c.date>?');

/** @param {import('node:sqlite').DatabaseSync} sql  @returns {{cases:number,unread:number,seconds:number,today:string}} */
export function buildXCases(sql,{today=new Date().toISOString().slice(0,10),dry=false}={}){
 const t0=Date.now();
 const past=sql.prepare(BUILD).all(today),seen=new Set(past.map(r=>r.k));
 const future=sql.prepare(FUTURE).all(today).filter(r=>!seen.has(r.k));
 const rows=past.concat(future);
 const unread=rows.reduce((a,r)=>a+(r.un?1:0),0);
 const state={builtAt:new Date().toISOString(),today,cases:past.length,future:future.length,unread};
 if(!dry){
  sql.exec('BEGIN IMMEDIATE');
  try{
   sql.exec('DELETE FROM x_cases');
   const ins=sql.prepare('INSERT INTO x_cases(case_key,region_id,date,month,label,stage,subs,status,card_id,cards,unread) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
   for(const r of rows)ins.run(r.k,r.g,r.d,String(r.d).slice(0,7),r.l,r.s,r.u,r.st,r.id,r.n,r.un?1:0);
   state.steps=buildXSteps(sql);
   state.factions=buildXFactions(sql);
   state.signals=buildXSignals(sql);
   sql.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(X_CASES_KEY,JSON.stringify(state));
   sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e;}
 }
 return {...state,seconds:Math.round((Date.now()-t0)/1000)};
}

/* Verlauf je Vorgang (Migration 0041): aus dem Zeitstrahl der Karte (events) erste Sitzung, Stationen, Dauer bis zur Entscheidung,
   Abstimmung und Änderung. Ohne Spalten (Migration fehlt) bleibt alles wie vorher. */
const DECIDED=['approved','rejected','postponed'];
const day=d=>String(d||'').slice(0,10);
/** @param {{date?:string,status?:string,committee?:string,result?:string}[]} events
    @param {string|{date:string,status:string,gremium:string}} card Karte des Vorgangs: ohne Zeitstrahl ihre Sitzung als einzige Station */
export function caseSteps(events,card=''){
 const c=typeof card==='string'?{date:card,status:'',gremium:''}:card,fallback=c.date;
 if(!(Array.isArray(events)&&events.length)&&c.gremium)events=[{date:c.date,status:c.status,committee:c.gremium}];
 const ev=(Array.isArray(events)?events:[]).map((e,i)=>({d:day(e?.date),st:String(e?.status||''),g:String(e?.committee||'').replace(/\s+/g,' ').trim(),res:e?.result,i}));
 const dated=ev.filter(e=>e.d).sort((a,b)=>a.d.localeCompare(b.d)||a.i-b.i);
 const ordered=[...dated,...ev.filter(e=>!e.d)];
 // Entscheidung: letzte Station mit Entscheidung (datierte zuerst), wie bisher in den Beschlüssen
 const dec=[...dated].reverse().find(e=>DECIDED.includes(e.st))||[...ev].reverse().find(e=>DECIDED.includes(e.st));
 const r=dec?readResult(dec.res):{vote:null,change:null};
 const days=dated.length>=2&&dec?.d&&dec.d>=dated[0].d?Math.round((Date.parse(dec.d)-Date.parse(dated[0].d))/864e5):null;
 return {first:dated[0]?.d||day(fallback),steps:ordered.map(e=>[e.d,e.st,e.g.replace(/[\t\n]/g,' ')].join('\t')).join('\n'),days,vote:r.vote||'',changed:r.change||''};
}
/** Stationen „Datum<TAB>Status<TAB>Gremium“ je Zeile zurück in Objekte */
export const parseSteps=s=>s?String(s).split('\n').map(l=>{const [d,st,g]=l.split('\t');return {d,st,g};}):[];
function buildXSteps(sql){
 const cols=new Set(sql.prepare("SELECT name FROM pragma_table_info('x_cases')").all().map(r=>r.name));
 if(!cols.has('steps'))return null;
 const terms=cols.has('terms');
 const up=sql.prepare(`UPDATE x_cases SET first_date=?,steps=?,days=?,vote=?,changed=?${terms?',terms=?,private_build=?':''} WHERE case_key=?`);let n=0;
 for(const r of sql.prepare("SELECT x.case_key k,x.date d,x.status st,c.gremium g,c.title ti,json_extract(t.payload,'$.events') ev FROM x_cases x LEFT JOIN topics t ON t.id=x.card_id LEFT JOIN search_cards c ON c.id=x.card_id").iterate()){
  let ev=[];try{ev=r.ev?JSON.parse(r.ev):[];}catch{/* kaputter Zeitstrahl: ohne Stationen */}
  const c=caseSteps(ev,{date:r.d,status:r.st,gremium:r.g||''});const more=terms?[termsText(r.ti||''),privateBuild(r.ti)?1:0]:[];up.run(c.first,c.steps,c.days,c.vote,c.changed,...more,r.k);n++;
 }
 return n;
}

/* Fraktionen (Migration 0043): je Vorgang die Fraktionen aus den Fakten aller seiner Karten und ob eine Karte empfiehlt, dem
   Antrag nicht zu folgen. Ohne Spalten (Migration fehlt) bleibt alles wie vorher. */
function buildXFactions(sql){
 const cols=new Set(sql.prepare("SELECT name FROM pragma_table_info('x_cases')").all().map(r=>r.name));
 if(!cols.has('factions'))return null;
 const by=new Map();
 for(const r of sql.prepare("SELECT rr.case_key k,fa.kind kind,fa.value v,max(fa.detail) d FROM topic_facts fa JOIN report_rules rr ON rr.topic_id=fa.topic_id WHERE fa.kind IN ('faction','faction_advice') GROUP BY rr.case_key,fa.kind,fa.value").iterate()){
  const c=by.get(r.k)||{list:[],advice:0};by.set(r.k,c);
  if(r.kind==='faction')c.list.push(r.v+'\t'+(r.d||''));else c.advice=1;
 }
 const up=sql.prepare('UPDATE x_cases SET factions=?,faction_advice=? WHERE case_key=?');let n=0;
 for(const [k,c] of by)n+=Number(up.run(c.list.join('\n'),c.advice,k).changes);
 return n;
}

/* Signale (Migration 0039): je Kategorie die Vorgänge mit Art und Stand, aus denselben Abfragen wie plenara-x-signals.mjs.
   Ohne Tabelle (Migration fehlt) bleibt alles wie vorher, die Seite fragt dann die Fakten direkt. */
function buildXSignals(sql){
 if(!sql.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='x_signals'").get())return null;
 sql.exec('DELETE FROM x_signals');const out={};
 for(const s of SIGNALS){
  const r=sql.prepare(`INSERT INTO x_signals(case_key,signal,art,phase) SELECT DISTINCT x.case_key,?,coalesce(av.a,''),coalesce(${s.phase},'') FROM x_cases x LEFT JOIN (${s.art}) av ON av.ck=x.case_key WHERE x.case_key IN (${s.cases})`).run(s.id);
  out[s.id]=Number(r.changes);
 }
 return out;
}
