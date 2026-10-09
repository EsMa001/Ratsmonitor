import {adminRead} from '@/server/services/admin-http';
import {timelineView} from '@/server/repositories/admin';
// Reports per area and day, from the values per area (region_series); ETag and stand (server/repositories/admin.ts).
export async function GET(request:Request){const v=timelineView(new URL(request.url).searchParams.get('basis')||'event');return adminRead(request,v.tag,v.build);}
