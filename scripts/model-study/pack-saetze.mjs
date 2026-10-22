// Pakete für die Einordnung der Kernsätze (Begriffsbuch Abschnitt 12): je Paket --size Berichte mit nummerierten Satzkandidaten
// (shared/model/sentences.mjs); 10 % der Berichte ein zweites Mal in einem anderen Paket (Schlüssel mit „d“), um die
// Übereinstimmung zu messen. Schreibt <dir>/paket-N.json und <dir>/anleitung.md (Abschnitt 12 des Begriffsbuchs und das Format).
//   node scripts/model-study/pack-saetze.mjs tests/fixtures/kern-saetze.json <dir> [--size=15]
import fs from 'node:fs';
import path from 'node:path';
import {candidates} from '../../shared/model/sentences.mjs';
const [file,dir]=process.argv.slice(2),size=+(process.argv.find(a=>a.startsWith('--size='))?.slice(7)||15);
const data=JSON.parse(fs.readFileSync(file,'utf8'));fs.mkdirSync(dir,{recursive:true});
const items=data.rows.map((r,i)=>({k:'s'+i,title:r.title,committee:r.committee,document:r.doc.name,sentences:candidates(r.text).map(c=>`${c.i}: ${c.text}`)}));
const doubles=items.filter((_,i)=>i%10===3).map(x=>({...x,k:x.k+'d'}));
// Doppel ans Ende gemischt, damit sie in anderen Paketen landen als das Original
const all=[...items,...doubles.reverse()],packs=[];
for(let i=0;i<all.length;i+=size)packs.push(all.slice(i,i+size));
packs.forEach((p,n)=>fs.writeFileSync(path.join(dir,`paket-${n+1}.json`),JSON.stringify(p,null,1)));
const book=fs.readFileSync('requirements/begriffsbuch-kern.md','utf8'),sec=book.slice(book.indexOf('## 12. Kernsätze'));
fs.writeFileSync(path.join(dir,'anleitung.md'),`# Kernsätze einordnen

Du ordnest Berichte aus Ratsinformationssystemen ein. Je Bericht siehst du Titel, Gremium, Name des Dokuments und die nummerierten
Sätze des Hauptdokuments. Wähle nach den Regeln unten die Nummern der Sätze für die Kurz- und die Langfassung. Lies nur diese Anleitung
und dein Paket, keinen Code und keine anderen Dateien. Rate nicht: was nicht im Satz steht, zählt nicht.

${sec}

## Ausgabe

Schreibe eine JSON-Liste mit einem Eintrag je Bericht des Pakets, in derselben Reihenfolge, nach <paket>.out.json:

[{"k":"s12","short":[4],"long":[2,4,7,9],"none":false}, …]

- k: der Schlüssel aus dem Paket (auch mit „d“ am Ende genau übernehmen)
- short: Nummern der Kurzfassung (1 oder 2), long: Nummern der Langfassung (3 bis 6, enthält die der Kurzfassung), aufsteigend
- none: true, wenn es keine Zusammenfassung geben soll; dann short und long leer
- optional note: ein kurzer Hinweis bei echten Zweifeln
`);
console.log(`${items.length} Berichte, ${doubles.length} Doppel, ${packs.length} Pakete in ${dir}`);
