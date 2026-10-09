import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminSummary} from '@/server/repositories/admin';
// Counts, labels, statuses, runs and job of the import and quality pages without the list of areas (about 30 KB). Live.
export async function GET(){try{await requireAdmin();return Response.json(await getAdminSummary(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
