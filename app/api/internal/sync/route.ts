import { env } from 'cloudflare:workers';
import {validRegion} from '@/shared/regions';
import { runSync } from '@/server/services/sync';
export async function POST(request: Request) {
    if (!env.IMPORT_TOKEN || request.headers.get('authorization') !== 'Bearer ' + env.IMPORT_TOKEN)
        return Response.json({ error: 'Nicht autorisiert' }, { status: 401 });
    const mode = new URL(request.url).searchParams.get('mode') || 'metadata';
    if (mode !== 'metadata' && mode !== 'summaries')
        return Response.json({ error: 'Ungültiger Importmodus' }, { status: 400 });
    if(mode==='summaries')return Response.json({error:'Textverarbeitung ist hier deaktiviert. Bitte im angemeldeten Adminbereich manuell starten.'},{status:403});
    const region=new URL(request.url).searchParams.get('region')||'muenster';
    if(!validRegion(region))return Response.json({error:'Unbekanntes Gebiet'},{status:400});
    // window: look-back period ('1w' … '24m'); without it the established twelve months. An unknown value is refused by runSync.
    const result = await runSync(mode,region,request.headers.get('x-import-trigger')==='scheduled'?'scheduled':'manual',{window:new URL(request.url).searchParams.get('window')||undefined});
    return Response.json(result.data, { status: result.status, headers: {'Cache-Control':'no-store',...(result.status===409?{'Retry-After':'60'}:{})} });
}

/** Operator-only run history. Public coverage is available on the sources page. */
export async function GET(request: Request) {
    if (!env.IMPORT_TOKEN || request.headers.get('authorization') !== 'Bearer ' + env.IMPORT_TOKEN)
        return Response.json({error:'Nicht autorisiert'},{status:401});
    if(!env.DB)return Response.json({error:'Datenbank fehlt'},{status:503});
    const runs=await env.DB.prepare('SELECT id,started_at,finished_at,status,details FROM import_runs ORDER BY started_at DESC LIMIT 50').all();
    return Response.json({runs:runs.results.map((r:any)=>({...r,details:JSON.parse(r.details)}))},{headers:{'Cache-Control':'no-store'}});
}
