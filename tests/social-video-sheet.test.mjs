import test from 'node:test';
import assert from 'node:assert/strict';
import {videoSheet,spokenNumber,spokenDate,spoken,shortTitle} from '../shared/social-video-sheet.mjs';

test('Zahlen, Daten und Beträge werden ausgeschrieben', () => {
 assert.equal(spokenNumber(2027),'zweitausendsiebenundzwanzig');
 assert.equal(spokenNumber(241000),'zweihunderteinundvierzigtausend');
 assert.equal(spokenNumber(253000),'zweihundertdreiundfünfzigtausend');
 assert.equal(spokenNumber(562),'fünfhundertzweiundsechzig');
 assert.equal(spokenNumber(21),'einundzwanzig');
 assert.equal(spokenDate('2026-10-13'),'dreizehnten Oktober');
 assert.equal(spokenDate('2026-11-05'),'fünften November');
 assert.equal(spokenDate('2026-09-08'),'achten September');
 assert.equal(spoken('Gesamtkosten 241.000,- € geschätzt, 5 % Puffer, P&R'),'Gesamtkosten zweihunderteinundvierzigtausend Euro geschätzt, fünf Prozent Puffer, Park und Ride');
});

// Beispiele aus den beiden Billerbeck-Berichten (Texte vom Nutzer, 31.10.2026)
const wege={title:'Ausbau Wirtschaftswege ab 2027',status:'unknown',events:[
 {date:'2026-09-03',committee:'Bezirksausschuss'},{date:'2026-09-08',committee:'Stadtentwicklungs- und Bauausschuss'},{date:'2026-10-13',committee:'Rat der Stadt'}],
 ruleSummary:{short:'Die aktualisierte Prioritätenliste zum Ausbau von Wirtschaftswegen wird beschlossen.'}};
const pr={title:'P&R Weihgarten: hier: Vorstellung der Planung',status:'consulting',events:[
 {date:'2026-09-08',committee:'Stadtentwicklungs- und Bauausschuss'},{date:'2026-10-13',committee:'Rat der Stadt'}],
 ruleSummary:{short:'Die Verwaltung wird beauftragt mit der vorgestellten Planung den Förderantrag zu stellen und die erforderlichen Mittel in den Haushalt 2027 ff zu verplanen.'}};

test('Wirtschaftswege: Stand offen, Verlauf, Zitat', () => {
 const s=videoSheet(wege,{regionName:'Billerbeck',today:'2026-10-31',titleShort:'Wirtschaftswege ab 2027'});
 assert.equal(s.ok,true,s.warnings.join('; '));
 assert.equal(s.stand.stamp,'STAND OFFEN');
 assert.equal(s.stand.extra,'Noch nicht beschlossen');
 assert.deepEqual(s.meta,['Rat der Stadt · zuletzt beraten am 13.10.26','Davor: Stadtentwicklungs- und Bauausschuss · 08.09.26']);
 assert.equal(s.zitatHinweis,'Vorschlag aus der Vorlage');
 assert.match(s.sprechtext[1],/^Stand offen in Billerbeck: Wirtschaftswege ab zweitausendsiebenundzwanzig\.$/);
 assert.match(s.sprechtext[5],/Noch kein Beschluss\. Zuletzt beraten: Rat der Stadt, am dreizehnten Oktober\.$/);
});

test('P&R: In Beratung, Standwort im ersten Satz, gesprochene Haushaltsangabe', () => {
 const s=videoSheet(pr,{regionName:'Billerbeck',today:'2026-10-31',titleShort:'P&R Weihgarten'});
 assert.equal(s.ok,true,s.warnings.join('; '));
 assert.equal(s.sprechtext[1],'In Beratung in Billerbeck: Park und Ride Weihgarten.');
 assert.match(s.sprechtext[2],/Haushalt zweitausendsiebenundzwanzig und folgende zu verplanen/);
});

test('Fehlende Angaben stoppen das Video, statt zu raten', () => {
 const s=videoSheet({title:'Etwas',status:'approved',events:[],ruleSummary:null},{regionName:'Ort',today:'2026-10-31'});
 assert.equal(s.ok,false);
 assert.ok(s.warnings.some(w=>/Zitat/.test(w))&&s.warnings.some(w=>/Sitzung/.test(w)));
 const long=videoSheet({...wege,title:'Ein sehr langer Titel, der nicht in zwei Zeilen passt'},{regionName:'Billerbeck',today:'2026-10-31',titleShort:'Ein sehr langer Titel, der nicht in zwei Zeilen passt'});
 assert.ok(long.warnings.some(w=>/Kurzform/.test(w)));
});

