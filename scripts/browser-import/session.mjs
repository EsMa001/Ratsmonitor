// Browsersitzung des Browser-Imports: ein sichtbarer, unveränderter Chromium-Browser (Playwright) mit eigenem Kontext je
// Instanzlauf. Er durchläuft die normale Browserprüfung der Web Application Firewall wie jeder Browser und wartet, bis die
// Zielseite des Systems positiv erkannt ist (zwei gleiche Zustände hintereinander). Keine Stealth-Erweiterung, kein
// Proxy, keine Lösung von Aufgaben: verlangt die Prüfung eine Handlung (CAPTCHA), läuft das Zeitlimit ab und der Lauf
// hält an. Inhalte werden mit fetch() aus der geöffneten Seite geholt (same-origin), nie mit einem zweiten Client.
// Übernommen aus dem Land-Hadeln-Testpaket v3 (test-hadeln.mjs, 07.10.2026) und für Instanzen verallgemeinert.
import fs from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {instanceUrl,isWaf,pageState,safeName} from './core.mjs';
export class StopError extends Error{}
const snapshotOf=page=>page.evaluate(()=>({url:location.href,title:document.title,readyState:document.readyState,body:(document.body?.innerText||'').slice(0,12000)}));
/** Bytes einer Adresse aus der geöffneten Seite: fetch() same-origin mit Zeitlimit und Größenprüfung (Content-Length und gelesener Strom). */
export function pageFetch(page,url,{timeoutMs,maxBytes}){
 return page.evaluate(async({url,timeoutMs,maxBytes})=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);let reader;
  try{
   const response=await fetch(url,{credentials:'same-origin',mode:'same-origin',redirect:'follow',signal:controller.signal,headers:{'Accept':'text/html,text/calendar,application/json,application/pdf;q=0.9,*/*;q=0.5'}});
   const info={httpStatus:response.status,finalUrl:response.url,contentType:response.headers.get('content-type')||'',etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
   const declared=Number(response.headers.get('content-length')||0);
   if(declared>maxBytes){await response.body?.cancel();return {...info,error:'Antwort überschreitet das Größenlimit.'};}
   if(!response.body)return {...info,error:'Leere HTTP-Antwort.'};
   reader=response.body.getReader();const chunks=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();return {...info,error:'Antwort überschreitet das Größenlimit.'};}chunks.push(value);}
   const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
   const binary=[];for(let i=0;i<data.length;i+=16384)binary.push(String.fromCharCode(...data.subarray(i,i+16384)));
   return {...info,bodyBase64:btoa(binary.join(''))};
  }catch(error){return {error:error.name==='AbortError'?'Zeitlimit des Abrufs erreicht.':String(error.message||error)};}
  finally{clearTimeout(timer);reader?.releaseLock();}
 },{url,timeoutMs,maxBytes});
}
/**
 * Sitzung öffnen. log(text) protokolliert, diagnoseDir nimmt HTML und Bildschirmfoto bei Abbruch auf.
 * launchOverrides: nur für Tests (z. B. executablePath); im Betrieb bleibt der Browser unverändert.
 */
