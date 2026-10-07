// Transport für die Leser des Projekts: eine get(url, source)-Funktion, die Seiten über die Browsersitzung holt
// (session.mjs). Die Leser (collectSdnet …) bleiben unverändert; sie sehen nur einen anderen Abruf. Regeln:
// - Nur Adressen der Instanz (Herkunft und Basispfad), nacheinander, mit Mindestabstand (limits.delayMs).
// - Eine Prüfseite der WAF im Ergebnis heißt: die Sitzung ist nicht mehr freigegeben. Die Startseite wird einmal neu
//   geöffnet (Browserprüfung regulär abgewartet), dann wird der Abruf einmal wiederholt. Bleibt es bei der Prüfseite:
//   Lauf angehalten.
// - HTTP 401, 403 und 429 halten den Lauf an: keine weitere Anfrage dieses Laufs, keine Wiederholung. Die Leser
//   bekommen danach bei jedem Abruf sofort den Abbruchgrund (ohne Netz), damit sie zügig mit ihrem Stand enden.
// - Mehr als limits.maxRequests Anfragen: „Zeitbudget der Quelle erreicht“, was die Leser als fortsetzbar werten.
import {setTimeout as sleep} from 'node:timers/promises';
import {BUDGET_REACHED,REFUSED} from '../../server/integrations/request-budget.mjs';
import {instanceUrl} from './core.mjs';
import {StopError,decodeResponse} from './session.mjs';
/**
 * @param session Sitzung aus openSession (oder eine Attrappe mit fetch(url) und open(url) für Tests)
 * @param instance geprüfte Instanzkonfiguration
 * @param options log(text); onRequest(record) je Anfrage (Adresse, Status, Dauer, Bytes); sleepFn für Tests
 */
export function browserTransport(session,instance,{log=()=>{},onRequest=()=>{},sleepFn=sleep}={}){
 const startUrl=new URL(instance.entryPaths.start,new URL(instance.basePath,instance.origin)).href;
 const state={requests:0,stopped:null,waf:0,reopened:0,bytes:0};
 let chain=Promise.resolve(),lastAt=0;
 const stop=reason=>{if(!state.stopped){state.stopped=reason;log('ANGEHALTEN: '+reason);}return new StopError(reason);};
 async function once(url,source){
  if(state.stopped)throw new StopError(state.stopped);
  const target=instanceUrl(url,instance);
  if(!target||(source?.base&&!instanceUrl(url,{origin:new URL(source.base).origin,basePath:new URL(source.base).pathname})))throw Error('Nicht freigegebene Quelladresse');
  if(state.requests>=instance.limits.maxRequests)throw Error(BUDGET_REACHED);
  for(let attempt=0;attempt<2;attempt++){
   const wait=instance.limits.delayMs-(Date.now()-lastAt);if(wait>0)await sleepFn(wait);
   lastAt=Date.now();state.requests++;
   const began=Date.now();const response=decodeResponse(await session.fetch(target));
   const record={url:target,finalUrl:response.finalUrl||null,httpStatus:response.httpStatus??null,contentType:response.contentType||'',bytes:response.body?.length||0,ms:Date.now()-began,waf:response.waf,error:response.error||null};
   state.bytes+=record.bytes;onRequest(record);
   if(response.waf){
    state.waf++;
    if(attempt===0){state.reopened++;log('Prüfseite der WAF statt Inhalt: Startseite wird neu geöffnet, Browserprüfung wird abgewartet.');await session.open(startUrl);continue;}
    throw stop('Die Sitzung liefert weiterhin die Prüfseite der WAF; der Abruf wird nicht umgangen.');
   }
   if(response.error)throw Error(response.error);
   if(response.finalUrl&&!instanceUrl(response.finalUrl,instance))throw Error('Weiterleitung auf eine andere Website: '+response.finalUrl);
   const status=response.httpStatus;
   if(status===429)throw stop('HTTP 429: Abruf vom Server abgewiesen ('+REFUSED+').');
   if(status===401||status===403)throw stop(`HTTP ${status}: Zugriff nicht freigegeben.`);
   if(!(status>=200&&status<300))throw Error('Quelle antwortet mit HTTP '+status);
   return response.text;
  }
  throw stop('Abruf ohne Ergebnis.');
 }
 /** get(url, source): Abrufe laufen nacheinander (die Leser fragen parallel). */
 const get=(url,source)=>{const run=chain.then(()=>once(url,source));chain=run.catch(()=>{});return run;};
 return {get,state,startUrl};
}
