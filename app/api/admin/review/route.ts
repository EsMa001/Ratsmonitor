import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminReview} from '@/server/repositories/admin';
import {AdminError} from '@/server/integrations/admin-access.mjs';
import {REVIEW_FILTERS} from '@/shared/admin.mjs';
import {validRegion} from '@/shared/regions';
export async function GET(request:Request){try{await requireAdmin();const p=new URL(request.url).searchParams,issue=p.get('issue')||'labels',region=p.get('region')||'all';if(!REVIEW_FILTERS.some(f=>f.id===issue)||region!=='all'&&!validRegion(region))throw new AdminError(400,'Ungültiger Prüffilter.');return Response.json(await getAdminReview(issue,region),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
