// Verlauf der Anbindung: wie viele Gebiete und Einwohner zu jedem Stand des Quellenkatalogs angebunden waren.
// Liest die Katalogdateien aus jedem Commit, der sie geändert hat (git log), zählt die Quellen gegen den heutigen
// Gebietskatalog (5.324 Gebiete; Einwohner auf der Gemeindeebene, Kreise zählen ihre Gemeinden nicht doppelt) und
// schreibt server/integrations/coverage-history.json. Schon bekannte Commits bleiben stehen; ein Lauf nach einem neuen
// Build des Katalogs ergänzt nur die neuen Stände. Der Arbeitsstand (nicht committete Änderungen) steht als letzter
// Punkt ohne Commit, wenn er vom letzten Commit abweicht.
//   node scripts/coverage-history.mjs            # ergänzt die Datei
//   FULL=1 node scripts/coverage-history.mjs     # berechnet alle Stände neu
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CATALOG,POPULATION,landOf} from '../shared/catalog.mjs';
import {ALL_LANDS} from '../shared/lands.mjs';
import {coverageOf} from '../shared/coverage.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const FILES=['nrw-sources','nearby-sources','expanded-sources','statewide-sources','nds-sources','de-sources','citystate-sources'].map(f=>'server/integrations/'+f+'.json');
// Die ersten sieben Quellen stehen in regions.mjs (Code, nicht JSON); sie gelten ab dem ersten Commit.
const CORE=['muenster','billerbeck','coesfeld','steinfurt','borken','warendorf','recklinghausen'];
const target=path.join(root,'server/integrations/coverage-history.json');
// stderr bleibt stumm: git meldet jede Datei, die es in einem alten Commit noch nicht gab.
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:1e9,stdio:['ignore','pipe','ignore']});

/** Angebundene Gebiete (ids) aus den Katalogdateien eines Commits (null: Arbeitsstand). */
function connectedAt(commit){
 const ids=new Set(CORE);
 for(const file of FILES){
  let text;
  try{text=commit?git(['show',commit+':'+file]):fs.readFileSync(path.join(root,file),'utf8');}catch{continue;}
  let json;try{json=JSON.parse(text);}catch{continue;}
  for(const s of Array.isArray(json)?json:Object.values(json.sources||json))if(s?.id&&s.method!=='pending')ids.add(s.id);
 }
 return ids;
}
const previous=!process.env.FULL&&fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{points:[]};
const known=new Map(previous.points.filter(p=>p.commit).map(p=>[p.commit,p]));
const log=git(['log','--format=%H|%cI','--reverse','--',...FILES,'server/integrations/regions.mjs']).trim().split('\n').filter(Boolean).map(l=>{const [commit,at]=l.split('|');return {commit,at};});
const points=[];
for(const {commit,at} of log){
 if(known.has(commit)){points.push(known.get(commit));continue;}
 const c=coverageOf(CATALOG,POPULATION,connectedAt(commit),landOf);
 points.push({at:new Date(at).toISOString(),commit:commit.slice(0,10),...c});
 console.log(commit.slice(0,10),at.slice(0,16),c.areas,'Gebiete',c.population,'Einwohner');
}
// Nach Zeit geordnet: Commits aus zwei Sitzungen (lokal, Cloud) liegen in der Historie nicht in Zeitfolge.
points.sort((a,b)=>a.at.localeCompare(b.at));
// Arbeitsstand: nur, wenn er sich vom letzten Commit unterscheidet.
const work=coverageOf(CATALOG,POPULATION,connectedAt(null),landOf),last=points.at(-1);
if(!last||last.areas!==work.areas||last.population!==work.population)points.push({at:new Date().toISOString(),commit:null,...work});
const total=coverageOf(CATALOG,POPULATION,new Set(CATALOG.map(r=>r.id)),landOf);
const out={builtAt:new Date().toISOString().slice(0,10),note:'Angebundene Gebiete und Einwohner je Stand des Quellenkatalogs (scripts/coverage-history.mjs). Einwohner auf der Gemeindeebene.',total:{areas:total.areas,population:total.population,lands:total.lands},lands:Object.fromEntries(ALL_LANDS.map(l=>[l.id,l.name])),points};
fs.writeFileSync(target,JSON.stringify(out,null,1)+'\n');
console.log(target+': '+points.length+' Stände, zuletzt '+last?.areas+' → '+work.areas+' von '+total.areas+' Gebieten, '+work.population+' von '+total.population+' Einwohnern');
