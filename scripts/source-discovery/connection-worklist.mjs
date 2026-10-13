// Read-only source analysis: current admin categories select the work list; newer evidence is comparison data only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CATALOG,landName} from '../../shared/catalog.mjs';
import {atlasCategory} from '../../server/integrations/atlas-sources.mjs';
import {loadAtlasInputs} from './atlas-inputs.mjs';

const VERSION=1;
const compare=(a,b)=>a<b?-1:a>b?1:0;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort(compare).filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const findingHash=evidence=>hash({id:evidence.id,reason:evidence.reason,url:evidence.url,category:evidence.category,access:evidence.access,
 checkedAt:evidence.checkedAt,dateBasis:evidence.dateBasis,dateCandidates:[...new Set(evidence.dateCandidates||[])].sort(compare)});
const NEXT={
 '02':'Gespeicherte Veröffentlichungsadresse in ein konkretes Quellenprofil überführen und mit Paket 02 prüfen.',
 '04':'Dokumentadresse, Herkunft, Antwortformat und Abruffehler diagnostizieren; anschließend Quellenprofil erneut prüfen.',
 '05':'Entdeckte Scan-PDF vor der ersten TOP-Erzeugung ablegen, OCR durchführen und das Quellenprofil erneut prüfen.',
 '06':'Öffentliche Sitzungsabschnitte anhand der Originalunterlagen belegen und das Quellenprofil erneut prüfen.',
 '07':'Körperschaft und Gremium innerhalb der gemeinsamen Veröffentlichung eindeutig zuordnen.',
 '08':'Amtliche Veröffentlichungsadresse, zwölfmonatiges Archiv und öffentliche RIS-Alternativen diagnostizieren.',
};

function problemOf(reason,{addressMissing=false}={}){
 // A stored count of zero unrecognized public parts is not an actual public-proof blocker.
 const text=String(reason).replace(/\b0 ohne erkennbaren öffentlichen Teil\b/gi,'');
 const rules=[
  ['05',/Scan-PDF|eingescannt|ohne Textebene/i],
  ['06',/Öffentlichkeitsnachweis|öffentlicher Teil nicht eindeutig|ohne erkennbaren öffentlichen Teil|Tagesordnung nicht eindeutig als öffentlich/i],
  ['04',/Dokumente nicht lesbar|Dokument[^;]*(?:defekt|zu groß)|HTTP 404|Website[^;]*(?:nicht abrufbar|nicht erreichbar)/i],
  ['07',/gemeinsames System|gemeinsame Veröffentlichung|mitbenutztes System|Gremien[^;]*nicht getrennt|anderen Gemeinde/i],
  ['08',/keine Sitzungsseite|keine Sitzungsunterlagen im Zeitraum|keine Seite mit Sitzungsbekanntmachungen|kein lesbares System erkannt|kein erreichbares System/i],
  ['02',/Sitzungsunterlagen nur|Sitzungstermine oder Unterlagen stehen nur|Sitzungen nur als Webseite oder PDF|kein Ratsinformationssystem erkennbar/i],
 ];
 const matches=rules.filter(([,pattern])=>pattern.test(text)).map(([id])=>id),primary=matches[0]||'08';
 return {primary,additional:matches.filter(id=>id!==primary&&id!=='02'),addressMissing,
  nextStep:addressMissing?'Amtliche Website und konkrete Veröffentlichungsseite zuerst belegen; anschließend '+NEXT[primary].charAt(0).toLowerCase()+NEXT[primary].slice(1):NEXT[primary],basis:'stored-reason'};
}

