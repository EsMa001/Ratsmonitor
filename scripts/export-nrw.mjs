import {readNrwSnapshot,writeNrwSnapshot} from './nrw-snapshot-file.mjs';
import {gzipSync} from 'node:zlib';
import {activeTopics} from '../shared/topic-identity.mjs';
// Freeze a reviewable import snapshot before building or committing the site.
import fs from 'node:fs/promises';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {createHash} from 'node:crypto';
import {NRW_SOURCES as sources} from '../server/integrations/source-catalog.mjs';
const results=[];
let saved={topics:[],coverage:[]};try{saved=readNrwSnapshot();}catch{}
for(const source of sources){try{results.push(mergeImport({topics:saved.topics.filter(t=>t.regionId===source.id),coverage:saved.coverage.find(c=>c.regionId===source.id)},JSON.parse(await fs.readFile('data/nrw/'+source.id+'.json','utf8'))))}catch{const prior=saved.coverage.find(c=>c.regionId===source.id);if(prior){results.push({topics:saved.topics.filter(t=>t.regionId===source.id),coverage:prior});continue;}results.push({topics:[],coverage:{regionId:source.id,method:source.method,from:null,to:null,importedAt:null,meetings:0,sourceCount:0,complete:false,issues:['Öffentliche Quelle konfiguriert; Abruf noch nicht abgeschlossen.'],sourceUrl:source.system||source.base}})}}
const result={topics:results.flatMap(r=>r.topics),coverage:results.map(r=>r.coverage)};
for(const c of result.coverage){if(c.issues.some(s=>s.startsWith('Verknüpfung:')))!c.issues.some(s=>s.startsWith('Nicht aufgelöste'))&&c.issues.push('Nicht aufgelöste Vorlagenverknüpfungen: mehrere Tagesordnungspunkte derselben Vorlage können getrennt erfasst sein. Die Vorgangszählung ist deshalb ein vorläufiger Teilstand.');}
result.revision=createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0,16);
writeNrwSnapshot(result);
console.log(JSON.stringify({revision:result.revision,articles:result.topics.length,sources:result.coverage.length}));

const packed={revision:result.revision,coverage:result.coverage,counts:Object.fromEntries(results.map(r=>[r.coverage.regionId,activeTopics(r.topics).length])),parts:results.filter(r=>r.topics.length).map(r=>({regionId:r.coverage.regionId,data:gzipSync(JSON.stringify(r)).toString('base64')}))};
await fs.writeFile('data/nrw-seed-gzip.json',JSON.stringify(packed));
