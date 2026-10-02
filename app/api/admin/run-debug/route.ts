import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {getRunDebug} from '@/server/repositories/admin';
import {AdminError} from '@/server/integrations/admin-access.mjs';
import {validRegion} from '@/shared/regions';
// Reads the stored record of an area's last import and its recent runs. Starts nothing.
export async function GET(request:Request){try{await requireAdmin();const region=new URL(request.url).searchParams.get('region')||'';if(!validRegion(region))throw new AdminError(400,'Ungültiges Gebiet.');return Response.json(await getRunDebug(region),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
