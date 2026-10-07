import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {storedQualityChecks,runQualityCheck} from '@/server/integrations/quality-check.mjs';
// Checks of the stock for duplicates, defects and orphans (shared/quality-checks.mjs). GET reads the stored results;
// POST {check} runs one check (one or two scans of the stock), stores and returns it. Nothing is changed by a check.
export async function GET(){try{if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');await requireAdmin();return Response.json(await storedQualityChecks(env.DB),{headers:ADMIN_HEADERS});}catch(e){return adminFailure(e);}}
export async function POST(request:Request){try{
 requireSameOrigin(request);if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');await requireAdmin();
 const body=await request.json().catch(()=>null) as {check?:unknown}|null;
 if(!body||typeof body.check!=='string'||body.check.length>40)throw new AdminError(400,'Ungültige Anfrage.');
 return Response.json(await runQualityCheck(env.DB,body.check),{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
