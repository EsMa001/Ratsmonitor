import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminEstimate} from '@/server/repositories/admin';
export async function GET(){try{await requireAdmin();return Response.json(await getAdminEstimate(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
