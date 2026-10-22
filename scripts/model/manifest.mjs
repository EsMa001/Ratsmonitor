// Schreibt shared/model-manifest.json aus den Modelldateien in RM_MODEL_DIR (Standard tmp/model): Fassung und Prüfsumme je Datei
// von Encoder (encoder/), Köpfen (heads/) und Satzkopf (summary/). Nach jedem Training bzw. Nachtrainieren ausführen und das Manifest committen;
// die Dateien selbst kommen nicht nach Git, sondern beim Ausrollen nach /srv/ratsmonitor/models.
//   node scripts/model/manifest.mjs --encoder=e5-small-ft1
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {modelDir} from '../../server/model/model-files.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const dir=modelDir(),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const list=(sub,files)=>Object.fromEntries(files.map(f=>[f,sha(path.join(dir,sub,f))]));
const heads=JSON.parse(fs.readFileSync(path.join(dir,'heads/heads.json'),'utf8'));
const m={note:'Modelldateien liegen nicht in Git (RM_MODEL_DIR, Server /srv/ratsmonitor/models); scripts/model/apply.mjs prüft sie gegen diese Prüfsummen.',
 encoder:{version:arg('encoder',heads.encoder),base:'intfloat/multilingual-e5-small (MIT), nachtrainiert mit scripts/model/finetune.py',files:list('encoder',['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx'])},
 heads:{version:heads.version,input:heads.input,trainedAt:heads.trainedAt,files:list('heads',['heads.json','heads.bin'])}};
// Satzkopf der Zusammenfassung (scripts/model/train-summary.mjs), wenn vorhanden
if(fs.existsSync(path.join(dir,'summary/summary.json'))){const s=JSON.parse(fs.readFileSync(path.join(dir,'summary/summary.json'),'utf8'));m.summary={version:s.version,trainedAt:s.trainedAt,files:list('summary',['summary.json'])};}
fs.writeFileSync('shared/model-manifest.json',JSON.stringify(m,null,1)+'\n');
console.log('Manifest',m.encoder.version,m.heads.version);
