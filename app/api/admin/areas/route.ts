import {adminRead} from '@/server/services/admin-http';
import {areasView} from '@/server/repositories/admin';
// The figures of every area, as rows in the order of the static list (admin-areas.mjs). Reads only; ETag and stand.
export async function GET(request:Request){const v=areasView();return adminRead(request,v.tag,v.build);}
