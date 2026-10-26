import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {AdminError,requireSameOrigin} from '@/server/integrations/admin-access.mjs';
import {accountsDb} from '@/server/accounts/config.mjs';
import {accountsOverview,revealAccount,findAccount} from '@/server/accounts/admin-accounts.mjs';
// Kontenübersicht (server/accounts/admin-accounts.mjs): GET alle Konten mit gekürzter Adresse, Stufe und Zahlungsstand;
// POST {id} zeigt die volle Adresse eines Kontos, POST {email} sucht die genaue Adresse. Beides steht im Admin-Protokoll.
export const dynamic='force-dynamic';
function accounts(){
 const db=accountsDb(env);
 if(!db)throw new AdminError(503,'Auf diesem Server gibt es keine Kontendatei.');
 return db;
}
export async function GET(){
 try{
  await requireAdmin();
  return Response.json(await accountsOverview(accounts()),{headers:ADMIN_HEADERS});
 }catch(e){return adminFailure(e);}
}
export async function POST(request:Request){
 try{
  const admin=await requireAdmin();
  requireSameOrigin(request);
  const text=await request.text();
  if(text.length>2000)throw new AdminError(413,'Anfrage zu groß.');
  let body:{id?:unknown;email?:unknown};
  try{body=JSON.parse(text);}catch{throw new AdminError(400,'Ungültige Anfrage.');}
  if(typeof body?.id==='string'){
   const found=await revealAccount(accounts(),{adminId:admin.userId,id:body.id});
   if(!found)throw new AdminError(404,'Konto nicht gefunden.');
   return Response.json(found,{headers:ADMIN_HEADERS});
  }
  if(typeof body?.email==='string'){
   const found=await findAccount(accounts(),{adminId:admin.userId,email:body.email});
   if(found===undefined)throw new AdminError(400,'Bitte eine vollständige E-Mail-Adresse eingeben.');
   return Response.json({found},{headers:ADMIN_HEADERS});
  }
  throw new AdminError(400,'Ungültige Anfrage.');
 }catch(e){return adminFailure(e);}
}
