import {readNrwSnapshot} from '../nrw-snapshot-file.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {mergeImport} from '../../server/integrations/merge-import.mjs';
import {activeTopics} from '../../shared/topic-identity.mjs';
import {classifyTopic,LABELS,LABEL_VERSION,CLASSIFIER_VERSION} from '../../shared/labels.mjs';
import {studyInput,STUDY_VERSION,PROMPT_VERSION} from '../../shared/label-study.mjs';
const folder=process.argv[2]||'tmp/label-study';const basis=process.argv[3]||'source';
if(!['source','title'].includes(basis))throw Error('basis: source oder title');
await fs.mkdir(folder,{recursive:true});
try{await fs.access(folder+'/corpus.json');throw Error('Vorhandener Studienbestand wird nicht überschrieben. Für neue Version anderes Verzeichnis verwenden.');}catch(e){if(e.code!=='ENOENT')throw e;}
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const [city,regional,nrw,history]=await Promise.all(['data/topics.json','data/regions.json','data/nrw-seed.json','data/history-backfill.json'].map(p=>p==='data/nrw-seed.json'?readNrwSnapshot():read(p)));
const base=[...city.topics.map(t=>({...t,regionId:'muenster'})),...regional.topics,...nrw.topics],all=[];
for(const id of new Set(base.map(t=>t.regionId))){const prior=base.filter(t=>t.regionId===id),fresh=history.results.find(r=>r.coverage.regionId===id);all.push(...activeTopics(fresh?mergeImport({topics:prior},fresh).topics:prior));}
const hash=s=>createHash('sha256').update(s).digest('hex');
const rows=all.map(t=>{const input=studyInput(t,basis);return {id:t.id,regionId:t.regionId,sourceUrl:t.sourceUrl,input,inputHash:hash(JSON.stringify(input)),rule:classifyTopic(t),ai:{status:'pending'}};}).sort((a,b)=>a.id.localeCompare(b.id));
const manifest={version:STUDY_VERSION,promptVersion:PROMPT_VERSION,catalogVersion:LABEL_VERSION,ruleVersion:CLASSIFIER_VERSION,basis,createdAt:new Date().toISOString(),count:rows.length,corpusHash:hash(JSON.stringify(rows)),provenance:'Versionierter Repository-Bestand einschließlich Zwölf-Monats-Nachladung; kein Live-Datenbankexport.'};
await fs.writeFile(folder+'/catalog.json',JSON.stringify(LABELS,null,2));
await fs.writeFile(folder+'/corpus.json',JSON.stringify({manifest,rows}));
// Fixed, blinded simple random sample via a reproducible SHA-256 ordering.
const sample=rows.toSorted((a,b)=>hash('holdout-v1|'+a.id).localeCompare(hash('holdout-v1|'+b.id))).slice(0,Math.min(300,rows.length));
const q=s=>{let v=String(s??'');if(/^\s*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
await fs.writeFile(folder+'/referenzstichprobe.csv','id,input_hash,gebiet,originalquelle,originaltitel,originaltext,referenz_label,pruefer,status,begruendung\n'+sample.map(r=>[r.id,r.inputHash,r.regionId,r.sourceUrl,r.input.title,r.input.text,'','','pending',''].map(q).join(',')).join('\n')+'\n');
await fs.writeFile(folder+'/references.json',JSON.stringify(sample.map(r=>({id:r.id,inputHash:r.inputHash,primary:null,reviewer:null,status:'pending',reason:''})),null,2));
console.log(JSON.stringify(manifest));
