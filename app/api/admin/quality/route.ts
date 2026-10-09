import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {requireSameOrigin,AdminError} from '@/server/integrations/admin-access.mjs';
import {storedQualityChecks} from '@/server/integrations/quality-check.mjs';
import {refreshStep} from '@/server/integrations/admin-refresh.mjs';
import {adminRead} from '@/server/services/admin-http';
import {qualityView} from '@/server/repositories/admin';
import {QUALITY_BY_ID} from '@/shared/quality-checks.mjs';
// Checks of the stock for duplicates, defects and orphans (shared/quality-checks.mjs). GET reads the stored results.
// POST {check} (an id or 'all') starts the check as a build in steps of a few seconds (admin-builds.mjs) and runs one
// step; POST {check,continue:true} runs the next one. While it runs the answer is {id,running:true,done,total}; when it
// is done, the stored result (or, for 'all', every result). Nothing is changed by a check.
export async function GET(request:Request){const v=qualityView();return adminRead(request,v.tag,v.build);}
export async function POST(request:Request){try{
 requireSameOrigin(request);if(!env.DB)throw new AdminError(503,'Datenbank fehlt.');await requireAdmin();
 const body=await request.json().catch(()=>null) as {check?:unknown;continue?:unknown}|null;
 if(!body||typeof body.check!=='string'||!(body.check==='all'||Object.hasOwn(QUALITY_BY_ID,body.check)))throw new AdminError(400,'Unbekannte Prüfung.');
 const check=body.check,step=await refreshStep(env.DB,{action:body.continue===true?'step':'start',target:'quality:'+check,budgetMs:8000});
 if(step.state!=='done')return Response.json({id:check,running:true,busy:step.state==='busy',reason:(step as {reason?:string}).reason,done:step.done,total:step.total},{headers:ADMIN_HEADERS});
 const stored=await storedQualityChecks(env.DB);
 if(check==='all')return Response.json({id:check,...stored},{headers:ADMIN_HEADERS});
 const result=stored.checks[check as keyof typeof stored.checks];
 if(!result)throw new AdminError(409,'Die Prüfung wurde abgebrochen.');
 return Response.json(result,{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
