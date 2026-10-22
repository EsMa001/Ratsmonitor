/**
 * Mail an den Betreiber aus einem Server-Skript (Betriebsüberwachung: notify-failure.mjs, ops-check.mjs). Die Skripte laufen in
 * Einheiten ohne Zugriff auf die Kontendatei; der Postausgang liegt dort. Deshalb geht die Mail über den Webdienst:
 * POST /api/internal/notify mit Bearer IMPORT_TOKEN (server/integrations/operator-notify.mjs). Adresse des Webdienstes:
 * RM_INTERNAL_URL, sonst http://127.0.0.1:<PORT> (wie serve.mjs lauscht). Mehrere Anläufe, weil der Webdienst nach einem
 * Neustart (Restart=always, 3 s) kurz nicht antwortet.
 */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function internalBase(env=process.env){
 return (env.RM_INTERNAL_URL||`http://${env.HOST&&env.HOST!=='0.0.0.0'?env.HOST:'127.0.0.1'}:${env.PORT||3000}`).replace(/\/+$/,'');
}
/** {sent, reason?, status?} */
export async function sendOperatorMail({subject,message},{env=process.env,attempts=5,waitMs=10000,fetchImpl=globalThis.fetch,log=console.error}={}){
 const token=env.IMPORT_TOKEN;
 if(!token||token.length<16)return {sent:false,reason:'IMPORT_TOKEN fehlt oder ist kürzer als 16 Zeichen; ohne ihn nimmt der Webdienst keine Mail an.'};
 const url=internalBase(env)+'/api/internal/notify';
 let last='';
 for(let i=1;i<=attempts;i++){
  try{
   const response=await fetchImpl(url,{method:'POST',signal:AbortSignal.timeout(30000),headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({subject,message})});
   const body=await response.json().catch(()=>({}));
   if(response.ok&&body?.sent)return {sent:true,status:response.status,...body};
   last=`${response.status} ${body?.reason||body?.error||''}`.trim();
   // 401/400/503 mit Grund (Konfiguration): weitere Anläufe ändern nichts
   if(response.status===401||response.status===400||body?.reason)return {sent:false,status:response.status,reason:last};
  }catch(error){last=error instanceof Error?error.message:String(error);}
  if(i<attempts){log(`Mail an den Betreiber, Anlauf ${i} von ${attempts}: ${last}; neuer Versuch in ${waitMs/1000} s`);await sleep(waitMs);}
 }
 return {sent:false,reason:last||'Webdienst nicht erreichbar.'};
}
