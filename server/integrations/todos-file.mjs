import {readFile,writeFile,rename} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {AdminError} from './admin-access.mjs';
// Interne To-Do-Liste: liegt als Datei im Repo (docs/todo/todos.json). Sie wird nur vom Vite-Dev-Server (build/todo-dev-plugin.mjs, Node)
// gelesen und geschrieben, nie vom Worker und nie im Produktions-Build; die Liste ist nicht öffentlich.
const FILE='docs/todo/todos.json';
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
export async function readTodos(file=FILE){
 return JSON.parse(await readFile(file,'utf8'));
}
export async function updateTodos(updates,file=FILE,today){
 const next=applyTodoUpdates(await readTodos(file),updates,today);
 // Erst in eine Nebendatei schreiben und dann umbenennen, damit ein Abbruch die Liste nicht halb überschreibt.
 const temp=join(dirname(file),'.todos.json.tmp');
 await writeFile(temp,JSON.stringify(next,null,2)+'\n','utf8');
 await rename(temp,file);
 return next;
}
// Antwort auf eine Anfrage an /__todos: {status,body}. Schreiben nur von der eigenen Seite (Origin = Host) und mit JSON.
export async function handleTodoRequest({method,origin,host,contentType,text},file=FILE,today){
 try{
  if(method==='GET')return {status:200,body:await readTodos(file)};
  if(method!=='POST')throw new AdminError(405,'Methode nicht erlaubt.');
  let sameOrigin=false;try{sameOrigin=!!origin&&new URL(origin).host===host;}catch{}
  if(!sameOrigin)throw new AdminError(403,'Diese Aktion muss direkt auf der Seite gestartet werden.');
  if(!contentType?.toLowerCase().startsWith('application/json'))throw new AdminError(415,'JSON-Anfrage erforderlich.');
  if(text.length>200_000)throw new AdminError(413,'Anfrage zu groß.');
  let body;try{body=JSON.parse(text);}catch{throw new AdminError(400,'Ungültige Anfrage.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new AdminError(400,'Ungültige Anfrage.');
  return {status:200,body:await updateTodos(body.updates,file,today)};
 }catch(e){
  if(e instanceof AdminError)return {status:e.status,body:{error:e.message}};
  console.error('To-Do-Liste:',e instanceof Error?e.message:String(e));
  return {status:500,body:{error:'Die To-Do-Liste konnte nicht gelesen oder gespeichert werden.'}};
 }
}
