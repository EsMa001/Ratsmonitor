// Modelldateien und Werkzeuge (nur Node, nicht im Worker): Encoder (nachtrainiertes multilingual-e5-small als ONNX, 8 Bit) und
// Köpfe liegen nicht in Git, sondern in RM_MODEL_DIR (Server: /srv/ratsmonitor/models, beim Ausrollen kopiert); welche Fassung
// gilt, steht mit Prüfsummen in shared/model-manifest.json. transformers.js (onnxruntime) kommt wie die OCR-Werkzeuge aus einem
// eigenen Ordner MODEL_TOOLS (Server: /srv/ratsmonitor/model-tools, `npm install @huggingface/transformers@3.7.5`).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadHeads} from '../../shared/model/heads.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const modelDir=()=>process.env.RM_MODEL_DIR||path.join(root,'tmp/model');
export const toolsDir=()=>process.env.MODEL_TOOLS||path.join(root,'tmp/ml');
export function manifest(){return JSON.parse(fs.readFileSync(path.join(root,'shared/model-manifest.json'),'utf8'));}
/** Fassung, die in model_labels steht: Encoder und Köpfe zusammen */
export const modelVersion=(m=manifest())=>`${m.encoder.version}+${m.heads.version}`;

const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Prüft alle Dateien gegen das Manifest; Fehlerliste (leer = in Ordnung) */
export function checkFiles(m=manifest(),dir=modelDir()){
 const bad=[];
 for(const [part,files] of [['encoder',m.encoder.files],['heads',m.heads.files]])for(const [f,h] of Object.entries(files)){
  const p=path.join(dir,part,f);if(!fs.existsSync(p))bad.push(`${part}/${f} fehlt`);else if(sha(p)!==h)bad.push(`${part}/${f} hat eine andere Prüfsumme`);}
 return bad;
}
/** Köpfe laden (geprüft) */
export function readHeads(dir=modelDir()){
 const json=JSON.parse(fs.readFileSync(path.join(dir,'heads/heads.json'),'utf8')),bin=fs.readFileSync(path.join(dir,'heads/heads.bin'));
 return loadHeads(json,bin);
}
/**
 * Encoder: Texte → normierte Einbettungen (Mittelwert, „query: “ davor, wie beim Lernen). Rechnet mit höchstens `threads` Kernen.
 * @returns {Promise<((texts:string[])=>Promise<Float32Array[]>)&{dispose:()=>Promise<void>}>}
 */
export async function loadEncoder({dir=modelDir(),threads=Math.max(1,Math.min(2,os.cpus().length-2))}={}){
 const t=await import(path.join(toolsDir(),'node_modules/@huggingface/transformers/dist/transformers.node.mjs'));
 t.env.localModelPath=dir+path.sep;t.env.allowRemoteModels=false;
 if(t.env.backends?.onnx)t.env.backends.onnx.numThreads=threads;
 const ex=await t.pipeline('feature-extraction','encoder',{dtype:'q8',session_options:{intraOpNumThreads:threads,interOpNumThreads:1}});
 const encode=async texts=>{
  const e=await ex(texts.map(x=>'query: '+x),{pooling:'mean',normalize:true}),D=e.dims.at(-1),out=[];
  for(let i=0;i<texts.length;i++)out.push(Float32Array.from(e.data.subarray(i*D,(i+1)*D)));
  return out;
 };
 // onnxruntime bricht sonst beim Beenden des Prozesses mit „mutex lock failed“ ab (Exit nicht 0)
 encode.dispose=()=>ex.dispose();
 return encode;
}
