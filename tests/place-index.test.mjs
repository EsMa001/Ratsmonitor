import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {CATALOG} from '../shared/catalog.mjs';
/* Ortserkennung der Suchleiste (components/ratsmonitor/lib/place.ts) mit den echten Kartendaten; Fläche als Rang nur 0 */
const root=path.resolve(import.meta.dirname,'..');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const {PlaceIndex}=await import(moduleUrl(compile('components/ratsmonitor/lib/place.ts').replace('"./text"',JSON.stringify(moduleUrl(compile('components/ratsmonitor/lib/text.ts'))))));
const map=JSON.parse(fs.readFileSync(path.join(root,'public/data/de_map.json'),'utf8'));
const idx=new PlaceIndex(map,{areaSize:()=>0});
const parse=(q,overrides={})=>idx.parse(q,overrides,{});

test('Ortsnamen mit Klammern, Punkt oder Schrägstrich werden vollständig erkannt, ohne Rest im Suchtext',()=>{
 for(const [q,ags] of [['Gronau (Westf.)','05554020'],['Lohne (Oldenburg)','03460006'],['Essen (Oldenburg)','03453006'],['St. Wendel','10046117'],['Adorf/Vogtl.','14523010'],['Neustadt (Hessen)','06534016'],['Weiden i.d.OPf.','09363']]){
  const p=parse(q);
  assert.equal(p.place?.ags,ags,q);assert.equal(p.restAll,'',q);
 }
 const p=parse('Hennef (Sieg) Kita');assert.equal(p.place?.ags,'05382020');assert.equal(p.restAll,'Kita');
});

test('Schreibweise mit oder ohne Dehnungs-h: Mehrwortname erkannt, Einzelwort als weitere Wahl',()=>{
 const ruhr=parse('Mühlheim an der Ruhr Bauantrag');assert.equal(ruhr.place?.ags,'05117');assert.equal(ruhr.restAll,'Bauantrag');
 const muehl=parse('mühlheim');assert.ok(muehl.place.name.startsWith('Mühlheim'));assert.ok(muehl.alts.some(e=>e.ags==='05117'));
 assert.ok(idx.suggest('mühlheim').items.some(e=>e.ags==='05117'));
 assert.equal(parse('bahnhof').place,null);
});

test('ausdrücklich gewählter Ort mit allgemeinem Namen („Hof“, „Lage“) wird Ortsfilter',()=>{
 assert.equal(parse('Hof').place,null);
 assert.equal(parse('Hof',{hof:'09464'}).place?.ags,'09464');
 const lage=parse('Lage Kita',{lage:'05766040'});assert.equal(lage.place?.ags,'05766040');assert.equal(lage.restAll,'Kita');
});

test('jedes Gebiet mit Kartenfläche ist über seinen Namen erreichbar (erkannt, Alternative oder Vorschlag)',()=>{
 const gem=new Set(map.gem.a),krs=new Set(map.krs.a);
 const fits=(e,r)=>!!e&&(e.ags===r.ags||r.ags===e.ags+'000'||(r.formerAgs??[]).includes(e.ags));
 const missing=[];
 for(const r of CATALOG){
  if(!gem.has(r.ags)&&!krs.has(r.ags)&&!(r.ags.length===8&&krs.has(r.ags.slice(0,5))))continue;
  /* Kreise mit vielen gleichnamigen Gemeinden („Neunkirchen“) über „Kreis …“ */
  const reach=q=>{const p=parse(q,{});return fits(p.place,r)||p.alts.some(e=>fits(e,r))||idx.suggest(q).items.some(e=>fits(e,r));};
  if(reach(r.shortName)||(r.kind==='district'&&reach('Kreis '+r.shortName)))continue;
  missing.push(r.shortName);
 }
 /* Namen unter drei Buchstaben erkennt die Suchleiste bewusst nicht (nur über die Karte wählbar) */
 assert.deepEqual(missing,['Au']);
});
