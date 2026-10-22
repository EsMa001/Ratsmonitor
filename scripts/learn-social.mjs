// Lernt aus den Berichten der letzten 12 Monate, wie oft Vorgänge je Unterthema des Modells streitig endeten
// (abgelehnt, vertagt/verwiesen oder nur mehrheitlich beschlossen) und schreibt shared/social-calibration-model.json
// (Social Media, server/integrations/social-model.mjs; seit 22.10.2026 statt der Stichwörter in shared/social-calibration.json).
// Braucht model_labels (Modell angewandt). Aufruf: node scripts/learn-social.mjs [--bis=2026-10-11]; danach Commit der JSON-Datei.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,readdirSync,writeFileSync} from 'node:fs';
import {evidenceOf} from '../server/integrations/social-topics.mjs';
const arg=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>a.slice(2).split('=')));
const to=arg.bis||new Date().toISOString().slice(0,10);
const from=new Date(Date.parse(to+'T00:00:00Z')-365*86400000).toISOString().slice(0,10);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const file=process.env.DATABASE_FILE||(local?dir+local:null);
if(!file){console.log('Keine lokale Datenbank gefunden.');process.exit(1);}
const db=new DatabaseSync(file,{readOnly:true});
const cards=db.prepare("SELECT c.id,m.subs FROM search_cards c JOIN model_labels m ON m.topic_id=c.id WHERE c.date BETWEEN ? AND ? AND m.kind='subject'").all(from,to);
const get=db.prepare("SELECT json_extract(payload,'$.events') ev,json_extract(payload,'$.event') e1,json_extract(payload,'$.sourceData.records') rec FROM topics WHERE id=?");
const parse=v=>{if(typeof v!=='string')return v;try{return JSON.parse(v);}catch{return null;}};
const stat=new Map();
const add=(k,res,sessions)=>{let s=stat.get(k);if(!s)stat.set(k,s={n:0,res:0,contested:0,unan:0,rej:0,post:0,maj:0,multi:0});s.n++;if(sessions>=3)s.multi++;if(res){s.res++;s[res==='ok'?'unan':res]+=res==='ok'?0:1;if(['rej','post','maj'].includes(res))s.contested++;}};
let matched=0;
for(const c of cards){
 let subs=[];try{subs=JSON.parse(c.subs||'[]');}catch{/* ohne */}if(!subs.length)continue;
 matched++;
 const r=get.get(c.id);if(!r)continue;
 const ev=evidenceOf({events:parse(r.ev),event:parse(r.e1),records:parse(r.rec)});
 for(const u of subs)add(u,ev.result,ev.sessions);add('*',ev.result,ev.sessions);
}
const terms={};
for(const [k,s] of stat){
 if(k==='*')continue;
 terms[k]={n:s.n,res:s.res,contested:s.res?+(s.contested/s.res).toFixed(3):0,rej:s.rej,post:s.post,maj:s.maj,unan:s.unan};
}
const all=stat.get('*');
const out={builtAt:to,from,to,cards:cards.length,matched,baseline:{n:all?.n||0,res:all?.res||0,contested:all?.res?+(all.contested/all.res).toFixed(3):0.3},subs:terms};
writeFileSync(new URL('../shared/social-calibration-model.json',import.meta.url),JSON.stringify(out,null,1)+'\n');
console.log(`Kalibrierung ${from} bis ${to}: ${matched} Sachpunkte, ${all?.res||0} mit Ergebnis, Mittel streitig ${out.baseline.contested}; ${Object.keys(terms).length} Unterthemen.`);
