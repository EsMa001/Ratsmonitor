import {AdminError,requireSameOrigin} from './admin-access.mjs';

export const AI_LOCAL_HEADERS={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow'};
export const AI_LOCAL_BODY_LIMIT=3_000_000;
const actions=new Set(['claim','read','renew','release','submit','fail']);

// Authentication belongs to the caller: owner session in production, loopback only in development.
export async function dispatchAiLocal(request,work){
 if(request.method==='GET'){
  const p=new URL(request.url).searchParams;
  const limit=p.get('limit')||'25';
  if(!/^\d+$/.test(limit)||Number(limit)<1||Number(limit)>100)throw new AdminError(400,'Bitte 1 bis 100 Berichte je Seite wählen.');
  return work.list({regions:p.get('regions')==='all'?'all':(p.get('regions')||'').split(',').filter(Boolean),window:p.get('window')||'all',state:p.get('state')||'open',limit:Number(limit),cursor:p.get('cursor')||undefined});
 }
 if(request.method!=='POST')throw new AdminError(405,'Anfragemethode nicht unterstützt.');
 requireSameOrigin(request);
 let size=0,parts=[];
 if(request.body){
  const reader=request.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>AI_LOCAL_BODY_LIMIT){await reader.cancel();throw new AdminError(413,'Ergebnis zu groß.');}parts.push(value);}}finally{reader.releaseLock();}
 }
 let body;
 try{const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.byteLength;}body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AdminError(400,'Ungültige JSON-Anfrage.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||!actions.has(body.action))throw new AdminError(400,'Ungültige Aktion.');
 return work[body.action](body);
}
