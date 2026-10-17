/* Worker-Thread für plenara.X (server/integrations/x-offload.mjs): eigene Nur-Lese-Verbindung auf DATABASE_FILE,
 * nimmt {id, kind, params} entgegen und antwortet {id, ok, value} bzw. {id, ok:false, message, status, analytics}
 * oder {id, unknown:true} für eine Art, die x-registry.mjs nicht kennt. Gebaut nach dist/standalone/worker/x-worker.mjs
 * (build/worker-build.mjs); unter node:test direkt aus dem Quelltext startbar. */
import {parentPort,workerData} from 'node:worker_threads';
import {openD1} from './d1-sqlite.mjs';
import {CATALOG} from '../../shared/catalog.mjs';
import {X_FUNCTIONS} from '../integrations/x-registry.mjs';
import {AnalyticsError} from '../integrations/analytics-diffusion.mjs';

const file=workerData?.file||process.env.DATABASE_FILE;
let db;
const database=()=>db??=openD1(file,{readOnly:true,busyTimeoutMs:Number(process.env.DATABASE_BUSY_TIMEOUT_MS||5000)});

parentPort.on('message',async({id,kind,params})=>{
 const fn=X_FUNCTIONS[kind];
 if(!fn){parentPort.postMessage({id,unknown:true});return;}
 try{parentPort.postMessage({id,ok:true,value:await fn(database(),CATALOG,new URLSearchParams(params))});}
 catch(error){parentPort.postMessage({id,ok:false,message:error?.message||String(error),status:error?.status,analytics:error instanceof AnalyticsError});}
});
