// Führt die Einordnung des Piloten zusammen (paket-N.out.json, Begriffsbuch zweite Fassung), prüft die Doppel und vergleicht mit den
// heutigen Regeln (Art, Thema, „Was geschieht“ als Vorgangsart, Status, Hauptdokument, Dokumentart).
//   node scripts/model-study/merge-pilot.mjs <Stichprobe.json> <Ordner mit paket-N.out.json> [--write] [--review=tmp/kern-pilot-pruefen.md]
//   --write: Stichprobe mit gold nach tests/fixtures/kern-pilot.json
import fs from 'node:fs';
import {itemKind} from '../../shared/item-kind.mjs';
import {themeOf,OPEN,SUBTOPICS,themeName,subtopicName} from '../../shared/themes.mjs';
import {stageOf} from '../../shared/stage.mjs';
import {documentType,documentTypeFromText,effectiveType,primaryPdf} from '../../shared/document-type.mjs';
const [sample,dir]=process.argv.slice(2),arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const data=JSON.parse(fs.readFileSync(sample,'utf8'));
const got=new Map(),dup=new Map();
for(const f of fs.readdirSync(dir).filter(f=>/^paket-\d+\.out\.json$/.test(f)))for(const o of JSON.parse(fs.readFileSync(dir+'/'+f,'utf8')))(o.k.endsWith('d')?dup:got).set(o.k.replace(/d$/,''),o);
// Bezeichnungen wie STATUS in shared/types.ts
const STATUS={announced:{label:'Angekündigt'},consulting:{label:'In Beratung'},recommended:{label:'Empfehlung'},approved:{label:'Beschlossen'},rejected:{label:'Abgelehnt'},postponed:{label:'Vertagt'},info:{label:'Zur Kenntnis'},unknown:{label:'Stand offen'}};
const pc=(a,b)=>b?Math.round(100*a/b)+' %':'–';
const FIELDS=['kind','process','status','main','result_doc'];
const agree=Object.fromEntries([...FIELDS,'theme','sub','doc','docN','n'].map(k=>[k,0]));
for(const [k,b] of dup){const a=got.get(k);if(!a)continue;agree.n++;
 for(const f of FIELDS)if((a[f]??null)===(b[f]??null))agree[f]++;
 if((a.themes?.[0]||'')===(b.themes?.[0]||''))agree.theme++;
 if((a.subs||[]).some(s=>(b.subs||[]).includes(s))||!(a.subs||[]).length&&!(b.subs||[]).length)agree.sub++;
 a.doctypes.forEach((t,i)=>{agree.docN++;if(t===b.doctypes[i])agree.doc++;});}
