// Kunden-MCP über HTTPS (Streamable HTTP, zustandslos, JSON-Antworten): ein Dienst auf dem Server unter /mcp, nur lesend.
// Anmeldung mit einem Schlüssel des Betreibers (plk_…) oder einem OAuth-Zugangstoken der Web-App (pat_…). Welche
// Gebiete und welche Mengengrenze gelten, steht nur in der Kundendatei (customers.mjs). Die Kontendatei öffnet dieser
// Dienst nie. Dazu die Beschreibungen für OAuth-Clients (RFC 9728 und RFC 8414) unter /.well-known/.
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createRatsmonitorMcpServer,minuteLimiter} from './server.mjs';
import {createCustomerData} from '../integrations/mcp-customer-data.mjs';
import {KEY_PREFIX} from './customers.mjs';
import {ACCESS_PREFIX,SCOPE,verifyAccessToken} from './tokens.mjs';
import {clientIp} from '../accounts/http.mjs';

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
 'Access-Control-Expose-Headers':'WWW-Authenticate, Mcp-Session-Id','Access-Control-Max-Age':'600'};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...CORS,...headers}});
const BEARER=/^Bearer ([A-Za-z0-9._~+/-]+=*)$/;

/** Beschreibung des Anmeldedienstes; die Endpunkte gehören der Web-App (server/accounts/oauth.mjs) */
export const authorizationServerMetadata=issuer=>({
 issuer,authorization_endpoint:issuer+'/oauth/authorize',token_endpoint:issuer+'/oauth/token',
 registration_endpoint:issuer+'/oauth/register',revocation_endpoint:issuer+'/oauth/revoke',
 response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],
 code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],
 revocation_endpoint_auth_methods_supported:['none'],scopes_supported:[SCOPE],authorization_response_iss_parameter_supported:true,
});
export const protectedResourceMetadata=issuer=>({
 resource:issuer+'/mcp',authorization_servers:[issuer],scopes_supported:[SCOPE],bearer_methods_supported:['header'],
 resource_name:'Plenara: Berichte aus Räten und Ausschüssen',
});

/** Wenige gleichzeitige Werkzeugaufrufe für den ganzen Dienst, damit die Datenbank für die Website frei bleibt */
function gate(size,waitMs){
 let running=0;const queue=[];
 const next=()=>{while(running<size&&queue.length){const job=queue.shift();if(job.done)continue;running++;job.start();}};
 return fn=>new Promise((resolve,reject)=>{
  const job={done:false,start:()=>{job.done=true;clearTimeout(job.timer);Promise.resolve().then(fn).then(resolve,reject).finally(()=>{running--;next();});}};
  job.timer=setTimeout(()=>{if(!job.done){job.done=true;reject(Object.assign(new Error('busy'),{busy:true}));}},waitMs);
  queue.push(job);next();
 });
}

/**
 * Handler für Request → Response. db: Inhaltsdatei nur lesend; customers: customerStore(); secret: MCP_TOKEN_SECRET;
 * issuer: öffentliche Adresse (SITE_URL), daraus die Adresse des MCP (issuer + '/mcp').
 */
