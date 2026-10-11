// plenara.X – Newsradar: Bausteine der Meldung (server/integrations/analytics-news.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {place,organ,quotable,article} from '../server/integrations/analytics-news.mjs';

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
