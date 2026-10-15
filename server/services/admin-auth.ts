import 'server-only';
// Die Prüfung selbst steht in session.ts (Admin als Rolle eines Kontos, alter Kopfzeilen-Weg nur mit ADMIN_LEGACY_HEADER=1).
import {AdminError} from '../integrations/admin-access.mjs';
export {requireAdmin} from './session';
export const ADMIN_HEADERS={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow'};
export function adminFailure(error:unknown){
 const known=error instanceof AdminError;
 // The cause stays in the server log (message only); the answer names none.
 if(!known)console.error('Admin-Anfrage konnte nicht abgeschlossen werden:',error instanceof Error?error.message:String(error));
 return Response.json({error:known?error.message:'Die Daten konnten nicht geladen werden. Bitte erneut versuchen.'},{status:known?error.status:503,headers:ADMIN_HEADERS});
}
