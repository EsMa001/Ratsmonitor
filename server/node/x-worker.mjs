/* Worker-Thread für plenara.X (server/integrations/x-offload.mjs): eigene Nur-Lese-Verbindung auf DATABASE_FILE,
 * nimmt {id, kind, params} entgegen und antwortet {id, ok, value} bzw. {id, ok:false, message, status, analytics}
 * oder {id, unknown:true} für eine Art, die x-registry.mjs nicht kennt. Gebaut nach dist/standalone/worker/x-worker.mjs
 * (build/worker-build.mjs); unter node:test direkt aus dem Quelltext startbar. */
import {parentPort,workerData} from 'node:worker_threads';
import {openD1} from './d1-sqlite.mjs';
import {CATALOG} from '../../shared/catalog.mjs';
import {X_FUNCTIONS} from '../integrations/x-registry.mjs';
import {AnalyticsError} from '../integrations/analytics-diffusion.mjs';
import {warmX} from '../integrations/x-cases.mjs';
import {searchDocuments,DocSearchError} from '../integrations/doc-search.mjs';
import {openDocReader} from './doc-index.mjs';

const file=workerData?.file||process.env.DATABASE_FILE;
let db;
const database=()=>db??=openD1(file,{readOnly:true,busyTimeoutMs:Number(process.env.DATABASE_BUSY_TIMEOUT_MS||5000)});
/* Dokumentsuche (/api/dokumente, server/integrations/doc-search.mjs): hier wie plenara.X, mit eigener Verbindung auf den
   Dokumentindex (fts.sqlite) statt auf x_cases */
let docs;
const LOCAL={dokumente:(d,catalog,params)=>searchDocuments(d,docs??=openDocReader(process.env.RM_PDF_STORE||'tmp/pdf-store'),catalog,params)};

parentPort.on('message',async({id,kind,params,warm})=>{
 /* {warm:true} von serve.mjs: x_cases und seine Indizes einmal lesen (warmX), Antwort die Dauer in ms */
 if(warm){try{parentPort.postMessage({id,ok:true,value:warmX(database().sqlite)});}catch(error){parentPort.postMessage({id,ok:false,message:error?.message||String(error)});}return;}
 const fn=LOCAL[kind]||X_FUNCTIONS[kind];
 if(!fn){parentPort.postMessage({id,unknown:true});return;}
 try{parentPort.postMessage({id,ok:true,value:await fn(database(),CATALOG,new URLSearchParams(params))});}
 catch(error){parentPort.postMessage({id,ok:false,message:error?.message||String(error),status:error?.status,analytics:error instanceof AnalyticsError,docSearch:error instanceof DocSearchError});}
});
