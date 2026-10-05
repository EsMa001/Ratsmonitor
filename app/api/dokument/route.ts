import {getTopic} from '@/server/repositories/topics';

const MAX=30*1024*1024; // größere Dateien öffnen wie bisher direkt bei der Kommune
const VIEWABLE=/^(application\/pdf|image\/(png|jpe?g|gif|webp))/i;

/**
 * Durchreicher für Originalunterlagen: ?t=<Vorgang>&i=<Nummer der Unterlage>.
 * Holt das Dokument im Moment des Klicks bei der Kommune und gibt es zum Anzeigen im Browser weiter
 * (inline statt Download). Nichts wird gespeichert. Nur Unterlagen bekannter Vorgänge sind erreichbar,
 * keine beliebigen Adressen. Nicht anzeigbare oder sehr große Dateien: Weiterleitung zur Quelle.
 */
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,id=p.get('t')||'',i=Number(p.get('i'));
 if(!id||!Number.isInteger(i)||i<0)return new Response('Ungültige Anfrage.',{status:400});
 const topic=await getTopic(id).catch(()=>undefined);
 const doc=topic?.documents?.[i];
 if(!doc?.url||!/^https?:\/\//i.test(doc.url))return new Response('Unterlage nicht gefunden.',{status:404});
 let res:Response;
 try{res=await fetch(doc.url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (Plenara Dokumentenansicht)'}});}
 catch{return errorPage(doc.url);}
 if(!res.ok||!res.body)return errorPage(doc.url);
 const size=Number(res.headers.get('content-length')||0);
 const disp=res.headers.get('content-disposition')||'';
 const name=(/filename\*=UTF-8''([^;]+)/i.exec(disp)?.[1]&&decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(disp)![1]))||/filename="?([^";]+)"?/i.exec(disp)?.[1]||'';
 let type=(res.headers.get('content-type')||'').split(';')[0].trim();
 if(!VIEWABLE.test(type)&&/\.pdf$/i.test(name||new URL(res.url).pathname))type='application/pdf';
 if(!VIEWABLE.test(type)||size>MAX){res.body.cancel();return Response.redirect(doc.url,302);}
 const headers=new Headers({'Content-Type':type,'Cache-Control':'private, max-age=600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:",'Content-Disposition':`inline${name?`; filename*=UTF-8''${encodeURIComponent(name)}`:''}`});
 if(size)headers.set('Content-Length',String(size));
 return new Response(res.body,{status:200,headers});
}

function errorPage(url:string){
 const u=url.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Unterlage nicht erreichbar</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 16px;color:#0f172a"><h1 style="font-size:22px">Unterlage gerade nicht erreichbar</h1><p style="color:#64748b">Das Ratsinformationssystem der Kommune antwortet im Moment nicht. Versuchen Sie es später erneut oder öffnen Sie die Unterlage direkt bei der Quelle.</p><p><a href="${u}" style="color:#0d9488">Direkt bei der Kommune öffnen →</a></p></body></html>`,{status:502,headers:{'Content-Type':'text/html; charset=utf-8'}});
}