export function createMcpHttpHandler({db,customers,secret,issuer,maxBodyBytes=1_000_000,concurrency=4,waitMs=30_000,audit=()=>{},now=()=>Date.now()}){
 if(!/^https?:\/\/[^/]+$/.test(String(issuer||'')))throw new Error('Die öffentliche Adresse (MCP_ISSUER) muss eine Origin ohne Pfad sein.');
 const resource=issuer+'/mcp',metadataUrl=issuer+'/.well-known/oauth-protected-resource/mcp';
 const services=new Map(),failures=new Map(),run=gate(concurrency,waitMs);
 const challenge=(error,description)=>`Bearer ${error?`error="${error}", error_description="${description}", `:''}resource_metadata="${metadataUrl}"`;
 const unauthorized=(error,description)=>json({error:error||'unauthorized',error_description:description||'Anmeldung erforderlich.'},401,{'WWW-Authenticate':challenge(error,description)});

 /** Zu viele falsche Anmeldungen von einer Adresse: 10 Minuten Pause */
 function failedTooOften(ip,at){
  const list=(failures.get(ip)||[]).filter(t=>t>at-600000);
  failures.set(ip,list);
  if(failures.size>10000)for(const [k,v] of failures)if(!v.length||v.at(-1)<=at-600000)failures.delete(k);
  return list.length>=30;
 }
 const noteFailure=(ip,at)=>failures.set(ip,[...(failures.get(ip)||[]),at]);

 async function authenticate(header){
  const match=BEARER.exec(header||'');
  if(!match)return {missing:true};
  const token=match[1];
  if(token.startsWith(KEY_PREFIX)){
   const hit=customers.byKey(token);
   return hit?{customer:hit.customer,via:'key',keyId:hit.keyId,token}:{invalid:true};
  }
  if(token.startsWith(ACCESS_PREFIX)){
   const payload=await verifyAccessToken(token,{secret,audience:resource,now:now()});
   const customer=payload&&customers.byIdentity(payload.cus);
   // Der Betreiber kann ein Konto jederzeit aus dem Kunden nehmen: gilt sofort, auch für noch gültige Token
   if(!customer||!customer.accounts.includes(payload.sub))return {invalid:true};
   return {customer,via:'oauth',user:payload.sub,client:payload.cid,expiresAt:payload.exp,token};
  }
  return {invalid:true};
 }

 function serviceFor(customer){
  const key=customer.identity+'\u0000'+customer.allowedRegionIds.join(',')+'\u0000'+customer.requestsPerMinute;
  let entry=services.get(customer.identity);
  if(!entry||entry.key!==key){
   entry={key,service:createCustomerData(db,{customerId:customer.identity,allowedRegionIds:customer.allowedRegionIds}),limiter:minuteLimiter(customer.requestsPerMinute)};
   services.set(customer.identity,entry);
  }
  return entry;
 }

 async function readBody(request){
  if(Number(request.headers.get('content-length')||0)>maxBodyBytes)return {tooLarge:true};
  let size=0;const parts=[];
  if(request.body){
   const reader=request.body.getReader();
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBodyBytes){await reader.cancel().catch(()=>{});return {tooLarge:true};}parts.push(value);}
  }
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.byteLength;}
  try{return {body:JSON.parse(new TextDecoder().decode(bytes))};}catch{return {invalid:true};}
 }

 async function mcp(request){
  const at=now(),ip=clientIp(request);
  if(failedTooOften(ip,at))return json({error:'too_many_requests',error_description:'Zu viele fehlgeschlagene Anmeldungen. Bitte später erneut.'},429,{'Retry-After':'600'});
  const auth=await authenticate(request.headers.get('authorization'));
  if(auth.missing)return unauthorized();
  if(auth.invalid){noteFailure(ip,at);audit({event:'mcp_http_auth',success:false});return unauthorized('invalid_token','Schlüssel oder Token ungültig oder abgelaufen.');}
  if(request.method!=='POST')return json({error:'method_not_allowed',error_description:'Dieser Dienst arbeitet ohne Sitzungen; nur POST.'},405,{Allow:'POST, OPTIONS'});
  const read=await readBody(request);
  if(read.tooLarge)return json({error:'too_large'},413);
  if(read.invalid)return json({jsonrpc:'2.0',error:{code:-32700,message:'Parse error'},id:null},400);
  const {customer}=auth;
  let entry;
  try{entry=serviceFor(customer);}
  catch{audit({event:'mcp_http_config',identity:customer.identity,success:false});return json({error:'unavailable',error_description:'Dieser Zugang ist gerade nicht eingerichtet. Bitte den Betreiber fragen.'},503);}
  const context={identity:customer.identity,via:auth.via,...(auth.user?{user:auth.user,client:auth.client}:{keyId:auth.keyId})};
  try{
   return await run(async()=>{
    const server=createRatsmonitorMcpServer({mode:'customer',customer:entry.service,identity:customer.identity,requestsPerMinute:customer.requestsPerMinute,
     limiter:entry.limiter,audit:event=>audit({...event,...context})});
    const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    try{
     await server.connect(transport);
     const response=await transport.handleRequest(request,{parsedBody:read.body,authInfo:{token:auth.token,clientId:auth.client||auth.keyId,scopes:[SCOPE],
      ...(auth.expiresAt?{expiresAt:auth.expiresAt}:{}),resource:new URL(resource),extra:context}});
     const headers=new Headers(response.headers);
     for(const [k,v] of Object.entries(CORS))headers.set(k,v);
     headers.set('Cache-Control','no-store');
     return new Response(await response.arrayBuffer(),{status:response.status,headers});
    }finally{await server.close().catch(()=>{});}
   });
  }catch(error){
   if(error?.busy)return json({error:'busy',error_description:'Der Dienst ist ausgelastet. Bitte gleich erneut versuchen.'},503,{'Retry-After':'5'});
   audit({event:'mcp_http_error',identity:customer.identity,success:false});
   return json({error:'internal_error'},500);
  }
 }

 return async function handle(request){
  const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')||'/';
  const known=path==='/mcp'||path.startsWith('/.well-known/oauth-');
  if(request.method==='OPTIONS'&&known)return new Response(null,{status:204,headers:CORS});
  if(path==='/.well-known/oauth-protected-resource'||path==='/.well-known/oauth-protected-resource/mcp')
   return request.method==='GET'||request.method==='HEAD'?json(protectedResourceMetadata(issuer),200,{'Cache-Control':'public, max-age=3600'}):json({error:'method_not_allowed'},405);
  if(path==='/.well-known/oauth-authorization-server'||path==='/.well-known/oauth-authorization-server/mcp')
   return request.method==='GET'||request.method==='HEAD'?json(authorizationServerMetadata(issuer),200,{'Cache-Control':'public, max-age=3600'}):json({error:'method_not_allowed'},405);
  if(path==='/health')return json({ok:!customers.problem(),problem:customers.problem()});
  if(path==='/mcp')return mcp(request);
  return json({error:'not_found'},404);
 };
}
