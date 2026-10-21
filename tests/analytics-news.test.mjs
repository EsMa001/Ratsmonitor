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
 assert.match(a.lead,/über die Vorlage beraten/,'abgelehnt im Status stammt aus der Vorberatung, nicht vom Stadtrat');
 assert.match(a.body.join(' '),/In einer Vorberatung war die Vorlage abgelehnt worden/);
 const c=article({card,topic:{...topic,events:[topic.events[1]]},facts:[],ev:{result:'rej'},sentences:['x'],more:[],today:'2026-10-11',regionName:'Stadt Stendal'});
 assert.match(c.lead,/hat die Vorlage am Montag, 5\. Oktober, abgelehnt\.$/,'ohne ablehnende Vorberatung: Status des Vorgangs');
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
 assert.match(a.body.join(' '),/In zwei Vorberatungen war die Vorlage abgelehnt worden\./);
 assert.match(a.body.join(' '),/Zuvor war der Vorgang 2-mal beraten worden/);
});

test('outcomeOf liest Platzhalter der Importe nicht als Ergebnis',()=>{
 assert.equal(outcomeOf('Öffentlicher Tagesordnungspunkt; ein Beschlussergebnis ist im erfassten Text nicht belegt.'),null);
 assert.equal(outcomeOf('Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.'),null);
 assert.equal(outcomeOf('Beschlussvorlage'),null);
 assert.equal(outcomeOf('Beschluss: einstimmig'),'einstimmig beschlossen');
});

test('Newsradar wählt wie alle plenara.X-Seiten über x_cases aus: künftige Vorgänge ja, private Bauanträge nein; andere Seiten nur bis heute',async()=>{
 const fs=await import('node:fs'),{DatabaseSync}=await import('node:sqlite'),{sqliteAdapter}=await import('../scripts/sqlite-adapter.mjs');
 const {buildXCases}=await import('../server/integrations/x-cases.mjs'),{news}=await import('../server/integrations/analytics-news.mjs'),{xQuery}=await import('../server/integrations/plenara-x-query.mjs');
 const sql=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const day=d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
 let n=0;
 const put=(title,date,status)=>{n++;const t={title,officialTitle:title,committee:'Rat',events:[{date,committee:'Rat',status}],
  ruleSummary:{short:{sentences:['Der Rat soll über die Sanierung der Sporthalle an der Schule entscheiden, die Kosten liegen bei zwei Millionen Euro.']}}};
  sql.prepare('INSERT INTO topics VALUES(?,?,?,?,?,?,?)').run('t'+n,'city',date,date,status,JSON.stringify(t),'a');};
 put('Sanierung der Sporthalle',day(-3),'rejected');
 put('Neubau der Feuerwache',day(5),'announced');
 put('Bauantrag Carport, Flurstück 12',day(-2),'rejected');
 buildXCases(sql,{today:day(0)});
 const db=sqliteAdapter(sql),catalog=[{id:'a',kind:'city',name:'Stadt Alt',ags:'05558008'}];
 const r=await news(db,catalog,new URLSearchParams(''));
 const heads=r.items.map(i=>i.headline).join(' | ');
 assert.match(heads,/Sporthalle/);assert.match(heads,/Feuerwache – kommt auf die Tagesordnung|Feuerwache kommt auf die Tagesordnung/);
 assert.doesNotMatch(heads,/Carport/,'private Bauanträge zählen nicht');
 const atlas=await xQuery(db,catalog,new URLSearchParams('view=atlas'));
 assert.equal(atlas.total,2,'ohne Zeitraum bis heute: der künftige Vorgang zählt im Atlas nicht');
});
