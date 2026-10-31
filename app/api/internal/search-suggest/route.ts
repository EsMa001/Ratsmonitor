// Register der Tippfehler-Vorschläge füllen bzw. nachführen (server/integrations/search-suggest.mjs): serve.mjs ruft das nach dem
// Start wiederholt auf, bis done:true, jeder Aufruf arbeitet höchstens einige Sekunden (Bearer IMPORT_TOKEN).
import {env} from 'cloudflare:workers';
import {internalCall} from '@/server/services/session';
import {syncSuggestIndex} from '@/server/integrations/search-suggest.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!await internalCall(request))return Response.json({error:'Nicht autorisiert'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await syncSuggestIndex(env.DB,{deadline:Date.now()+4000,chunk:5000}),{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error('[suche] Tippfehler-Register:',error instanceof Error?error.message:String(error));return Response.json({error:'Register nicht gefüllt.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
