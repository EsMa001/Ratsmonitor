import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminAtlas} from '@/server/repositories/admin';
// Lückenatlas: every area with its connection, reason, access and what the database holds. Reads only.
export async function GET(){try{await requireAdmin();return Response.json(await getAdminAtlas(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
