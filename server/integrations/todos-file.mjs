import {readFile,writeFile,rename} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {AdminError} from './admin-access.mjs';
import {applyTodoUpdates} from './todos-store.mjs';
export {applyTodoUpdates,berlinToday} from './todos-store.mjs';
// Interne To-Do-Liste: liegt als Datei im Repo (docs/todo/todos.json). Sie wird nur vom Vite-Dev-Server (build/todo-dev-plugin.mjs, Node)
// gelesen und geschrieben, nie vom Worker und nie im Produktions-Build. Auf dem Server: todos-store.mjs.
const FILE='docs/todo/todos.json';
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
