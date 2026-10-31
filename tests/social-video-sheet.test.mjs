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
 assert.equal(spoken('Gesamtkosten 241.000,- € geschätzt, 5 % Puffer, P&R'),'Gesamtkosten zweihunderteinundvierzigtausend Euro geschätzt, fünf Prozent Puffer, P und R');
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
 assert.match(s.sprechtext[1],/^Billerbeck: Wirtschaftswege ab zweitausendsiebenundzwanzig\. Stand: offen\.$/);
 assert.match(s.sprechtext[5],/Noch kein Beschluss\. Zuletzt beraten im Rat der Stadt am dreizehnten Oktober\.$/);
});

test('P&R: In Beratung, Standwort als 5. bis 8. Wort, gesprochene Haushaltsangabe', () => {
 const s=videoSheet(pr,{regionName:'Billerbeck',today:'2026-10-31',titleShort:'P&R Weihgarten'});
 assert.equal(s.ok,true,s.warnings.join('; '));
 assert.equal(s.sprechtext[1],'Billerbeck: P und R Weihgarten. Stand: In Beratung.');
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

