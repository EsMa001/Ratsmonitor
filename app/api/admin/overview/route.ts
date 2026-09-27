import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminDashboard} from '@/server/repositories/admin';
export async function GET(){try{await requireAdmin();return Response.json(await getAdminDashboard(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
