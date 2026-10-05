import 'server-only';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AdminError,requireAdminAccess} from '../integrations/admin-access.mjs';
export const ADMIN_HEADERS={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow'};
export async function requireAdmin(){return requireAdminAccess(env.DB,await getChatGPTUser());}
export function adminFailure(error:unknown){
 const known=error instanceof AdminError;
 // The cause stays in the server log (message only); the answer names none.
 if(!known)console.error('Admin-Anfrage konnte nicht abgeschlossen werden:',error instanceof Error?error.message:String(error));
 return Response.json({error:known?error.message:'Die Daten konnten nicht geladen werden. Bitte erneut versuchen.'},{status:known?error.status:503,headers:ADMIN_HEADERS});
}
