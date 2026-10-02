import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminKeywords} from '@/server/repositories/admin';
// Counts the keywords stored with the reports. Reads only; starts no analysis.
export async function GET(){try{await requireAdmin();return Response.json(await getAdminKeywords(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