test('Ein Zitat, das nur den Titel wiederholt, zählt nicht', () => {
 const title='Ausbau Wirtschaftswege ab 2027 und Prioritätenliste werden beschlossen';
 const s=videoSheet({...wege,title,ruleSummary:{short:title+'.'}},{regionName:'Billerbeck',today:'2026-10-31',titleShort:'Wirtschaftswege ab 2027'});
 assert.equal(s.ok,false);
 assert.ok(s.warnings.some(w=>/nur den Titel/.test(w)));
});

// Dresden: Kernsatz länger als 160 Zeichen, Titel mit Zusatz nach „ - “
const dresden={"title":"Hitzeaktionsplan der Landeshauptstadt Dresden 2026 bis 2030 - ein Plan zum Schutz der Gesundheit vor Hitze","status":"approved",
"events":[{"date":"2026-08-31","committee":"Seniorenbeirat","result":"Zustimmung mit Ergänzung"},{"date":"2026-09-02","committee":"Beirat für Menschen mit Behinderungen","result":"Zustimmung mit Ergänzung"},{"date":"2026-09-24","committee":"Stadtrat","result":"Vertagung"},{"date":"2026-10-29","committee":"Stadtrat","result":"punktweise Abstimmung"}],
"ruleSummary":{"short":"Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 der Landeshauptstadt Dresden gemäß Anlage 1 als Grundlage für Maßnahmen zur Minderung gesundheitlicher Risiken durch Hitze und zum Schutz der Dresdner Bevölkerung, insbesondere besonders betroffener Personengruppen.",
"long":"Die gesundheitlichen Auswirkungen sind im Faktenblatt Hitze und Gesundheit des Amtes für Gesundheit und Prävention beschrieben (siehe www.dresden.de/hitzeaktionsplan). […] Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 der Landeshauptstadt Dresden gemäß Anlage 1 als Grundlage für Maßnahmen zur Minderung gesundheitlicher Risiken durch Hitze und zum Schutz der Dresdner Bevölkerung, insbesondere besonders betroffener Personengruppen. Der Stadtrat beauftragt den Oberbürgermeister, den Hitzeaktionsplan umzusetzen, zu evaluieren und seine Fortschreibung am Ende des Aktionszeitraumes zu prüfen. […] Zu Beschlussunkt 1: Der Hitzeaktionsplan (HAP) bündelt für den Zeitraum 2026 bis 2030 strategische und operative Maßnahmen."}};
test('Dresden: Kurztitel, gekürzter Kernsatz mit […], beschlossen ohne Zusatzzeile', () => {
 const s=videoSheet(dresden,{regionName:'Dresden',today:'2026-10-31'});
 assert.equal(s.ok,true,s.warnings.join('; '));
 assert.equal(s.titel2,'Hitzeaktionsplan 2026 bis 2030');
 assert.match(s.zitat,/^Der Stadtrat bestätigt den Hitzeaktionsplan 2026 bis 2030 .* \[…\]$/);
 assert.ok(s.zitat.length<=160);
 assert.equal(s.stand.extra,null);
 assert.equal(s.zitatHinweis,'Aus der Vorlage');
});
test('Titel werden vor „ - “ und „:“ gekürzt, der Ort fällt weg', () => {
 assert.equal(shortTitle('P&R Weihgarten: hier: Vorstellung der Planung','Billerbeck'),'P&R Weihgarten');
 assert.equal(shortTitle('Ein sehr langer Titel ohne Trennzeichen der nicht passt','Billerbeck'),null);
});


