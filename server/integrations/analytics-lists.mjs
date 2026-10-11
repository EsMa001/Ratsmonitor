import {titleKey} from '../../shared/topic-facts.mjs';
import {where} from './analytics-radar-extra.mjs';

/*
 * Plenara.X – Listen hinter den Zahlen (Fraktionsprofil, Beschlüsse, Förderradar, Trends, Ausbreitung, Beratungswege): dieselbe
 * Darstellung wie in den Themenradaren (RadarDrill.tsx). Jede Auswertung wählt ihre Vorgänge selbst (mit denselben Filtern wie ihre
 * Zahlen); hier werden sie wie dort gezählt: derselbe Titel je Gebiet einmal (mit seiner jüngsten Sitzung), die jüngsten zuerst,
 * LIST_SIZE je Abruf ab offset. Bei Gemeindeverbänden steht die Mitgliedsgemeinde dabei, wenn Gremium oder Titel sie nennen.
 */
export const LIST_SIZE=50;
export const offsetOf=params=>Math.max(0,Number(params.get('offset'))||0);

/** rows: {id, region, title, date, status, gremium?, euro?, signal?}; extra(r) ergänzt Felder je Eintrag */
export function listPage(rows,catalog,offset,extra=()=>({})){
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 const groups=new Map();
 for(const r of [...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date)))){
  const k=r.region+'|'+titleKey(r.title),g=groups.get(k);
  if(g){g.times++;continue;}
  groups.set(k,{...r,times:1});
 }
 const all=[...groups.values()];
 return {offset,size:LIST_SIZE,total:all.length,
  items:all.slice(offset,offset+LIST_SIZE).map(r=>({id:r.id,title:r.title,region:where(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),status:r.status,times:r.times,...extra(r)}))};
}

/** Dieselbe Liste direkt in SQL (für große Mengen): cond ist eine Bedingung auf search_cards, gruppiert nach Gebiet und Titel;
    die übrigen Spalten stammen aus der jüngsten Sitzung (SQLite: einziges max() bestimmt die Zeile) */
export async function sqlList(db,catalog,cond,args,offset){
 const group="region_id||'|'||lower(title)";
 const [{results},count]=await Promise.all([
  db.prepare(`SELECT id,region_id region,title,gremium,max(date) date,status,count(*) times FROM search_cards WHERE ${cond} GROUP BY ${group} ORDER BY date DESC LIMIT ? OFFSET ?`).bind(...args,LIST_SIZE,offset).all(),
  db.prepare(`SELECT count(DISTINCT ${group}) n FROM search_cards WHERE ${cond}`).bind(...args).first(),
 ]);
 const byId=new Map(catalog.map(r=>[r.id,r])),name=r=>byId.get(r)?.name||r;
 return {offset,size:LIST_SIZE,total:Number(count?.n||0),
  items:results.map(r=>({id:r.id,title:r.title,region:where(name(r.region),r.title,r.gremium,byId.get(r.region)?.members).label,date:String(r.date).slice(0,10),status:r.status,times:r.times}))};
}
