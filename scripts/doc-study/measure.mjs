// Misst Dokumentart, Hauptdokument und Sitzungsunterlage (shared/document-type.mjs) an einer von Hand eingeordneten Stichprobe.
//   node scripts/doc-study/measure.mjs --set=doc-dev [--fehler]
// Hauptdokument: Wahl von primaryPdf (Titel, Zahl der Berichte, Text vorhanden) gegen die zulässigen Dokumente; bei „-“ (nur Sitzungsunterlagen) ist richtig,
// wenn die Regel das Dokument als Sitzungsunterlage verwirft. Art: aus dem Titel im Zusammenhang des Berichts (reportTypes), aus dem Textanfang
// (documentTypeFromText) und beides (effectiveType). Sitzungsunterlage: sessionDocument mit der Zahl der Berichte derselben Sitzung.
import fs from 'node:fs';
import {documentType,documentTypeFromText,effectiveType,primaryPdf,reportTypes,sessionDocument} from '../../shared/document-type.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+arg('set','doc-dev')+'.json',import.meta.url),'utf8'));
const CODE={paper:'p',decision:'d',attachment:'a',minutes:'m',invitation:'i',other:'o'};
const c={n:0,mainOk:0,docs:0,tTitle:0,tText:0,tBoth:0,textDocs:0,sessTP:0,sessFP:0,sessFN:0,sessGold:0,skipOk:0,skipN:0};const bad=[],conf={};
for(const [i,r] of ref.rows.entries()){
 if(!r.gold)continue;c.n++;
 const docs=r.docs.map(d=>({...d,kind:'application/pdf'}));
 const opt={uses:u=>docs.find(d=>d.url===u)?.uses||0,hasText:u=>!!docs.find(d=>d.url===u)?.head?.trim()},types=reportTypes(docs);
 const g=r.gold;
 if(!g.main.length){c.skipN++;const p=primaryPdf(docs,opt);if(!p||sessionDocument(p,p.uses))c.skipOk++;else bad.push([i,'haupt',`${'abcdefghijkl'[docs.indexOf(p)]} statt keins`,r.title]);}
 else{const p=primaryPdf(docs,opt),k=docs.indexOf(p);if(g.main.includes(k))c.mainOk++;else bad.push([i,'haupt',`${'abcdefghijkl'[k]} statt ${g.main.map(x=>'abcdefghijkl'[x]).join('')}`,r.title]);}
 docs.forEach((d,j)=>{
  c.docs++;const want=g.types[j];
  const tt=CODE[types.get(d.url)],tx=d.head?documentTypeFromText(d.head):null,tb=CODE[effectiveType(types.get(d.url),tx,d.title)];
  if(tt===want)c.tTitle++;if(tb===want)c.tBoth++;if(d.head){c.textDocs++;if(CODE[tx]===want)c.tText++;}
  if(tb!==want){const key=want+'→'+tb;conf[key]=(conf[key]||0)+1;}
  const s=sessionDocument(d,d.uses);if(g.session[j]){c.sessGold++;if(s)c.sessTP++;else{c.sessFN++;bad.push([i,'sitzung',`${'abcdefghijkl'[j]} nicht erkannt`,d.title]);}}else if(s){c.sessFP++;bad.push([i,'sitzung',`${'abcdefghijkl'[j]} fälschlich`,d.title]);}
 });
}
const pc=(a,b)=>b?(100*a/b).toFixed(0)+' %':'–';
console.log(`${c.n} Berichte, ${c.docs} PDFs`);
console.log(`Hauptdokument richtig ${pc(c.mainOk,c.n-c.skipN)} (${c.mainOk}/${c.n-c.skipN}); nur Sitzungsunterlagen richtig verworfen ${c.skipOk}/${c.skipN}`);
console.log(`Art richtig: Titel ${pc(c.tTitle,c.docs)}, Textanfang ${pc(c.tText,c.textDocs)} (von ${c.textDocs} mit Text, ohne Treffer zählt falsch), beides ${pc(c.tBoth,c.docs)}`);
console.log(`Sitzungsunterlage: ${c.sessTP}/${c.sessGold} erkannt, ${c.sessFP} fälschlich`);
console.log('Verwechslungen (soll→ist, beides):',Object.entries(conf).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(', '));
if(process.argv.includes('--fehler'))for(const [i,k,m,t] of bad)console.log(String(i).padStart(3),k.padEnd(8),m.padEnd(22),t.slice(0,80));