/** A deterministic snapshot of the current admin view. No files, source requests or current clock are used here. */
export function buildConnectionWorklist(inputs,{catalog=CATALOG,baseline=null}={}){
 const {atlas,sources,currentEvidence,resolutions=new Map()}=inputs;
 const byId=new Map(catalog.map(region=>[region.id,region]));
 if(byId.size!==catalog.length)throw Error('Gebietskatalog enthält doppelte IDs.');
 const records=[];let configured=0;
 for(const region of catalog){
  const stored=atlas.areas[region.id],category=atlasCategory(region.id,stored,sources);
  if(category==='ok'||category==='ready')configured++;
  if(category!=='website')continue;
  const evidence=currentEvidence.get(region.id);
  if(!evidence)throw Error('Aktueller Atlasbeleg fehlt: '+region.id);
  const land=region.ags.slice(0,2),atlasUrl=stored?.u||evidence.url||'';
  records.push({id:region.id,ags:region.ags,name:region.name,kind:region.kind,
   level:region.kind==='district'?'district':region.members?.length||region.ags.length===9?'association':'municipality',
   land:{id:land,name:landName(land)},atlasUrl,connectionState:'not-configured',
   evidence:copy(evidence),problem:problemOf(evidence.reason||'',{addressMissing:!atlasUrl.trim()}),
   comparison:copy(resolutions.get(region.id)||{selected:evidence,alternatives:[],conflict:false,decision:'no-comparison-evidence'})});
 }
 records.sort((a,b)=>compare(a.id,b.id));
 const current=new Set(records.map(record=>record.id)),initial=new Set(baseline?.initialIds||[]);
 const removed=baseline?[...initial].filter(id=>!current.has(id)).sort(compare).map(id=>{
  const region=byId.get(id);
  if(!region)return {id,explanation:'removed-from-catalog',category:null};
  const category=atlasCategory(id,atlas.areas[id],sources);
  return {id,name:region.name,explanation:category==='ok'||category==='ready'?'connected':'recategorized',category};
 }):[];
 const baselineDiff={initialized:!!baseline,baselineId:baseline?.baselineId||null,
  added:baseline?records.filter(record=>!initial.has(record.id)).map(({id,name})=>({id,name,explanation:'entered-website-category'})):[],removed,
  changedEvidence:baseline&&baseline.evidenceHashes?records.filter(record=>initial.has(record.id)&&baseline.evidenceHashes[record.id]!==findingHash(record.evidence)).map(record=>({id:record.id,previousHash:baseline.evidenceHashes[record.id]||null,currentHash:findingHash(record.evidence)})):[],
  changedProvenance:baseline&&baseline.provenanceHashes?records.filter(record=>initial.has(record.id)&&baseline.provenanceHashes[record.id]!==hash(record.evidence)).map(record=>({id:record.id,previousHash:baseline.provenanceHashes[record.id]||null,currentHash:hash(record.evidence)})):[]};
 const problemCounts={};for(const record of records)problemCounts[record.problem.primary]=(problemCounts[record.problem.primary]||0)+1;
 const payload={version:VERSION,basis:{atlasBuiltAt:atlas.builtAt||null,reportDate:inputs.reportDate||atlas.reportDate||null},
  inputManifest:copy(inputs.manifest||[]).sort((a,b)=>compare(a.path,b.path)||compare(a.role,b.role)),
  totals:{catalog:catalog.length,configured,websiteOpen:records.length,addressMissing:records.filter(record=>record.problem.addressMissing).length,problemCounts},records,baselineDiff,
  diagnostics:copy(inputs.diagnostics||[])};
 return {version:VERSION,snapshotId:hash(payload),...payload};
}

/** Initial ids and their evidence basis, kept independently of later snapshots. */
export function createConnectionBaseline(snapshot){
 const payload={version:VERSION,initialIds:snapshot.records.map(record=>record.id),
  evidenceHashes:Object.fromEntries(snapshot.records.map(record=>[record.id,findingHash(record.evidence)])),
  provenanceHashes:Object.fromEntries(snapshot.records.map(record=>[record.id,hash(record.evidence)])),
  evidenceBasisHash:hash(snapshot.records.map(({id,evidence})=>({id,hash:findingHash(evidence)}))),
  provenanceBasisHash:hash(snapshot.records.map(({id,evidence})=>({id,hash:hash(evidence)}))),
  inputManifest:copy(snapshot.inputManifest),basis:copy(snapshot.basis)};
 return {version:VERSION,baselineId:hash(payload),...payload};
}

const escapeCell=value=>String(value??'').replace(/\r?\n/g,' ').replaceAll('|','\\|').replaceAll('<','&lt;').replaceAll('>','&gt;');
const safeLink=url=>/^https?:\/\//i.test(url)?`[Quelle](<${url.replace(/[<>\s|\\]/g,char=>encodeURIComponent(char))}>)`:escapeCell(url||'—');
const problemFile={'02':'02-quellenprofile.md','04':'04-dokumentabruf.md','05':'05-scan-pdfs.md','06':'06-oeffentliche-abschnitte.md','07':'07-gemeinsame-quellen.md','08':'08-fehlende-veroeffentlichungen.md'};

