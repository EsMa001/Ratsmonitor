import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin} from '@/server/integrations/admin-access.mjs';
import {getAdminEstimate,computeAdminEstimate} from '@/server/repositories/admin';
// GET shows the stored estimate (or that none exists yet); POST computes it anew, which reads every report twice and
// takes about a minute, and stores it (server/integrations/admin-estimate-store.mjs).
export async function GET(){try{await requireAdmin();return Response.json(await getAdminEstimate(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);await requireAdmin();return Response.json(await computeAdminEstimate(),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
