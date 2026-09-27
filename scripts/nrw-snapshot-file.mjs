// Node-only, reviewable snapshot storage. Keep each Git object comfortably small.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const defaultFile=fileURLToPath(new URL('../data/nrw-seed.json',import.meta.url));
const hash=data=>createHash('sha256').update(data).digest('hex');
export function readNrwSnapshot(file=defaultFile){
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 if(Array.isArray(manifest.topics))return manifest; // Earlier single-file exports.
 if(manifest.format!=='nrw-split-v1')throw Error('Unbekanntes NRW-Snapshotformat');
 const topics=[];
 for(const part of manifest.parts){
  if(!/^nrw-seed-parts\/nrw-\d{8}-\d{4}\.json$/.test(part.file))throw Error('Ungültiger Snapshotpfad');
  const raw=fs.readFileSync(path.join(path.dirname(file),part.file));
  if(hash(raw)!==part.sha256)throw Error('Snapshot-Prüfsumme stimmt nicht: '+part.file);
  const rows=JSON.parse(raw);if(rows.length!==part.count||rows.some(t=>t.regionId!==part.regionId))throw Error('Snapshot-Zuordnung stimmt nicht');
  topics.push(...rows);
 }
 return {revision:manifest.revision,topics,coverage:manifest.coverage};
}
export function writeNrwSnapshot(snapshot,file=defaultFile){
 const folder=path.join(path.dirname(file),'nrw-seed-parts');fs.mkdirSync(folder,{recursive:true});
 const parts=[];
 for(const regionId of new Set(snapshot.topics.map(t=>t.regionId))){
  if(!/^nrw-\d{8}$/.test(regionId))throw Error('Ungültiges NRW-Gebiet');
  const rows=snapshot.topics.filter(t=>t.regionId===regionId);
  for(let i=0;i<rows.length;i+=100){
   const slice=rows.slice(i,i+100),name=regionId+'-'+String(i/100).padStart(4,'0')+'.json',raw=JSON.stringify(slice);
   if(Buffer.byteLength(raw)>4*1024*1024)throw Error('Snapshotteil überschreitet vier MB');
   fs.writeFileSync(path.join(folder,name),raw);
   parts.push({regionId,file:'nrw-seed-parts/'+name,count:slice.length,sha256:hash(raw)});
  }
 }
 fs.writeFileSync(file,JSON.stringify({format:'nrw-split-v1',revision:snapshot.revision,coverage:snapshot.coverage,parts},null,2)+'\n');
 const keep=new Set(parts.map(p=>path.basename(p.file)));
 for(const name of fs.readdirSync(folder))if(/^nrw-\d{8}-\d{4}\.json$/.test(name)&&!keep.has(name))fs.unlinkSync(path.join(folder,name));
}
