import {windowStart,historyWindow} from './history-window.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {collectRegionalOparl} from './oparl-regional.mjs';
import {collectRubin} from './more-rubin.mjs';
import {SOURCES} from './regions.mjs';
import {collectSessionNet,fetchText} from './sessionnet.mjs';
import {collectSdnet} from './sdnet.mjs';
import {collectAllris} from './allris.mjs';
import {collectOparl,requestJson} from './oparl.mjs';
import {READERS} from './readers.mjs';
/**
 * options.window selects the look-back period ('1d' | '1w' | '1m' | '3m' | '12m' | '24m'); it is validated before any request and recorded with the source status.
 * options.trace (import-trace.mjs) records every request to the source, whichever adapter reads it.
 */
export async function collectRegion(id,options={}){
 const window=historyWindow(options.window);
 const d=await collect(id,{...options,window});
 return {...d,coverage:{...d.coverage,window}};
}
async function collect(id,options){
 const trace=options.trace,text=trace?trace.wrap(fetchText):fetchText,pages=trace?{...options,get:text}:options;
 if(id==='muenster'){const d=await collectOparl(trace?{...options,getJson:trace.wrap(requestJson)}:options);return {...d,topics:d.topics.map(t=>({...t,regionId:id})),coverage:{...d.coverage,regionId:id,method:'oparl'}};}
 const nrw=NRW_SOURCES.find(s=>s.id===id);if(nrw?.method==='oparl')return collectRegionalOparl(nrw,options);
 const source=nrw||SOURCES.find(s=>s.id===id);if(!source)throw Error('Unbekanntes Gebiet');
 // A switched-off source is never asked, whichever reader it names (citystate-sources.json: reader built, check or consent missing).
 if(source.method==='pending'){const now=new Date(),from=windowStart(now,options.window);return {topics:[],coverage:{regionId:id,method:'pending',from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:0,sourceCount:1,complete:false,issues:[source.note||'Quelle abgeschaltet; es wird nichts abgerufen.'],sourceUrl:source.base||source.system||''}};}
 if(id==='recklinghausen'||source.adapter==='more-rubin')return collectRubin(source,pages);
 // Order of sources: OParl where it works, otherwise the public pages. A page scraper therefore runs only while
 // the vendor's OParl endpoint is switched off, or when the catalog records that OParl was checked and is not
 // usable for this area (oparlFallback). An OParl endpoint that appears later stops the scraper until it is checked.
 const checked=source.oparlFallback?`OParl geprüft am ${source.oparlFallback.checkedAt}, nicht nutzbar (${source.oparlFallback.reason}); öffentliche Seiten als Rückfall.`:null;
 const vendorOparlOff=async probe=>{if(checked)return;try{const body=JSON.parse(await text(probe,source));if(body.type?.endsWith('/System'))throw Error('OParl vorhanden; Adapterfreigabe erforderlich.');}catch(e){if(e.message.includes('Adapterfreigabe'))throw e;}};
 if(source.adapter==='sdnet'){
  await vendorOparlOff(source.base+'webservice/oparl/v1.1/system');
  const d=await collectSdnet(source,pages);d.coverage.apiCheck=checked||'OParl-Schnittstelle des Herstellers ist nicht aktiviert.';d.coverage.apiCheckedAt=new Date().toISOString();return d;
 }
 if(source.adapter==='allris'){
  // The reader asks the system's own OParl address itself, in the one session it keeps for the whole import.
  const d=await collectAllris(source,{...pages,checkOparl:!checked});d.coverage.apiCheck=checked||'OParl-Adresse des Systems (oparl/system) liefert kein OParl-System.';d.coverage.apiCheckedAt=new Date().toISOString();return d;
 }
 // Further readers (readers.mjs). ALLRIS 3 asks the system's own OParl address first, like ALLRIS 4.
 const reader=READERS[source.adapter];
 if(reader){const d=await reader.collect(source,{...pages,...(reader.oparlCheck?{checkOparl:!checked}:{})});if(checked)d.coverage.apiCheck=checked;d.coverage.apiCheckedAt=new Date().toISOString();return d;}
 if(source.extension){
  // Probe the vendor's public OParl endpoint. Failures do not masquerade as API data.
  await vendorOparlOff(source.base+`oparl/1.0/system.${source.extension}`);
  const d=await collectSessionNet(source,pages);d.coverage.apiCheck=checked||'Keine nutzbare OParl-Schnittstelle am geprüften Herstellerendpunkt.';d.coverage.apiCheckedAt=new Date().toISOString();return d;
 }
 const now=new Date(),from=windowStart(now,options.window);
 return {topics:[],coverage:{regionId:id,method:'pending',from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:0,sourceCount:1,complete:false,issues:['Öffentlicher Datenzugang wird geprüft; noch keine Artikel erfasst.'],sourceUrl:source.base}};
}
