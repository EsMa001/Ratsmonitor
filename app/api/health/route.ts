// Erreichbarkeitsprüfung für einen externen Uptime-Dienst (server/integrations/health.mjs): ohne Konto, ohne Stufe, nur lesend.
// Frei in der Zugangssperre (FREE in server/accounts/access.mjs) und in tests/route-access.test.mjs (OPEN) mit Grund.
import {env} from 'cloudflare:workers';
import {healthReport,HEALTH_HEADERS} from '@/server/integrations/health.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 const {status,body}=await healthReport(env.DB);
 return Response.json(body,{status,headers:HEALTH_HEADERS});
}
