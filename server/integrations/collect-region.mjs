import {windowStart,historyWindow} from './history-window.mjs';
import {NRW_SOURCES} from './source-catalog.mjs';
import {collectRegionalOparl} from './oparl-regional.mjs';
import {collectRubin} from './more-rubin.mjs';
import {SOURCES} from './regions.mjs';
import {collectSessionNet,fetchText} from './sessionnet.mjs';
import {collectOparl} from './oparl.mjs';
/** options.window selects the look-back period ('1w' | '1m' | '3m' | '12m'); it is validated before any request and recorded with the source status. */
export async function collectRegion(id,options={}){
 const window=historyWindow(options.window);
 const d=await collect(id,{...options,window});
 return {...d,coverage:{...d.coverage,window}};
}
async function collect(id,options){
 if(id==='muenster'){const d=await collectOparl(options);return {...d,topics:d.topics.map(t=>({...t,regionId:id})),coverage:{...d.coverage,regionId:id,method:'oparl'}};}
 const nrw=NRW_SOURCES.find(s=>s.id===id);if(nrw?.method==='oparl')return collectRegionalOparl(nrw,options);
 const source=nrw||SOURCES.find(s=>s.id===id);if(!source)throw Error('Unbekanntes Gebiet');
 if(id==='recklinghausen'||source.adapter==='more-rubin')return collectRubin(source,options);
 if(source.extension){
  // Probe the vendor's public OParl endpoint. Failures do not masquerade as API data.
  const probe=source.base+`oparl/1.0/system.${source.extension}`;
  let apiCheck='Keine nutzbare OParl-Schnittstelle am geprüften Herstellerendpunkt.';
  try{const body=JSON.parse(await fetchText(probe,source));if(body.type?.endsWith('/System'))throw Error('OParl vorhanden; Adapterfreigabe erforderlich.');}catch(e){if(e.message.includes('Adapterfreigabe'))throw e;}
  const d=await collectSessionNet(source,options);d.coverage.apiCheck=apiCheck;d.coverage.apiCheckedAt=new Date().toISOString();return d;
 }
 const now=new Date(),from=windowStart(now,options.window);
 return {topics:[],coverage:{regionId:id,method:'pending',from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:0,sourceCount:1,complete:false,issues:['Öffentlicher Datenzugang wird geprüft; noch keine Artikel erfasst.'],sourceUrl:source.base}};
}
