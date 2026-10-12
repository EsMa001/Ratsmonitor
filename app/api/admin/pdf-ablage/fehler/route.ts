import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure} from '@/server/services/admin-auth';
import {errorsCsv} from '@/server/integrations/pdf-store-admin.mjs';
// Fehlerliste des PDF-Imports je Dokument als CSV (dasselbe wie scripts/pdf-store/fetch.mjs --errors --csv), Stand der
// letzten Zählung (scripts/pdf-store/stats.mjs).
export async function GET(){try{
 await requireAdmin();
 const csv=await errorsCsv(env.DB);
 if(csv===null)return new Response('Noch keine Fehlerliste: sie entsteht bei der nächsten Zählung.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="pdf-import-fehler.csv"','Cache-Control':'no-store'}});
}catch(e){return adminFailure(e);}}
