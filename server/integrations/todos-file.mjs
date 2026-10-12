import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {AdminError} from './admin-access.mjs';
import {applyTodoUpdates,normalizeTodos,todoRevision,requireTodoRevision} from './todos-store.mjs';
export {applyTodoUpdates,berlinToday} from './todos-store.mjs';

const FILE='docs/todo/todos.json';
const pending=new Map();
export async function readTodos(file=FILE){
 const data=JSON.parse(await readFile(file,'utf8'));
 return {...normalizeTodos(data),revision:await todoRevision(data)};
}
export async function updateTodos(updates,file=FILE,today,options={}){
 const key=resolve(file),previous=pending.get(key)??Promise.resolve();
 const write=previous.catch(()=>{}).then(async()=>{
  const current=await readTodos(file);
  if(options.revision!==undefined&&options.revision!==current.revision)throw new AdminError(409,'Die Aufgaben wurden zwischenzeitlich geaendert. Bitte den aktuellen Stand laden und die Aenderung erneut speichern.');
  const next=applyTodoUpdates(current,updates,today,options.creates??[]);
  delete next.revision;
  const temp=join(dirname(file),'.todos-'+crypto.randomUUID()+'.tmp');
  try{
   await writeFile(temp,JSON.stringify(next,null,2)+'\n','utf8');
   await rename(temp,file);
  }catch(error){await unlink(temp).catch(()=>{});throw error;}
  return {...next,revision:await todoRevision(next)};
 });
 pending.set(key,write);
 try{return await write;}finally{if(pending.get(key)===write)pending.delete(key);}
}

export async function handleTodoRequest({method,origin,host,contentType,text},file=FILE,today){
 try{
  if(method==='GET')return {status:200,body:await readTodos(file)};
  if(method!=='POST')throw new AdminError(405,'Methode nicht erlaubt.');
  let sameOrigin=false;try{sameOrigin=!!origin&&new URL(origin).host===host;}catch{}
  if(!sameOrigin)throw new AdminError(403,'Diese Aktion muss direkt auf der Seite gestartet werden.');
  if(!contentType?.toLowerCase().startsWith('application/json'))throw new AdminError(415,'JSON-Anfrage erforderlich.');
  if(typeof text!=='string')throw new AdminError(400,'Ungueltige Anfrage.');
  if(text.length>200_000)throw new AdminError(413,'Anfrage zu gross.');
  let body;try{body=JSON.parse(text);}catch{throw new AdminError(400,'Ungueltige Anfrage.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new AdminError(400,'Ungueltige Anfrage.');
  requireTodoRevision(body.revision);
  return {status:200,body:await updateTodos(body.updates,file,today,{revision:body.revision,creates:body.creates})};
 }catch(error){
  if(error instanceof AdminError)return {status:error.status,body:{error:error.message}};
  console.error('To-Do-Liste:',error instanceof Error?error.message:String(error));
  return {status:500,body:{error:'Die To-Do-Liste konnte nicht gelesen oder gespeichert werden.'}};
 }
}
