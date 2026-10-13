// Vergleich alt gegen neu (Plan requirements/regel-schritt-plan.md, Schritt 6): Was die Themenradare (Fakten 'radar:<id>' aus
// shared/radars.mjs) finden, gegen die Unterthemen und „Was geschieht“ aus readReport (report_rules, Migration 0035).
// Je Radar-Unterthema: Vorgänge alt, davon auch neu gefunden, und neu ohne alt. Nur aktive Sachpunkte, je Vorgang einmal.
//   node scripts/plenara-x/compare-radars.mjs [--beispiele=3]   lokale Datenbank (DATABASE_FILE oder .wrangler/)
import {existsSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const ex=+(process.argv.find(a=>a.startsWith('--beispiele='))?.slice(12)??3);
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const local=existsSync(dir)?readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'):null;
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+local,{readOnly:true});
// Radar-Unterthema → neue Unterthemen (s:) oder Wert von „Was geschieht“ (stage:)
const MAP={
 versorgung:{'Strom und Gas':['s:umwelt.waerme'],'Wärme':['s:umwelt.waerme'],'Trinkwasser':['s:umwelt.wasser'],'Abwasser':['s:umwelt.wasser'],
  'Abfall und Entsorgung':['s:umwelt.abfall'],'Stadtwerke und Beteiligungen':['s:finanzen.beteil'],'Breitband':['s:verwaltung.breit']},
 verkehr:{'Straßen und Brücken':['s:mobilitaet.strasse'],'Radverkehr':['s:mobilitaet.rad'],'Bus und Bahn':['s:mobilitaet.oepnv'],
  'Tempo und Verkehrssicherheit':['s:mobilitaet.sicher'],'Parken':['s:mobilitaet.park'],'Gehwege und Barrierefreiheit':['s:mobilitaet.geh'],'Verkehrsplanung':['s:mobilitaet.plan']},
 soziales:{'Vereinsförderung':['s:kultur.verein'],'Sport und Bäder':['s:kultur.sport'],'Jugend':['s:soziales.jugend','s:kultur.spiel'],'Senioren und Pflege':['s:soziales.senior'],
  'Inklusion und Teilhabe':['s:soziales.inkl'],'Integration und Geflüchtete':['s:soziales.integ'],'Armut und Grundversorgung':['s:soziales.armut'],
  'Kultur, Heimat und Ehrenamt':['s:kultur.kultur','s:kultur.heimat','s:kultur.bib','s:kultur.verein']},
 klima:{'Wärmeplanung':['s:umwelt.waerme'],'Photovoltaik':['s:umwelt.ee'],'Windenergie':['s:umwelt.ee'],'Klimaschutz':['s:umwelt.klimaschutz'],
  'Klimaanpassung':['s:umwelt.anpass'],'Energieeffizienz und Sanierung':['s:umwelt.klimaschutz'],'E-Mobilität':['s:mobilitaet.plan']},
 finanzen:{'Haushalt und Nachtrag':['s:finanzen.hh'],'Haushaltssicherung':['s:finanzen.hsk'],'Steuern und Hebesätze':['s:finanzen.steuer'],
  'Kredite und Schulden':['s:finanzen.kredit'],'Jahresabschluss und Bilanz':['s:finanzen.abschl'],'Umlagen':['s:finanzen.kredit'],'Außerplanmäßige Ausgaben':['s:finanzen.upl']},
 beteiligung:{'Einwohneranträge und Anregungen':['stage:antrag'],'Petitionen und Bürgerbegehren':['stage:beteiligung'],'Bürgerbeteiligung':['s:verwaltung.beteil','stage:beteiligung'],'Beiräte':['s:verwaltung.beteil']},
 vergabe:{'*':['stage:vergabe']},
 gebuehren:{'*':['stage:abgaben']},
};
const rows=db.prepare(`SELECT f.kind,f.value,r.case_key,r.subs,r.stage,r.item_kind,c.title FROM topic_facts f JOIN report_rules r ON r.topic_id=f.topic_id
 JOIN search_cards c ON c.id=f.topic_id WHERE f.kind LIKE 'radar:%'`).all();
const hit=(r,targets)=>targets.some(t=>t.startsWith('s:')?(','+(r.subs||'')+',').includes(','+t.slice(2)+','):r.stage===t.slice(6));
const out=[];
for(const [radar,subs] of Object.entries(MAP))for(const [name,targets] of Object.entries(subs)){
 const old=new Map();for(const r of rows)if(r.kind==='radar:'+radar&&(name==='*'||r.value===name))old.set(r.case_key,r);
 const both=[...old.values()].filter(r=>hit(r,targets)),missed=[...old.values()].filter(r=>!hit(r,targets));
 // Neu ohne alt: Sachpunkte mit dem neuen Ziel, aber ohne diesen Radar-Fakt
 const conds=targets.map(t=>t.startsWith('s:')?`(','||subs||',') LIKE '%,${t.slice(2)},%'`:`stage='${t.slice(6)}'`).join(' OR ');
 const neu=db.prepare(`SELECT count(DISTINCT case_key) n FROM report_rules WHERE item_kind='subject' AND (${conds})`).get().n;
 out.push({radar,name,alt:old.size,auchNeu:both.length,neuGesamt:neu,fehlt:missed.slice(0,ex).map(r=>r.title.slice(0,90)+(r.item_kind!=='subject'?' ['+r.item_kind+']':''))});
}
for(const o of out)console.log(`${(o.radar+' · '+o.name).padEnd(52)} alt ${String(o.alt).padStart(6)} · davon neu ${o.alt?Math.round(100*o.auchNeu/o.alt):0} % · neu gesamt ${o.neuGesamt}${o.fehlt.length?'\n   fehlt z. B.: '+o.fehlt.join(' | '):''}`);
