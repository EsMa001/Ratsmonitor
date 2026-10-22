// Messlatte: die heutigen Regeln auf den Prüfberichten der großen Stichprobe (set check), gegen die Einordnung nach dem Begriffsbuch.
//   node scripts/model-study/rules-big.mjs tests/fixtures/kern-big.json
import fs from 'node:fs';
import {itemKind} from '../../shared/item-kind.mjs';
import {themeOf,OPEN} from '../../shared/themes.mjs';
import {stageOf} from '../../shared/stage.mjs';
import {documentType,documentTypeFromText,effectiveType,primaryPdf} from '../../shared/document-type.mjs';
import {tenderOf,windStepOf,solarOf,energyOf,areaDevOf,schoolBuildOf,streetSignalOf,waterSignalOf,broadbandSignalOf,projectsOf,careOf,retailOf,planUseOf,planOf} from '../../shared/topic-facts.mjs';
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),test=data.rows.filter(r=>r.gold&&r.set==='check');
const pc=(a,b)=>b?Math.round(100*a/b)+' %':'–';
const KIND={formal:'procedure',collection:'procedure',routine:'personal',subject:'subject'};
const PROCESS={bericht:'information',antrag:'political',beteiligung:'political',bauantrag:'permit',planung:'planning',regelung:'planning',bau:'build',vergabe:'build',haushalt:'money',abgaben:'money',foerderung:'money',vertrag:'contract',liegenschaft:'contract',sonst:'other'};
const DOC={paper:'paper',attachment:'attachment',decision:'result',minutes:'minutes',invitation:'session'};
const PLAN={'Aufstellung':'aufstellung','Frühzeitige Beteiligung':'fruehzeitig','Offenlage':'entwurf','Abwägung':'abwaegung','Satzungsbeschluss':'satzung','Aufhebung':'aufhebung','Sonstiger Schritt':'sonst'};
const signal=t=>!!(tenderOf(t)||windStepOf(t)||solarOf(t)||energyOf(t)||areaDevOf(t)||schoolBuildOf(t)||streetSignalOf(t)||waterSignalOf(t)||broadbandSignalOf(t)||projectsOf(t).length||careOf(t)||retailOf(t)||planUseOf(t));
const isS=r=>r.gold.kind==='subject',c={};const add=(k,ok)=>{c[k]=c[k]||[0,0];c[k][1]++;if(ok)c[k][0]++;};
let tg=0,tr=0,tw=0,th=0;
for(const r of test){
 add('Art',KIND[itemKind(r.title)]===r.gold.kind);
 add('Status',r.rule.status===r.gold.status);
 const docs=r.pdfs.map(p=>({title:p.name,url:p.url,kind:'application/pdf'}));
 if(docs.length){const p=primaryPdf(docs),i=p?docs.indexOf(p):-1;add('Hauptdokument',(i<0?null:i)===(r.gold.main??null));}
 r.pdfs.forEach((p,j)=>add('Dokumentart',(DOC[effectiveType(documentType(p.name),p.first?documentTypeFromText(p.first):null,p.name)]||'other')===r.gold.doctypes?.[j]));
 if(isS(r)){add('Vorgangsart',PROCESS[stageOf({title:r.title})]===r.gold.process);add('Vorhaben',signal(r.title)===!!r.gold.project);
  if(r.gold.planstep){const pl=planOf(r.title,r.pdfs.map(p=>p.decision||'').join(' '));add('Planschritt',!!pl&&PLAN[pl.stage]===r.gold.planstep);}
  const t=themeOf({title:r.title}).theme,g=r.gold.themes||[];if(t!==OPEN){tg++;if(g.includes(t))tr++;}if(g.length&&!g.includes('offen')){tw++;if(g.includes(t))th++;}}
}
for(const [k,[ok,n]] of Object.entries(c))console.log(k.padEnd(18),pc(ok,n),`(${n})`);
console.log('Thema'.padEnd(18),`Genauigkeit ${pc(tr,tg)}, Abdeckung ${pc(th,tw)}`);
