// File-only atlas inputs. Saved classifications are authoritative; work files
// and report rows remain dated evidence, never an implicit replacement.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CATALOG} from '../../shared/catalog.mjs';
import {NRW_SOURCES} from '../../server/integrations/source-catalog.mjs';
import {SOURCES} from '../../server/integrations/regions.mjs';
import {configuredAtlasSources,atlasCategory} from '../../server/integrations/atlas-sources.mjs';
import {accessOfReason,channelOf} from '../../shared/source-access.mjs';
import {categoryOf,reasonDate,resolveEvidence} from './atlas-evidence.mjs';

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ATLAS='server/integrations/source-atlas.json';
const WORK=['tmp/source-discovery/open.json','tmp/source-discovery-nds/open.json','tmp/source-discovery-de/open.json'];
const REPORTS=[['requirements/statewide-sources-report.md',['05']],['requirements/nds-sources-report.md',['03']],['requirements/de-sources-report.md',null]];
const AUTHORITIES=['shared/catalog.mjs','shared/nrw-regions.json','shared/nds-regions.json','shared/de-regions.json','shared/lands.mjs',
 'server/integrations/source-catalog.mjs','server/integrations/regions.mjs','server/integrations/source-consents.json',
 ...['nrw','nearby','expanded','statewide','nds','de','citystate'].map(n=>`server/integrations/${n}-sources.json`)];
