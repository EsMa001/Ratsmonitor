import {adminRead} from '@/server/services/admin-http';
import {keywordsView} from '@/server/repositories/admin';
// Keywords of the stored reports, as last counted ("Neu zählen" counts them anew in steps, /api/admin/refresh). Reads
// only; ETag and stand.
export async function GET(request:Request){const v=keywordsView();return adminRead(request,v.tag,v.build);}
