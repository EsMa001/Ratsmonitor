// Reine Hilfsfunktionen des Browser-Imports (ohne Browser, ohne Netz), übernommen aus dem Land-Hadeln-Testpaket v3
// (core.mjs, 07.10.2026) und für mehrere Instanzen verallgemeinert: Adressprüfung, WAF-Erkennung, positive
// Zielseitenprüfung, Dateinamen, PDF-Plausibilität, Instanzkonfiguration. Tests: tests/browser-import.test.mjs.
import crypto from 'node:crypto';
export const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export const shortHash=value=>sha256(value).slice(0,10);
/** Adresse derselben Website (Herkunft) unterhalb des Basispfads, ohne Fragment; opake Parameter („__“) bleiben unverändert. null sonst. */
export function instanceUrl(href,instance){
 try{
  const base=new URL(instance.basePath||'/',instance.origin),url=new URL(href,base);
  if(!['http:','https:'].includes(url.protocol)||url.origin!==base.origin||url.username||url.password)return null;
  if(!url.pathname.toLowerCase().startsWith(base.pathname.toLowerCase().replace(/\/$/,'')))return null;
  url.hash='';return url.href;
 }catch{return null;}
}
/** Prüfseite der Web Application Firewall (deutsch und englisch) nach Titel, Adresse oder Seitentext. */
export function isWaf(title='',url='',body=''){
 return /rescaled\s*waf|browser[-\s]*(?:überprüfung|ueberpruefung|verification)|verifying(?:\s+your)?\s+browser/i.test(title)
  ||/\/\.well-known\/rescaled-waf\//i.test(url)
  ||/verifying your browser|rescaled\s*waf|unsere web application firewall|our web application firewall/i.test(String(body).slice(0,6000));
}
/** Erkennungsmuster der unterstützten Systeme: Titel der Zielseite. */
export const ADAPTERS=Object.freeze({
 sdnet:{name:'SD.NET RIM',title:/\bSD[.\s-]*NET\b/i,oparlPath:'/webservice/oparl/v1.1/system'},
});
/**
 * Zustand der geladenen Seite gegenüber der angeforderten Adresse: 'waf' (Prüfseite), 'other' (andere Website, anderer
 * Pfad oder andere Abfrage, Fehler- oder Anmeldeseite), 'loading' (noch nicht fertig), 'ready' (Zielseite des Systems).
 * „Kein WAF-Text“ ist kein Bereitschaftssignal: ready verlangt denselben Pfad und dieselben Parameter, readyState
 * complete, den Systemtitel und einen nicht leeren Text. Ein „Loading …“-Titel ist nicht ready.
 */
export function pageState(snapshot,expectedUrl,instance,adapter=ADAPTERS[instance?.adapter]||ADAPTERS.sdnet){
 if(isWaf(snapshot.title,snapshot.url,snapshot.body))return 'waf';
 const actual=instanceUrl(snapshot.url,instance),expected=instanceUrl(expectedUrl,instance);
 if(!actual||!expected)return 'other';
 const a=new URL(actual),e=new URL(expected);
 if(a.pathname.replace(/\/$/,'')!==e.pathname.replace(/\/$/,''))return 'other';
 // Die opake Abfrage eines Vorgangs gehört zur Identität der Seite (eine andere Abfrage ist eine andere Seite).
 if(e.search&&a.search!==e.search)return 'other';
 if(snapshot.readyState!=='complete')return 'loading';
 if(/^Loading\b/i.test(String(snapshot.title||'').trim()))return 'loading';
 const body=String(snapshot.body||'').trim();
 return adapter.title.test(snapshot.title||'')&&body.length>=20?'ready':'other';
}
export function safeName(value,max=76){
 let result=String(value||'').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/\s+/g,'_').replace(/^[. ]+|[. ]+$/g,'').slice(0,max).replace(/[. ]+$/g,'');
 if(!result)result='dokument';
 if(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(result))result=`_${result}`;
 return result;
}
/** Dateiname eines Dokuments: Name aus der Adresse plus kurzer Hash der Adresse (gleiche Namen in verschiedenen Pfaden kollidieren nicht). */
export function documentName(url){
 let name=new URL(url).pathname.split('/').pop()||'dokument';
 try{name=decodeURIComponent(name);}catch{}
 return `${safeName(name.replace(/\.pdf$/i,''),55)}_${shortHash(url)}.pdf`;
}
/** Plausibilität einer PDF-Datei: Kopf „%PDF-“ und Endmarkierung „%%EOF“ in den letzten 4 KB. Keine Strukturprüfung. */
export function checkPdf(buffer){
 if(buffer.length<10||!/^%PDF-(?:1\.[0-9]|2\.0)/.test(buffer.subarray(0,12).toString('ascii')))return {ok:false,reason:'Kein PDF-Kopf (%PDF-); stattdessen wahrscheinlich HTML.'};
 if(!buffer.subarray(Math.max(0,buffer.length-4096)).includes(Buffer.from('%%EOF')))return {ok:false,reason:'PDF-Endmarkierung fehlt; Datei wahrscheinlich unvollständig.'};
 return {ok:true,reason:'PDF-Kopf und Endmarkierung vorhanden (Plausibilitätsprüfung).'};
}
export function csvCell(value){
 let text=String(value??'');
 if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text=`'${text}`;
 return `"${text.replaceAll('"','""')}"`;
}
export const LIMITS=Object.freeze({
 delayMs:[1000,60000,1200],pageTimeoutMs:[1000,300000,120000],fetchTimeoutMs:[1000,300000,60000],maxFileMiB:[1,100,25],
 maxRequests:[1,20000,600],maxDurationMs:[10000,14400000,1800000],maxDocuments:[1,2000,20],keepBrowserOpenMs:[0,60000,3000],
});
/**
 * Instanzkonfiguration prüfen und mit Standardwerten vervollständigen (scripts/browser-import/instances/*.json).
 * Herkunft und Basispfad bleiben getrennt (ein Installations-Unterpfad wird nicht abgeschnitten).
 */
