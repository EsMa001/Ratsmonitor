import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminCoverage} from '@/server/repositories/admin';
// Coverage by areas and population, today and over time (connected sources, stored reports). Reads only.
export async function GET(){try{await requireAdmin();return Response.json(await getAdminCoverage(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
