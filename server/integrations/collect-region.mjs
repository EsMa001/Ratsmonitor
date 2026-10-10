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
import {refusalGate,isRefusal} from './request-budget.mjs';
// A negative OParl probe of a source holds this long; until then the probe is not sent again. Almost every vendor
// endpoint answers 404, and the probe cost up to 20 s per import. A probe gets at most PROBE_MS.
export const PROBE_DAYS=30;
const PROBE_MS=8000;
/**
 * options.window selects the look-back period ('1d' | '1w' | '1m' | '3m' | '12m' | '24m'); it is validated before any request and recorded with the source status.
 * options.trace (import-trace.mjs) records every request to the source, whichever adapter reads it.
 * options.oparlProbeAt: time of the last negative OParl probe (source status); within PROBE_DAYS the probe is skipped.
 * The result's coverage.oparlProbeAt names the negative probe this import relies on, if any.
 * result.refused ({retryAfterMs}): the source refused a request (HTTP 429 or a rejection page); no further request
 * went to it in this import (refusalGate).
 */
export async function collectRegion(id,options={}){
 const window=historyWindow(options.window),gate=refusalGate();
 let d;
 try{d=await collect(id,{...options,window,gate});}
 catch(e){if(gate.refused&&e&&typeof e==='object')e.refused=gate.refused;throw e;}
 return {...d,coverage:{...d.coverage,window},...(gate.refused?{refused:gate.refused}:{})};
}
async function collect(id,options){
 // The gate sits outside the trace: requests it stops never reach the source and are not recorded.
 const trace=options.trace,traced=trace?trace.wrap(fetchText):fetchText,text=options.gate?options.gate.wrap(traced):traced,pages=text===fetchText?options:{...options,get:text};
 if(id==='muenster'){const d=await collectOparl(trace?{...options,getJson:trace.wrap(requestJson)}:options);return {...d,topics:d.topics.map(t=>({...t,regionId:id})),coverage:{...d.coverage,regionId:id,method:'oparl'}};}
 const nrw=NRW_SOURCES.find(s=>s.id===id);if(nrw?.method==='oparl')return collectRegionalOparl(nrw,options);
 const source=nrw||SOURCES.find(s=>s.id===id);if(!source)throw Error('Unbekanntes Gebiet');
 // A switched-off source is never asked, whichever reader it names (citystate-sources.json: reader built, check or consent missing).
 if(source.method==='pending'){const now=new Date(),from=windowStart(now,options.window);return {topics:[],coverage:{regionId:id,method:'pending',from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:0,sourceCount:1,complete:false,issues:[source.note||'Quelle abgeschaltet; es wird nichts abgerufen.'],sourceUrl:source.base||source.system||''}};}
 if(id==='recklinghausen'||source.adapter==='more-rubin')return collectRubin(source,pages);
 // Order of sources: OParl where it works, otherwise the public pages. A page scraper therefore runs only while
 // the vendor's OParl endpoint is switched off, or when the catalog records that OParl was checked and is not
 // usable for this area (oparlFallback). An OParl endpoint that appears later stops the scraper until it is checked,
 // at the latest PROBE_DAYS after the last negative probe.
 const checked=source.oparlFallback?`OParl geprüft am ${source.oparlFallback.checkedAt}, nicht nutzbar (${source.oparlFallback.reason}); öffentliche Seiten als Rückfall.`:null;
 const probedAt=Date.parse(options.oparlProbeAt||''),recent=!checked&&Date.now()-probedAt>=0&&Date.now()-probedAt<PROBE_DAYS*864e5;
 // Time of the negative probe this import relies on: the remembered one, or one sent now.
 let probe=recent?new Date(probedAt).toISOString():null;
 const mark=d=>{if(probe){d.coverage.oparlProbeAt=probe;d.coverage.apiCheckedAt=probe;}else d.coverage.apiCheckedAt=new Date().toISOString();return d;};
 // Only a clear answer counts as negative (a status, no JSON, no OParl system); a timeout, a broken connection or a refusal (429) is asked again next time.
 const vendorOparlOff=async url=>{if(checked||recent)return;let negative=true;try{const body=JSON.parse(await text(url,source,PROBE_MS));if(body.type?.endsWith('/System'))throw Error('OParl vorhanden; Adapterfreigabe erforderlich.');}catch(e){if(e.message.includes('Adapterfreigabe'))throw e;negative=e instanceof SyntaxError||/HTTP \d{3}/.test(e.message)&&!isRefusal(e);}if(negative)probe=new Date().toISOString();};
 if(source.adapter==='sdnet'){
  await vendorOparlOff(source.base+'webservice/oparl/v1.1/system');
  const d=await collectSdnet(source,pages);d.coverage.apiCheck=checked||'OParl-Schnittstelle des Herstellers ist nicht aktiviert.';return mark(d);
 }
 if(source.adapter==='allris'){
  // The reader asks the system's own OParl address itself, in the one session it keeps for the whole import.
  const ask=!checked&&!recent;
  const d=await collectAllris(source,{...pages,checkOparl:ask});if(ask)probe=new Date().toISOString();d.coverage.apiCheck=checked||'OParl-Adresse des Systems (oparl/system) liefert kein OParl-System.';return mark(d);
 }
 // Further readers (readers.mjs). ALLRIS 3 asks the system's own OParl address first, like ALLRIS 4.
 const reader=READERS[source.adapter];
 if(reader){const ask=Boolean(reader.oparlCheck)&&!checked&&!recent;const d=await reader.collect(source,{...pages,...(reader.oparlCheck?{checkOparl:ask}:{})});if(ask)probe=new Date().toISOString();else if(!reader.oparlCheck)probe=null;if(checked)d.coverage.apiCheck=checked;return mark(d);}
 if(source.extension){
  // Probe the vendor's public OParl endpoint. Failures do not masquerade as API data.
  await vendorOparlOff(source.base+`oparl/1.0/system.${source.extension}`);
  const d=await collectSessionNet(source,pages);d.coverage.apiCheck=checked||'Keine nutzbare OParl-Schnittstelle am geprüften Herstellerendpunkt.';return mark(d);
 }
 const now=new Date(),from=windowStart(now,options.window);
 return {topics:[],coverage:{regionId:id,method:'pending',from:from.toISOString().slice(0,10),to:now.toISOString().slice(0,10),importedAt:now.toISOString(),meetings:0,sourceCount:1,complete:false,issues:['Öffentlicher Datenzugang wird geprüft; noch keine Artikel erfasst.'],sourceUrl:source.base}};
}
