import {readNrwSnapshot} from './nrw-snapshot-file.mjs';
import fs from 'node:fs';
import {recordUrl,identityState} from '../shared/topic-identity.mjs';
const topics=['topics','regions','nrw-seed'].flatMap(name=>(name==='nrw-seed'?readNrwSnapshot():JSON.parse(fs.readFileSync('data/'+name+'.json','utf8'))).topics);
const keys=new Map();const states={paper:0,unlinked:0,conflict:0};const byRegion={};
for(const t of topics){const region=t.regionId||'muenster',state=identityState(t);states[state]++;byRegion[region]??={total:0,paper:0,unlinked:0,conflict:0};byRegion[region].total++;byRegion[region][state]++;const url=recordUrl(t.sourceUrl);if(url){const key=region+'|'+url;keys.set(key,[...keys.get(key)||[],t.id]);}}
console.log(JSON.stringify({basis:'Versionierte Importdateien; keine Live-Datenbankabfrage',total:topics.length,states,duplicateOfficialRecords:[...keys.entries()].filter(([,ids])=>ids.length>1).map(([record,ids])=>({record,ids})),byRegion},null,2));
