import {env} from 'cloudflare:workers';
import {requireAdmin,adminFailure,ADMIN_HEADERS} from '@/server/services/admin-auth';
import {AdminError} from '@/server/integrations/admin-access.mjs';
import {createAiLocalWork} from '@/server/integrations/ai-local-work.mjs';
import {dispatchAiLocal} from '@/server/integrations/ai-local-http.mjs';

async function handle(request:Request){try{
 await requireAdmin();
 if(!env.DB||typeof env.AI_LOCAL_SOURCES!=='function')throw new AdminError(503,'Die lokale Textablage ist hier nicht angebunden. Die KI-Verarbeitung benötigt den Node-Betrieb.');
 const work=createAiLocalWork(env.DB,{loadSources:env.AI_LOCAL_SOURCES});
 return Response.json(await dispatchAiLocal(request,work),{headers:ADMIN_HEADERS});
}catch(e){return adminFailure(e);}}
export const GET=handle;
export const POST=handle;
