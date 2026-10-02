import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminTimeline} from '@/server/repositories/admin';
import {AdminError} from '@/server/integrations/admin-access.mjs';
import {TIMELINE_BASES} from '@/shared/timeline.mjs';
export async function GET(request:Request){try{await requireAdmin();const basis=new URL(request.url).searchParams.get('basis')||'event';if(!Object.hasOwn(TIMELINE_BASES,basis))throw new AdminError(400,'Ungültiger Zeitbezug.');return Response.json(await getAdminTimeline(basis),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
