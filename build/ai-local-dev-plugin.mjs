import {openLocalAiWork} from '../server/node/ai-local-runtime.mjs';
import {dispatchAiLocal,AI_LOCAL_HEADERS,AI_LOCAL_BODY_LIMIT} from '../server/integrations/ai-local-http.mjs';

export function isLocalAiRequest(req){
 const remote=req.socket?.remoteAddress;
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote))return false;
 try{
  const url=new URL(`http://${req.headers.host}`);
  return ['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password&&req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||req.headers.origin===url.origin);
 }catch{return false;}
}

export function aiLocalDev(){
 let runtime;
 return {name:'ai-local-dev',apply:'serve',configureServer(server){
  server.httpServer?.once('close',()=>{runtime?.close();runtime=undefined;});
  server.middlewares.use('/api/admin/ai-local',async(req,res)=>{
   for(const [key,value] of Object.entries(AI_LOCAL_HEADERS))res.setHeader(key,value);
   res.setHeader('Content-Type','application/json; charset=utf-8');
   try{
    if(!isLocalAiRequest(req))throw Object.assign(new Error('Dieser lokale Zugang ist nur auf diesem Rechner verfügbar.'),{status:403});
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>AI_LOCAL_BODY_LIMIT)throw Object.assign(new Error('Ergebnis zu groß.'),{status:413});chunks.push(chunk);}
    runtime??=openLocalAiWork();
    const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
    const body=await dispatchAiLocal(request,runtime.work);
    res.statusCode=200;res.end(JSON.stringify(body));
   }catch(error){res.statusCode=error.status||503;res.end(JSON.stringify({error:error.message||'Lokale Verarbeitung nicht verfügbar.'}));}
  });
 }};
}
