import {adminRead,ADMIN_IMMUTABLE_HEADERS,ADMIN_READ_HEADERS} from '@/server/services/admin-http';
import {staticVersion,staticAreasText} from '@/server/repositories/admin';
// What only a deploy changes about the areas (admin-areas.mjs). Asked with its version (?v=) it is cached for good by the
// browser; asked without or with another version it answers the current one with ETag.
export async function GET(request:Request){
 const version=staticVersion(),asked=new URL(request.url).searchParams.get('v');
 return adminRead(request,async()=>'sv1'+version,async()=>staticAreasText(),asked===version?ADMIN_IMMUTABLE_HEADERS:ADMIN_READ_HEADERS);
}
