// Themenradare: Erkennung von Unterthema und Signal (shared/radars.mjs, radarFactsOf in shared/topic-facts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {radarFactsOf} from '../shared/topic-facts.mjs';
const of=(t,x='')=>radarFactsOf(t,x).map(r=>`${r.kind.slice(6)}:${r.value}/${r.detail}`);

test('topics and signals from the title',()=>{
 assert.deepEqual(of('Abschluss eines Konzessionsvertrages Strom'),['versorgung:Strom und Gas/Vertrag und Konzession']);
 assert.deepEqual(of('Neufassung der Abwassergebührensatzung 2027'),['versorgung:Abwasser/Gebühren und Entgelte','gebuehren:Schmutzwasser/Kalkulation und Satzung']);
 assert.deepEqual(of('Tempo 30 vor der Grundschule - Antrag der SPD'),['verkehr:Tempo und Verkehrssicherheit/Antrag aus der Politik']);
 assert.deepEqual(of('Einbringung der Haushaltssatzung 2027'),['finanzen:Haushalt und Nachtrag/Entwurf und Einbringung']);
 assert.ok(of('Vergabe von Planungsleistungen für den Neubau der Grundschule').includes('vergabe:Planungs- und Ingenieurleistungen/Vergabe und Zuschlag'));
 assert.ok(of('Zuschuss an den Sportverein Blau-Weiß e.V.').includes('soziales:Vereinsförderung/Förderung und Zuschuss'));
 assert.ok(of('Anregung gemäß § 24 GO NRW: Spielplatz').includes('beteiligung:Einwohneranträge und Anregungen/Sonstiges'));
});

test('very short titles use the decision proposal',()=>{
 assert.deepEqual(of('Vorlage 12/26','Beschlussvorschlag: Der Rat beschließt die kommunale Wärmeplanung.').filter(x=>x.startsWith('klima')),['klima:Wärmeplanung/Planung und Konzept']);
});

test('no radar facts for private building permits, formal items, planning participation or look-alike words',()=>{
 assert.deepEqual(of('Bauantrag Um- und Anbau, energetische Sanierung, Fl.-Nr. 213'),[]);
 assert.deepEqual(of('Verpflichtung der Mitglieder des Integrationsrates'),[]);
 assert.deepEqual(of('Einwohnerfragestunde'),[]);
 assert.deepEqual(of('Bebauungsplan Nr. 5, Ergebnis der Öffentlichkeitsbeteiligung'),[]);
 assert.deepEqual(of('Ortstafeln Bachstraße').filter(x=>x.startsWith('soziales')),[]);
 assert.deepEqual(of('Erledigung der Anträge').filter(x=>x.startsWith('klima')),[],'LED nur als Wort');
 assert.deepEqual(of('Mitteilungen der Verwaltung zur Abwassergebühr'),[],'Sammelpunkt');
 assert.deepEqual(of('Sanierung der Turnhalle').filter(x=>x.startsWith('vergabe')),[],'Vergaberadar nur mit Vergabe im Titel');
});

test('fee radar: fee items by service, other fees as fallback, no kita or staff tariffs',()=>{
 const g=t=>of(t).filter(x=>x.startsWith('gebuehren'));
 assert.deepEqual(g('Erhöhung der Abfallgebühren ab 2027'),['gebuehren:Abfall/Erhöhung']);
 assert.deepEqual(g('Kalkulation der Niederschlagswassergebühr 2027'),['gebuehren:Niederschlagswasser/Kalkulation und Satzung']);
 assert.deepEqual(g('Neufassung der Wassergebührensatzung'),['gebuehren:Trinkwasser/Kalkulation und Satzung']);
 assert.deepEqual(g('Abwassergebühren 2027'),['gebuehren:Schmutzwasser/Sonstiges'],'Abwasser ist nicht Trinkwasser');
 assert.deepEqual(g('Änderung der Gebührensatzung der Musikschule'),['gebuehren:Bücherei, Musikschule und Kultur/Kalkulation und Satzung']);
 assert.deepEqual(g('Gebührenordnung Kommunales Eigentum'),['gebuehren:Weitere Benutzungsgebühren/Sonstiges']);
 assert.deepEqual(g('Neukalkulation Kanalgebühren 2027-2029'),['gebuehren:Schmutzwasser/Kalkulation und Satzung']);
 assert.deepEqual(g('Senkung der Elternbeiträge in Kitas'),[],'Kita-Radar');
 assert.deepEqual(g('Tarifabschluss TVöD 2026'),[],'Personal');
 assert.deepEqual(g('Neubau der Kläranlage'),[],'ohne Gebühr im Titel');
});
