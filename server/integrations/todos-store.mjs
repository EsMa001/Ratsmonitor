import {AdminError} from './admin-access.mjs';
// Interne To-Do-Liste, ohne Dateizugriff (läuft im Worker und auf dem Node-Server). Quelle ist docs/todo/todos.json:
// lokal schreibt der Dev-Server sie direkt (todos-file.mjs), auf dem Server liegt sie im Build, und system_state hält
// nur, was dort abgehakt oder terminiert wurde ({id:{erledigt,faellig,erledigtAm,base}}). base ist der Stand der Datei
// beim Speichern: Wurde die Datei seither geändert und ausgeliefert, gilt die Datei. scripts/pull-todos.mjs holt die
// Änderungen vom Server in die Datei.
const KEY='admin-todos-v1';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const MAX_UPDATES=1000;
const isDate=value=>DATE.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export const berlinToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});
// Wendet {id,erledigt,faellig}-Änderungen auf die Liste an. Texte, Hinweise und Reihenfolge bleiben unverändert; unbekannte Einträge sind ein Fehler.
export function applyTodoUpdates(data,updates,today=berlinToday()){
 if(!Array.isArray(updates)||updates.length>MAX_UPDATES)throw new AdminError(400,'Ungültige Anfrage.');
 const byId=new Map();
 for(const update of updates){
  if(!update||typeof update!=='object'||typeof update.id!=='string'||typeof update.erledigt!=='boolean')throw new AdminError(400,'Ungültige Anfrage.');
  const faellig=update.faellig===null||update.faellig===''||update.faellig===undefined?null:update.faellig;
  if(faellig!==null&&(typeof faellig!=='string'||!isDate(faellig)))throw new AdminError(400,'Ungültiges Datum.');
  byId.set(update.id,{erledigt:update.erledigt,faellig});
 }
 const known=new Set();
 const kategorien=data.kategorien.map(category=>({...category,items:category.items.map(item=>{
  known.add(item.id);
  const change=byId.get(item.id);
  if(!change)return item;
  const erledigtAm=change.erledigt?(item.erledigt?item.erledigtAm:today):null;
  return {...item,erledigt:change.erledigt,faellig:change.faellig,erledigtAm};
 })}));
 for(const id of byId.keys())if(!known.has(id))throw new AdminError(400,'Unbekannter Eintrag: '+id);
 return {...data,kategorien};
}
const sameState=(a,b)=>a.erledigt===b.erledigt&&(a.faellig??null)===(b.faellig??null);
/** Datei plus gespeicherte Änderungen; eine Änderung zählt nur, solange der Eintrag in der Datei noch ihrem base entspricht. */
export function mergeTodos(base,stored){
 const changes=stored&&typeof stored==='object'?stored:{};
 return {...base,kategorien:base.kategorien.map(category=>({...category,items:category.items.map(item=>{
  const change=changes[item.id];
  if(!change||!change.base||!sameState(item,change.base))return item;
  return {...item,erledigt:change.erledigt,faellig:change.faellig,erledigtAm:change.erledigtAm};
 })}))};
}
/** Änderungen gegenüber der Datei, die gespeichert werden müssen (Einträge wie in der Datei fallen weg). */
export function diffTodos(base,next){
 const after=new Map(next.kategorien.flatMap(c=>c.items).map(i=>[i.id,i]));
 const changes={};
 for(const item of base.kategorien.flatMap(c=>c.items)){
  const now=after.get(item.id);
  if(!now||(sameState(item,now)&&(item.erledigtAm??null)===(now.erledigtAm??null)))continue;
  changes[item.id]={erledigt:now.erledigt,faellig:now.faellig,erledigtAm:now.erledigtAm,base:{erledigt:item.erledigt,faellig:item.faellig}};
 }
 return changes;
}
export async function readChanges(db){
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(KEY).first();
 try{return row?JSON.parse(row.value):{};}catch{return {};}
}
export async function readStoredTodos(db,base){
 return mergeTodos(base,await readChanges(db));
}
export async function updateStoredTodos(db,base,updates,today){
 const next=applyTodoUpdates(mergeTodos(base,await readChanges(db)),updates,today);
 await db.prepare('INSERT OR REPLACE INTO system_state(key,value) VALUES(?,?)').bind(KEY,JSON.stringify(diffTodos(base,next))).run();
 return next;
}
