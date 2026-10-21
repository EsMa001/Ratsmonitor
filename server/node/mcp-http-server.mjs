// Startet den Kunden-MCP über HTTP (server/mcp/http.mjs) als eigenen Prozess (systemd: ratsmonitor-mcp.service).
// Liest nur MCP_* aus der Umgebung (/etc/ratsmonitor/mcp.env), nie die Kontendatei und nie IMPORT_TOKEN:
//   MCP_DATABASE_FILE   Inhaltsdatei, wird nur lesend geöffnet (query_only)
//   MCP_CUSTOMERS_FILE  Kundendatei des Betreibers (scripts/mcp-customers.mjs)
//   MCP_TOKEN_SECRET    Geheimnis für die Zugangstoken, dasselbe wie in der Web-App
//   MCP_ISSUER          öffentliche Adresse ohne Pfad (https://plenara.de)
//   MCP_PORT, MCP_HOST  Standard 3002 auf 127.0.0.1 (Caddy leitet /mcp und /.well-known/oauth-* hierher)
import http from 'node:http';
import {Readable} from 'node:stream';
import {openD1} from './d1-sqlite.mjs';
import {createMcpHttpHandler} from '../mcp/http.mjs';
import {customerStore} from '../mcp/customers.mjs';
import {tokenSecret} from '../mcp/tokens.mjs';

export class McpHttpConfigError extends Error {}

/** Node-Anfrage → Request (Adresse aus der öffentlichen Origin, nicht aus Host-Kopfzeilen) */
export function toRequest(req,origin){
 const headers=new Headers();
 for(const [k,v] of Object.entries(req.headers))if(v!==undefined)for(const item of [v].flat())headers.append(k,item);
 const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req);
 return new Request(new URL(req.url||'/',origin),{method:req.method,headers,body,duplex:'half'});
}
async function send(res,response){
 res.statusCode=response.status;
 response.headers.forEach((v,k)=>res.setHeader(k,v));
 if(!response.body){res.end();return;}
 for await(const chunk of response.body)res.write(chunk);
 res.end();
}

export async function startMcpHttp(env=process.env,{log=line=>process.stderr.write(JSON.stringify(line)+'\n')}={}){
 const issuer=String(env.MCP_ISSUER||'').replace(/\/+$/,'');
 if(!env.MCP_DATABASE_FILE||!env.MCP_CUSTOMERS_FILE||!issuer)throw new McpHttpConfigError('MCP_DATABASE_FILE, MCP_CUSTOMERS_FILE und MCP_ISSUER sind erforderlich.');
 let secret;
 try{secret=tokenSecret(env.MCP_TOKEN_SECRET);}catch(error){throw new McpHttpConfigError(error.message);}
 const db=openD1(env.MCP_DATABASE_FILE,{readOnly:true});
 await db.exec('PRAGMA query_only=ON');
 // Passt die Inhaltsdatei? Der Dienst migriert nie (wie der STDIO-Weg in mcp-runtime.mjs)
 try{
  await db.prepare('SELECT id,region_id,date,title,label,status,search,teaser,gremium FROM search_cards LIMIT 0').all();
  await db.prepare('SELECT id,region_id,event_date,active,payload FROM topics LIMIT 0').all();
 }catch{db.close();throw new McpHttpConfigError('Die Inhaltsdatei passt nicht (Migrationen fehlen); der MCP-Dienst migriert nicht.');}
 const customers=customerStore(env.MCP_CUSTOMERS_FILE);
 const problem=customers.problem();
 if(problem)log({event:'mcp_http_customers',problem});
 const handle=createMcpHttpHandler({db,customers,secret,issuer,audit:event=>log({...event,at:new Date().toISOString()})});
 const server=http.createServer(async(req,res)=>{
  try{await send(res,await handle(toRequest(req,issuer)));}
  catch{if(!res.headersSent){res.statusCode=500;res.setHeader('Content-Type','application/json');}res.end('{"error":"internal_error"}');}
 });
 server.requestTimeout=120_000;
 server.headersTimeout=20_000;
 server.keepAliveTimeout=65_000;
 const port=Number(env.MCP_PORT||3002),host=env.MCP_HOST||'127.0.0.1';
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 log({event:'mcp_http_listening',host,port,resource:issuer+'/mcp'});
 // Offene Keep-alive-Verbindungen sofort schließen, sonst wartet close() bis zu 65 s
 const close=async()=>{const done=new Promise(r=>server.close(()=>r()));server.closeAllConnections?.();await done;db.close();};
 return {server,close,port:server.address().port};
}
