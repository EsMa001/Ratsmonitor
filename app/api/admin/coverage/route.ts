import {adminRead} from '@/server/services/admin-http';
import {coverageView} from '@/server/repositories/admin';
// Coverage by areas and population, today and over time (connected sources, stored reports). Reads only; ETag and stand.
export async function GET(request:Request){const v=coverageView();return adminRead(request,v.tag,v.build);}