console.log(`Doppel ${agree.n}: Art ${pc(agree.kind,agree.n)} · erstes Thema ${pc(agree.theme,agree.n)} · Unterthema ${pc(agree.sub,agree.n)} · Vorgangsart ${pc(agree.process,agree.n)} · Status ${pc(agree.status,agree.n)} · Hauptdokument ${pc(agree.main,agree.n)} · Ergebnisdokument ${pc(agree.result_doc,agree.n)} · Dokumentart ${pc(agree.doc,agree.docN)} je PDF`);
// Regeln auf die neuen Klassen abgebildet
const KIND={formal:'procedure',collection:'procedure',routine:'personal',subject:'subject'};
const PROCESS={bericht:'information',antrag:'political',beteiligung:'political',bauantrag:'permit',planung:'planning',regelung:'planning',bau:'build',vergabe:'build',haushalt:'money',abgaben:'money',foerderung:'money',vertrag:'contract',liegenschaft:'contract',sonst:'other'};
const DOC={paper:'paper',attachment:'attachment',decision:'result',minutes:'minutes',invitation:'session'};
const c={n:0,kind:0,status:0,main:0,mainN:0,doc:0,docN:0,proc:0,procN:0,tGiven:0,tRight:0,tWant:0,tHit:0},dist={kind:{},process:{},status:{},ruleStatus:{}},notes=[],conf={};
data.rows.forEach((r,i)=>{const g=got.get('p'+i);if(!g)return;c.n++;if(g.note)notes.push([r.title,g.note]);
 if(process.argv.includes('--write'))r.gold={kind:g.kind,themes:g.themes||[],subs:g.subs||[],subsubs:g.subsubs||[],process:g.process??null,service:g.service??null,status:g.status,main:g.main??null,result_doc:g.result_doc??null,doctypes:g.doctypes};
 for(const [k,v] of [['kind',g.kind],['process',g.process||'–'],['status',g.status],['ruleStatus',r.rule.status]])dist[k][v]=(dist[k][v]||0)+1;
 if(KIND[itemKind(r.title)]===g.kind)c.kind++;
 if(r.rule.status===g.status)c.status++;else{const k=r.rule.status+'→'+g.status;conf[k]=(conf[k]||0)+1;}
 const docs=r.pdfs.map(p=>({title:p.name,url:p.url,kind:'application/pdf'}));
 if(docs.length){c.mainN++;const p=primaryPdf(docs),idx=p?docs.indexOf(p):-1;if((idx<0?null:idx)===(g.main??null))c.main++;}
 r.pdfs.forEach((p,j)=>{const t=effectiveType(documentType(p.name),p.first?documentTypeFromText(p.first):null,p.name);c.docN++;if((DOC[t]||'other')===g.doctypes[j])c.doc++;});
 if(g.kind==='subject'){c.procN++;if(PROCESS[stageOf({title:r.title})]===g.process)c.proc++;
  const th=themeOf({title:r.title}).theme,want=(g.themes||[]).filter(t=>t!==OPEN);
  if(th!==OPEN){c.tGiven++;if((g.themes||[]).includes(th))c.tRight++;}
  if(!(g.themes||[]).includes(OPEN)){c.tWant++;if(want.includes(th))c.tHit++;}}
});
console.log(`Regeln gegen Einordnung (${c.n} Berichte): Art ${pc(c.kind,c.n)} · Thema Genauigkeit ${pc(c.tRight,c.tGiven)}, Abdeckung ${pc(c.tHit,c.tWant)} · Vorgangsart ${pc(c.proc,c.procN)} (${c.procN} Sachpunkte) · Status ${pc(c.status,c.n)} · Hauptdokument ${pc(c.main,c.mainN)} (${c.mainN} mit PDF) · Dokumentart ${pc(c.doc,c.docN)} (${c.docN} PDFs)`);
for(const [k,v] of Object.entries(dist))console.log(k+':',JSON.stringify(v));
console.log('Status Regel→Einordnung, Abweichungen:',JSON.stringify(Object.fromEntries(Object.entries(conf).sort((a,b)=>b[1]-a[1]))));
console.log('Hinweise der Einordnung:',notes.length);
if(process.argv.includes('--write')){const out=new URL('../../tests/fixtures/kern-pilot.json',import.meta.url);data.note+='; zweite Fassung des Begriffsbuchs';fs.writeFileSync(out,JSON.stringify(data,null,1));console.log('gold geschrieben',out.pathname);}
const review=arg('review','');
if(review){
 const KN={subject:'Sachpunkt',procedure:'Ablauf',personal:'Personalie'};
 const PN={information:'Information',political:'Antrag aus der Politik',permit:'Genehmigung für Dritte',planning:'Planung und Regelung',build:'Bau und Vergabe',money:'Geld',contract:'Vertrag und Grundstück',other:'Sonstiges'};
 const DN={paper:'Vorlage',bundle:'Sammeldokument',attachment:'Anlage',result:'Ergebnis',minutes:'Niederschrift',session:'Sitzungsunterlage',other:'Sonstiges'};
 const pick=data.rows.map((r,i)=>[r,got.get('p'+i)]).filter(([,g])=>g);
 const withPdf=pick.filter(([r])=>r.pdfs.length),without=pick.filter(([r])=>!r.pdfs.length);
 const sel=[...withPdf.filter((_,i)=>i%Math.max(1,Math.floor(withPdf.length/30))===0).slice(0,30),...without.filter((_,i)=>i%Math.max(1,Math.floor(without.length/20))===0).slice(0,20)];
 let o='# Pilot (zweite Fassung): 50 Berichte zum Prüfen\n\nJe Bericht kurz „ok“ oder was richtig wäre. Grundlage: `requirements/begriffsbuch-kern.md`.\n\n';
 sel.forEach(([r,g],n)=>{
  o+=`## ${n+1}. ${r.title.slice(0,160)}\n\nGremium: ${r.committee||'–'} · Sitzung: ${r.eventDate||'–'}\n\n`;
  const real=r.events.filter(e=>e.result&&!/^Öffentlich(?:er Tagesordnungspunkt| auf der Tagesordnung);/.test(e.result));
  if(real.length)o+='Ergebnis laut Quelle: '+real.map(e=>`${e.date||''} ${e.committee}: „${e.result.slice(0,80)}“`).join('; ')+'\n\n';
  if(r.pdfs.length)o+=r.pdfs.map(p=>`- PDF ${p.i}: ${p.name.slice(0,90)}${p.first?'':' (kein Text)'} → **${DN[g.doctypes[p.i]]||g.doctypes[p.i]}**${g.main===p.i?' · **Hauptdokument**':''}${g.result_doc===p.i?' · **Ergebnisdokument**':''}`).join('\n')+'\n\n';
  o+=`Art: **${KN[g.kind]}** · Status: **${STATUS[g.status]?.label||g.status}** (heute: ${STATUS[r.rule.status]?.label||r.rule.status})`;
  if(g.kind==='subject')o+=` · Vorgangsart: **${PN[g.process]||g.process}**${g.service?' ('+g.service+')':''} · Thema: **${(g.themes||[]).map(t=>t===OPEN?'offen':themeName(t)).join(' / ')}**${(g.subs||[]).length?' · Unterthema: **'+g.subs.map(s=>subtopicName(s)||s).join(', ')+'**':''}${(g.subsubs||[]).length?' · Unter-Unterthema: **'+g.subsubs.join(', ')+'**':''}`;
  o+=(g.note?`\n\nHinweis der Einordnung: ${g.note}`:'')+'\n\nPrüfung: \n\n';
 });
 if(notes.length)o+='---\n\n## Alle Hinweise der Einordnung\n\n'+notes.map(([t,n])=>`- ${t.slice(0,90)}: ${n}`).join('\n')+'\n';
 fs.writeFileSync(review,o);console.log('Prüfliste',review,sel.length);
}
