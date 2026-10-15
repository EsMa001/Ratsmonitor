// Abdeckung der Fakten: für wie viele Gemeinden in Deutschland liegt ein Wert vor (Reiter „Themen & Texte“).
// Gerechnet beim Bau der Zahlen für plenara.X (scripts/plenara-x/build-x-cases.mjs), über x_cases, nur Node (node:sqlite).
// Gemeinden = Gemeindeschlüssel (8 Stellen) des Katalogs: Gemeinden selbst und alle Mitgliedsgemeinden der Verbände.
// Nenner (total): nur Gemeinden, für die überhaupt ein Sachvorgang in x_cases liegt (bei Verbänden alle Mitgliedsgemeinden);
// all: alle Gemeinden des Katalogs.
// Ein Wert eines Verbands gilt für die Mitgliedsgemeinde, die Gremium oder Titel nennen (where, wie in Karte und Listen),
// sonst für alle Mitgliedsgemeinden. Werte von Kreisen zählen für keine Gemeinde.
import {where} from './member-place.mjs';

export function municipalitiesOf(catalog){
 const all=new Set();
 for(const r of catalog){if(r.kind!=='city')continue;if(r.members?.length)for(const m of r.members)all.add(m.ags);else all.add(String(r.ags).slice(0,8));}
 return all;
}

const placesOf=reg=>reg.members?.length?reg.members.map(m=>m.ags):[String(reg.ags).slice(0,8)];

/** {total, all, places: {Art: Zahl der Gemeinden mit mindestens einem Wert}} */
export function factCoverage(db,catalog){
 const byId=new Map(catalog.map(r=>[r.id,r])),covered=new Set();
 for(const {g} of db.prepare('SELECT DISTINCT region_id g FROM x_cases').iterate()){const reg=byId.get(g);if(reg?.kind==='city')for(const a of placesOf(reg))covered.add(a);}
 const q=db.prepare(`SELECT DISTINCT f.kind kind,x.region_id g,c.title title,c.gremium gremium FROM topic_facts f
  JOIN report_rules rr ON rr.topic_id=f.topic_id JOIN x_cases x ON x.case_key=rr.case_key JOIN search_cards c ON c.id=x.card_id`);
 const places=new Map();
 for(const r of q.iterate()){
  const reg=byId.get(r.g);if(!reg||reg.kind!=='city')continue;
  const set=places.get(r.kind)||new Set();places.set(r.kind,set);
  if(!reg.members?.length){set.add(String(reg.ags).slice(0,8));continue;}
  const w=where(reg.name,r.title||'',r.gremium||'',reg.members),m=w.key&&reg.members.find(x=>x.name===w.key||x.name.replace(/\s*\(.*\)$/,'')===w.key);
  if(m?.ags)set.add(m.ags);else for(const x of reg.members)set.add(x.ags);
 }
 return {total:covered.size,all:municipalitiesOf(catalog).size,places:Object.fromEntries([...places].map(([k,s])=>[k,s.size]))};
}