const ALGORITHMS=['scripts/source-discovery/atlas-inputs.mjs','scripts/source-discovery/atlas-evidence.mjs','scripts/source-discovery/connection-worklist.mjs','server/integrations/atlas-sources.mjs','shared/source-access.mjs'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const sameFinding=(a,b)=>a?.reason===b?.reason&&a?.url===b?.url&&a?.category===b?.category&&a?.access===b?.access;
const isoDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:null;
const documentDay=value=>isoDay(value)||(/^(\d{2})\.(\d{2})\.(\d{4})$/.test(value||'')?isoDay(value.split('.').reverse().join('-')):null);

function dates(reason,explicit){
 const inferred=reasonDate(reason),checked=isoDay(explicit);
 const candidates=[...new Set([...inferred.candidates,...(checked?[checked]:[])])].sort();
 const ambiguous=candidates.length>1;
 return {checkedAt:ambiguous?null:checked||inferred.checkedAt,dateBasis:ambiguous?'unknown':checked?'checkedAt':inferred.basis,dateCandidates:candidates,
  dateIssues:[...(explicit&&!checked?['invalid-checkedAt']:[]),...(ambiguous?['conflicting-check-dates']:[])]};
}

function evidence(id,{reason='',url='',category=categoryOf(reason),access,kind='',checkedAt},origin){
 const result={id,category,access:access??accessOfReason(reason,url,kind),reason,url,...dates(reason,checkedAt),origin};
 if(!result.checkedAt)result.dateIssues.push('unknown-check-date');
 for(const field of ['documentBuiltAt','documentReportDate']){
  const day=documentDay(origin[field]);
  if(day&&result.checkedAt&&result.checkedAt>day)result.dateIssues.push(`check-after-${field}`);
 }
 return result;
}

// Keep the first exact evidence record; origin hashes distinguish revisions of
// a source, while generated atlas timestamps never create new evidence.
function uniqueEvidence(items){
 const seen=new Set();
 return items.filter(e=>{
  const key=JSON.stringify([e.id,e.category,e.access,e.reason,e.url,e.checkedAt,e.dateBasis,e.origin]);
  if(seen.has(key))return false;seen.add(key);return true;
 });
}

/** Read the saved atlas and comparison evidence without network or writes. */
export function loadAtlasInputs({root=repository,catalog=CATALOG,catalogSources=NRW_SOURCES,coreSources=SOURCES}={}){
 const manifest=[],diagnostics=[],files=new Map();
 function file(name,role){
  if(files.has(name))return files.get(name);
  const absolute=path.join(root,name),present=fs.existsSync(absolute),bytes=present?fs.readFileSync(absolute):null;
  const entry={path:name,sha256:bytes?hash(bytes):null,present,role};manifest.push(entry);
  const result={text:bytes?.toString('utf8')??null,entry};files.set(name,result);return result;
 }
 for(const name of AUTHORITIES)file(name,'authority');
 for(const name of ALGORITHMS)file(name,'algorithm');
 // Fingerprint the actual resolved inputs as well (including injected fixtures).
 for(const [name,value] of [['catalog',catalog],['catalogSources',catalogSources],['coreSources',coreSources]])manifest.push({path:`resolved:${name}`,sha256:hash(JSON.stringify(value)),present:true,role:'authority'});
 const saved=file(ATLAS,'authority');
 const atlas=saved.text?JSON.parse(saved.text):{texts:[],areas:{}};
 if(!saved.text)diagnostics.push({kind:'missing-atlas',path:ATLAS});
 const sources=configuredAtlasSources(catalogSources,coreSources);
 const currentEvidence=new Map(),candidates=new Map(),byId=new Map(catalog.map(r=>[r.id,r]));
 const add=e=>{if(byId.has(e.id)&&!sources.has(e.id)){if(!candidates.has(e.id))candidates.set(e.id,[]);candidates.get(e.id).push(e);}};
 for(const r of catalog){
  if(sources.has(r.id))continue;
  const row=atlas.areas?.[r.id];if(!row)continue;
  const current=evidence(r.id,{category:atlasCategory(r.id,row,sources),access:row.c==='ok'||row.c==='ready'?'none':row.z,reason:atlas.texts?.[row.r]??'',url:row.u??''},
   {kind:'atlas',path:ATLAS,pointer:`/areas/${r.id}`,sha256:saved.entry.sha256,documentBuiltAt:atlas.builtAt??null,documentReportDate:atlas.reportDate??null});
  const historic=atlas.evidence?.[r.id];
  // Reuse the original provenance only while it still describes the flat row.
  // A manual edit invalidates that provenance and starts a fresh atlas record.
  if(historic?.selected?.id===r.id&&sameFinding(historic.selected,current)){
   currentEvidence.set(r.id,historic.selected);
   for(const alternative of historic.alternatives||[])if(alternative.id===r.id)add(alternative);
  }else{
   currentEvidence.set(r.id,current);
   if(historic)diagnostics.push({kind:'saved-evidence-mismatch',id:r.id,path:ATLAS});
  }
 }
 for(const name of WORK){
  const input=file(name,'comparison');if(!input.text)continue;
  const rows=JSON.parse(input.text);
  if(!Array.isArray(rows))throw new Error(`${name}: expected an array`);
  rows.forEach((o,i)=>add(evidence(o.id,{reason:o.reason??'',url:o.link??o.url??'',checkedAt:o.checkedAt},
   {kind:'work',path:name,pointer:`/${i}`,sha256:input.entry.sha256})));
 }
 for(const s of catalogSources){
  if(s.method!=='pending'||!s.note)continue;
  add(evidence(s.id,{reason:s.note,url:s.system||s.base||s.api||'',kind:s.adapter?channelOf(s).kind:'',checkedAt:s.checkedAt},
   {kind:'pending',path:'resolved:catalogSources',pointer:`/${catalogSources.indexOf(s)}`,sha256:manifest.find(m=>m.path==='resolved:catalogSources').sha256}));
 }
 const reportDates=[];
 for(const [name,lands] of REPORTS){
  const input=file(name,'comparison');if(!input.text)continue;
  const reportDate=input.text.match(/Stand: (\d{2}\.\d{2}\.\d{4})/)?.[1]??null;
  if(documentDay(reportDate))reportDates.push(documentDay(reportDate));
  let inOpen=false;
  for(const [i,line] of input.text.split(/\r?\n/).entries()){
   if(line.startsWith('## ')){inOpen=line.startsWith('## Nicht angebundene Gebiete');continue;}
   if(!inOpen||!line.startsWith('| ')||line.startsWith('| Gebiet'))continue;
   const columns=line.split('|').map(c=>c.trim());if(columns.length<5||!columns[1]||/^[-: ]+$/.test(columns[1]))continue;
   const matches=catalog.filter(r=>r.name===columns[1]&&(lands?lands.includes(r.ags.slice(0,2)):!['03','05'].includes(r.ags.slice(0,2)))&&!sources.has(r.id));
   if(matches.length!==1){diagnostics.push({kind:matches.length?'ambiguous-report-match':'unmatched-report-row',path:name,line:i+1,name:columns[1],ids:matches.map(r=>r.id).sort()});continue;}
   add(evidence(matches[0].id,{reason:columns[2],url:columns[3]||''},
    {kind:'report',path:name,pointer:`line:${i+1}`,sha256:input.entry.sha256,documentReportDate:reportDate}));
  }
 }
 const resolutions=new Map();
 for(const r of [...catalog].sort((a,b)=>compare(a.id,b.id))){
  if(sources.has(r.id))continue;
  const current=currentEvidence.get(r.id);
  const options=uniqueEvidence([...(current?[current]:[]),...(candidates.get(r.id)||[])]).filter(e=>e!==current);
  // A consent is a display overlay, not a contradictory technical finding.
  // Compare new checks with its original evidence, then restore the saved
  // consent. currentEvidence itself retains the exact saved display record.
  if(current?.category==='consent'&&current.derivedFrom&&current.origin?.consent){
   const technical=resolveEvidence(current.derivedFrom,options);
   resolutions.set(r.id,applyConsentEvidence(technical,current.origin.consent,current.origin));
  }else resolutions.set(r.id,resolveEvidence(current,options));
 }
 manifest.sort((a,b)=>compare(a.path,b.path));
 return {atlas,sources,currentEvidence,resolutions,manifest,diagnostics,reportDate:reportDates.sort().at(-1)?.split('-').reverse().join('.')||''};
}

/** Persist original provenance and all comparisons alongside compact atlas rows. */
export function atlasEvidence(resolutions){
 return Object.fromEntries([...resolutions].filter(([,r])=>r.selected).sort(([a],[b])=>compare(a,b)));
}

/** A consent changes the displayed status, not the day of the underlying check. */
export function applyConsentEvidence(resolution,consent,origin){
 const selected=resolution?.selected;if(!selected||!consent)return resolution;
 // Older atlas files can already contain a consent without its underlying
 // evidence. Retain that original wording rather than repeatedly wrapping it.
 if(selected.category==='consent'&&!selected.derivedFrom)return resolution;
 const prior=selected.category==='consent'?selected.derivedFrom:selected;
 return {...resolution,selected:{...prior,category:'consent',
  reason:`Freigabe (${consent.scope.join(', ')}) vom ${consent.date.split('-').reverse().join('.')} liegt vor; Prüflauf ausstehend. Vorher: ${prior.reason}`,
  dateBasis:prior.checkedAt?'underlying-evidence':'unknown',origin:{kind:'consent',...origin},derivedFrom:prior}};
}
