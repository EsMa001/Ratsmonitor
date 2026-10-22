// Führt den Nachtrag (Vorhaben, Antragsteller, Empfehlung, Planschritt, Wärmeplan-Schritt, Hausform) in tests/fixtures/kern-pilot.json
// zusammen, prüft die Doppel und vergleicht mit den heutigen Regeln (Signal-Fakten aus dem Titel, factionsOf, planOf, heatPlanOf).
//   node scripts/model-study/merge-pilot-extra.mjs <Ordner mit paket-N.out.json> [--write]
import fs from 'node:fs';
import {tenderOf,windStepOf,solarOf,energyOf,areaDevOf,schoolBuildOf,streetSignalOf,waterSignalOf,broadbandSignalOf,projectsOf,careOf,retailOf,planOf,planUseOf,heatPlanOf,factionsOf} from '../../shared/topic-facts.mjs';
const dir=process.argv[2],file=new URL('../../tests/fixtures/kern-pilot.json',import.meta.url),data=JSON.parse(fs.readFileSync(file,'utf8'));
const got=new Map(),dup=new Map();
for(const f of fs.readdirSync(dir).filter(f=>/^paket-\d+\.out\.json$/.test(f)))for(const o of JSON.parse(fs.readFileSync(dir+'/'+f,'utf8')))(o.k.endsWith('d')?dup:got).set(o.k.replace(/d$/,''),o);
const pc=(a,b)=>b?Math.round(100*a/b)+' %':'–',same=(a,b)=>JSON.stringify([...(a||[])].sort())===JSON.stringify([...(b||[])].sort());
const ag={n:0,project:0,applicants:0,advice:0,planstep:0,heatstep:0,housetypes:0};
for(const [k,b] of dup){const a=got.get(k);if(!a)continue;ag.n++;for(const f of ['project','advice','planstep','heatstep'])if((a[f]??null)===(b[f]??null))ag[f]++;if(same(a.applicants,b.applicants))ag.applicants++;if(same(a.housetypes,b.housetypes))ag.housetypes++;}
console.log(`Doppel ${ag.n}: Vorhaben ${pc(ag.project,ag.n)} · Antragsteller ${pc(ag.applicants,ag.n)} · Empfehlung ${pc(ag.advice,ag.n)} · Planschritt ${pc(ag.planstep,ag.n)} · Wärmeplan ${pc(ag.heatstep,ag.n)} · Hausform ${pc(ag.housetypes,ag.n)}`);
// Heute: Signal = irgendein Signal-Fakt aus dem Titel
const signalToday=t=>!!(tenderOf(t)||windStepOf(t)||solarOf(t)||energyOf(t)||areaDevOf(t)||schoolBuildOf(t)||streetSignalOf(t)||waterSignalOf(t)||broadbandSignalOf(t)||projectsOf(t).length||careOf(t)||retailOf(t)||planUseOf(t));
const PARTY=[['cdu',/cdu/i],['csu',/csu/i],['spd',/spd/i],['gruene',/grün|gruen|bündnis/i],['fdp',/fdp/i],['afd',/afd/i],['linke',/link/i],['bsw',/bsw/i],['fw',/freie wähler|fwg|\bfw\b/i]];
const PLAN={'Aufstellung':'aufstellung','Frühzeitige Beteiligung':'fruehzeitig','Offenlage':'entwurf','Abwägung':'abwaegung','Satzungsbeschluss':'satzung','Aufhebung':'aufhebung','Sonstiger Schritt':'sonst'};
const HEAT={'Start und Beauftragung':'start','Analyse und Zwischenstand':'analyse','Entwurf und Beteiligung':'entwurf','Wärmeplan vorgelegt':'beschluss','Umsetzung und Fortschreibung':'umsetzung'};
const c={n:0,proj:0,projYes:0,sig:0,sigHit:0,sigGiven:0,sigRight:0,app:0,appN:0,plan:0,planN:0,heat:0,heatN:0},dist={project:{},applicants:{},advice:{},planstep:{},heatstep:{},housetypes:{}};
data.rows.forEach((r,i)=>{const g=got.get('p'+i);if(!g||r.gold.kind!=='subject')return;c.n++;
 Object.assign(r.gold,{project:!!g.project,applicants:g.applicants||[],advice:g.advice||'none',planstep:g.planstep??null,heatstep:g.heatstep??null,housetypes:g.housetypes||[]});
 for(const [k,v] of Object.entries({project:String(!!g.project),advice:g.advice||'none',planstep:g.planstep||'–',heatstep:g.heatstep||'–'}))dist[k][v]=(dist[k][v]||0)+1;
 for(const a of g.applicants||[])dist.applicants[a]=(dist.applicants[a]||0)+1;for(const h of g.housetypes||[])dist.housetypes[h]=(dist.housetypes[h]||0)+1;
 const today=signalToday(r.title);if(g.project){c.projYes++;if(today)c.sigHit++;}if(today){c.sigGiven++;if(g.project)c.sigRight++;}
 const head=r.pdfs.map(p=>p.first||'').join(' ').slice(0,1500),fo=factionsOf(r.title,head),rule=(fo?.parties||[]).map(p=>(PARTY.find(([,re])=>re.test(p))||['other'])[0]);
 const gp=(g.applicants||[]).filter(a=>!['member','residents','local'].includes(a));if(gp.length||rule.length){c.appN++;if(same([...new Set(rule)],gp))c.app++;}
 if(g.planstep){c.planN++;const pl=planOf(r.title,r.pdfs.map(p=>p.decision||'').join(' '));if(pl&&PLAN[pl.stage]===g.planstep)c.plan++;}
 if(g.heatstep){c.heatN++;const h=heatPlanOf(r.title,r.pdfs.map(p=>p.decision||'').join(' '));if(HEAT[h]===g.heatstep)c.heat++;}
});
console.log(`Regeln gegen Einordnung (${c.n} Sachpunkte): Vorhaben ${c.projYes}× ja; heutige Signal-Regeln finden davon ${pc(c.sigHit,c.projYes)} (Abdeckung), ihre Treffer sind zu ${pc(c.sigRight,c.sigGiven)} Vorhaben (${c.sigGiven} Treffer) · Antragsteller ${pc(c.app,c.appN)} (${c.appN}) · Planschritt ${pc(c.plan,c.planN)} (${c.planN}) · Wärmeplan ${pc(c.heat,c.heatN)} (${c.heatN})`);
for(const [k,v] of Object.entries(dist))console.log(k+':',JSON.stringify(v));
const notes=[...got.values()].filter(g=>g.note);console.log('Hinweise:',notes.length);for(const g of notes.slice(0,12))console.log(' -',g.k,g.note.slice(0,150));
if(process.argv.includes('--write')){fs.writeFileSync(file,JSON.stringify(data,null,1));console.log('geschrieben');}
