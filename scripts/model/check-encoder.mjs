// Prüft den umgewandelten Encoder (RM_MODEL_DIR/encoder, über transformers.js wie im Betrieb) gegen die Einbettungen, mit denen die
// Köpfe gelernt haben (finetune.py: <emb-dir>/big-emb<suffix>.*): Kosinus an echten Titeln und PDF-Texten der Stichprobe.
// Erwartet über 0,98 (8 Bit); darunter stimmt Umwandlung oder Wortzerlegung nicht.
//   node scripts/model/check-encoder.mjs [--emb-dir=tmp/ml] [--suffix=-ft] [--n=40]
import fs from 'node:fs';
import path from 'node:path';
import {encoderTexts} from '../../shared/model/features.mjs';
import {loadEncoder} from '../../server/model/model-files.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const dir=arg('emb-dir','tmp/ml'),suf=arg('suffix','-ft'),n=+arg('n',40);
const keys=JSON.parse(fs.readFileSync(path.join(dir,`big-emb${suf}.json`),'utf8')),buf=new Float32Array(fs.readFileSync(path.join(dir,`big-emb${suf}.bin`)).buffer.slice(0)),D=buf.length/keys.length;
const at=new Map(keys.map((k,i)=>[k,i])),rows=JSON.parse(fs.readFileSync('tests/fixtures/kern-big.json','utf8')).rows;
const encode=await loadEncoder();const cos=[];
for(let i=0;i<rows.length&&cos.length<n;i+=97){
 for(const [k,t] of encoderTexts(rows[i])){const key=k==='t'?'t'+i:k==='r'?'r'+i:'p'+i+'.'+k.slice(2),j=at.get(key);if(j==null)continue;
  const [v]=await encode([t]);let c=0;for(let d=0;d<D;d++)c+=v[d]*buf[j*D+d];cos.push(c);}
}
cos.sort((a,b)=>a-b);
console.log(`${cos.length} Texte: kleinster Kosinus ${cos[0].toFixed(4)}, Median ${cos[cos.length>>1].toFixed(4)}`);
await encode.dispose();
process.exitCode=cos[0]>=0.97?0:1;
