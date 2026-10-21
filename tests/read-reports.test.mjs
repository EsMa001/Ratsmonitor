// Ein Durchlauf für alle Regeln je Bericht (scripts/pdf-store/read-reports.mjs): Art des Punkts, Thema, Regel-Zusammenfassung
// und Fakten; KI-Felder bleiben; Sitzungsunterlagen verlieren eine alte Zusammenfassung, fehlender Text nicht; ein zweiter
// Lauf ohne geänderte Eingaben liest nichts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openPdfStore} from '../server/node/pdf-store.mjs';
import {READ_VERSION} from '../server/integrations/report-rules.mjs';

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
const OLD={version:2,generatedBy:'Regelbasierte Zusammenfassung',score:70,short:{sentences:['Alt.']},long:{sentences:['Alt lang.']}};

test('read-reports: alle Regeln in einem Lauf, KI-Felder bleiben, zweiter Lauf liest nichts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'read-reports-'));
 try{
  const file=path.join(dir,'db.sqlite'),storeDir=path.join(dir,'store');
  const db=new DatabaseSync(file);
  db.exec(`CREATE TABLE topics(id TEXT PRIMARY KEY,region_id TEXT,active INTEGER,payload TEXT);
   CREATE TABLE data_revisions(id TEXT PRIMARY KEY,revision INTEGER);INSERT INTO data_revisions VALUES('content',1);`);
  for(const m of ['0025','0032','0035'])db.exec(fs.readFileSync('drizzle/'+fs.readdirSync('drizzle').find(f=>f.startsWith(m)),'utf8').replace(/CREATE TRIGGER[\s\S]*?END;/g,''));
  const store=openPdfStore(storeDir);
  const topic=(id,title,docs,extra={})=>{
   const payload={id,title,officialTitle:title,sourceText:'',shortSummary:'Überblick',longSummary:['Überblick'],
    generatedBy:'Automatischer Quellenüberblick',documents:docs.map(([t,u])=>({title:t,url:u,kind:'application/pdf'})),...extra};
   db.prepare('INSERT INTO topics VALUES(?,?,1,?)').run(id,'r',JSON.stringify(payload));return payload;
  };
  const put=(url,text)=>{store.put(url,new Uint8Array(Buffer.from(`%PDF-1.4\n% ${url}\n%%EOF`,'latin1')));store.putText(store.entry(url).sha256,[text],{method:'text',version:1});};
  put('https://x.test/vorlage.pdf',DOC);put('https://x.test/ki.pdf',DOC);put('https://x.test/niederschrift.pdf',DOC);
  const ai=topic('ki','Finanzzwischenbericht 2025',[['Sitzungsvorlage','https://x.test/ki.pdf']],
   {generatedBy:'KI-Zusammenfassung',shortSummary:'KI kurz',longSummary:['KI lang'],summaryMethod:'ai-agent-content-v1',contentAnalysis:{id:'k1',status:'completed'},ruleSummaryTried:'1:alt'});
  topic('regel','Finanzzwischenbericht 2025',[['Sitzungsvorlage','https://x.test/vorlage.pdf']]);
  topic('sitzung','Finanzzwischenbericht 2025',[['Niederschrift','https://x.test/niederschrift.pdf']],{ruleSummary:OLD});
  topic('ohne-text','Finanzzwischenbericht 2025',[['Sitzungsvorlage','https://x.test/fehlt.pdf']],{ruleSummary:OLD});
  topic('formal','Genehmigung der Niederschrift der letzten Sitzung',[]);
  topic('antrag','Antrag der SPD-Fraktion zur Sanierung der Grundschule',[]);
  store.close();db.close();
  const run=()=>{const out=execFileSync(process.execPath,['--no-warnings','scripts/pdf-store/read-reports.mjs'],{env:{...process.env,DATABASE_FILE:file,RM_PDF_STORE:storeDir},encoding:'utf8'});return JSON.parse(out.slice(out.indexOf('{')));};
  const first=run();
  assert.equal(first.read,6);
  const after=new DatabaseSync(file),get=id=>JSON.parse(after.prepare('SELECT payload FROM topics WHERE id=?').get(id).payload);
  const k=get('ki');
  assert.ok(k.ruleSummary?.short?.sentences?.length&&k.ruleSummary.long?.sentences?.length,'KI-Bericht bekommt die Regel-Zusammenfassung');
  for(const key of ['generatedBy','shortSummary','longSummary','summaryMethod','contentAnalysis'])assert.deepEqual(k[key],ai[key],key+' bleibt');
  assert.equal(k.ruleSummaryTried,undefined,'Merker entfällt (Schlüssel in report_rules)');
  assert.equal(k.itemKind,'subject');assert.equal(k.theme.id,'finanzen');
  assert.ok(get('regel').ruleSummary);
  assert.equal(get('sitzung').ruleSummary,undefined,'Sitzungsunterlage: alte Zusammenfassung fällt weg');
  assert.deepEqual(get('ohne-text').ruleSummary,OLD,'ohne Text bleibt sie');
  assert.deepEqual([get('formal').itemKind,get('formal').theme.id],['formal','offen']);
  const issues=Object.fromEntries(after.prepare('SELECT topic_id,summary_issue FROM report_rules').all().map(r=>[r.topic_id,r.summary_issue]));
  assert.deepEqual(issues,{ki:null,regel:null,sitzung:'session-document','ohne-text':'no-text',formal:'no-document',antrag:'no-document'});
  assert.ok(after.prepare('SELECT version FROM report_rules').all().every(r=>r.version===READ_VERSION));
  // Ergebnisse als Spalten (0035): Vorgang, Art, Thema, Unterthemen, Was geschieht
  const cols=id=>({...after.prepare('SELECT case_key,item_kind,theme,subs,stage FROM report_rules WHERE topic_id=?').get(id)});
  assert.deepEqual(cols('regel'),{case_key:'r|finanzzwischenbericht 2025',item_kind:'subject',theme:'finanzen',subs:get('regel').theme.subs.join(','),stage:get('regel').stage});
  assert.deepEqual(cols('formal'),{case_key:'r|genehmigung der niederschrift der letzten sitzung',item_kind:'formal',theme:'offen',subs:'',stage:null});
  assert.deepEqual(after.prepare("SELECT kind,value FROM topic_facts WHERE topic_id='antrag'").all().map(r=>[r.kind,r.value]),[['faction','SPD']]);
  assert.match(after.prepare("SELECT method FROM topic_facts WHERE topic_id='antrag'").get().method,/^facts-v\d+:title$/);
  after.close();
  const second=run();
  assert.equal(second.read,0,'unveränderte Eingaben: nichts zu lesen');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// --ids (Nacharbeit, Folgekette nach der OCR): nur die genannten Berichte, immer neu gelesen; die Nutzung je Adresse kommt
// aus den Gebieten dieser Berichte, eine Sitzungsunterlage wird also weiter erkannt
test('read-reports --ids: liest nur die genannten Berichte, erkennt Sitzungsunterlagen im Gebiet, liest sie erneut',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'read-reports-ids-'));
 try{
  const file=path.join(dir,'db.sqlite'),storeDir=path.join(dir,'store'),idFile=path.join(dir,'ids.txt');
  const db=new DatabaseSync(file);
  db.exec(`CREATE TABLE topics(id TEXT PRIMARY KEY,region_id TEXT,active INTEGER,payload TEXT);
   CREATE TABLE data_revisions(id TEXT PRIMARY KEY,revision INTEGER);INSERT INTO data_revisions VALUES('content',1);`);
  for(const m of ['0025','0032','0035'])db.exec(fs.readFileSync('drizzle/'+fs.readdirSync('drizzle').find(f=>f.startsWith(m)),'utf8').replace(/CREATE TRIGGER[\s\S]*?END;/g,''));
  const store=openPdfStore(storeDir);
  const topic=(id,region,title,docs)=>db.prepare('INSERT INTO topics VALUES(?,?,1,?)').run(id,region,JSON.stringify({id,title,officialTitle:title,
   documents:docs.map(([t,u])=>({title:t,url:u,kind:'application/pdf'}))}));
  const put=url=>{store.put(url,new Uint8Array(Buffer.from(`%PDF-1.4\n% ${url}\n%%EOF`,'latin1')));store.putText(store.entry(url).sha256,[DOC],{method:'text',version:1});};
  put('https://x.test/vorlage.pdf');put('https://x.test/sitzung.pdf');
  topic('a','r','Finanzzwischenbericht 2025',[['Sitzungsvorlage','https://x.test/vorlage.pdf']]);
  // Ein Dokument an fünf Berichten desselben Gebiets ist eine Sitzungsunterlage, auch wenn nur einer davon gelesen wird
  for(let i=0;i<5;i++)topic('s'+i,'r',`Punkt ${i} der Sitzung`,[['Unterlage','https://x.test/sitzung.pdf']]);
  topic('andere','q','Finanzzwischenbericht 2025',[['Sitzungsvorlage','https://x.test/vorlage.pdf']]);
  store.close();db.close();
  const run=()=>{const out=execFileSync(process.execPath,['--no-warnings','scripts/pdf-store/read-reports.mjs','--ids',idFile],{env:{...process.env,DATABASE_FILE:file,RM_PDF_STORE:storeDir},encoding:'utf8'});return JSON.parse(out.slice(out.indexOf('{')));};
  fs.writeFileSync(idFile,'a\ns0\n');
  const first=run();
  assert.equal(first.berichte,2,'nur die genannten Berichte werden betrachtet');assert.equal(first.read,2);
  const after=new DatabaseSync(file),issues=Object.fromEntries(after.prepare('SELECT topic_id,summary_issue FROM report_rules').all().map(r=>[r.topic_id,r.summary_issue]));
  assert.deepEqual(issues,{a:null,s0:'session-document'},'andere Berichte bleiben ungelesen');
  after.close();
  assert.equal(run().read,2,'--ids liest immer neu');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
