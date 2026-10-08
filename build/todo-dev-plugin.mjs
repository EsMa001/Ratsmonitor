import {handleTodoRequest} from '../server/integrations/todos-file.mjs';
// Nur für den lokalen Dev-Server (apply: 'serve'): /__todos liest und schreibt docs/todo/todos.json (interne To-Do-Liste).
// Die API-Routen laufen im Dev-Server in einer Worker-Umgebung ohne Zugriff auf Projektdateien, darum geht das hier in Node.
export function todoDev(){
 return {
  name:'todo-dev',
  apply:'serve',
  configureServer(server){
   server.middlewares.use('/__todos',(req,res)=>{
    const chunks=[];
    req.on('data',chunk=>chunks.push(chunk));
    req.on('end',async()=>{
     const {status,body}=await handleTodoRequest({method:req.method,origin:req.headers.origin,host:req.headers.host,contentType:req.headers['content-type'],text:Buffer.concat(chunks).toString('utf8')});
     res.statusCode=status;
     res.setHeader('Content-Type','application/json');
     res.setHeader('Cache-Control','private, no-store, max-age=0');
     res.setHeader('X-Robots-Tag','noindex, nofollow');
     res.end(JSON.stringify(body));
    });
   });
  },
 };
}
