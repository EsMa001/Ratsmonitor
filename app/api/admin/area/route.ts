import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {AdminError} from '@/server/integrations/admin-access.mjs';
import {getAreaNotes} from '@/server/repositories/admin';
import {validRegion} from '@/shared/regions';
// The notes of one area (issues, warnings, address of the source), read when somebody opens them.
export async function GET(request:Request){try{await requireAdmin();const id=new URL(request.url).searchParams.get('id')||'';if(!validRegion(id))throw new AdminError(400,'Ungültiges Gebiet.');return Response.json(await getAreaNotes(id),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
