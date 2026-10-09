import 'server-only';
import {requireAdmin,adminFailure} from '@/server/services/admin-auth';
import {etagMatches,fnv,readResponse} from '@/server/services/admin-etag.mjs';
export {etagMatches,fnv};
// Reading admin routes answer with a weak ETag; the browser asks with "no-cache" and gets 304 while nothing changed,
// without the server building the answer (rule R2 of requirements/admin-performance-konzept.md). Writing routes,
// errors and the step routes keep ADMIN_HEADERS (no-store).
const BASE={'Vary':'Cookie, oai-authenticated-user-id','X-Robots-Tag':'noindex, nofollow'};
export const ADMIN_READ_HEADERS:Record<string,string>={...BASE,'Cache-Control':'private, no-cache'};
export const ADMIN_IMMUTABLE_HEADERS:Record<string,string>={...BASE,'Cache-Control':'private, max-age=31536000, immutable'};
/** tag(): cheap identifier of the answer (a few small queries). build(): the answer (object or JSON text), only when needed. */
export async function adminRead(request:Request,tag:()=>Promise<string>,build:()=>Promise<unknown>,headers=ADMIN_READ_HEADERS){
 try{await requireAdmin();return await readResponse(request,tag,build,headers);}
 catch(e){return adminFailure(e);}
}
