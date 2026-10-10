import {getTopic} from '@/server/repositories/topics';
import {fetchDocument,idleLimited,documentName,blockedTarget,VIEWABLE,MAX_BYTES} from '@/server/integrations/document-proxy.mjs';

/**
 * Durchreicher für Originalunterlagen: ?t=<Vorgang>&i=<Nummer der Unterlage>.
 * Holt das Dokument im Moment des Klicks bei der Kommune und gibt es zum Anzeigen im Browser weiter
 * (inline statt Download). Nichts wird gespeichert. Nur Unterlagen bekannter Vorgänge sind erreichbar,
 * keine beliebigen Adressen. Nicht anzeigbare oder sehr große Dateien, Adressen ohne https: Weiterleitung zur Quelle.
 * Der Abruf folgt Weiterleitungen nur mit Prüfung des Ziels (document-proxy.mjs): nie ins eigene Netz.
 */
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,id=p.get('t')||'',i=Number(p.get('i'));
 if(!id||!Number.isInteger(i)||i<0)return new Response('Ungültige Anfrage.',{status:400});
 const topic=await getTopic(id).catch(()=>undefined);
 const doc=topic?.documents?.[i];
 if(!doc?.url||!/^https?:\/\//i.test(doc.url))return new Response('Unterlage nicht gefunden.',{status:404});
 // Not fetched by the server (http, an internal address): the browser opens the source itself, as before for large files.
 if(blockedTarget(doc.url))return Response.redirect(doc.url,302);
 let fetched:Awaited<ReturnType<typeof fetchDocument>>;
 try{fetched=await fetchDocument(doc.url);}
 catch{return errorPage(doc.url);}
 const {response:res,url:finalUrl,control}=fetched;
 if(!res.ok||!res.body){await res.body?.cancel().catch(()=>{});return errorPage(doc.url);}
 // With Content-Encoding the length names the compressed body, which the runtime has already unpacked: not passed on.
 const size=Number(res.headers.get('content-length')||0),encoded=Boolean(res.headers.get('content-encoding'));
 const name=documentName(res.headers.get('content-disposition'));
 let type=(res.headers.get('content-type')||'').split(';')[0].trim();
 if(!VIEWABLE.test(type)&&/\.pdf$/i.test(name||new URL(finalUrl).pathname))type='application/pdf';
 if(!VIEWABLE.test(type)||size>MAX_BYTES){await res.body.cancel().catch(()=>{});return Response.redirect(doc.url,302);}
 const headers=new Headers({'Content-Type':type,'Cache-Control':'private, max-age=600','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:",'Content-Disposition':`inline${name?`; filename*=UTF-8''${encodeURIComponent(name)}`:''}`});
 if(size&&!encoded)headers.set('Content-Length',String(size));
 return new Response(idleLimited(res.body,(reason:unknown)=>control.abort(reason)),{status:200,headers});
}

function errorPage(url:string){
 const u=url.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Unterlage nicht erreichbar</title><body style="font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 16px;color:#0f172a"><h1 style="font-size:22px">Unterlage gerade nicht erreichbar</h1><p style="color:#64748b">Das Ratsinformationssystem der Kommune antwortet im Moment nicht. Versuchen Sie es später erneut oder öffnen Sie die Unterlage direkt bei der Quelle.</p><p><a href="${u}" style="color:#0d9488">Direkt bei der Kommune öffnen →</a></p></body></html>`,{status:502,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
}
