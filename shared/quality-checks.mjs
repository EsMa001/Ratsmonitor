// The checks of the stock the quality page offers ("Duplikate und Defekte"): what each one looks for, in words the
// page shows. The SQL behind them lives in server/integrations/quality-check.mjs; this list is shared with the page.
// group: duplicates (the same item stored more than once), hints (reports that look alike but are mostly distinct
// items), defects (a report that is incomplete or inconsistent), orphans (rows that point to nothing). Nothing is
// changed by a check: it reports, the operator decides.
export const QUALITY_GROUPS=Object.freeze({duplicates:'Doppelungen',defects:'Defekte',orphans:'Verwaiste Einträge',hints:'Hinweise (meist legitim)'});
export const QUALITY_CHECKS=Object.freeze([
 {id:'dupSharedSystem',group:'duplicates',name:'Derselbe Vorgang unter mehreren Gebieten',explain:'Dieselbe Quelladresse mit demselben Titel ist unter zwei oder mehr Gebieten gespeichert: ein gemeinsam genutztes System (Verband, Amt, Verwaltungsgemeinschaft), dessen Leser die Gremien der Mitglieder nicht trennt. Jedes betroffene Gebiet zeigt den fremden Punkt mit. Zählt die überzähligen Berichte.'},
 {id:'emptyTitle',group:'defects',name:'Ohne Titel',explain:'Weder amtlicher Titel noch Titel vorhanden.'},
 {id:'truncatedTitle',group:'defects',name:'Titel abgeschnitten',explain:'Der Titel endet mit „;“, „:“ oder „,“: der Leser hat nur den ersten Teil übernommen („Vollzug des Baugesetzbuches (BauGB);“, „2. Lesung:“).'},
 {id:'noEvents',group:'defects',name:'Ohne Sitzungstermin',explain:'Kein Sitzungseintrag im Datensatz; der Bericht erscheint in keinem Zeitraum.'},
 {id:'badEventDate',group:'defects',name:'Sitzungsdatum ungültig',explain:'Spaltendatum kein gültiger Tag oder außerhalb von 1990 bis zwei Jahre in der Zukunft.'},
 {id:'eventDateMismatch',group:'defects',name:'Spaltendatum weicht vom Datensatz ab',explain:'Die Spalte event_date (Listen, Zeiträume) nennt einen anderen Tag als der Datensatz selbst.'},
 {id:'documentsWithoutUrl',group:'defects',name:'Dokument ohne Adresse',explain:'Ein eingetragenes Dokument hat keine Adresse; es kann weder gelesen noch verlinkt werden.'},
 {id:'regionUnknown',group:'defects',name:'Gebiet nicht im Katalog',explain:'Berichte mit einer Gebietskennung, die der Katalog nicht führt (umbenannt, aufgelöst, Tippfehler).'},
 {id:'conflicts',group:'defects',name:'Identitätskonflikt',explain:'Widersprüchliche amtliche Vorgangsbezüge; der Bericht wurde beim Zusammenführen ausgelassen.'},
 {id:'mergeTargetMissing',group:'orphans',name:'Verweis auf fehlendes Ziel',explain:'Ein zusammengeführter Bericht zeigt auf eine Kennung, die es nicht gibt.'},
 {id:'mergeChain',group:'orphans',name:'Verweis auf einen Verweis',explain:'Das Ziel eines zusammengeführten Berichts ist selbst zusammengeführt (Kette); Leser lösen nur eine Stufe auf.'},
 {id:'orphanAnalyses',group:'orphans',name:'Analysefassungen ohne Bericht',explain:'Einträge in article_analyses, deren Bericht nicht mehr existiert.'},
 {id:'orphanVersions',group:'orphans',name:'Archivierte Fassungen ohne Bericht',explain:'Einträge in article_versions, deren Bericht nicht mehr existiert.'},
 {id:'dupSameMeeting',group:'hints',name:'Gleichlautende Punkte in derselben Sitzung',explain:'Zwei oder mehr Berichte desselben Gremiums am selben Tag mit demselben Titel (ohne Platzhalter wie „Tagesordnungspunkt“ oder „Einwohnerfragestunde“, nur Titel ab 25 Zeichen). Meist verschiedene Punkte mit gleichem Wortlaut (mehrere Spendenbeschlüsse, Wahlen, Nachrücker, Ergänzungen); nur selten derselbe Punkt zweimal. Zählt nicht als Doppelung. Zusammengeführt wird allein über amtliche Vorgangsbezüge.'},
]);
export const QUALITY_BY_ID=Object.freeze(Object.fromEntries(QUALITY_CHECKS.map(c=>[c.id,c])));
/** Totals of stored results: duplicates count the surplus reports (groups separately), defects and orphans their rows, hints apart. */
export function qualitySummary(checks={}){
 const sum={duplicates:0,duplicateGroups:0,defects:0,orphans:0,hints:0,checked:0,pending:[]};
 for(const c of QUALITY_CHECKS){const r=checks[c.id];if(!r){sum.pending.push(c.id);continue;}sum.checked++;
  if(c.group==='duplicates'){sum.duplicates+=Number(r.count||0);sum.duplicateGroups+=Number(r.groups||0);}else sum[c.group]+=Number(r.count||0);}
 return sum;
}
