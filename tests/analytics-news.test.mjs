// plenara.X – Newsradar: Bausteine der Meldung (server/integrations/analytics-news.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {place,organ,quotable,article,outcomeOf} from '../server/integrations/analytics-news.mjs';

test('place and committee with article and place in the genitive',()=>{
 assert.deepEqual(place('Stadt Coesfeld'),{gen:'der Stadt Coesfeld',short:'Coesfeld'});
 assert.deepEqual(place('Kreis Coesfeld'),{gen:'des Kreises Coesfeld',short:'Kreis Coesfeld'});
 const ort=place('Stadt Stendal');
 assert.equal(organ('Ortschaftsrat Möringen',ort).nom,'Der Ortschaftsrat Möringen der Stadt Stendal');
 assert.equal(organ('Stadtverordnetenversammlung',ort).nom,'Die Stadtverordnetenversammlung der Stadt Stendal');
 assert.equal(organ('Rat der Stadt Stendal',ort).nom,'Der Rat der Stadt Stendal','Ort steht schon im Namen');
 assert.equal(organ('Gremium laut Originalquelle',ort).nom,'Ein Gremium');
});

test('only whole sentences without attachments or PDF remnants are quoted',()=>{
 assert.equal(quotable('Der Rat beschließt die Sanierung der Grundschule an der Mühlenstraße.'),'Der Rat beschließt die Sanierung der Grundschule an der Mühlenstraße.');
 assert.equal(quotable('Die CDU-Fraktion hat mit Schreiben vom 09.06.2026 (s. Anlage 1) den Antrag vorgelegt.'),null);
 assert.equal(quotable('Seite 2 von 5 Der Rat beschließt die Sanierung der Grundschule an der Mühlenstraße.'),null);
 assert.equal(quotable('Der Rat beschließt die Sanierung der Grundschule an der'),null,'abgeschnitten');
});

test('the outcome belongs to the named session, not to another committee',()=>{
 const card={id:'t1',date:'2026-10-05',status:'rejected',title:'Wärmeplanung',gremium:'Stadtrat'};
 const topic={title:'Kommunale Wärmeplanung',events:[{date:'2026-09-30',committee:'Ortschaftsrat Möringen',result:'abgelehnt'},{date:'2026-10-05',committee:'Stadtrat',result:''}]};
 const a=article({card,topic,facts:[],ev:{result:'rej'},sentences:['Der Stadtrat beschließt die kommunale Wärmeplanung.'],more:[],today:'2026-10-11',regionName:'Stadt Stendal'});
 assert.match(a.lead,/^Stendal\. Der Stadtrat der Stadt Stendal hat die Vorlage am Montag, 5\. Oktober, abgelehnt\.$/,'letzte Sitzung: Status des Vorgangs');
 const b=article({card:{...card,status:'consulting'},topic,facts:[],ev:{result:'rej'},sentences:['x'],more:[],today:'2026-10-11',regionName:'Stadt Stendal'});
 assert.match(b.lead,/über die Vorlage beraten/,'Ablehnung im Ortschaftsrat ist kein Ausgang des Stadtrats');
 assert.match(b.body.join(' '),/Zuvor hatte sich der Ortschaftsrat Möringen der Stadt Stendal damit befasst/);
});

test('acknowledged, recommended and withdrawn are not decisions',()=>{
 assert.equal(outcomeOf('einstimmig zur Kenntnis genommen'),'zur Kenntnis genommen');
 assert.equal(outcomeOf('einstimmig empfohlen'),'einstimmig empfohlen');
 assert.equal(outcomeOf('Antrag zurückgezogen'),'zurückgezogen');
 assert.equal(outcomeOf('mehrheitlich beschlossen'),'mit Mehrheit beschlossen');
 assert.equal(outcomeOf('abgelehnt'),'abgelehnt');
 assert.equal(quotable('I3) Die Stadt übernimmt die Regelung des Kreises bezüglich der Einkommensgruppen.'),null,'Aufzählungsrest');
 assert.equal(quotable('Die Verwaltung nimmt zum Antrag wie folgt Stellung. Std./72,10 € Mitteilung der Verwaltung zum Antrag.'),null,'Tabellenrest');
 const card={id:'t2',date:'2026-09-30',status:'approved',title:'Reduzierung der Elternbeiträge',gremium:'Kreistag'};
 const topic={title:'Reduzierung der Elternbeiträge',events:[{date:'2026-09-22',committee:'Kreisausschuss',result:'zur Kenntnis genommen'},{date:'2026-09-30',committee:'Kreistag',result:'Kenntnis genommen'}]};
 const a=article({card,topic,facts:[],ev:{result:null},sentences:['Die vergleichende Übersicht der Elternbeiträge wird zur Kenntnis genommen.'],more:[],today:'2026-10-11',regionName:'Kreis Coesfeld'});
 assert.match(a.headline,/– zur Kenntnis genommen$/);
 assert.doesNotMatch(a.lead,/beschlossen/);
});

test('earlier rejections are named and placeholder committees are not counted twice',()=>{
 const card={id:'t3',date:'2026-10-05',status:'consulting',title:'Wärmeplanung',gremium:'Stadtrat'};
 const topic={title:'Wärmeplanung',events:[{date:'2026-09-28',committee:'Ortschaftsrat A',result:'einstimmig abgelehnt'},{date:'2026-09-29',committee:'Ortschaftsrat B',result:'abgelehnt'},
  {date:'2026-09-29',committee:'Gremium laut Originalquelle',result:''},{date:'2026-10-05',committee:'Stadtrat',result:''}]};
 const a=article({card,topic,facts:[],ev:{result:'rej'},sentences:['Der Stadtrat beschließt die kommunale Wärmeplanung.'],more:[],today:'2026-10-11',regionName:'Stadt Stendal'});
 assert.match(a.body.join(' '),/Zwei vorberatende Gremien hatten die Vorlage abgelehnt\./);
 assert.match(a.body.join(' '),/Zuvor hatten sich 2 Gremien damit befasst/);
});
