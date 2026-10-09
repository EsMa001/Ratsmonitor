import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {adminRead} from '@/server/services/admin-http';
import {requireSameOrigin} from '@/server/integrations/admin-access.mjs';
import {estimateView,computeAdminEstimate} from '@/server/repositories/admin';
// GET shows the stored estimate (or that none exists yet) with ETag and stand; POST computes it anew from the values per
// area and stores it (server/integrations/admin-estimate-store.mjs).
export async function GET(request:Request){const v=estimateView();return adminRead(request,v.tag,v.build);}
export async function POST(request:Request){try{requireSameOrigin(request);await requireAdmin();return Response.json(await computeAdminEstimate(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