test('Beträge mit Bezeichnung (auch „200.000,-“ ohne Eurozeichen) und Tage bis zur nächsten Sitzung', () => {
 const t={title:'P&R Weihgarten',status:'consulting',events:[{date:'2026-10-13',committee:'Rat der Stadt'},{date:'2026-11-12',committee:'Rat der Stadt'}],
  ruleSummary:{short:'Die Gesamtkosten werden auf 241.000,- € geschätzt, dem steht eine voraussichtliche Förderung von 200.000,- gegenüber und wird beschlossen.'}};
 const s=videoSheet(t,{regionName:'Billerbeck',today:'2026-10-31',titleShort:'P&R Weihgarten'});
 assert.deepEqual(s.betraege.map(b=>[b.value,b.label]),[[241000,'Geschätzte Gesamtkosten'],[200000,'Voraussichtliche Förderung']]);
 assert.equal(s.naechste.tage,12);
 assert.equal(s.naechste.datum,'12.11.26');
 assert.match(s.sprechtext[1],/^In Beratung in Billerbeck/);
 const d=videoSheet({...t,events:[{date:'2026-10-13',committee:'Rat der Stadt'}]},{regionName:'Billerbeck',today:'2026-10-31',titleShort:'P&R Weihgarten'});
 assert.equal(d.naechste,null);
});

test('Hook nennt das Standwort in jedem Status als erste Wörter', () => {
 for (const [status,start] of [['approved','Beschlossen in Ort'],['rejected','Abgelehnt in Ort'],['announced','Angekündigt in Ort'],['recommended','Empfehlung in Ort'],['postponed','Vertagt in Ort'],['info','Zur Kenntnis genommen in Ort'],['unknown','Stand offen in Ort']]) {
  const s=videoSheet({title:'Thema',status,events:[{date:'2026-10-13',committee:'Rat'}],ruleSummary:{short:'Der Rat beschließt das Thema für alle Beteiligten im Ort.'}},{regionName:'Ort',today:'2026-10-31',titleShort:'Thema'});
  assert.ok(s.sprechtext[1].startsWith(start),s.sprechtext[1]);
 }
});

test('Betrag mit „,-“ ohne Eurozeichen behält das Leerzeichen, nächste Sitzung mit „am“', () => {
 assert.equal(spoken('Förderung von 200.000,- gegenüber'),'Förderung von zweihunderttausend Euro gegenüber');
 assert.equal(spoken('241.000,- € geschätzt'),'zweihunderteinundvierzigtausend Euro geschätzt');
 const s=videoSheet({title:'Thema',status:'consulting',events:[{date:'2026-10-13',committee:'Rat'},{date:'2026-11-12',committee:'Rat'}],ruleSummary:{short:'Der Rat beschließt das Thema für alle Beteiligten im Ort.'}},{regionName:'Ort',today:'2026-10-31',titleShort:'Thema'});
 assert.match(s.sprechtext[5],/Nächste Sitzung: Rat, am zwölften November\./);
});

test('Zu langer Beschlusssatz: Gremiumsname wird ausgelassen, der Beschluss bleibt vollständig', () => {
 const t={title:'Beratung und Beschlussfassung über den Forstwirtschaftsplan für das Forstwirtschaftsjahr 2027',status:'approved',events:[{date:'2026-10-31',committee:'Stadtrat Bad Hönningen'}],
  ruleSummary:{short:'Der Ausschuss für Erneuerbare Energien, Umwelt- und Naturschutz empfiehlt dem Stadtrat zu beschließen: 1. Dem Forstwirtschaftsplan für das Jahr 2027 wird zugestimmt.'}};
 const s=videoSheet(t,{regionName:'Bad Hönningen',today:'2026-10-31'});
 assert.equal(s.zitat,'Der Ausschuss […] empfiehlt dem Stadtrat zu beschließen: 1. Dem Forstwirtschaftsplan für das Jahr 2027 wird zugestimmt.');
 assert.equal(s.titel2,'Forstwirtschaftsplan 2027');
 assert.equal(s.meta[0],'Stadtrat · zuletzt beraten am 31.10.26');
});

test('Doppelte Termine entfallen, Statuswörter sind keine Ergebnisse', () => {
 const e=[{date:'2026-09-23',committee:'Ausschuss Stadt Ort',result:'Stand offen'},{date:'2026-09-23',committee:'Ausschuss Stadt Ort',result:'Stand offen'},{date:'2026-10-31',committee:'Stadtrat Ort',result:'In Beratung'}];
 const s=videoSheet({title:'Thema',status:'approved',events:e,ruleSummary:{short:'Der Rat beschließt das Thema für alle Beteiligten im Ort.'}},{regionName:'Ort',today:'2026-10-31',titleShort:'Thema'});
 assert.deepEqual(s.verlauf.map(v=>[v.committee,v.result]),[['Ausschuss',null],['Stadtrat',null]]);
});
