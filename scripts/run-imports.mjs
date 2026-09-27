import {pathToFileURL} from 'node:url';
import nearby from '../server/integrations/nearby-sources.json' with {type:'json'};
import expanded from '../server/integrations/expanded-sources.json' with {type:'json'};
export const DEFAULT_REGIONS = ['muenster','billerbeck','coesfeld','steinfurt','warendorf','recklinghausen','nrw-05334002','nrw-05562004','nrw-05566008','nrw-05758012','nrw-05114000','nrw-05315000','nrw-05566032',...nearby.map(s=>s.id),...expanded.map(s=>s.id)];
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
/** Portable, sequential client; logs never include credentials or response bodies. */
export async function runImports({siteUrl,token,regions=DEFAULT_REGIONS,fetcher=fetch,sleep=pause,log=console.log,trigger='scheduled'}) {
 const site=new URL(siteUrl);
 if(site.protocol!=='https:'||site.username||site.password||site.search||site.hash||!token)throw Error('SITE_URL muss eine HTTPS-Adresse ohne Zugangsdaten sein; IMPORT_TOKEN ist erforderlich.');
 if(!regions.length||regions.some(r=>!/^[-a-z0-9]+$/.test(r)))throw Error('Ungültige Gebietsliste');
 const results=[];
 for(const region of [...new Set(regions)]){
  let result;
  for(let attempt=1;attempt<=3;attempt++){
   const url=new URL('/api/internal/sync',site);url.searchParams.set('region',region);
   let response;
   try{response=await fetcher(url,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'x-import-trigger':trigger},signal:AbortSignal.timeout(240000)});}catch{result={region,status:'network-error',attempt};}
   if(response){
    if([401,403].includes(response.status))throw Error('Importzugang abgelehnt; Zugangsdaten und Freigabe prüfen.');
    let data={};try{data=await response.json();}catch{}
    result={region,status:response.status,attempt,skipped:!!data.skipped,topics:data.topics,coverage:data.coverage?.attemptStatus};
    if(response.ok || ![408,409,429,500,502,503,504].includes(response.status))break;
   }
   if(attempt<3){const retry=Number(response?.headers.get('retry-after'));await sleep(Math.min(120000,Math.max(5000*2**(attempt-1),Number.isFinite(retry)?retry*1000:0)));}
  }
  results.push(result);log(JSON.stringify(result));
 }
 return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const results=await runImports({siteUrl:process.env.SITE_URL,token:process.env.IMPORT_TOKEN,regions:process.env.IMPORT_REGIONS?.split(',').map(s=>s.trim()).filter(Boolean),trigger:process.env.IMPORT_TRIGGER==='manual'?'manual':'scheduled'});if(results.some(r=>r.status!==200||['failed','empty'].includes(r.coverage)))process.exitCode=1;}
 catch{console.error('Importlauf abgebrochen. HTTPS-Ziel, Zugang und Konfiguration prüfen; keine Zugangsdaten ins Protokoll kopieren.');process.exitCode=1;}
}