export async function openSession(instance,{log=()=>{},diagnoseDir=null,launchOverrides={}}={}){
 let chromium;try{({chromium}=await import('playwright'));}catch{throw Error('Playwright fehlt: pnpm install und pnpm exec playwright install chromium ausführen.');}
 const browser=await chromium.launch({headless:instance.access.headless,...launchOverrides});
 const context=await browser.newContext({acceptDownloads:false,viewport:{width:1365,height:900}});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 let closed=false;browser.on('disconnected',()=>{closed=true;});
 const session={
  instance,browser,page,version:browser.version(),
  closed:()=>closed||page.isClosed(),
  async diagnostics(name){
   if(!diagnoseDir||page.isClosed())return;
   const stem=path.join(diagnoseDir,safeName(name,60));
   await fs.mkdir(diagnoseDir,{recursive:true}).catch(()=>{});
   await fs.writeFile(stem+'.html',await page.content().catch(()=>''),'utf8').catch(()=>{});
   await page.screenshot({path:stem+'.png',fullPage:false,timeout:5000}).catch(()=>{});
  },
  /**
   * Seite öffnen und auf die positiv erkannte Zielseite warten: Browserprüfung abwarten, dann zwei gleiche „ready“-
   * Zustände hintereinander. HTTP 401/403 ohne Prüfseite und HTTP 429 beenden den Lauf (StopError).
   */
  async open(url){
   const target=instanceUrl(url,instance);if(!target)throw new StopError('Adresse gehört nicht zur Instanz: '+url);
   let httpStatus=null;
   const listener=response=>{try{if(response.request().isNavigationRequest()&&response.frame()===page.mainFrame())httpStatus=response.status();}catch{}};
   page.on('response',listener);
   const started=Date.now(),timeoutMs=instance.limits.pageTimeoutMs;
   try{
    try{await page.goto(target,{waitUntil:'domcontentloaded',timeout:Math.min(timeoutMs,60000)});}
    catch(error){if(error.name!=='TimeoutError')throw error;log('Navigation dauert an; warte weiter auf die Zielseite.');}
    let stable=0,previous='',lastLog=0;
    while(Date.now()-started<timeoutMs){
     if(session.closed())throw new StopError('Browserfenster wurde geschlossen.');
     if(httpStatus===429)throw new StopError('HTTP 429: Abruf vom Server abgewiesen; der Lauf endet ohne Wiederholung.');
     let snapshot;try{snapshot=await snapshotOf(page);}catch{await sleep(500);continue;}
     const state=pageState(snapshot,target,instance);
     if(state!=='waf'&&[401,403].includes(httpStatus))throw new StopError(`HTTP ${httpStatus}: Zugriff nicht freigegeben.`);
     if(state!=='waf'&&httpStatus>=400)throw Error(`HTTP ${httpStatus} beim Laden der Seite.`);
     const marker=snapshot.url+'|'+snapshot.title;
     stable=state==='ready'?(marker===previous?stable+1:1):0;previous=marker;
     if(stable>=2)return {...snapshot,httpStatus};
     if(Date.now()-lastLog>=5000){log(`Warte: ${state==='waf'?'Browserprüfung':state==='loading'?'Seite lädt':'Zielseite noch nicht erkannt'} | ${snapshot.title}`);lastLog=Date.now();}
     await sleep(700);
    }
    await session.diagnostics('zielseite-nicht-erkannt');
    throw new StopError('Keine Zielseite des Systems innerhalb des Zeitlimits; die Browserprüfung wird nicht umgangen.');
   }finally{page.off('response',listener);}
  },
  /** Bytes einer Adresse der Instanz aus der Sitzung. */
  fetch(url){
   const target=instanceUrl(url,instance);if(!target)return Promise.resolve({error:'Adresse gehört nicht zur Instanz: '+url});
   return pageFetch(page,target,{timeoutMs:instance.limits.fetchTimeoutMs,maxBytes:instance.limits.maxFileMiB*1024*1024});
  },
  async close(){if(browser.isConnected()){if(instance.limits.keepBrowserOpenMs>0)await sleep(instance.limits.keepBrowserOpenMs);await browser.close().catch(()=>{});}},
 };
 return session;
}
/** Antwort der Sitzung als Text und mit Prüfung: Prüfseite der WAF erkannt? */
export function decodeResponse(response){
 const body=response.bodyBase64?Buffer.from(response.bodyBase64,'base64'):Buffer.alloc(0);
 // Wie fetchText der Leser: Latin-1 nur, wenn der Typ oder der Seitenkopf es sagt; sonst UTF-8.
 const probe=body.subarray(0,2000).toString('latin1');
 const latin=/charset=["']?(?:iso-8859-1|windows-1252)/i.test(response.contentType||'')||/charset=(?:iso-8859-1|windows-1252)/i.test(probe);
 const text=new TextDecoder(latin?'windows-1252':'utf-8').decode(body);
 return {...response,body,text,waf:isWaf('',response.finalUrl||'',text.slice(0,40000))};
}
