// Modell (requirements/modell-konzept.md): Eingaben wie beim Lernen, Kette der Köpfe, readReport mit den Antworten des Modells,
// und – wenn die Modelldateien lokal liegen – dieselben Antworten auf die Prüfberichte wie beim Lernen (tmp/model/heads/check.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inputOf,encoderTexts,reportSparse,flags,DOCTYPES,KIND,STATUS,THEMES,PROCESS,STEPS,SERVICE,APPLICANTS,MODEL_THEME_VERSION} from '../shared/model/features.mjs';
import {classify,loadHeads} from '../shared/model/heads.mjs';
import {readReport} from '../server/integrations/report-rules.mjs';

const payload={title:'Bebauungsplan Nr. 12  „Am Bach“',committee:'Rat',eventDate:'2026-11-03',
 events:[{date:'2026-09-01',committee:'Bauausschuss',result:'Empfehlung an den Rat'},{date:'2026-11-03',committee:'Rat',result:'Öffentlicher Tagesordnungspunkt; Ergebnis nicht belegt'}],
 documents:[{title:'Vorlage 12/2026',url:'https://x/1.pdf',kind:'application/pdf'},{title:'Plan',url:'https://x/2.pdf',kind:'application/pdf'},{title:'Seite',url:'https://x/s',kind:'text/html'}]};
const pages={'https://x/1.pdf':['Beschlussvorlage\nBebauungsplan Nr. 12','Beschlussvorschlag: Der Rat beschließt den Bebauungsplan als Satzung.']};

test('Eingabe wie beim Lernen: nur PDFs, erste Seite, Beschlussvorschlag, echte Ergebnisse',()=>{
 const input=inputOf(payload,u=>u==='https://x/1.pdf'?{bytes:200000}:null,u=>pages[u]||null);
 assert.equal(input.title,'Bebauungsplan Nr. 12 „Am Bach“');
 assert.equal(input.pdfs.length,2);
 assert.equal(input.pdfs[0].bytes,200000);assert.equal(input.pdfs[1].first,null);
 assert.match(input.pdfs[0].decision,/^Beschlussvorschlag: Der Rat beschließt/);
 const texts=Object.fromEntries(encoderTexts(input));
 assert.deepEqual(Object.keys(texts),['t','r','p.0','p.1']);
 assert.equal(texts.r,'Empfehlung an den Rat','Platzhalter der Importe sind kein Ergebnis');
 assert.equal(texts.t,'Bebauungsplan Nr. 12 „Am Bach“ | Gremium: Rat');
 const f=flags(input,0,null,'2026-10-21');assert.deepEqual([...f],[1,1,1,1,0,1,1]);
 assert.ok(reportSparse(input,0).includes('d<sat'),'Wortteile des Beschlussvorschlags mit eigener Vorsilbe');
});

/* Kleines künstliches Modell: jeder Kopf entscheidet nur über den Versatz B, dichte Gewichte 0 */
function tinyModel(bias){
 const floats=[];let off=0;const put=a=>{const o=[off,a.length];floats.push(Float32Array.from(a));off+=a.length;return o;};
 const head=(classes,dd,b)=>({classes,DD:dd,vocab:[],W:put([]),U:put(new Array(classes.length*dd).fill(0)),B:put(b)});
 const st=(classes,dd,b=classes.map(()=>-5))=>({classes,a:head(classes,dd,b),b:head(classes,0,classes.map(()=>0))});
 const D=4,DR=4*D+7;
 const heads={doctype:st(DOCTYPES,D,DOCTYPES.map((c,i)=>i===0?5:-5)),document:st(['main','result'],D+DOCTYPES.length,[5,-5]),
  kind:st(KIND,DR,bias.kind),status:st(STATUS,DR,bias.status),themes:st(THEMES,DR,bias.themes),process:st(PROCESS,DR,bias.process),
  project:st(['ja'],DR,[5]),step:st(STEPS,DR,STEPS.map((c,i)=>i===4?5:-5)),service:st(SERVICE,DR),applicants:st(APPLICANTS,DR),
  subs:{bauen:st(['bauen.plan','bauen.erschl'],DR,[5,-5])},subsubs:{'bauen.plan':st(['bauen.plan.wohnen'],DR,[5])}};
 const bin=Buffer.concat(floats.map(f=>Buffer.from(f.buffer)));
 return loadHeads({version:'tiny',dim:D,thresholds:{theme:0.2,sub:0.4,subsub:0.4},heads},bin);
}
const one=(cls,pick)=>cls.map(c=>c===pick?5:-5);

