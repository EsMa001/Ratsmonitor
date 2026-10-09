import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getAdminDashboard} from '@/server/repositories/admin';
import {filterAdminSources,sourcesCsv,SOURCE_FILTERS} from '@/shared/admin.mjs';
import {AdminError} from '@/server/integrations/admin-access.mjs';
export async function GET(request:Request){try{await requireAdmin();const p=new URL(request.url).searchParams,filter=p.get('filter')||'data',q=p.get('q')||'';if(!SOURCE_FILTERS.some(f=>f.id===filter)||q.length>120)throw new AdminError(400,'Ungültiger Exportfilter.');const data=await getAdminDashboard({review:false});return new Response(sourcesCsv(filterAdminSources(data.sources,filter,q)),{headers:{...ADMIN_HEADERS,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="vor-ort-quellen.csv"'}});}catch(e){return adminFailure(e);}}
