// Gleicht die Einordnung der großen Stichprobe an Regeln an, die erst während der Einordnung festgelegt wurden
// (requirements/begriffsbuch-kern.md, Abschnitte 9 bis 11). Nur eindeutige Fälle werden geändert und mit `fixed` vermerkt;
// nicht eindeutige werden als Liste ausgegeben (zum Nachsehen von Hand).
//   node scripts/model-study/normalize-big.mjs <kern-big.json> <Ordner mit paket-N.out.json> [--write]
import fs from 'node:fs';
const [file,dir]=process.argv.slice(2),data=JSON.parse(fs.readFileSync(file,'utf8'));
const PLACEHOLDER=/^Öffentlich(?:er Tagesordnungspunkt| auf der Tagesordnung);|^In der Tagesordnung geführt|^Sitzung steht noch aus/;
const STICHTAG='2026-10-21';
const rowOf=k=>data.rows[+k.replace(/^b|d$/g,'')];
const counts={info:0,body_money:0,announced_check:0},check=[];
for(const f of fs.readdirSync(dir).filter(f=>/^paket-\d+\.out\.json$/.test(f))){
 const path=dir+'/'+f,arr=JSON.parse(fs.readFileSync(path,'utf8'));let changed=false;
 for(const o of arr){const r=rowOf(o.k);if(!r)continue;
  const hasDecision=r.pdfs.some(p=>p.decision),past=r.eventDate&&r.eventDate<=STICHTAG;
  const real=r.events.filter(e=>e.result&&!PLACEHOLDER.test(e.result));
  // Abschnitt 4 / 11.1: Sachpunkt „Information“ ohne Beschlussvorschlag, Sitzung vorbei, kein Beleg → Zur Kenntnis
  if(o.kind==='subject'&&o.process==='information'&&o.status==='unknown'&&past&&!hasDecision&&!real.length){o.status='info';o.fixed=(o.fixed?o.fixed+',':'')+'11.1';counts.info++;changed=true;}
  // 3 / 11: Antrag eines Gremiums, Vereins oder einer Schule auf Geld → Geld
  if(o.kind==='subject'&&o.process==='political'&&(o.applicants||[]).every(a=>a==='body')&&(o.applicants||[]).length&&/zuschuss|förder|mittel|zuwendung|finanzier|kostenübernahme/i.test(r.title)){o.process='money';o.fixed=(o.fixed?o.fixed+',':'')+'3';counts.body_money++;changed=true;}
  // 11.15: Angekündigt trotz früherem Ergebnis → nur melden
  if(o.status==='announced'&&real.length){counts.announced_check++;if(!o.k.endsWith('d'))check.push([o.k,r.title.slice(0,70),real.map(e=>`${e.date} ${e.committee.slice(0,30)}: ${e.result.slice(0,50)}`).join(' | ')]);}
 }
 if(changed&&process.argv.includes('--write'))fs.writeFileSync(path,JSON.stringify(arr));
}
console.log('angeglichen:',JSON.stringify(counts),process.argv.includes('--write')?'(geschrieben)':'(nur gezählt)');
for(const c of check)console.log(' prüfen',c.join(' · '));
