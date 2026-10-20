// Fehler aus dem Browser (components/ratsmonitor/lib/reportError.ts) als eine Zeile ins Server-Log: „[client-error] {…}“.
// Keine Datenbank, keine IP-Adresse, keine Suchparameter; nur gleiche Herkunft, höchstens 4 KB, Mengenbegrenzung je Minute.
import {cleanReport,makeLimiter,sameOrigin,MAX_BYTES} from '@/server/integrations/client-errors.mjs';
export const dynamic='force-dynamic';
const allow=makeLimiter();
export async function POST(request:Request){
 if(!sameOrigin(request))return new Response(null,{status:403});
 const text=await request.text().catch(()=>'');
 if(!text||text.length>MAX_BYTES)return new Response(null,{status:413});
 let raw:unknown=null;try{raw=JSON.parse(text);}catch{return new Response(null,{status:400});}
 const report=cleanReport(raw);
 if(!report)return new Response(null,{status:400});
 if(allow())console.error('[client-error] '+JSON.stringify(report));
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
