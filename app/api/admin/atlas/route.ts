import {adminRead} from '@/server/services/admin-http';
import {atlasView} from '@/server/repositories/admin';
// Lückenatlas: every area with its connection, reason, access and what the database holds. Reads only; ETag and stand.
export async function GET(request:Request){const v=atlasView();return adminRead(request,v.tag,v.build);}
