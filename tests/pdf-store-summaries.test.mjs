// Regel-Zusammenfassungen aus der PDF-Ablage (scripts/pdf-store/summaries.mjs): auch für Berichte mit KI-Zusammenfassung, ohne
// deren KI-Text, Angaben und Einträge in article_analyses anzufassen (Entscheidung 12.10.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {withRuleSummary} from '../server/integrations/compact-summary.mjs';

const DOC=`Sitzungsvorlage
Beschlussvorschlag:
Der Finanzzwischenbericht 2025 wird zur Kenntnis genommen.
Sachverhalt:
Der Schwerpunkt liegt dabei auf dem Produktbereich 16 „Allgemeine Finanzwirtschaft“.
Steuerschätzung und Einnahmeentwicklung
Die Mai-Steuerschätzung prognostiziert für alle Gebietskörperschaften erneut erhebliche Mindereinnahmen gegenüber dem Vorjahr. Damit verschärft sich die Finanzlage der Kommunen deutlich.
Für die Jahre 2025 bis 2029 werden insgesamt rund 27 Milliarden Euro weniger Steuereinnahmen erwartet, z.B. wegen der schwachen wirtschaftlichen Entwicklung im Land.
Die Gewerbesteuer entwickelt sich in der Stadt dagegen stabil; die Erträge liegen zur Jahresmitte bei rund 48 Millionen Euro und damit leicht über dem Planansatz.
Bei den Aufwendungen wirken vor allem die gestiegenen Personalkosten und die höhere Kreisumlage, die den Haushalt mit zusätzlich 2,1 Millionen Euro belasten.
Die Verwaltung schlägt vor, die Bewirtschaftung der Sachkosten fortzuführen und neue freiwillige Leistungen bis zum Jahresabschluss zurückzustellen.
Anlage 1: Tabelle`;

test('Regel-Zusammenfassung auch bei KI-Zusammenfassung: nur ruleSummary dazu, KI-Text und KI-Einträge bleiben',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pdf-summaries-'));
 try{
  const file=path.join(dir,'db.sqlite'),storeDir=path.join(dir,'store');
  const db=new DatabaseSync(file);
  db.exec(`CREATE TABLE topics(id TEXT PRIMARY KEY,region_id TEXT,active INTEGER,payload TEXT);
   CREATE TABLE article_analyses(id TEXT PRIMARY KEY,topic_id TEXT,kind TEXT,method TEXT,input_hash TEXT,created_at TEXT,payload TEXT);`);
  const store=openPdfStore(storeDir);
  const topic=(id,extra)=>{
   const url=`https://x.test/${id}.pdf`;
   store.put(url,new Uint8Array(Buffer.from(`%PDF-1.4\n% ${id}\n%%EOF`,'latin1')));
   store.putText(store.entry(url).sha256,[DOC],{method:'text',version:1});
   const payload={id,title:'Finanzzwischenbericht 2025',officialTitle:'Finanzzwischenbericht 2025',sourceText:'',shortSummary:'Überblick',longSummary:['Überblick'],
    generatedBy:'Automatischer Quellenüberblick',documents:[{title:'Sitzungsvorlage',url,kind:'application/pdf'}],...extra};
   db.prepare('INSERT INTO topics VALUES(?,?,1,?)').run(id,'r',JSON.stringify(payload));
   return payload;
  };
  const ai=topic('ki',{generatedBy:'KI-Zusammenfassung',shortSummary:'KI kurz',longSummary:['KI lang'],summaryMethod:'ai-agent-content-v1',summaryIssue:undefined,contentAnalysis:{id:'k1',status:'completed'}});
  topic('regel',{});
  // KI-Bericht, der schon eine Regel-Zusammenfassung hat (aus einem anderen Dokument): bleibt, wie er ist
  const had={version:2,generatedBy:'Regelbasierte Zusammenfassung',source:{url:'https://x.test/alt.pdf',title:'Alt'},score:70,short:{sentences:['Alt.']},long:{sentences:['Alt lang.']}};
  const aiHad=topic('ki-alt',{generatedBy:'KI-Zusammenfassung',shortSummary:'KI kurz',longSummary:['KI lang'],ruleSummary:had});
  // Ein KI-Eintrag ohne Status 'completed' (so stehen manche auf dem Server): der Regelweg darf ihn nicht löschen
  db.prepare('INSERT INTO article_analyses VALUES(?,?,?,?,?,?,?)').run('k0','ki','summary','ai-agent-content-v1','h','2026-10-04',JSON.stringify({status:'insufficient_source',agent:'Claude Code'}));
  store.close();db.close();
  execFileSync(process.execPath,['--no-warnings','scripts/pdf-store/summaries.mjs'],{env:{...process.env,DATABASE_FILE:file,RM_PDF_STORE:storeDir},stdio:'pipe'});
  const after=new DatabaseSync(file),get=id=>JSON.parse(after.prepare('SELECT payload FROM topics WHERE id=?').get(id).payload);
  const k=get('ki'),r=get('regel');
  assert.ok(k.ruleSummary?.short?.sentences?.length&&k.ruleSummary.long?.sentences?.length,'KI-Bericht bekommt die Regel-Zusammenfassung, kurz und lang');
  for(const key of ['generatedBy','shortSummary','longSummary','summaryMethod','contentAnalysis'])assert.deepEqual(k[key],ai[key],key+' bleibt');
  assert.equal(k.summaryIssue,undefined);assert.equal(k.summaryAttemptedAt,undefined,'kein Versuch eines anderen Wegs vermerkt');
  assert.deepEqual(after.prepare("SELECT id FROM article_analyses WHERE topic_id='ki'").all().map(x=>x.id),['k0'],'KI-Einträge bleiben, kein neuer');
  assert.ok(r.ruleSummary,'Bericht ohne KI wie bisher');
  assert.deepEqual(get('ki-alt'),aiHad,'vorhandene Regel-Zusammenfassung bei KI-Bericht: keine Neufassung');
  assert.equal(after.prepare("SELECT count(*) AS n FROM article_analyses WHERE topic_id='regel'").get().n,1,'dort wie bisher ein Eintrag');
  after.close();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('withRuleSummary: nur ruleSummary dazu oder den Versuch merken, alles andere bleibt',()=>{
 const old={id:'a',generatedBy:'KI-Zusammenfassung',shortSummary:'KI',longSummary:['KI'],summaryMethod:'ai-agent-content-v1',ruleSummaryTried:'1:alt'};
 const rule={short:{sentences:['Satz.']},long:{sentences:['Satz.']}};
 const a=withRuleSummary(old,{...old,ruleSummary:rule,generatedBy:'Automatischer Quellenüberblick',longSummary:['anders']},'2:x');
 assert.deepEqual(a,{id:'a',generatedBy:'KI-Zusammenfassung',shortSummary:'KI',longSummary:['KI'],summaryMethod:'ai-agent-content-v1',ruleSummary:rule});
 assert.deepEqual(withRuleSummary(old,{...old,documentIssue:'x'},'2:import'),{...old,ruleSummaryTried:'2:import'});
 assert.equal(old.ruleSummaryTried,'1:alt','das Original bleibt unverändert');
});
