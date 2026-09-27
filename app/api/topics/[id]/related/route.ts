import {getTopic} from '@/server/repositories/topics';
import {getRelated} from '@/server/repositories/regions';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const topic=await getTopic(id);if(!topic)return Response.json({error:'Nicht gefunden'},{status:404});try{return Response.json(await getRelated(topic),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Vergleich derzeit nicht verfügbar'},{status:503})}}
