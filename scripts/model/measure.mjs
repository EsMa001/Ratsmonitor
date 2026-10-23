// Misst gespeicherte Köpfe (heads.json, heads.bin) auf einer Prüfmenge, mit derselben Messung wie scripts/model/train.mjs
// (measure-lib.mjs). Für den Vergleich vorher/nachher auf einer frischen Prüfmenge (kern-extra2.json, set check).
//   node scripts/model/measure.mjs --heads=tmp/model/heads [--extra2=tests/fixtures/kern-extra2.json --test=check2] [--emb-dir=tmp/ml --suffix=-ft]
import fs from 'node:fs';
import path from 'node:path';
import {loadHeads} from '../../shared/model/heads.mjs';
import {measure} from './measure-lib.mjs';

const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const EMB=arg('emb-dir','tmp/ml'),SUF=arg('suffix','-ft'),HEADS=arg('heads','tmp/model/heads'),EXTRA2=arg('extra2',''),TEST=arg('test','check'),FX='tests/fixtures/';
const loadEmb=name=>{const k=JSON.parse(fs.readFileSync(path.join(EMB,`${name}${SUF}.json`),'utf8')),b=new Float32Array(fs.readFileSync(path.join(EMB,`${name}${SUF}.bin`)).buffer.slice(0));
 const D=b.length/k.length;return {D,map:new Map(k.map((x,i)=>[x,b.subarray(i*D,(i+1)*D)]))};};
const emb=new Map(),rows=[];
if(TEST==='check2'){const e=loadEmb('extra2-emb');for(const [k,v] of e.map)emb.set(k.replace(/^([trp])(\d+)/,(m,a,n)=>a+(200000+ +n)),v);
 JSON.parse(fs.readFileSync(EXTRA2,'utf8')).rows.forEach((r,i)=>{if(r.gold&&r.set==='check')rows.push({...r,i:200000+i});});}
else{const e=loadEmb('big-emb');for(const [k,v] of e.map)emb.set(k,v);
 JSON.parse(fs.readFileSync(FX+'kern-big.json','utf8')).rows.forEach((r,i)=>{if(r.gold&&r.set==='check')rows.push({...r,i});});}
const ZERO=new Float32Array([...emb.values()][0].length);
const E=k=>emb.get(k)||ZERO,EK=(r,k)=>E(k==='t'?'t'+r.i:k==='r'?'r'+r.i:'p'+r.i+'.'+k.slice(2));
const json=JSON.parse(fs.readFileSync(path.join(HEADS,'heads.json'),'utf8')),bin=fs.readFileSync(path.join(HEADS,'heads.bin'));
const {Q}=measure(rows,loadHeads(json,bin),EK,arg('today','2026-10-23'));
console.log(json.version,'auf',TEST,rows.length,'Berichten');
for(const [k,v] of Object.entries(Q))console.log(k.padEnd(11),JSON.stringify(v));