export function renderConnectionWorklist(snapshot){
 const lines=['# Offene Website/PDF-Gebiete','',
  `Arbeitsstand Version ${snapshot.version}. Snapshot: \`${snapshot.snapshotId}\`.`,
  `Auswahl nach aktuellem Quellenkatalog und gespeicherter Admin-Einordnung: **${snapshot.totals.websiteOpen} offene Gebiete**, ${snapshot.totals.configured} konfigurierte Gebiete insgesamt.`,
  `**${snapshot.totals.addressMissing} Gebiete ohne gespeicherte Veröffentlichungsadresse**: Zuerst amtliche Website und konkrete Fundstelle belegen. Die Einordnung des gespeicherten Grundes bleibt erhalten.`,
  'Erzeugungs- und Berichtsdatum der Eingabedateien sind keine Ersatzwerte für das Prüfdatum. „Unbekannt“ bleibt unbekannt.',
  'Neuere oder widersprüchliche Vergleichsbelege stehen im JSON; sie ersetzen die gespeicherten Gründe dieser Arbeitsliste nicht.',
  '', '[Vollständiger Snapshot mit Originalgründen, Herkunft und Vergleichen](website-arbeitsliste.json)',
  '', '## Führende Probleme','', '| Paket | Gebiete |', '|---|---:|',
  ...Object.entries(snapshot.totals.problemCounts).sort(([a],[b])=>compare(a,b)).map(([id,n])=>`| [${id}](../${problemFile[id]}) | ${n} |`),
  '', 'Zusätzliche Probleme stehen je Gebiet im JSON. Überlappende Problemgruppen werden nicht addiert.',
  '', '## Unterschied zur Ausgangsliste',''];
 if(!snapshot.baselineDiff.initialized)lines.push('Noch keine Ausgangsliste hinterlegt. Mit `--init-baseline` einmalig anlegen; vorhandene Ausgangslisten bleiben erhalten.');
 else{
  const d=snapshot.baselineDiff;
  lines.push(`Neu: ${d.added.length}; ausgeschieden: ${d.removed.length}; fachlich geänderte Belege bei bestehenden Gebieten: ${d.changedEvidence.length}; geänderte Provenienz: ${d.changedProvenance.length}.`,
   '', '| ID | Änderung | Grund / aktuelle Kategorie |', '|---|---|---|',
   ...d.added.map(row=>`| ${escapeCell(row.id)} | neu | ${row.explanation} |`),
   ...d.removed.map(row=>`| ${escapeCell(row.id)} | ausgeschieden | ${row.explanation}${row.category?' / '+escapeCell(row.category):''} |`));
 }
 const conflictCount=snapshot.records.filter(record=>record.comparison.conflict).length;
 lines.push('', `Vergleichskonflikte: ${conflictCount}. Eingabediagnosen: ${snapshot.diagnostics.length}. Details im JSON.`,
  '', '## Vollständige Arbeitsliste','', '| ID | Gebiet | Anschluss | Paket | Belegtes Prüfdatum | Gespeicherte Adresse |', '|---|---|---|---|---|---|',
  ...snapshot.records.map(record=>`| ${escapeCell(record.id)} | ${escapeCell(record.name)} | nicht konfiguriert | [${record.problem.primary}](../${problemFile[record.problem.primary]}) | ${escapeCell(record.evidence.checkedAt||'unbekannt')} | ${safeLink(record.atlasUrl)} |`), '');
 return lines.join('\n');
}

function runCli(){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
 let out=path.join(root,'requirements/kommunen-anbindung/daten'),init=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--init-baseline')init=true;
  else if(args[i]==='--out'&&args[i+1]&&!args[i+1].startsWith('--'))out=path.resolve(args[++i]);
  else throw Error('Verwendung: node scripts/source-discovery/connection-worklist.mjs [--out DIR] [--init-baseline]');
 }
 const inputs=loadAtlasInputs({root}),baselinePath=path.join(out,'baseline-website.json');
 let baseline=fs.existsSync(baselinePath)?JSON.parse(fs.readFileSync(baselinePath,'utf8')):null;
 if(baseline&&(!Array.isArray(baseline.initialIds)||new Set(baseline.initialIds).size!==baseline.initialIds.length))throw Error('Ungültige Ausgangsliste: '+baselinePath);
 fs.mkdirSync(out,{recursive:true});
 if(init&&!baseline){
  const proposed=createConnectionBaseline(buildConnectionWorklist(inputs));
  try{fs.writeFileSync(baselinePath,JSON.stringify(canonical(proposed),null,2)+'\n',{flag:'wx'});baseline=proposed;}
  catch(error){if(error.code!=='EEXIST')throw error;baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));}
 }
 const snapshot=buildConnectionWorklist(inputs,{baseline});
 fs.writeFileSync(path.join(out,'website-arbeitsliste.json'),JSON.stringify(canonical(snapshot),null,2)+'\n');
 fs.writeFileSync(path.join(out,'website-arbeitsliste.md'),renderConnectionWorklist(snapshot));
 console.log(`${snapshot.totals.websiteOpen} offene Website/PDF-Gebiete; Snapshot ${snapshot.snapshotId}; ${out}`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{runCli();}catch(error){console.error(error.message);process.exitCode=1;}
}
