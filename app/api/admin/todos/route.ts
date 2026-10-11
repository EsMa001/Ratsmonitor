import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {AdminError,requireSameOrigin} from '@/server/integrations/admin-access.mjs';
import {readChanges,readStoredTodos,updateStoredTodos} from '@/server/integrations/todos-store.mjs';
import todos from '@/docs/todo/todos.json';
// To-do-Liste auf dem Server: Einträge aus docs/todo/todos.json (Stand des Deploys), Abhaken und Termine in system_state.
// Lokal speichert der Dev-Server direkt in die Datei (/__todos, build/todo-dev-plugin.mjs). ?aenderungen=1 liefert nur die
// gespeicherten Änderungen mit ihrem Dateistand (für scripts/pull-todos.mjs).
export async function GET(request:Request){
 try{
  await requireAdmin();
  if(!env.DB)throw Error('Datenbank fehlt');
  if(new URL(request.url).searchParams.has('aenderungen'))return Response.json({changes:await readChanges(env.DB)},{headers:ADMIN_HEADERS});
  return Response.json(await readStoredTodos(env.DB,todos),{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}
}
export async function POST(request:Request){
 try{
  await requireAdmin();
  requireSameOrigin(request);
  if(!env.DB)throw Error('Datenbank fehlt');
  const text=await request.text();
  if(text.length>200_000)throw new AdminError(413,'Anfrage zu groß.');
  let body:{updates?:unknown};try{body=JSON.parse(text);}catch{throw new AdminError(400,'Ungültige Anfrage.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new AdminError(400,'Ungültige Anfrage.');
  return Response.json(await updateStoredTodos(env.DB,todos,body.updates),{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}
}