test('Kette: Sachpunkt mit Thema, Unterthema, Unter-Unterthema, Schritt bei Planung; Ablauf ohne Thema',()=>{
 const input=inputOf(payload,()=>null,u=>pages[u]||null),emb=()=>new Float32Array(4);
 const m=tinyModel({kind:one(KIND,'subject'),status:one(STATUS,'recommended'),themes:one(THEMES,'bauen'),process:one(PROCESS,'planning')});
 const o=classify(input,emb,m,'2026-10-21');
 assert.equal(o.main,0);assert.equal(o.doctypes[0],'paper');
 assert.equal(o.kind,'subject');assert.equal(o.status,'recommended');assert.ok(o.statusP>0.99);
 assert.deepEqual(o.themes,['bauen']);assert.deepEqual(o.subs,['bauen.plan']);assert.deepEqual(o.subsubs,['bauen.plan.wohnen']);
 assert.equal(o.process,'planning');assert.equal(o.step,'beschluss');assert.equal(o.service,null);assert.equal(o.project,true);
 const f=classify(input,emb,tinyModel({kind:one(KIND,'procedure'),status:one(STATUS,'info'),themes:one(THEMES,'bauen'),process:one(PROCESS,'planning')}),'2026-10-21');
 assert.equal(f.kind,'procedure');assert.deepEqual(f.themes,[]);assert.equal(f.process,null);assert.equal(f.step,null);
});

test('readReport mit Modell: Hauptdokument, Art, Thema und Vorgangsart vom Modell, Fassung model-v1',()=>{
 const report={...payload,documents:payload.documents};
 const model={key:'m|k',kind:'subject',themes:['bauen'],subs:['bauen.plan'],process:'planning',mainUrl:'https://x/2.pdf'};
 const r=readReport(report,{model});
 assert.equal(r.mainUrl,'https://x/2.pdf');assert.equal(r.itemKind,'subject');assert.equal(r.stage,'planning');
 assert.deepEqual(r.theme,{id:'bauen',subs:['bauen.plan'],source:'model',version:MODEL_THEME_VERSION,evidence:report.title});
 const f=readReport(report,{model:{...model,kind:'procedure',mainUrl:null}});
 assert.equal(f.itemKind,'formal');assert.equal(f.mainUrl,null);assert.equal(f.theme.id,'offen');assert.equal(f.stage,null);
 assert.equal(readReport(report,{model:{...model,kind:'personal'}}).itemKind,'routine');
 assert.notEqual(r.key,readReport(report,{model:{...model,key:'m|anders'}}).key,'neue Antwort des Modells heißt neu lesen');
});

const DIR='tmp/model/heads',EMB='tmp/ml';
test('gespeichertes Modell: dieselben Antworten auf die Prüfberichte wie beim Lernen',{skip:!(fs.existsSync(DIR+'/check.json')&&fs.existsSync(EMB+'/big-emb-ft.bin'))&&'Modelldateien fehlen lokal'},()=>{
 const check=JSON.parse(fs.readFileSync(DIR+'/check.json','utf8'));
 const model=loadHeads(JSON.parse(fs.readFileSync(DIR+'/heads.json','utf8')),fs.readFileSync(DIR+'/heads.bin'));
 assert.equal(model.version,check.version);
 const keys=JSON.parse(fs.readFileSync(EMB+'/big-emb-ft.json','utf8')),buf=new Float32Array(fs.readFileSync(EMB+'/big-emb-ft.bin').buffer.slice(0)),D=model.dim,at=new Map(keys.map((k,i)=>[k,i]));
 const rows=JSON.parse(fs.readFileSync('tests/fixtures/kern-big.json','utf8')).rows;
 let same=0;
 for(const c of check.rows){const r=rows[c.i],E=k=>{const j=at.get(k==='t'?'t'+c.i:k==='r'?'r'+c.i:'p'+c.i+'.'+k.slice(2));return j==null?null:buf.subarray(j*D,(j+1)*D);};
  const o=classify(r,E,model,check.today);if(JSON.stringify(o)===JSON.stringify(c.out))same++;}
 assert.equal(same,check.rows.length);
});
