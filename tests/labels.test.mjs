// Katalog labels-v3 (shared/labels.mjs): die 10 Themen plus „noch nicht eingeordnet“; Titelregel = Art des Punkts und Thema
// aus dem Titel wie readReport ohne Text; alte Einordnungen (labels-v2) werden fest übersetzt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTopic,LABELS,LEGACY_LABELS,labelOf,LABEL_VERSION} from '../shared/labels.mjs';
import {THEMES,themeOf} from '../shared/themes.mjs';
import {itemKind} from '../shared/item-kind.mjs';
import {readReport} from '../server/integrations/report-rules.mjs';
const cases=[
 ['Mitteilungen der Verwaltung','unklar'],['Verschiedenes','unklar'],['Einwohnerfragestunde','unklar'],
 ['Genehmigung der Niederschrift','unklar'],['Feststellung der Beschlussfähigkeit','unklar'],
 ['Mitteilungen der Verwaltung zum Klimaschutz','umwelt'],['Anfragen zur Kulturförderung','kultur'],
 ['Erschließungsarbeiten Friedhofstraße/Buschenkamp','bauen'],['Friedhofsverwaltung','sicherheit'],
 ['Kinder- und Jugendparlament genehmigt Ideenwettbewerb','soziales'],['Baum an der neuen Brücke - Frau Besecke','unklar'],
 ['Barrierefreier Umbau der Bushaltestellen','mobilitaet'],['Neue Belegungsvereinbarung für geförderte Wohnungen','bauen'],
 ['Erweiterung der GGS Richterich','bildung'],['Musikschule','kultur'],['Neubau einer Kita an der Nordstraße','bildung'],
 ['Schulwegsicherheit','mobilitaet'],['Landschaftspflege','unklar'],['Schulbau','bildung'],['Bebauungsplan Schulzentrum','bauen'],
 ['Stillfreundliche Kommune','soziales'],['Sportförderung','kultur'],['Kulturförderung','kultur'],['Finanzen','finanzen'],
 ['Transport von sperrigen Abfällen','umwelt']
];
test('Titelregel: Themen, Formalien und offene Titel',()=>{
 for(const [title,expected] of cases)assert.equal(classifyTopic({title}).primary,expected,title);
});
test('Titelregel ist readReport ohne Text: gleiche Art des Punkts, gleiches Thema',()=>{
 for(const [title] of cases){
  const r=readReport({title,documents:[]}),c=classifyTopic({title});
  assert.equal(c.primary,r.theme.id==='offen'?'unklar':r.theme.id,title);
  assert.deepEqual(c.subs,r.theme.subs,title);
  if(itemKind(title)!=='subject')assert.equal(c.primary,'unklar',title);
  else assert.equal(c.primary,themeOf({title}).theme==='offen'?'unklar':themeOf({title}).theme,title);
 }
});
test('Katalog: 10 Themen in der Reihenfolge von themes.mjs, dann unklar; Übersetzung der 16 alten Labels',()=>{
 assert.deepEqual(LABELS.map(l=>l.id),[...THEMES.map(t=>t.id),'unklar']);
 assert.ok(LABELS.every(l=>/^#[0-9a-f]{6}$/.test(l.color)));
 assert.equal(Object.keys(LEGACY_LABELS).length,16);
 assert.ok(Object.values(LEGACY_LABELS).every(id=>LABELS.some(l=>l.id===id)));
 assert.deepEqual([labelOf('klima','labels-v2'),labelOf('sport','labels-v2'),labelOf('gesundheit','labels-v2'),labelOf('sitzung','labels-v2'),labelOf('kultur',LABEL_VERSION),labelOf('sport',LABEL_VERSION),labelOf('bauen','labels-v1')],
  ['umwelt','kultur','soziales','unklar','kultur',null,null]);
 const c=classifyTopic({officialTitle:'Mitteilungen - Frau Schulze',sourceUrl:'https://example.org/1'});
 assert.equal(c.evidence,'Mitteilungen - Frau Schulze');assert.equal(c.sourceUrl,'https://example.org/1');assert.equal(c.version,'labels-v3');
});
test('Themenfilter aus alten Namen (gespeicherte Suchen): übersetzt, alte Sammellabels entfallen, Unbekanntes null',async()=>{
 const {labelFilterName}=await import('../shared/labels.mjs');
 assert.equal(labelFilterName('Klima & Energie'),'Umwelt, Klima & Energie');
 assert.equal(labelFilterName('Sport & Freizeit'),'Kultur, Sport & Freizeit');
 assert.equal(labelFilterName('Allgemeine Anfragen & Mitteilungen'),'');
 assert.equal(labelFilterName('Bauen & Wohnen'),'Bauen & Wohnen');
 assert.equal(labelFilterName(''),'');
 assert.equal(labelFilterName('Erfunden'),null);
});
