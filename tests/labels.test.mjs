import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTopic,LABELS} from '../shared/labels.mjs';
const cases=[
 ['Mitteilungen der Verwaltung','allgemein'],['Verschiedenes','allgemein'],['Einwohnerfragestunde','allgemein'],
 ['Genehmigung der Niederschrift','sitzung'],['Feststellung der Beschlussfähigkeit','sitzung'],
 ['Mitteilungen der Verwaltung zum Klimaschutz','klima'],['Anfragen zur Kulturförderung','kultur'],
 ['Erschließungsarbeiten Friedhofstraße/Buschenkamp','bauen'],['Friedhofsverwaltung','sicherheit'],
 ['Kinder- und Jugendparlament genehmigt Ideenwettbewerb','soziales'],['Baum an der neuen Brücke - Frau Besecke','umwelt'],
 ['Barrierefreier Umbau der Bushaltestellen','mobilitaet'],['Neue Belegungsvereinbarung für geförderte Wohnungen','bauen'],
 ['Rad-Vorrang-Route Berensberg','mobilitaet'],['Erweiterung der GGS Richterich','bildung'],
 ['Musikschule','kultur'],['Neubau einer Kita an der Nordstraße','bildung'],['Schulwegsicherheit','mobilitaet'],
 ['Schul- und Sportförderung','unklar'],['Baustelle Wiens - Herr Kösters','unklar'],['Probleme Lawi - Frau Besecke','unklar'],
 ['Mitteilungen - Frau Schulze','allgemein'],['Unbekanntes Projekt - Frau Schulze','unklar'],
 ['Landschaftspflege','unklar'],['Schulbau','bildung'],['Bebauungsplan Schulzentrum','bauen'],
 ['Stillfreundliche Kommune','gesundheit'],['Sportförderung','sport'],['Kulturförderung','kultur'],['Finanzen','finanzen'],['Transport von sperrigen Abfällen','umwelt'],['Einwohnerfragestunde gemäß § 18 der Geschäftsordnung','allgemein']
];
test('reviewed title fixtures: substance, formal headings and ambiguity',()=>{
 for(const [title,expected] of cases)assert.equal(classifyTopic({title}).primary,expected,title);
});
test('structural groups remain distinct from the 13 subject domains',()=>{
 assert.equal(LABELS.filter(l=>!l.kind&&l.id!=='unklar').length,13);
 assert.equal(LABELS.filter(l=>l.kind).length,2);
 const c=classifyTopic({officialTitle:'Mitteilungen - Frau Schulze',sourceUrl:'https://example.org/1'});
 assert.equal(c.evidence,'Mitteilungen - Frau Schulze');assert.equal(c.sourceUrl,'https://example.org/1');assert.equal(c.version,'labels-v2');
});
