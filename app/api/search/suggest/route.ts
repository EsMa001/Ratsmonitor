// „Meinten Sie …?“ für Suchbegriffe ohne Treffer: je unbekanntem Wort eine Ersetzung aus der Wortliste (server/integrations/search-suggest.mjs).
// Die Oberfläche fragt nur bei 0 Treffern (ResultsPanel.tsx); die Antwort hängt an keiner Stufe und ändert nichts.
import {env} from 'cloudflare:workers';
import {guard} from '@/server/services/session';
import {suggestQuery} from '@/server/integrations/search-suggest.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const denied=await guard(request);
  if(denied)return denied;
  const q=new URL(request.url).searchParams.get('q')||'';
  const suggestions=q.length>200?[]:await suggestQuery(env.DB,q);
  return Response.json({suggestions},{headers:{'Cache-Control':'public, max-age=3600'}});
 }
 catch{return Response.json({suggestions:[]},{headers:{'Cache-Control':'no-store'}});}
}
