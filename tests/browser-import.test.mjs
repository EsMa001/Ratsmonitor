import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {instanceUrl,isWaf,pageState,safeName,documentName,checkPdf,csvCell,validateInstance,sourceOf,oparlVerdict} from '../scripts/browser-import/core.mjs';
import {browserTransport} from '../scripts/browser-import/transport.mjs';
import {StopError,decodeResponse} from '../scripts/browser-import/session.mjs';
import {detect,importInstance,apply,record,bundleOf,download} from '../scripts/browser-import/runner.mjs';
import {BUDGET_REACHED} from '../server/integrations/request-budget.mjs';
const ORIGIN='https://ris.example.test',BASE=ORIGIN+'/';
const tmpDir=async()=>fs.mkdtemp(path.join(os.tmpdir(),'browser-import-'));
const config=(extra={})=>validateInstance({schemaVersion:1,instanceId:'beispiel',displayName:'Beispiel',adapter:'sdnet',origin:ORIGIN,regions:[{id:'nrw-05170004',name:'Gemeinde Alpen'}],window:'1m',outputDir:extra.outputDir||'tmp/browser-import/test-beispiel',...extra});
/* Eine Sitzung ohne Browser: antwortet aus einer Seitentabelle; open() zählt und meldet die Zielseite. */
function fakeSession(pages,{wafFirst=0}={}){
 const calls=[],opened=[];let wafLeft=wafFirst;
 return {calls,opened,version:'fake',closed:()=>false,async diagnostics(){},async close(){},
  async open(url){opened.push(url);return {url,title:'Vorlagen - SD.NET RIM 4',readyState:'complete',body:'Vorlagen Betreff Sitzung Dokumente',httpStatus:200};},
  async fetch(url){calls.push(url);
   if(wafLeft>0){wafLeft--;return {httpStatus:200,finalUrl:url,contentType:'text/html',bodyBase64:Buffer.from('<html><title>rescaled WAF ⋅ Browser-Überprüfung</title>Verifying your browser</html>').toString('base64')};}
   const page=typeof pages==='function'?pages(url):pages[url];
   if(page===undefined)return {httpStatus:404,finalUrl:url,contentType:'text/html',bodyBase64:Buffer.from('<html>nicht da</html>').toString('base64')};
   if(typeof page==='object'&&!Buffer.isBuffer(page))return {finalUrl:url,contentType:'text/html',...page,bodyBase64:Buffer.from(page.body||'').toString('base64')};
   return {httpStatus:200,finalUrl:url,contentType:Buffer.isBuffer(page)?'application/pdf':'text/html; charset=utf-8',bodyBase64:Buffer.from(page).toString('base64')};
  }};
}
test('core: WAF screens, loading and foreign pages are never ready; the query of a case belongs to its identity',()=>{
 const instance=config();
 assert.equal(isWaf('rescaled WAF ⋅ Browser-Überprüfung'),true);assert.equal(isWaf('Verifying your browser'),true);assert.equal(isWaf('',ORIGIN+'/.well-known/rescaled-waf/verify?x=1'),true);assert.equal(isWaf('Vorlagen - SD.NET RIM 4','','Vorlagen'),false);
 const ready={url:ORIGIN+'/vorlagen',title:'Vorlagen - SD.NET RIM 4',readyState:'complete',body:'Vorlagen Betreff Sitzung Dokumente Beratung'};
 assert.equal(pageState(ready,ORIGIN+'/vorlagen',instance),'ready');
 assert.equal(pageState({...ready,title:'Loading '+ORIGIN+'/vorlagen'},ORIGIN+'/vorlagen',instance),'loading');
 assert.equal(pageState({...ready,readyState:'loading'},ORIGIN+'/vorlagen',instance),'loading');
 assert.equal(pageState({...ready,body:''},ORIGIN+'/vorlagen',instance),'other');
 assert.equal(pageState({...ready,title:'rescaled WAF - SD.NET'},ORIGIN+'/vorlagen',instance),'waf');
 assert.equal(pageState({...ready,url:'https://example.org/vorlagen'},ORIGIN+'/vorlagen',instance),'other');
 assert.equal(pageState({...ready,url:ORIGIN+'/login'},ORIGIN+'/vorlagen',instance),'other');
 assert.equal(pageState({...ready,url:ORIGIN+'/vorgang/?__=A'},ORIGIN+'/vorgang/?__=B',instance),'other');
 assert.equal(pageState({...ready,url:ORIGIN+'/vorgang/?__=A#x'},ORIGIN+'/vorgang/?__=A',instance),'ready');
});
test('core: addresses of the instance keep opaque parameters, lose fragments, respect the base path and refuse the rest',()=>{
 const instance=config();
 assert.equal(instanceUrl('/vorgang/?__=A_-B&x=2#foo',instance),ORIGIN+'/vorgang/?__=A_-B&x=2');
 assert.equal(instanceUrl('javascript:alert(1)',instance),null);assert.equal(instanceUrl('https://example.org/file.pdf',instance),null);
 assert.equal(instanceUrl('https://user:secret@ris.example.test/file.pdf',instance),null);
 const sub=config({basePath:'/ris/'});assert.equal(instanceUrl('/ris/vorlagen',sub),ORIGIN+'/ris/vorlagen');assert.equal(instanceUrl('/vorlagen',sub),null);
 assert.equal(safeName('CON.pdf'),'_CON.pdf');assert.equal(safeName('A/B:C?D*'),'A_B_C_D_');
 assert.notEqual(documentName(ORIGIN+'/sdnetrim/one/report.pdf'),documentName(ORIGIN+'/sdnetrim/two/report.pdf'));
 assert.equal(checkPdf(Buffer.from('<!doctype html>rescaled WAF')).ok,false);assert.equal(checkPdf(Buffer.alloc(0)).ok,false);assert.equal(checkPdf(Buffer.from('%PDF-1.7\ntruncated')).ok,false);assert.equal(checkPdf(Buffer.from('%PDF-1.7\nfixture\n%%EOF\n')).ok,true);
 assert.ok(csvCell('=HYPERLINK("bad")').startsWith("\"'=HYPERLINK"));
});
test('core: instance configuration is checked before any browser starts; defaults and the reader source follow from it',()=>{
 const instance=config();
 assert.equal(instance.limits.delayMs,1200);assert.equal(instance.limits.maxRequests,600);assert.equal(instance.access.headless,false);assert.equal(instance.access.oparlStatus,'unknown');assert.equal(instance.entryPaths.start,'/vorlagen');
 assert.deepEqual(sourceOf(instance,instance.regions[0]),{id:'nrw-05170004',name:'Gemeinde Alpen',kind:'city',method:'scraper',adapter:'sdnet',base:BASE,system:BASE,transport:'browser'});
 assert.throws(()=>config({origin:ORIGIN+'/ris'}),/https-Herkunft ohne Pfad/);
 assert.throws(()=>config({limits:{delayMs:1}}),/delayMs/);
 assert.throws(()=>config({adapter:'unbekannt'}),/adapter unbekannt/);
 assert.throws(()=>config({regions:[]}),/regions/);
 assert.throws(()=>config({allowedDocumentOrigins:['https://cdn.example.test']}),/eigene Herkunft/);
 assert.throws(()=>config({access:{oparlStatus:'ja'}}),/oparlStatus/);
 assert.throws(()=>config({window:'5y'}),/window/);
 assert.equal(oparlVerdict({httpStatus:400,body:'{"error":"Webservice \\"OParl\\" ist nicht aktiviert!","code":100}'}).status,'disabled_confirmed');
 assert.equal(oparlVerdict({httpStatus:200,contentType:'application/json',body:JSON.stringify({type:'https://schema.oparl.org/1.1/System',name:'Test'})}).status,'available');
 assert.equal(oparlVerdict({httpStatus:200,body:'<html>Verifying your browser</html>'}).status,'blocked');
 assert.equal(oparlVerdict({httpStatus:200,contentType:'text/html',body:'<html>irgendwas</html>'}).status,'unknown');
});
test('transport: requests run one after another with the configured spacing and only within the instance',async()=>{
 const instance=config(),session=fakeSession({[BASE+'a']:'<html>A</html>',[BASE+'b']:'<html>B</html>'}),waits=[];
 const {get,state}=browserTransport(session,instance,{sleepFn:async ms=>{waits.push(ms);}});
 const source=sourceOf(instance,instance.regions[0]);
 const [a,b]=await Promise.all([get(BASE+'a',source),get(BASE+'b',source)]);
 assert.equal(a,'<html>A</html>');assert.equal(b,'<html>B</html>');assert.deepEqual(session.calls,[BASE+'a',BASE+'b']);
 assert.equal(waits.length,1);assert.ok(waits[0]>0&&waits[0]<=1200,'second request waits for the spacing');
 await assert.rejects(get('https://other.test/x',source),/Nicht freigegebene Quelladresse/);
 await assert.rejects(get(BASE+'missing',source),/Quelle antwortet mit HTTP 404/);
 assert.equal(state.stopped,null);assert.equal(state.requests,3);
});
test('transport: a WAF page reopens the start page once; a second one, 401/403 and 429 stop the run for good',async()=>{
 const instance=config(),source=sourceOf(instance,instance.regions[0]);
 const once=fakeSession({[BASE+'a']:'<html>A</html>'},{wafFirst:1});
 const t1=browserTransport(once,instance,{sleepFn:async()=>{}});
 assert.equal(await t1.get(BASE+'a',source),'<html>A</html>');assert.deepEqual(once.opened,[BASE+'vorlagen']);assert.equal(t1.state.waf,1);assert.equal(t1.state.reopened,1);
 const twice=fakeSession({[BASE+'a']:'<html>A</html>'},{wafFirst:2});
 const t2=browserTransport(twice,instance,{sleepFn:async()=>{}});
 await assert.rejects(t2.get(BASE+'a',source),StopError);assert.match(t2.state.stopped,/Prüfseite der WAF/);
 await assert.rejects(t2.get(BASE+'a',source),StopError);assert.equal(twice.calls.length,2,'after the stop nothing is asked');
 for(const [status,pattern] of [[403,/HTTP 403/],[429,/HTTP 429/],[401,/HTTP 401/]]){
  const s=fakeSession(url=>url===BASE+'x'?{httpStatus:status,body:'nein'}:'<html>ok</html>');
  const t=browserTransport(s,instance,{sleepFn:async()=>{}});
  await assert.rejects(t.get(BASE+'x',source),pattern);assert.match(t.state.stopped,pattern);
  await assert.rejects(t.get(BASE+'ok',source),StopError);assert.equal(s.calls.length,1);
 }
 const limited=browserTransport(fakeSession(()=>'<html>ok</html>'),config({limits:{maxRequests:2}}),{sleepFn:async()=>{}});
 await limited.get(BASE+'1',source);await limited.get(BASE+'2',source);await assert.rejects(limited.get(BASE+'3',source),new RegExp(BUDGET_REACHED));
 assert.equal(decodeResponse({httpStatus:200,contentType:'text/html; charset=iso-8859-1',bodyBase64:Buffer.from('Stra\xdfe','latin1').toString('base64')}).text,'Straße');
 assert.equal(decodeResponse({httpStatus:200,contentType:'text/html',bodyBase64:Buffer.from('<html>Verifying your browser</html>').toString('base64')}).waf,true);
});
/* Seiten eines SD.NET-Systems wie in tests/sdnet.test.mjs: Vorlagenliste, Kalender, zwei Sitzungen, eine Vorlagenseite. */
const meetingUrl=n=>BASE+'tops/?__=MEETING'+n,matterUrl=n=>BASE+'vorgang/?__=MATTER'+n;
const paperRow=(reference,subject,when,committee,meeting)=>`<tr class="row-1"><td class="column-dokument"></td><td class="column-betreff"><a href="${matterUrl(reference.replace(/\D/g,''))}">${reference}</a> - Verwaltungsvorlage<br/><span>${subject}</span></td><td class="column-termin">${when?`<a href="${meetingUrl(meeting)}" title="Zur Sitzung vom ${when}">${when}</a><br/>${committee}`:''}</td></tr>`;
const paperList=rows=>`<html><table><tbody>${rows.join('')}</tbody></table></html>`;
const agendaRow=(marker,number,title,reference,key,documents='')=>`<tr class="row-0 original ${marker}" ${key?`data-vorgang-id="${key}"`:''}><td class="column-topnrtext">${number}</td><td class="column-bezeichnung">${title}</td><td class="column-nummer">${reference||'&nbsp;'}</td><td class="column-dokumente">${documents}</td></tr>`;
const paperLinks=reference=>`<a class="link-element" href="${BASE}sdnetrim/FILE${reference.replace(/\D/g,'')}/Vorlage.pdf" title="Verwaltungsvorlage ${reference} im PDF-Format öffnen"><span class="hide-text">Verwaltungsvorlage ${reference} (94 KB)</span></a><a class="link-element" href="${matterUrl(reference.replace(/\D/g,''))}" title="Verwaltungsvorlage ${reference} - Vorgang. Vorgang öffnen"><span class="hide-text">Vorgang</span></a>`;
const agenda=(committee,when,rows)=>`<html><table><tr><th>Sitzung:</th><td>${committee}, 6. Sitzung</td></tr><tr><th>Termin:</th><td>${when} 18:00 Uhr</td></tr></table><table id="table0" class="table-data table-top table-cols-4"><caption>Tagesordnungspunkte</caption><tbody>${rows.join('')}</tbody></table></html>`;
const matter=(reference,subject,consultations)=>`<html><table><tr><th>Verwaltungsvorlage:</th><td>${reference}</td></tr><tr><th>Betreff:</th><td>${subject}</td></tr></table><table id="table0" class="table-data table-vorgang table-cols-4"><caption>Beratungsfolge</caption><tbody>${consultations.map(c=>`<tr class="row-1"><td class="column-beginn"><a href="${meetingUrl(c.meeting)}" title="Zur Sitzung">${c.when} 18:00 Uhr</a></td><td class="column-gremium"><a href="${BASE}gremien/?__=G"><span>${c.committee}</span></a></td><td class="column-beschluss"></td><td class="column-ergebnis">${c.result||''}</td></tr>`).join('')}</tbody></table></html>`;
const pdf=label=>Buffer.from(`%PDF-1.4\n${label}\n%%EOF\n`);
const fixturePages=()=>({
 [BASE+'vorlagen']:paperList([paperRow('79/2026','Bestellung einer Geschäftsführung','Do, 24.09.2026','Rat',2)]),
 [BASE+'termine']:`<html><button id="btn-export-ics" data-export-url="${BASE}termine/ics/?__=EXPORT"></button></html>`,
 [BASE+'termine/ics/?__=EXPORT']:['BEGIN:VEVENT','DTSTART:20261103T180000','SUMMARY:Rat','DESCRIPTION:Link zur Tagesordnung: '+meetingUrl(8),'END:VEVENT'].join('\r\n'),
 [meetingUrl(2)]:agenda('Rat','Do, 24.09.2026',[agendaRow('top-oeff-data','4.','Bestellung einer Geschäftsführung','79/2026','505_3022',paperLinks('79/2026'))]),
 [meetingUrl(1)]:agenda('Haupt- und Finanzausschuss','Do, 03.09.2026',[agendaRow('top-oeff-data','1.','Mitteilungen der Verwaltung','','200_6040'),agendaRow('top-oeff-data','3.','Bestellung einer Geschäftsführung','79/2026','505_3022',paperLinks('79/2026'))]),
 [meetingUrl(8)]:'<html><p>Noch keine Tagesordnung.</p></html>',
 [matterUrl('792026')]:matter('79/2026','Bestellung einer Geschäftsführung',[{meeting:1,when:'Do, 03.09.2026',committee:'Haupt- und Finanzausschuss',result:'Einstimmig dafür, 0 Enthaltungen'},{meeting:2,when:'Do, 24.09.2026',committee:'Rat',result:'Einstimmig dafür, 0 Enthaltungen'}]),
 [BASE+'sdnetrim/FILE792026/Vorlage.pdf']:pdf('Vorlage 79/2026'),
 [BASE+'webservice/oparl/v1.1/system']:{httpStatus:400,contentType:'application/json',body:'{"error":"Webservice \\"OParl\\" ist nicht aktiviert!","code":100,"type":"SD.NET RIM Webservice"}'},
});
test('runner: detect, import, apply, record and download work end to end with the SD.NET reader and a stand-in session',async()=>{
 const out=await tmpDir(),root=await tmpDir(),instance=config({outputDir:out}),pages=fixturePages();
 const sessionFactory=async()=>fakeSession(pages);
 const found=await detect(instance,{quiet:true,sessionFactory});
 assert.equal(found.oparl.status,'disabled_confirmed');assert.equal(found.entry.title,'Vorlagen - SD.NET RIM 4');assert.equal(found.error,null);
 assert.ok(JSON.parse(await fs.readFile(path.join(out,'detect.json'),'utf8')).oparl);
 const report=await importInstance(instance,{quiet:true,sessionFactory,now:new Date('2026-10-01T12:00:00Z')});
 assert.equal(report.scope,'complete_for_scope',JSON.stringify(report.regions));assert.equal(report.regions[0].topics,2);assert.equal(report.regions[0].meetings,2);assert.equal(report.stopped,null);
 assert.ok(report.totals.requests>=6);assert.ok(report.requests.every(r=>r.url.startsWith(BASE)));
 const result=JSON.parse(await fs.readFile(path.join(out,'nrw-05170004.json'),'utf8'));
 assert.equal(result.coverage.transport,'browser');assert.equal(result.coverage.regionId,'nrw-05170004');assert.equal(result.coverage.requestedFrom,'2026-09-01');
 assert.ok(result.topics.every(t=>t.regionId==='nrw-05170004'&&t.sourceUrl.startsWith(BASE)));
 /* apply: into a database with the real schema; a second apply of the same files changes nothing */
 const dbPath=path.join(out,'test.sqlite'),raw=new DatabaseSync(dbPath);
 for(const f of (await fs.readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())raw.exec(await fs.readFile(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 raw.close();
 const applied=await apply(instance,{dbPath});
 assert.deepEqual(applied.regions,[{id:'nrw-05170004',topics:2,complete:true}]);
 const check=new DatabaseSync(dbPath,{readOnly:true});
 assert.equal(check.prepare("SELECT count(*) n FROM topics WHERE region_id='nrw-05170004'").get().n,2);
 assert.equal(JSON.parse(check.prepare("SELECT payload FROM source_coverage WHERE region_id='nrw-05170004'").get().payload).transport,'browser');
 check.close();
 await apply(instance,{dbPath});
 const again=new DatabaseSync(dbPath,{readOnly:true});assert.equal(again.prepare('SELECT count(*) n FROM topics').get().n,2);assert.equal(again.prepare('SELECT count(*) n FROM article_versions').get().n,0);again.close();
 /* record: an accepted source with transport browser and the OParl finding, in the folder of the region's Land */
 const recorded=await record(instance,{root});
 assert.deepEqual(recorded.skipped,[]);assert.equal(recorded.written.length,1);
 const rows=JSON.parse(await fs.readFile(path.join(root,'tmp/source-discovery/verified-browser.json'),'utf8'));
 const row=rows['nrw-05170004'];assert.equal(row.accepted.transport,'browser');assert.equal(row.accepted.adapter,'sdnet');assert.equal(row.accepted.base,BASE);assert.equal(row.accepted.oparlFallback.reason,'Webservice OParl ist nicht aktiviert (HTTP 400).');assert.equal(row.accepted.browserImport.topics,2);
 /* download: the PDF behind the papers once per address and once per content; HTML instead of PDF is a failure, not a file */
 pages[BASE+'sdnetrim/FILE792026/Vorlage.pdf']=pdf('Vorlage 79/2026');
 const meta=await download(instance,{quiet:true,sessionFactory});
 assert.equal(meta.totals.saved,1);assert.equal(meta.totals.failed,0);assert.equal(meta.documents[0].status,'gespeichert');
 assert.equal(checkPdf(await fs.readFile(path.join(out,meta.documents[0].localPath))).ok,true);
 pages[BASE+'sdnetrim/FILE792026/Vorlage.pdf']='<html><title>rescaled WAF</title>Verifying your browser</html>';
 const blocked=await download(instance,{quiet:true,sessionFactory});
 assert.equal(blocked.totals.saved,0);assert.equal(blocked.documents[0].status,'fehler');assert.match(blocked.stopped,/Prüfseite der WAF/);
 /* a region without a result file or without reports is not recorded */
 const empty=config({outputDir:await tmpDir(),regions:[{id:'nrw-05170004',name:'Gemeinde Alpen'}]});
 assert.deepEqual((await record(empty,{root})).skipped,[['nrw-05170004','keine Ergebnisdatei']]);
 assert.equal((await bundleOf(empty)).results.length,0);
});
test('runner: a run that is stopped by the WAF reports stopped and keeps what was read before',async()=>{
 const out=await tmpDir(),instance=config({outputDir:out}),pages=fixturePages();
 let served=0;const sessionFactory=async()=>{const s=fakeSession(url=>{served++;if(served>3)return {httpStatus:403,body:'nein'};return pages[url];});return s;};
 const report=await importInstance(instance,{quiet:true,sessionFactory,now:new Date('2026-10-01T12:00:00Z')});
 assert.equal(report.scope,'stopped');assert.match(report.stopped,/HTTP 403/);
 assert.equal(report.regions.length,1);assert.ok(report.totals.requests<=4,'no request after the stop');
 const result=JSON.parse(await fs.readFile(path.join(out,'nrw-05170004.json'),'utf8'));assert.equal(result.coverage.complete,false);assert.match(result.coverage.browserImport.stopped,/HTTP 403/);
});