export function validateInstance(input){
 if(!input||typeof input!=='object')throw Error('Instanzkonfiguration fehlt.');
 if(input.schemaVersion!==1)throw Error('schemaVersion muss 1 sein.');
 if(!/^[a-z0-9][a-z0-9-]{1,60}$/.test(String(input.instanceId||'')))throw Error('instanceId: Kleinbuchstaben, Ziffern, Bindestriche.');
 const adapter=input.adapter||'sdnet';if(!ADAPTERS[adapter])throw Error('adapter unbekannt: '+adapter);
 let origin;try{origin=new URL(input.origin);}catch{throw Error('origin fehlt oder ist keine Adresse.');}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('origin muss eine https-Herkunft ohne Pfad sein.');
 const basePath=String(input.basePath||'/');if(!basePath.startsWith('/')||!basePath.endsWith('/'))throw Error('basePath muss mit / beginnen und enden.');
 const regions=Array.isArray(input.regions)?input.regions:[];
 if(!regions.length||regions.some(r=>!r||typeof r.id!=='string'||!/^(?:nrw|nds|de)-\d{3,12}$|^[a-z]+$/.test(r.id)||typeof r.name!=='string'||!r.name))throw Error('regions: mindestens ein Gebiet mit id und name.');
 const limits={};for(const [name,[low,high,fallback]] of Object.entries(LIMITS)){const v=input.limits?.[name]??fallback;if(!Number.isInteger(v)||v<low||v>high)throw Error(`limits.${name} muss eine ganze Zahl zwischen ${low} und ${high} sein.`);limits[name]=v;}
 const access={transport:'playwright-browser-fetch',headless:false,oparlStatus:'unknown',...(input.access||{})};
 if(access.transport!=='playwright-browser-fetch')throw Error('access.transport: nur playwright-browser-fetch.');
 if(typeof access.headless!=='boolean')throw Error('access.headless muss true oder false sein.');
 if(!['unknown','disabled_confirmed','available','blocked'].includes(access.oparlStatus))throw Error('access.oparlStatus unbekannt.');
 const window=String(input.window||'3m');if(!/^(1w|1m|3m|12m|24m)$/.test(window))throw Error('window: 1w, 1m, 3m, 12m oder 24m.');
 const allowedDocumentOrigins=Array.isArray(input.allowedDocumentOrigins)?input.allowedDocumentOrigins:[origin.origin];
 if(allowedDocumentOrigins.some(o=>o!==origin.origin))throw Error('allowedDocumentOrigins: vorerst nur die eigene Herkunft (der Abruf läuft same-origin in der Seite).');
 const entry=String(input.entryPaths?.start||'/vorlagen');if(!entry.startsWith('/'))throw Error('entryPaths.start muss mit / beginnen.');
 return {schemaVersion:1,instanceId:input.instanceId,displayName:String(input.displayName||input.instanceId),adapter,origin:origin.origin,basePath,entryPaths:{start:entry},
  regions:regions.map(r=>({id:r.id,name:r.name,kind:r.kind||'city',bodyAssignment:r.bodyAssignment||'whole-instance'})),access,limits,window,allowedDocumentOrigins,
  outputDir:String(input.outputDir||`tmp/browser-import/${input.instanceId}`)};
}
/** Der Quelleneintrag, den die Leser des Projekts erwarten (collectSdnet liest base + 'vorlagen' usw.). */
export function sourceOf(instance,region){
 const base=new URL(instance.basePath,instance.origin).href;
 return {id:region.id,name:region.name,kind:region.kind,method:'scraper',adapter:instance.adapter,base,system:base,transport:'browser'};
}
/** Ergebnis einer OParl-Probe in Worte und einen Status. */
export function oparlVerdict({httpStatus,contentType='',body=''}){
 const text=String(body||'');
 if(/nicht aktiviert/i.test(text)&&(httpStatus===400||httpStatus===403||httpStatus===404))return {status:'disabled_confirmed',note:`Webservice OParl ist nicht aktiviert (HTTP ${httpStatus}).`};
 try{const json=JSON.parse(text);if(httpStatus===200&&typeof json.type==='string'&&json.type.endsWith('/System'))return {status:'available',note:'OParl-System antwortet ('+(json.name||json.product||'ohne Namen')+').'};}catch{}
 if(isWaf('','',text))return {status:'blocked',note:'OParl-Adresse liefert die Prüfseite der WAF.'};
 if(httpStatus===401||httpStatus===403)return {status:'blocked',note:`OParl-Adresse antwortet mit HTTP ${httpStatus}.`};
 return {status:'unknown',note:`OParl-Adresse: HTTP ${httpStatus}, ${contentType||'ohne Typ'}; kein OParl-System erkennbar.`};
}
