// Führt die Einordnung der großen Stichprobe zusammen (paket-N.out.json), meldet die Übereinstimmung der Doppel je Feld und schreibt
// gold in die Stichprobe. Fehlende oder ungültige Einträge werden gezählt, nicht erfunden.
//   node scripts/model-study/merge-big.mjs <kern-big.json> <Ordner> [--write=tests/fixtures/kern-big.json] [--waves=1-5]
import fs from 'node:fs';
const [file,dir]=process.argv.slice(2),arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const got=new Map(),dup=new Map();let packs=0,bad=0;
for(const f of fs.readdirSync(dir).filter(f=>/^paket-\d+\.out\.json$/.test(f))){
 let arr;try{arr=JSON.parse(fs.readFileSync(dir+'/'+f,'utf8'));}catch{bad++;continue;}packs++;
 for(const o of arr)(o.k.endsWith('d')?dup:got).set(o.k.replace(/d$/,''),o);}
const pc=(a,b)=>b?Math.round(100*a/b)+' %':'–',same=(a,b)=>JSON.stringify([...(a||[])].sort())===JSON.stringify([...(b||[])].sort());
const F=['kind','process','service','project','advice','planstep','heatstep','status','main','result_doc'],ag={n:0,theme:0,subs:0,subsubs:0,applicants:0,housetypes:0,doc:0,docN:0};for(const f of F)ag[f]=0;
for(const [k,b] of dup){const a=got.get(k);if(!a)continue;ag.n++;
 for(const f of F)if((a[f]??null)===(b[f]??null))ag[f]++;
 if((a.themes?.[0]||'')===(b.themes?.[0]||''))ag.theme++;
 for(const f of ['subs','subsubs','applicants','housetypes'])if(same(a[f],b[f]))ag[f]++;
 (a.doctypes||[]).forEach((t,i)=>{ag.docN++;if(t===b.doctypes?.[i])ag.doc++;});}
console.log(`${packs} Pakete gelesen${bad?', '+bad+' unlesbar':''}, ${got.size} von ${data.rows.length} Berichten eingeordnet`);
console.log(`Doppel ${ag.n}: Art ${pc(ag.kind,ag.n)} · Thema ${pc(ag.theme,ag.n)} · Unterthemen ${pc(ag.subs,ag.n)} · Unter-Unterthemen ${pc(ag.subsubs,ag.n)} · Vorgangsart ${pc(ag.process,ag.n)} · Leistungsart ${pc(ag.service,ag.n)} · Vorhaben ${pc(ag.project,ag.n)} · Antragsteller ${pc(ag.applicants,ag.n)} · Empfehlung ${pc(ag.advice,ag.n)} · Planschritt ${pc(ag.planstep,ag.n)} · Wärmeplan ${pc(ag.heatstep,ag.n)} · Hausform ${pc(ag.housetypes,ag.n)} · Status ${pc(ag.status,ag.n)} · Hauptdokument ${pc(ag.main,ag.n)} · Ergebnisdokument ${pc(ag.result_doc,ag.n)} · Dokumentart ${pc(ag.doc,ag.docN)}`);
const out=arg('write','');
if(out){let n=0;data.rows.forEach((r,i)=>{const g=got.get('b'+i);if(!g)return;n++;const {k,...gold}=g;r.gold=gold;});
 fs.writeFileSync(out,JSON.stringify(data));console.log('gold geschrieben',n,'→',out);}
const notes=[...got.values()].filter(g=>g.note);console.log('Hinweise:',notes.length);
