// Zahlen für plenara.X (Tabelle x_cases, Migration 0036): eine Zeile je Vorgang, damit GET /api/x nicht über alle Karten zählt.
// Gebaut einmal je Lauf des Jobs rule-texts (Schritt 3, scripts/plenara-x/build-x-cases.mjs), nach den Regeln je Bericht und der
// Wortliste; Thema von Hand oder KI und neue Karten erscheinen im Atlas mit dem nächsten Lauf. Nur Node (node:sqlite).
// Regeln wie bisher in plenara-x-query.mjs: Vorgang = report_rules.case_key, ungelesene Karte: Gebiet + Titel; nur Sachpunkte
// (itemKind subject, ungelesen: keine Formalie nach search_cards.formal); Werte der Karte mit der letzten Sitzung bis zum Bautag.
import {SIGNALS} from './plenara-x-signals.mjs';
export const X_CASES_KEY='x-cases';
/** Stand der Zahlen für den Zwischenspeicher der Route (atRevisionStale): ändert sich nur mit einem neuen Bau, nicht mit jedem Import */
export const X_REVISION_SQL="SELECT coalesce((SELECT value FROM system_state WHERE key='x-cases'),'') AS revision";

const BUILD=`SELECT coalesce(r.case_key,c.region_id||'|'||lower(c.title)) k,c.region_id g,max(c.date) d,c.label l,coalesce(r.stage,'') s,
 coalesce(r.subs,'') u,c.status st,c.id id,count(*) n,r.topic_id IS NULL un
 FROM search_cards c LEFT JOIN report_rules r ON r.topic_id=c.id
 WHERE c.date<>'' AND c.date<=? AND coalesce(r.item_kind,CASE WHEN c.formal=1 THEN 'formal' ELSE 'subject' END)='subject'
 GROUP BY k`;

/** @param {import('node:sqlite').DatabaseSync} sql  @returns {{cases:number,unread:number,seconds:number,today:string}} */
export function buildXCases(sql,{today=new Date().toISOString().slice(0,10),dry=false}={}){
 const t0=Date.now();
 const rows=sql.prepare(BUILD).all(today);
 const unread=rows.reduce((a,r)=>a+(r.un?1:0),0);
 const state={builtAt:new Date().toISOString(),today,cases:rows.length,unread};
 if(!dry){
  sql.exec('BEGIN IMMEDIATE');
  try{
   sql.exec('DELETE FROM x_cases');
   const ins=sql.prepare('INSERT INTO x_cases(case_key,region_id,date,month,label,stage,subs,status,card_id,cards,unread) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
   for(const r of rows)ins.run(r.k,r.g,r.d,String(r.d).slice(0,7),r.l,r.s,r.u,r.st,r.id,r.n,r.un?1:0);
   state.signals=buildXSignals(sql);
   sql.prepare('INSERT INTO system_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(X_CASES_KEY,JSON.stringify(state));
   sql.exec('COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e;}
 }
 return {...state,seconds:Math.round((Date.now()-t0)/1000)};
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
