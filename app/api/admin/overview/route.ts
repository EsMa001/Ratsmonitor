import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminDashboard} from '@/server/repositories/admin';
// ?review=0: without the review list of page 2. Page 1 asks this way, also while a job is running.
export async function GET(request?:Request){try{await requireAdmin();return Response.json(await getAdminDashboard({review:!request||new URL(request.url).searchParams.get('review')!=='0'}),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
