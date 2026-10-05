import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEBSITE_READER_NAME,siteAllowed,fetchSiteText,fetchSiteBytes,robotsGate,collectWebsite,ROBOTS,ROBOTS_BLOCKED,decodeText,readPdfText,similarTitles} from '../server/integrations/website.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {fetchText} from '../server/integrations/sessionnet.mjs';
import {wpEndpoints} from '../server/integrations/website-feeds.mjs';
import {windowStart} from '../server/integrations/history-window.mjs';
import {READERS} from '../server/integrations/readers.mjs';
import {REFUSED} from '../server/integrations/request-budget.mjs';
import {SOURCE_USER_AGENT} from '../server/integrations/no-redirect.mjs';
// All pages, feeds and PDF texts in tests/fixtures/website/ are NACHGEBILDET (made up for these tests, not live pages):
// the website of an invented municipality Musterbach on www.musterbach.example.test, written the way small towns publish
// notices, minutes, feeds and calendars. No real places or persons. PDF files are stood in for by their extracted text
// (pdfText is injected), the network by functions that answer from the fixtures and record every address asked.
// The folder the fixtures' robots.txt excludes is read as "/gesperrt/": a folder "/intern/" names the non-public part (never asked
// at all), so it would not show the robots.txt rule.
// These tests check the old rule (robots.txt obeyed, ROBOTS_POLICY=obey); the tests marked "standard rule" switch to
// the rule of server/integrations/robots-policy.mjs: robots.txt is recorded, not obeyed, and a refusal stays final.
process.env.ROBOTS_POLICY='obey';
const standardRule=async fn=>{const was=process.env.ROBOTS_POLICY;delete process.env.ROBOTS_POLICY;try{return await fn();}finally{process.env.ROBOTS_POLICY=was;}};
const fixture=name=>readFileSync(new URL(`./fixtures/website/${name}`,import.meta.url),'utf8').replace(/\/intern\//g,'/gesperrt/');
const base='https://www.musterbach.example.test/';
const now=new Date('2026-10-04T10:00:00Z'),fromDay=windowStart(now,'12m').toISOString().slice(0,10);
const source={id:'de-09999001',name:'Gemeinde Musterbach',kind:'city',method:'scraper',adapter:'website',base,pages:[base+'rathaus/bekanntmachungen/'],feeds:[base+'aktuelles/feed.rss'],ics:[base+'veranstaltungen/kalender.ics'],wp:base+'wp-json/',sitemap:base+'sitemap.xml',verifiedSource:base+'rathaus/bekanntmachungen/',verifiedAt:'2026-10-04'};
const wp=wpEndpoints(source.wp,fromDay);
const U={
 invitation:base+'fileadmin/bekanntmachungen/2026/einladung-gemeinderat-2026-10-14.pdf',pastInvitation:base+'fileadmin/bekanntmachungen/2026/einladung-gemeinderat-2026-09-16.pdf',
 report:base+'aktuelles/sitzungsbericht-gemeinderat-16-09-2026.html',committee:base+'rathaus/gremien/bauausschuss/niederschrift-2026-09-23.html',
 unclear:base+'rathaus/gremien/werkausschuss/einladung-2026-11-05.html',county:base+'aktuelles/kreistag-2026-10-20.html',
 sitemapMinutes:base+'rathaus/gremien/gemeinderat/niederschrift-2026-07-22.html',scan:base+'wp-content/uploads/2026/10/tagesordnung-gemeinderat-2026-11-25.pdf',
 closed:base+'fileadmin/bekanntmachungen/2026/niederschrift-gemeinderat-nichtoeffentlich-2026-09-16.pdf',statute:base+'fileadmin/bekanntmachungen/2026/haushaltssatzung-2026.pdf',
 publisher:'https://www.amtsblatt-verlag.example.test/musterbach/einladung-bauausschuss-2026-10-21.pdf',old:base+'fileadmin/bekanntmachungen/2024/einladung-gemeinderat-2024-03-12.pdf',
 robots:base+'gesperrt/protokoll-gemeinderat-2026-07-08.pdf',robotsSitemap:base+'gesperrt/sitzung-gemeinderat-2026-08-19.html',feedArticle:base+'aktuelles/einladung-bauausschuss-21-10-2026.html',
 oldSitemap:base+'rathaus/gremien/gemeinderat/niederschrift-2023-05-10.html',waste:base+'leben/abfallkalender-2026.html',job:base+'aktuelles/stellenausschreibung-bauhof.html',
};
const enc=s=>new TextEncoder().encode(s);
const pdf=name=>({bytes:enc('%PDF-1.7 '+name),type:'application/pdf'}),page=name=>({bytes:enc(fixture(name)),type:'text/html; charset=utf-8'});
// pdfText stands in for unpdf: the fake PDF names its text fixture; "scan" has no text layer.
const pdfText=async bytes=>{const name=new TextDecoder().decode(bytes).slice(9);return name==='scan'?' \n ':fixture(name);};
const site=(changes={},docChanges={})=>{
 const pages={[base+'robots.txt']:fixture('robots.txt'),[base+'rathaus/bekanntmachungen/']:fixture('bekanntmachungen.html'),[base+'rathaus/bekanntmachungen/?seite=2']:fixture('bekanntmachungen-2.html'),
  [base+'aktuelles/feed.rss']:fixture('feed.xml'),[base+'veranstaltungen/kalender.ics']:fixture('kalender.ics'),[wp.posts]:fixture('wp-posts.json'),[wp.media]:fixture('wp-media.json'),[base+'sitemap.xml']:fixture('sitemap.xml'),...changes};
 const docs={[U.invitation]:pdf('einladung-gemeinderat-2026-10-14.txt'),[U.pastInvitation]:pdf('einladung-gemeinderat-2026-09-16.txt'),[U.report]:page('sitzungsbericht-gemeinderat-2026-09-16.html'),
  [U.committee]:page('niederschrift-bauausschuss-2026-09-23.html'),[U.unclear]:page('einladung-werkausschuss-2026-11-05.html'),[U.county]:page('kreistag-2026-10-20.html'),
  [U.sitemapMinutes]:page('niederschrift-gemeinderat-2026-07-22.html'),[U.scan]:pdf('scan'),...docChanges};
 const calls=[],answer=(map,url)=>{calls.push(url);const v=map[url];if(v instanceof Error)throw v;if(v===undefined)throw Error('Quelle antwortet mit HTTP 404');return v;};
 return {calls,get:async url=>answer(pages,url),getBytes:async url=>answer(docs,url)};
};
const run=async(options={},web=site())=>({web,d:await collectWebsite(options.source||source,{now,get:web.get,getBytes:web.getBytes,pdfText,window:'12m',...options})});
const SECRET=/Flurstück (?:412|512|77)|Personalangelegenheit|Lindenweg|Kanalarbeiten/;
// A fake fetch answering from a table of {status, headers, body}; records the requests.
const fakeFetch=table=>{const seen=[];const request=async(url,init)=>{seen.push({url,init});const a=table[url];if(!a)return new Response('nicht da',{status:404});return new Response(a.body??'',{status:a.status??200,headers:a.headers||{}});};request.seen=seen;return request;};

test('siteAllowed takes https addresses on the origin of base and of alsoFrom only',()=>{
 const s={base,alsoFrom:['https://dokumente.musterbach.example.test','https://www.elsewhere.example.test','http://alt.musterbach.example.test']};
 assert.equal(siteAllowed(base+'rathaus/a.pdf#seite=2',s),base+'rathaus/a.pdf');
 assert.equal(siteAllowed('https://dokumente.musterbach.example.test/einladung.pdf',s),'https://dokumente.musterbach.example.test/einladung.pdf');
 // A foreign host, a host of another domain named in alsoFrom, plain http and addresses with credentials are refused.
 for(const url of ['https://www.amtsblatt-verlag.example.test/musterbach/a.pdf','https://www.elsewhere.example.test/a.pdf','http://www.musterbach.example.test/a.pdf','http://alt.musterbach.example.test/a.pdf','https://user:pw@www.musterbach.example.test/a.pdf','https://www.musterbach.example.test:8443/a.pdf','kein Link'])
  assert.throws(()=>siteAllowed(url,s),/Nicht freigegebene Quelladresse/,url);
 assert.throws(()=>siteAllowed('https://dokumente.musterbach.example.test/a.pdf',{base}),/Nicht freigegebene/,'without alsoFrom only the origin of base');
});

test('fetchSiteText follows redirects by hand within the site and refuses a redirect to a foreign origin',async()=>{
 const s={base,alsoFrom:['https://dokumente.musterbach.example.test']};
 const request=fakeFetch({[base+'a']:{status:301,headers:{location:'/b'}},[base+'b']:{status:302,headers:{location:'https://dokumente.musterbach.example.test/c'}},'https://dokumente.musterbach.example.test/c':{body:'<p>Tagesordnung</p>',headers:{'content-type':'text/html; charset=utf-8'}},
  [base+'away']:{status:302,headers:{location:'https://cloud.example.test/share/einladung.pdf'}},[base+'loop1']:{status:301,headers:{location:'/loop2'}},[base+'loop2']:{status:301,headers:{location:'/loop1'}},
  [base+'r0']:{status:301,headers:{location:'/r1'}},[base+'r1']:{status:301,headers:{location:'/r2'}},[base+'r2']:{status:301,headers:{location:'/r3'}},[base+'r3']:{status:301,headers:{location:'/r4'}},
  [base+'down']:{status:503},[base+'wall']:{body:'<html>Die Anfrage wurde abgelehnt. Fehler-Nummer: 7571357861314030815</html>'}});
 assert.equal(await fetchSiteText(base+'a',s,5000,request),'<p>Tagesordnung</p>');
 assert.deepEqual(request.seen.map(r=>r.url),[base+'a',base+'b','https://dokumente.musterbach.example.test/c']);
 assert.ok(request.seen.every(r=>r.init.redirect==='manual'&&r.init.headers['User-Agent']===SOURCE_USER_AGENT));
 await assert.rejects(fetchSiteText(base+'away',s,5000,request),/Nicht freigegebene Quelladresse/);
 assert.ok(!request.seen.some(r=>r.url.startsWith('https://cloud.example.test')),'the foreign target is never asked');
 await assert.rejects(fetchSiteText(base+'loop1',s,5000,request),/Wiederholte Weiterleitung/);
 await assert.rejects(fetchSiteText(base+'r0',s,5000,request),/Weiterleitungslimit/);
 await assert.rejects(fetchSiteText(base+'down',s,5000,request),{message:'Quelle antwortet mit HTTP 503'});
 await assert.rejects(fetchSiteText(base+'wall',s,5000,request),{message:REFUSED});
 await assert.rejects(fetchSiteText('https://cloud.example.test/x',s,5000,request),/Nicht freigegebene/);
});

test('fetchSiteText checks every redirect target against robots.txt; fetchSiteBytes keeps the size limit',async()=>{
 const request=fakeFetch({[base+'open']:{status:302,headers:{location:'/gesperrt/einladung.html'}},[base+'gesperrt/einladung.html']:{body:'geheim'},[base+'big.pdf']:{headers:{'content-length':String(13e6),'content-type':'application/pdf'},body:'%PDF'},[base+'ok.pdf']:{headers:{'content-type':'application/pdf'},body:'%PDF-1.7 x'}});
 const gated={base,[ROBOTS]:async url=>!new URL(url).pathname.startsWith('/gesperrt/')};
 await assert.rejects(fetchSiteText(base+'open',gated,5000,request),{message:ROBOTS_BLOCKED});
 assert.ok(!request.seen.some(r=>r.url.includes('/gesperrt/')));
 await assert.rejects(fetchSiteBytes(base+'big.pdf',{base},5000,request),/zu groß/);
 const got=await fetchSiteBytes(base+'ok.pdf',{base},5000,request);
 assert.equal(got.type,'application/pdf');assert.equal(new TextDecoder().decode(got.bytes),'%PDF-1.7 x');
 // Pages in Latin-1 are read as such.
 assert.equal(decodeText(new Uint8Array([0x47,0x72,0xfc,0xdf,0x65]),'text/html; charset=ISO-8859-1'),'Grüße');
});

test('robotsGate reads robots.txt once per origin; 4xx allows all, 5xx or no answer blocks the origin',async()=>{
 const asked=[];
 const get=async url=>{asked.push(url);if(url===base+'robots.txt')return 'User-agent: *\nDisallow: /intern/\n\nUser-agent: ratsmonitor-sourcecatalog\nDisallow: /suche\nDisallow: /fileadmin/privat/\n';if(url.startsWith('https://dokumente.'))throw Error('Quelle antwortet mit HTTP 404');throw Error('Quelle antwortet mit HTTP 500');};
 const s={base,alsoFrom:['https://dokumente.musterbach.example.test','https://archiv.musterbach.example.test']};
 const allows=await robotsGate(get,s);
 assert.deepEqual(asked,[base+'robots.txt'],'the robots.txt of base is read at once, others when needed');
 // Our own group applies instead of "*": /intern/ is open to it, /fileadmin/privat/ is not.
 assert.equal(await allows(base+'rathaus/a.pdf'),true);assert.equal(await allows(base+'suche?q=rat'),false);assert.equal(await allows(base+'fileadmin/privat/x.pdf'),false);
 assert.equal(await allows('https://dokumente.musterbach.example.test/x.pdf'),true,'no robots.txt (404): all allowed');
 assert.equal(await allows('https://archiv.musterbach.example.test/x.pdf'),false,'robots.txt with 500: nothing');
 assert.equal(await allows('https://archiv.musterbach.example.test/y.pdf'),false);
 assert.deepEqual(asked,[base+'robots.txt','https://dokumente.musterbach.example.test/robots.txt','https://archiv.musterbach.example.test/robots.txt']);
 assert.equal(allows.issues.length,1);assert.match(allows.issues[0],/archiv\.musterbach\.example\.test.*HTTP 500.*nichts gelesen/);
 // Without a group of our own, the group "*" applies; a refusal (429) is no "missing robots.txt".
 const star=await robotsGate(async()=>'User-agent: *\nDisallow: /intern/',{base});assert.equal(await star(base+'intern/a.html'),false);
 const refused=await robotsGate(async()=>{throw Error(REFUSED);},{base});assert.equal(await refused(base+'a.html'),false);
});

test('collectWebsite asks robots.txt first and never asks foreign, non-public, out-of-period or excluded addresses',async()=>{
 const {web:{calls}}=await run();
 assert.equal(calls[0],base+'robots.txt');
 assert.equal(calls.filter(u=>u.endsWith('robots.txt')).length,1);
 for(const url of [base+'rathaus/bekanntmachungen/',base+'rathaus/bekanntmachungen/?seite=2',base+'aktuelles/feed.rss',base+'veranstaltungen/kalender.ics',wp.posts,wp.media,base+'sitemap.xml',
  U.invitation,U.pastInvitation,U.report,U.committee,U.unclear,U.county,U.sitemapMinutes,U.scan])assert.ok(calls.includes(url),'read: '+url);
 for(const url of [U.closed,U.statute,U.publisher,U.old,U.robots,U.robotsSitemap,U.feedArticle,U.oldSitemap,U.waste,U.job,base+'suche?q=Gemeinderat',base+'impressum.html'])assert.ok(!calls.includes(url),'never read: '+url);
 assert.ok(calls.every(u=>u.startsWith(base)),'only the site itself');
 assert.equal(new Set(calls).size,calls.length,'no address twice (the PDF named by list, feed and sitemap is read once)');
 assert.ok(!calls.some(u=>/[?&](?:search|q|s)=/.test(u)),'the search of the site is never used');
});

test('collectWebsite yields topics with ids, statuses and events from notices, minutes, feed, calendar and WordPress',async()=>{
 const {d}=await run();
 assert.equal(d.topics.length,16);
 const by=(day,title)=>d.topics.find(t=>t.eventDate===day&&t.title.startsWith(title));
 const statuses=[['2026-10-14','Erweiterung des Kindergartens','announced'],['2026-10-21','Bauantrag: Neubau eines Wohnhauses','announced'],['2026-11-11','Haushaltsplan 2027','announced'],
  ['2026-09-16','Bauantrag: Neubau einer Maschinenhalle','approved'],['2026-09-16','Antrag auf Tempo 30','rejected'],['2026-09-16','Bericht zur Haushaltslage','info'],['2026-09-16','Satzung über die Friedhofsgebühren','postponed'],
  ['2026-09-16','Anfragen','unknown'],['2026-09-23','Bauantrag Errichtung einer Photovoltaik','recommended'],['2026-09-30','Feuerwehrbedarfsplan 2027','approved'],['2026-09-30','Zuschuss für den Sportverein','rejected'],['2026-07-22','Kindergartengebühren','approved']];
 for(const [day,title,status] of statuses){const t=by(day,title);assert.ok(t,title);assert.equal(t.status,status,title);assert.equal(t.events.at(-1).status,status,title);}
 for(const t of d.topics){assert.match(t.id,/^de-09999001-web-2026\d{4}-[0-9a-f]{8}$/);assert.equal(t.id.slice(16,24),t.eventDate.replace(/-/g,''));}
 // A committee's approval is a recommendation; the deciding council's approval a decision.
 assert.equal(by('2026-09-23','Bauantrag').committee,'Bauausschuss');assert.equal(by('2026-09-23','Bauantrag').events[0].decision.kind,'recommendation');
 assert.equal(by('2026-07-22','Kindergartengebühren').events[0].decision.kind,'decision');
 // The body is named without the town's name, so that notice and report of one meeting meet.
 assert.ok(d.topics.every(t=>!/Musterbach$/.test(t.committee)));
 const ahead=by('2026-10-14','Bebauungsplan');
 assert.deepEqual([ahead.events.length,ahead.events[0].description,ahead.events[0].result,ahead.events[0].url],[1,'Öffentlich auf der Tagesordnung; die Sitzung steht noch aus.','',U.invitation+'#sitzung-2026-10-14-gemeinderat']);
 assert.equal(ahead.title,'Bebauungsplan "Am Mühlbach" – Aufstellungsbeschluss');
 assert.match(by('2026-07-22','Kindergarten').events[0].description,/^Laut veröffentlichter Niederschrift: Beschluss: Der Gemeinderat beschließt die Änderung der Gebührensatzung\. Abstimmung: 11:2$/);
 assert.equal(by('2026-09-16','Anfragen').events.at(-1).description,'Öffentlich auf der Tagesordnung; ein Ergebnis ist im eingelesenen Abschnitt nicht belegt.');
 // Feed entry with text of its own and calendar entry: their own addresses.
 assert.equal(by('2026-10-21','Bauvoranfrage').events[0].url,U.feedArticle+'#sitzung-2026-10-21-bauausschuss');
 assert.equal(by('2026-11-11','Anfragen').events[0].url,base+'veranstaltungen/kalender.ics#sitzung-2026-11-11-gemeinderat');
 assert.equal(by('2026-09-30','Zuschuss').sourceUrl,base+'2026/10/02/aus-dem-gemeinderat-30-09-2026/#sitzung-2026-09-30-gemeinderat');
});

test('collectWebsite joins invitation and minutes of one meeting and item into one topic, with the title of the invitation',async()=>{
 const {d}=await run();
 const joined=d.topics.filter(t=>t.eventDate==='2026-09-16');
 assert.equal(joined.length,5);
 const hall=joined.find(t=>t.status==='approved');
 assert.equal(hall.title,'Bauantrag: Neubau einer Maschinenhalle, Fl.Nr. 210, Gemarkung Musterbach','the invitation names the item fully');
 assert.deepEqual(hall.events.map(e=>[e.url,e.status]),[[U.pastInvitation+'#sitzung-2026-09-16-gemeinderat','unknown'],[U.report+'#sitzung-2026-09-16-gemeinderat','approved']]);
 assert.equal(hall.events[1].result,'Das gemeindliche Einvernehmen wird erteilt.');
 assert.deepEqual(hall.documents.map(x=>[x.url,x.kind]),[[U.pastInvitation,'application/pdf'],[U.report,'html']]);
 assert.deepEqual(hall.sourceData.records.map(r=>r.kind),['agenda','minutes']);
 assert.deepEqual(hall.sourceData.records[1].fields,{title:'Bauantrag Neubau Maschinenhalle',number:'1',status:'approved',result:'Das gemeindliche Einvernehmen wird erteilt.',yes:12,no:0,abstentions:null});
 assert.equal(hall.sourceUrl,U.pastInvitation+'#sitzung-2026-09-16-gemeinderat');
 // Same day and number, other body: another topic.
 assert.notEqual(d.topics.find(t=>t.eventDate==='2026-10-21'&&t.title.startsWith('Bauantrag')).id.slice(-8),d.topics.find(t=>t.eventDate==='2026-10-14'&&t.title.startsWith('Genehmigung')).id.slice(-8));
});

test('collectWebsite takes nothing of the non-public part, also behind letter-spaced or framed headings',async()=>{
 const {d}=await run();
 assert.ok(!SECRET.test(JSON.stringify(d)),'no item, title or text of a non-public part');
 // The invitation of 16 September prints "N i c h t ö f f e n t l i c h e r T e i l" with single spaces (as unpdf
 // returns it): items 6 and 7 behind it are not taken.
 assert.deepEqual(d.topics.filter(t=>t.eventDate==='2026-09-16').map(t=>t.sourceData.records[0].fields.number).sort(),['1','2','3','4','5']);
 // A heading in a form the heading rules do not know ("– Nichtöffentlicher Teil –") still names the non-public part:
 // it ends the public part, nothing behind it is taken.
 const framed=fixture('einladung-gemeinderat-2026-10-14.txt').replace('Nichtöffentlicher Teil','– Nichtöffentlicher Teil –');
 const web=site({},{[U.invitation]:pdf('framed')});
 const other=await collectWebsite(source,{now,window:'12m',get:web.get,getBytes:web.getBytes,pdfText:async b=>new TextDecoder().decode(b).endsWith('framed')?framed:pdfText(b)});
 assert.deepEqual(other.topics.filter(t=>t.eventDate==='2026-10-14').map(t=>t.sourceData.records[0].fields.number).sort(),['1','2','3']);
 assert.ok(!/Flurstück 512/.test(JSON.stringify(other)));
});

test('collectWebsite reports an agenda without evidence of the public part and takes none of its items',async()=>{
 const {d}=await run();
 assert.ok(!d.topics.some(t=>/Wasserpreise|Kläranlage/.test(t.title)));
 assert.deepEqual(d.coverage.issues,['PDF ohne lesbaren Text (vermutlich eingescannt): '+U.scan,'Tagesordnung nicht eindeutig als öffentlich erkennbar, nicht übernommen: '+U.unclear]);
 assert.equal(d.coverage.complete,false);
});

test('collectWebsite leaves out the county council on a town site, but not on a county site',async()=>{
 const {d,web}=await run();
 assert.ok(web.calls.includes(U.county),'the page is read');
 assert.ok(!d.topics.some(t=>/Kreishaushalt|Schulentwicklungsplan/.test(t.title)||t.committee==='Kreistag'));
 const {d:county}=await run({source:{...source,id:'de-09999000',name:'Landkreis Musterland',kind:'district'}});
 assert.deepEqual(county.topics.filter(t=>t.committee==='Kreistag').map(t=>[t.title,t.status]),[['Kreishaushalt 2027','announced'],['Schulentwicklungsplan des Landkreises','announced']]);
});

test('collectWebsite reads nothing when robots.txt answers with a server error',async()=>{
 const web=site({[base+'robots.txt']:new Error('Quelle antwortet mit HTTP 500')});
 const {d}=await run({},web);
 assert.deepEqual(web.calls,[base+'robots.txt']);
 assert.equal(d.topics.length,0);assert.equal(d.coverage.complete,false);
 assert.match(d.coverage.issues[0],/^robots\.txt von https:\/\/www\.musterbach\.example\.test nicht lesbar \(Quelle antwortet mit HTTP 500\)/);
 assert.equal(d.coverage.issues.at(-1),'Noch keine Artikel erfolgreich erfasst.');
 // Without robots.txt (404) everything is allowed, also /gesperrt/.
 const open=site({[base+'robots.txt']:new Error('Quelle antwortet mit HTTP 404')});await run({},open);
 assert.ok(open.calls.includes(U.robots));
});

test('collectWebsite records a scanned PDF as unreadable for a later OCR step',async()=>{
 const {d}=await run();
 assert.deepEqual(d.coverage.unreadable,[U.scan]);
 assert.ok(!d.topics.some(t=>t.eventDate==='2026-11-25'));
});

test('collectWebsite reads at most 60 documents and leaves the rest for the next import',async()=>{
 const days=Array.from({length:65},(_,i)=>new Date(Date.UTC(2026,0,5+i*3)).toISOString().slice(0,10));
 const list=`<main><h1>Sitzungsberichte</h1>${days.map(d=>`<a href="/berichte/${d}.html">Sitzungsbericht Gemeinderat ${d.split('-').reverse().join('.')}</a>`).join('')}</main>`;
 const report=d=>`<main><p>Bericht aus der öffentlichen Sitzung des Gemeinderates am ${d.split('-').reverse().join('.')}</p><h3>TOP 1: Bauantrag ${d}</h3><p>Der Gemeinderat stimmt zu.</p></main>`;
 const s={id:'de-09999002',name:'Gemeinde Oberdorf',kind:'city',base,pages:[base+'berichte/']};
 const web=site({[base+'berichte/']:list},Object.fromEntries(days.map(d=>[base+`berichte/${d}.html`,{bytes:enc(report(d)),type:'text/html'}])));
 const {d}=await run({source:s},web);
 assert.equal(web.calls.filter(u=>u.includes('/berichte/20')).length,60);
 assert.equal(d.coverage.resumable,true);
 assert.ok(d.coverage.issues.includes('Dokumentlimit erreicht; 5 Dokumente noch nicht gelesen, weiterer Import erforderlich.'));
 assert.equal(d.topics.length,60);assert.equal(d.coverage.documents,60);
 // The newest first: the five oldest reports are left.
 const oldest=days.slice(0,5).map(x=>base+`berichte/${x}.html`);
 assert.ok(oldest.every(u=>!web.calls.includes(u)));
 // The next import reads what it has not read yet before what it read completely, and is then done.
 const again=site({[base+'berichte/']:list},Object.fromEntries(days.map(x=>[base+`berichte/${x}.html`,{bytes:enc(report(x)),type:'text/html'}])));
 const next=await collectWebsite(s,{now:new Date(now.getTime()+3600000),get:again.get,getBytes:again.getBytes,pdfText,window:'12m',marks:{known:d.marks,stock:new Set(Object.keys(d.marks))}});
 assert.ok(oldest.every(u=>again.calls.includes(u)),'the reports left last time are read');
 assert.equal(again.calls.filter(u=>u.includes('/berichte/20')).length,60);
 assert.equal(next.topics.length,5);assert.equal(next.coverage.resumable,undefined);
 assert.ok(!next.coverage.issues.some(i=>/Dokumentlimit/.test(i)));
 assert.ok(next.coverage.warnings.includes('Dokumentlimit erreicht; 5 bereits vollständig gelesene Dokumente diesmal nicht erneut gelesen.'));
 assert.equal(Object.keys(next.marks).length,65,'the marks of the reports held back are kept');
});

test('collectWebsite tells whether a document names the area, without case and umlaut variants',async()=>{
 assert.equal((await run({expectNames:['MUSTERBACH']})).d.coverage.namesArea,true);
 assert.equal((await run({expectNames:['Oberdorf','Unterbach']})).d.coverage.namesArea,false);
 assert.equal((await run()).d.coverage.namesArea,undefined,'only asked when names are given');
 const s={id:'de-09999003',name:'Gemeinde Lüdersdorf',kind:'city',base,pages:[base+'b/']};
 const doc=`<main><p>Öffentliche Sitzung des Gemeinderates Lüdersdorf am 30.09.2026</p><p>1. Dorfplatz</p></main>`;
 const web=()=>site({[base+'b/']:'<a href="/b/sitzung-gemeinderat-2026-09-30.html">Sitzung Gemeinderat 30.09.2026</a>'},{[base+'b/sitzung-gemeinderat-2026-09-30.html']:{bytes:enc(doc),type:'text/html'}});
 assert.equal((await run({source:s,expectNames:['Luedersdorf']},web())).d.coverage.namesArea,true);
 assert.equal((await run({source:s,expectNames:['Lüders']},web())).d.coverage.namesArea,false,'a part of a word is no name');
});

test('collectWebsite marks meetings; a second import with the same pages yields no topics',async()=>{
 const {d}=await run();
 assert.deepEqual(Object.keys(d.marks).sort(),[U.invitation+'#sitzung-2026-10-14-gemeinderat',U.pastInvitation+'#sitzung-2026-09-16-gemeinderat',U.report+'#sitzung-2026-09-16-gemeinderat',U.committee+'#sitzung-2026-09-23-bauausschuss',U.feedArticle+'#sitzung-2026-10-21-bauausschuss',base+'veranstaltungen/kalender.ics#sitzung-2026-11-11-gemeinderat',base+'2026/10/02/aus-dem-gemeinderat-30-09-2026/#sitzung-2026-09-30-gemeinderat',U.sitemapMinutes+'#sitzung-2026-07-22-gemeinderat'].sort());
 assert.equal(d.readMeetings,8);
 const marks={known:d.marks,stock:new Set(Object.keys(d.marks))};
 const {d:again}=await run({marks});
 assert.equal(again.topics.length,0);assert.equal(again.coverage.unchangedMeetings,8);assert.deepEqual(Object.keys(again.marks).sort(),Object.keys(d.marks).sort());
 // Two days later the marks are no longer trusted blindly, but an unchanged meeting still yields nothing; a changed one does.
 const later=new Date(now.getTime()+2*86400000);
 const changed=site({},{[U.report]:{bytes:enc(fixture('sitzungsbericht-gemeinderat-2026-09-16.html').replace('Es lagen keine Anfragen vor.','Der Gemeinderat nimmt die Anfragen zur Kenntnis.')),type:'text/html'}});
 const third=await collectWebsite(source,{now:later,get:changed.get,getBytes:changed.getBytes,pdfText,window:'12m',marks});
 const day=third.topics.filter(t=>t.eventDate==='2026-09-16');
 // The changed report is given out together with the unchanged invitation of its meeting: the topic keeps the
 // invitation's title, its address and both records, also after merging into the stock.
 assert.deepEqual(day.map(t=>[t.title,t.status]),[['Bauantrag: Neubau einer Maschinenhalle, Fl.Nr. 210, Gemarkung Musterbach','approved'],['Antrag auf Tempo 30 in der Hauptstraße','rejected'],['Bericht zur Haushaltslage','info'],['Satzung über die Friedhofsgebühren','postponed'],['Anfragen','info']]);
 assert.ok(day.every(t=>t.events.length===2&&t.sourceData.records.map(r=>r.kind).join()==='agenda,minutes'&&t.sourceUrl.startsWith(U.pastInvitation)));
 assert.ok(!third.topics.some(t=>t.eventDate>'2026-10-06'),'unchanged announced meetings yield nothing again');
 assert.equal(day.find(t=>t.title==='Anfragen').id,d.topics.find(t=>t.eventDate==='2026-09-16'&&t.title==='Anfragen').id,'the same topic as before');
 const merged=mergeImport({topics:d.topics,coverage:d.coverage},{topics:third.topics,coverage:third.coverage}).topics.find(t=>t.id===day[0].id);
 assert.deepEqual([merged.title,merged.sourceData.records.map(r=>r.kind)],['Bauantrag: Neubau einer Maschinenhalle, Fl.Nr. 210, Gemarkung Musterbach',['agenda','minutes']]);
});

test('collectWebsite builds topics like the other readers: source data, quality, summary with the place',async()=>{
 const {d}=await run();
 const t=d.topics.find(x=>x.eventDate==='2026-10-14'&&x.title.startsWith('Erweiterung'));
 assert.equal(t.regionId,source.id);assert.equal(t.source,'city');assert.equal(t.public,true);assert.equal(t.reference,'');assert.equal(t.category,'Bildung & Familie');
 assert.equal(t.sourceData.method,'website');assert.equal(t.sourceData.version,'public-source-fields-v1');assert.deepEqual(t.sourceData.records,[{kind:'agenda',url:U.invitation+'#sitzung-2026-10-14-gemeinderat',fields:{title:'Erweiterung des Kindergartens',number:'3'}}]);
 assert.deepEqual(t.events[0].attendance,{status:'not_collected',sourceUrl:U.invitation+'#sitzung-2026-10-14-gemeinderat',fetchedAt:now.toISOString(),people:[]});
 assert.equal(t.events[0].decision.kind,'unknown');assert.equal(t.events[0].committee,'Gemeinderat');
 assert.match(t.events[0].publicEvidence,/öffentlichen Sitzung des Gemeinderates/);
 assert.deepEqual(t.quality.checks.map(c=>[c.name,c.passed,c.detail]),[['Originalquelle',true,'Offizielle Website der Kommune; nur Punkte des öffentlichen Teils einer Bekanntmachung oder Niederschrift.'],['Inhaltliche Prüfung',false,'Automatischer Quellenüberblick, keine geprüfte KI-Zusammenfassung.']]);
 assert.match(t.longSummary[0],/in Gemeinde Musterbach/);assert.equal(t.relevanceReason,'Öffentlicher Vorgang: Gemeinde Musterbach');
 assert.deepEqual(t.documents.map(x=>[x.url,x.kind]),[[U.invitation,'application/pdf']]);assert.match(t.documents[0].title,/^Einladung zur öffentlichen Sitzung des Gemeinderates am 14\.10\.2026/);
});

test('collectWebsite coverage counts meetings, documents and announced meetings without agenda',async()=>{
 const {d}=await run();
 const c=d.coverage;
 assert.deepEqual([c.regionId,c.method,c.listStrategy,c.from,c.to,c.sourceCount,c.sourceUrl,c.quiet],[source.id,'scraper','website',fromDay,'2026-10-04',1,base,false]);
 // 14.10., 16.09., 23.09., 05.11. (unclear), 21.10., 11.11., 30.09., 22.07.; the Ortschaftsrat of 28.10. (JSON-LD event) has no agenda yet.
 assert.equal(c.meetings,8);assert.equal(c.upcomingWithoutAgenda,1);
 assert.equal(c.documents,8);assert.equal(c.resumable,undefined);
 assert.ok(c.warnings.some(w=>/2 Adressen laut robots\.txt ausgeschlossen/.test(w)));
});

test('collectWebsite reads the PDF behind a detail page without agenda, and records documents without a meeting',async()=>{
 const s={id:'de-09999004',name:'Gemeinde Oberdorf',kind:'city',base,pages:[base+'aktuelles/']};
 const detail='<main><h1>Einladung zur Sitzung des Gemeinderates am 18.11.2026</h1><p>Die Einladung mit Tagesordnung finden Sie hier:</p><a href="/files/einladung-gemeinderat-2026-11-18.pdf">Einladung (PDF)</a><a href="/files/einladung-gemeinderat-nicht-oeffentlich-2026-11-18.pdf">Anlage</a></main>';
 const text='Gemeinde Oberdorf\nAm 18.11.2026 um 19 Uhr findet eine öffentliche Sitzung des Gemeinderates statt.\nTagesordnung – öffentlicher Teil\n1. Neubau Feuerwehrhaus\nNichtöffentlicher Teil\n2. Grundstücksangelegenheit Flurstück 412';
 const web=site({[base+'aktuelles/']:'<main><a href="/aktuelles/einladung-gemeinderat-18-11-2026.html">Einladung zur Sitzung des Gemeinderates am 18.11.2026</a><a href="/aktuelles/protokoll-gemeinderat.html">Protokolle des Gemeinderates</a></main>'},
  {[base+'aktuelles/einladung-gemeinderat-18-11-2026.html']:{bytes:enc(detail),type:'text/html'},[base+'files/einladung-gemeinderat-2026-11-18.pdf']:pdf('oberdorf'),[base+'aktuelles/protokoll-gemeinderat.html']:{bytes:enc('<main><p>Die Protokolle liegen im Rathaus aus.</p></main>'),type:'text/html'}});
 const {d}=await run({source:s,pdfText:async()=>text},web);
 assert.ok(web.calls.includes(base+'files/einladung-gemeinderat-2026-11-18.pdf'));
 assert.ok(!web.calls.includes(base+'files/einladung-gemeinderat-nicht-oeffentlich-2026-11-18.pdf'));
 assert.deepEqual(d.topics.map(t=>[t.title,t.status,t.events[0].url]),[['Neubau Feuerwehrhaus','announced',base+'files/einladung-gemeinderat-2026-11-18.pdf#sitzung-2026-11-18-gemeinderat']]);
 assert.deepEqual(d.coverage.unparsed,[base+'aktuelles/protokoll-gemeinderat.html']);
 assert.ok(d.coverage.issues.includes('Keine Sitzung erkannt, nicht übernommen: '+base+'aktuelles/protokoll-gemeinderat.html'));
 assert.ok(!/Flurstück 412/.test(JSON.stringify(d)));
});

test('the website reader is registered for catalog entries but never detected from a page',async()=>{
 assert.equal(typeof READERS.website.collect,'function');
 assert.equal(READERS.website.name,WEBSITE_READER_NAME);
 assert.equal(WEBSITE_READER_NAME,'Website der Kommune (öffentliche Bekanntmachungen)');
 assert.equal(await READERS.website.detect(base,fixture('bekanntmachungen.html'),{}),null);
 assert.equal(READERS.website.oparlCheck,undefined);
});

// --- further cases (all pages and texts NACHGEBILDET, not live; invented places Oberdorf, Unterdorf) -----------------
const oberdorf={id:'de-09999005',name:'Gemeinde Oberdorf',kind:'city',base,pages:[base+'b/']};
const html=body=>({bytes:enc(`<main>${body}</main>`),type:'text/html'});
// A list page that links each document by its label; docs: {path: [label, answer]}.
const listed=(docs,pages={})=>site({[base+'b/']:`<main><h1>Bekanntmachungen</h1>${Object.entries(docs).map(([path,[label]])=>`<a href="/${path}">${label}</a>`).join('')}</main>`,...pages},Object.fromEntries(Object.entries(docs).map(([path,[,answer]])=>[base+path,answer])));

test('collectWebsite takes no item that its own line, a note, a mark or a later head names as non-public',async()=>{
 const docs={
  'b/einladung-gemeinderat-14-10-2026.html':['Einladung Sitzung Gemeinderat 14.10.2026',html('<h1>Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026</h1><h2>Öffentlicher Teil</h2><p>1. Bauantrag Kita</p><p>2. Haushalt 2027</p><p>3. Grundstücksverkauf Lindenweg (nichtöffentlich)</p><p>4. Personalangelegenheit Bauhof</p>')],
  'b/einladung-bauausschuss-21-10-2026.html':['Einladung Sitzung Bauausschuss 21.10.2026',html('<h1>Einladung zur Sitzung des Bauausschusses am 21.10.2026</h1><h2>Öffentlicher Teil</h2><table><tr><td>1</td><td></td><td>Ausbau Schulweg</td></tr><tr><td>2</td><td>N</td><td>Grundstücksverkauf Lindenweg</td></tr><tr><td>3</td><td></td><td>Vergabe Kanalarbeiten</td></tr></table>')],
  'b/einladung-gemeinderat-28-10-2026.html':['Einladung Sitzung Gemeinderat 28.10.2026',html('<h1>Einladung zur Sitzung des Gemeinderates am 28.10.2026</h1><h2>Öffentlicher Teil</h2><p>1. Neubau Feuerwehrhaus</p><h2>Nichtöffentlicher Teil</h2><p>2. Grundstücksverkauf Lindenweg</p><p>(Vorberatung in öffentlicher Sitzung des Bauausschusses am 23.09.2026)</p><p>3. Personalangelegenheit Bauhof</p>')],
  'b/amtsblatt-sitzungen-gemeinderat.html':['Amtsblatt Sitzungen des Gemeinderates',html('<p>Sitzung des Gemeinderates am 04.11.2026</p><p>Öffentlicher Teil</p><p>1. Dorfplatz</p><p>Nichtöffentlicher Teil</p><p>2. Personalangelegenheit Bauhof</p><p>Sitzung des Bauausschusses am 11.11.2026</p><p>Öffentlicher Teil</p><p>1. Ausbau Lindenstraße</p><p>– Nichtöffentlicher Teil –</p><p>2. Grundstücksverkauf Lindenweg</p>')],
  'b/einladung-gemeinderat-2026-11-18.pdf':['Einladung zur öffentlichen Sitzung des Gemeinderates am 18.11.2026',pdf('decomposed')],
  'b/niederschrift-gemeinderat-2026-09-16.pdf':['Niederschrift nichtöffentliche Sitzung Gemeinderat 16.09.2026'.normalize('NFD'),pdf('never')],
 };
 const web=listed(docs);
 // The PDF writes its umlauts with a spacing diaeresis, as some PDF producers do.
 const text='Einladung\nAm 18.11.2026 findet eine ¨offentliche Sitzung des Gemeinderates statt.\n1. Radweg Ortsmitte\nNicht¨offentlicher Teil\n2. Personalangelegenheit Bauhof';
 const {d}=await run({source:oberdorf,pdfText:async()=>text},web);
 assert.ok(!web.calls.includes(base+'b/niederschrift-gemeinderat-2026-09-16.pdf'),'a decomposed "nichtöffentlich" in the link text closes the document');
 assert.deepEqual(d.topics.map(t=>`${t.eventDate} ${t.committee}: ${t.title}`).sort(),['2026-10-14 Gemeinderat: Bauantrag Kita','2026-10-14 Gemeinderat: Haushalt 2027','2026-10-21 Bauausschuss: Ausbau Schulweg','2026-10-28 Gemeinderat: Neubau Feuerwehrhaus','2026-11-04 Gemeinderat: Dorfplatz','2026-11-11 Bauausschuss: Ausbau Lindenstraße','2026-11-18 Gemeinderat: Radweg Ortsmitte']);
 assert.ok(!SECRET.test(JSON.stringify(d.topics)));
 assert.ok(!d.topics.some(t=>t.eventDate==='2026-09-23'),'a note on an earlier reading starts no meeting');
});

test('collectWebsite reads the site with its own fetch in a traced import: robots.txt for redirect targets, alsoFrom, documents recorded',async()=>{
 const other='https://dokumente.musterbach.example.test';
 const s={id:'de-09999006',name:'Gemeinde Musterbach',kind:'city',base,pages:[base+'liste',base+'b/'],feeds:[other+'/feed.rss'],alsoFrom:[other]};
 const request=fakeFetch({[base+'robots.txt']:{body:'User-agent: *\nDisallow: /intern/\n'},[base+'liste']:{status:302,headers:{location:'/intern/liste'}},[base+'intern/liste']:{body:'geheim'},
  [base+'b/']:{body:'<main><a href="/b/einladung-gemeinderat-2026-10-14.html">Einladung Sitzung Gemeinderat 14.10.2026</a></main>',headers:{'content-type':'text/html'}},
  [base+'b/einladung-gemeinderat-2026-10-14.html']:{body:'<main><p>Öffentliche Sitzung des Gemeinderates am 14.10.2026</p><p>1. Dorfplatz</p></main>',headers:{'content-type':'text/html'}},
  [other+'/robots.txt']:{status:404},[other+'/feed.rss']:{body:'<rss><channel></channel></rss>',headers:{'content-type':'application/rss+xml'}}});
 const recorded=[],trace={wrap:fn=>async(url,...rest)=>{recorded.push(url);return fn(url,...rest);}};
 const saved=globalThis.fetch;globalThis.fetch=request;
 let d;
 // As collect-region.mjs hands it over in a metadata import: the council-system fetch, wrapped by the trace.
 try{d=await READERS.website.collect(s,{now,window:'12m',trace,get:trace.wrap(fetchText)});}finally{globalThis.fetch=saved;}
 const asked=request.seen.map(r=>r.url);
 assert.ok(!asked.includes(base+'intern/liste'),'a redirect into a path robots.txt excludes is not followed');
 assert.ok(asked.includes(other+'/robots.txt')&&asked.includes(other+'/feed.rss'),'the origin of alsoFrom is read');
 assert.ok(!d.coverage.issues.some(i=>/Nicht freigegebene/.test(i)));
 assert.ok(request.seen.every(r=>r.init.headers['User-Agent']===SOURCE_USER_AGENT));
 assert.ok(recorded.includes(base+'b/einladung-gemeinderat-2026-10-14.html'),'documents are recorded by the trace too');
 assert.deepEqual(d.topics.map(t=>t.title),['Dorfplatz']);
});

test('collectWebsite never reads a council system, the site search or the non-public part, also not behind a redirect',async()=>{
 const web=site({[base+'b/']:`<main><a href="/buergerinfo/to0040.asp?__ksinr=123">Tagesordnung Sitzung Gemeinderat 14.10.2026</a><a href="/sessionnet/si0057.php?__ksinr=9">Sitzung Gemeinderat 14.10.2026</a>
  <a href="/suche?q=Sitzung+Gemeinderat+14.10.2026">Sitzung Gemeinderat 14.10.2026</a><a href="/search/?query=Tagesordnung+Gemeinderat">Tagesordnung Gemeinderat</a><a href="/index.php?id=5&amp;tx_kesearch_pi1%5Bsword%5D=Sitzung">Sitzung Gemeinderat</a>
  <a href="/piwi/sitzung/detail/12">Sitzung Gemeinderat 21.10.2026</a><a href="/b/protokoll_noe_2026-09-16.pdf">Protokoll Gemeinderat 16.09.2026</a><a href="/b/protokoll-gemeinderat-2026-09-16.pdf">Protokoll (nö) Gemeinderat 16.09.2026</a></main>`});
 const {web:{calls},d}=await run({source:{...oberdorf,feeds:[base+'ratsinfo/feed.rss']}},web);
 assert.deepEqual(calls,[base+'robots.txt',base+'b/']);
 assert.ok(d.coverage.warnings.some(w=>/^\d+ Adressen eines Ratsinformationssystems, der Suche oder des nichtöffentlichen Teils nicht abgerufen\.$/.test(w)));
 // Redirect targets are checked as links are.
 const request=fakeFetch({[base+'a']:{status:302,headers:{location:'/nichtoeffentlich/sitzung-gemeinderat-2026-10-14.html'}},[base+'r']:{status:302,headers:{location:'/buergerinfo/to0040.asp?__ksinr=1'}},[base+'s']:{status:301,headers:{location:'/suche?q=rat'}},
  [base+'big.html']:{headers:{'content-type':'text/html'},body:'x'.repeat(5e6)}});
 for(const u of ['a','r','s'])await assert.rejects(fetchSiteBytes(base+u,{base},5000,request),/nicht abgerufen/);
 assert.deepEqual(request.seen.map(r=>r.url),[base+'a',base+'r',base+'s']);
 // A page asked for as a document is read up to the limit of pages (4 MB), not that of PDF files.
 await assert.rejects(fetchSiteBytes(base+'big.html',{base},5000,request),/zu groß/);
});

test('collectWebsite asks an origin nothing more after it refused a request (403, 429)',async()=>{
 const docs=Object.fromEntries(Array.from({length:8},(_,i)=>[`b/einladung-gemeinderat-2026-10-${10+i}.html`,[`Einladung Sitzung Gemeinderat ${10+i}.10.2026`,null]]));
 for(const [status,resumable] of [[403,undefined],[429,true]]){
  const web=listed(docs);const getBytes=async url=>{web.calls.push(url);throw Error('Quelle antwortet mit HTTP '+status);};
  const d=await collectWebsite(oberdorf,{now,window:'12m',get:web.get,getBytes,pdfText,maxDurationMs:9000});
  // Two requests are under way at a time; after the refusal no further one is made.
  assert.equal(web.calls.filter(u=>u.includes('/b/einladung')).length,2,'the two requests under way, then none more');
  assert.ok(d.coverage.issues.includes(`https://www.musterbach.example.test wies Abrufe ab (HTTP ${status}); in diesem Import keine weiteren Anfragen dorthin, 6 Adressen nicht abgefragt.`),status);
  assert.equal(d.coverage.resumable,resumable);
 }
 // A firewall's rejection page counts as a temporary refusal.
 const web=listed(docs);const d=await collectWebsite(oberdorf,{now,window:'12m',get:web.get,getBytes:async url=>{web.calls.push(url);throw Error(REFUSED);},pdfText,maxDurationMs:9000});
 assert.equal(web.calls.filter(u=>u.includes('/b/einladung')).length,2);assert.equal(d.coverage.resumable,true);
});

test('collectWebsite joins minutes to the invitation only where the item is the same, also when renumbered',async()=>{
 const docs={
  'b/einladung-gemeinderat-2026-09-16.html':['Einladung Sitzung Gemeinderat 16.09.2026',html('<p>Einladung zur öffentlichen Sitzung des Gemeinderates am 16.09.2026</p><p>1. Genehmigung der Niederschrift</p><p>2. Antrag auf Tempo 30 in der Schulstraße</p><p>3. Neubau Feuerwehrhaus</p>')],
  'b/niederschrift-gemeinderat-2026-09-16.html':['Niederschrift Sitzung Gemeinderat 16.09.2026',html('<p>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</p><p>1. Genehmigung der Niederschrift</p><p>Die Niederschrift wird genehmigt. Abstimmung: 12:0</p><p>2. Neubau Feuerwehrhaus</p><p>Der Gemeinderat beschließt den Neubau. Abstimmung: 12 : 0</p><p>3. Zuschuss Sportverein</p><p>Der Antrag wird abgelehnt.</p>')],
 };
 const {d}=await run({source:oberdorf},listed(docs));
 const by=title=>d.topics.find(t=>t.title.startsWith(title));
 assert.deepEqual([by('Antrag auf Tempo 30').status,by('Antrag auf Tempo 30').events.length],['unknown',1],'the outcome of another item never lands here');
 assert.deepEqual([by('Neubau Feuerwehrhaus').status,by('Neubau Feuerwehrhaus').events.length,by('Neubau Feuerwehrhaus').sourceData.records.map(r=>r.fields.number)],['approved',2,['3','2']]);
 assert.deepEqual([by('Genehmigung').status,by('Genehmigung').events.length],['approved',2]);
 assert.deepEqual([by('Zuschuss Sportverein').status,by('Zuschuss Sportverein').events.length],['rejected',1]);
 assert.equal(d.topics.length,4);
 assert.equal(similarTitles('Bauantrag: Neubau einer Maschinenhalle, Fl.Nr. 210','Bauantrag Neubau Maschinenhalle'),true);
 assert.equal(similarTitles('Bauantrag Müller','Bauantrag Schmidt'),false);
});

test('collectWebsite gives one event per meeting and kind when a notice is published as page and as PDF',async()=>{
 const agenda='Am 18.11.2026 findet eine öffentliche Sitzung des Gemeinderates statt.\n1. Neubau Feuerwehrhaus\n2. Dorfplatz';
 const docs={'b/einladung-gemeinderat-18-11-2026.html':['Einladung Sitzung Gemeinderat 18.11.2026',html(agenda.split('\n').map(l=>`<p>${l}</p>`).join(''))],'b/einladung-gemeinderat-2026-11-18.pdf':['Einladung Sitzung Gemeinderat 18.11.2026 (PDF)',pdf('agenda')]};
 const {d}=await run({source:oberdorf,pdfText:async()=>agenda},listed(docs));
 const t=d.topics.find(x=>x.title==='Neubau Feuerwehrhaus');
 assert.deepEqual([d.topics.length,t.events.length,t.sourceData.records.length,t.documents.length,d.readMeetings,Object.keys(d.marks).length],[2,1,1,2,1,1]);
});

test('collectWebsite leaves out bodies of associations, of the county and of other towns',async()=>{
 const docs={
  'b/einladung-verbandsversammlung-2026-10-14.html':['Einladung Sitzung Verbandsversammlung 14.10.2026',html('<p>Einladung zur Sitzung der Verbandsversammlung</p><p>Zweckverband Wasserversorgung Oberdorf-Unterdorf</p><p>am 14.10.2026</p><p>Öffentlicher Teil</p><p>1. Wirtschaftsplan 2027</p>')],
  'b/einladung-umweltausschuss-2026-10-15.html':['Einladung Sitzung Umweltausschuss 15.10.2026',html('<p>Einladung zur Sitzung des Umweltausschusses des Kreistages am 15.10.2026</p><p>Öffentlicher Teil</p><p>1. Radwegekonzept</p>')],
  'b/einladung-werkausschuss-2026-10-16.html':['Einladung Sitzung Werkausschuss 16.10.2026',html('<p>Einladung zur Sitzung des Werkausschusses des Abwasserverbandes Oberdorf am 16.10.2026</p><p>Öffentlicher Teil</p><p>1. Gebührenkalkulation</p>')],
  'b/einladung-gemeinderat-unterdorf-2026-10-17.html':['Einladung Sitzung Gemeinderat Unterdorf 17.10.2026',html('<p>Einladung zur öffentlichen Sitzung des Gemeinderates Unterdorf am 17.10.2026</p><p>1. Spielplatz</p>')],
  'b/einladung-gemeinschaftsversammlung-2026-10-19.html':['Einladung Sitzung Gemeinschaftsversammlung 19.10.2026',html('<p>Einladung zur öffentlichen Sitzung der Gemeinschaftsversammlung am 19.10.2026</p><p>1. Stellenplan</p>')],
  'b/einladung-gemeinderat-2026-10-18.html':['Einladung Sitzung Gemeinderat 18.10.2026',html('<p>Einladung zur öffentlichen Sitzung des Gemeinderates Oberdorf am 18.10.2026</p><p>1. Dorfplatz</p>')],
 };
 const {d}=await run({source:oberdorf},listed(docs));
 assert.deepEqual(d.topics.map(t=>[t.committee,t.title]),[['Gemeinderat','Dorfplatz']]);
 assert.ok(d.coverage.issues.includes('Sitzung eines Gremiums einer anderen Gemeinde (Gemeinderat Unterdorf), nicht übernommen: '+base+'b/einladung-gemeinderat-unterdorf-2026-10-17.html'));
 // The area of an association has its assembly, not that of a special-purpose association.
 const {d:vg}=await run({source:{...oberdorf,name:'Verwaltungsgemeinschaft Oberdorf'}},listed(docs));
 assert.deepEqual(vg.topics.map(t=>t.title).sort(),['Dorfplatz','Spielplatz','Stellenplan']);
});

test('collectWebsite: a committee that approves or rejects recommends; the council decides',async()=>{
 const docs={'b/niederschrift-bauausschuss-2026-09-23.html':['Niederschrift Sitzung Bauausschuss 23.09.2026',html('<p>Niederschrift über die öffentliche Sitzung des Bauausschusses am 23.09.2026</p><p>1. Bauantrag Neubau Garage</p><p>Der Antrag wird abgelehnt.</p><p>2. Bauantrag Carport</p><p>Der Antrag wird angenommen.</p>')]};
 const {d}=await run({source:oberdorf},listed(docs));
 assert.deepEqual(d.topics.map(t=>[t.title,t.status,t.events[0].decision.kind]),[['Bauantrag Neubau Garage','recommended','recommendation'],['Bauantrag Carport','recommended','recommendation']]);
});

// A minimal PDF with one text line per row (Helvetica), as a PDF producer writes it.
function makePdf(pages){
 const objs=[],add=o=>objs.push(o);add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const kids=[],parent=2+pages.length*2;
 for(const rows of pages){const content=rows.map((l,i)=>`BT /F1 12 Tf 50 ${750-i*20} Td (${l}) Tj ET`).join('\n');add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);add(`<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 612 792] /Contents ${objs.length} 0 R /Resources << /Font << /F1 1 0 R >> >> >>`);kids.push(objs.length);}
 add(`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`);add(`<< /Type /Catalog /Pages ${objs.length} 0 R >>`);
 let out='%PDF-1.4\n';const at=[];objs.forEach((o,i)=>{at.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 const xref=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n${at.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objs.length+1} /Root ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return enc(out);
}

test('readPdfText reads a real PDF page by page and refuses more than 150 pages',async()=>{
 const text=await readPdfText(makePdf([['Einladung zur Sitzung des Gemeinderates','1. Bauantrag Scheune'],['N i c h t o e f f e n t l i c h e r   T e i l','2. Personalangelegenheit']]));
 assert.equal(text,'Einladung zur Sitzung des Gemeinderates\n1. Bauantrag Scheune\nN i c h t o e f f e n t l i c h e r T e i l\n2. Personalangelegenheit');
 await assert.rejects(readPdfText(makePdf(Array.from({length:151},(_,i)=>[`Seite ${i+1}`]))),/zu umfangreich/);
});

// --- hardening round 1 (texts NACHGEBILDET) ---------------------------------------------------------------------------
test('collectWebsite: minutes of a renumbered agenda join the item with the same plot number, not the one with the same number',async()=>{
 const docs={
  'b/einladung-gemeinderat-2026-09-16.html':['Einladung Sitzung Gemeinderat 16.09.2026',html('<p>Einladung zur öffentlichen Sitzung des Gemeinderates am 16.09.2026</p><p>1. Genehmigung der Niederschrift</p><p>2. Bauantrag Neubau eines Einfamilienhauses, Fl.Nr. 12, Gemarkung Oberdorf</p><p>3. Bauantrag Neubau eines Einfamilienhauses, Fl.Nr. 13, Gemarkung Oberdorf</p><p>4. Anfragen</p>')],
  'b/niederschrift-gemeinderat-2026-09-16.html':['Niederschrift Sitzung Gemeinderat 16.09.2026',html('<p>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</p><p>TOP 2 wurde abgesetzt; die folgenden Punkte wurden neu nummeriert.</p><p>1. Genehmigung der Niederschrift</p><p>Die Niederschrift wird genehmigt. Abstimmung: 12:0</p><p>2. Bauantrag Neubau eines Einfamilienhauses, Fl.Nr. 13, Gemarkung Oberdorf</p><p>Beschluss: Das gemeindliche Einvernehmen wird nicht erteilt. Abstimmung: 3:9</p>')],
 };
 const {d}=await run({source:oberdorf},listed(docs));
 const by=plot=>d.topics.find(t=>t.title.includes(`Fl.Nr. ${plot},`));
 assert.equal(by(12).status,'unknown','the outcome of Fl.Nr. 13 never lands on Fl.Nr. 12');
 assert.equal(by(13).status,'rejected');
 assert.equal(similarTitles('Bauantrag Einfamilienhaus, Fl.Nr. 12','Bauantrag Einfamilienhaus, Fl.Nr. 13'),false);
 assert.equal(similarTitles('Genehmigung der Niederschrift vom 15.07.2026','Genehmigung der Niederschrift'),true);
});

test('fetchSiteText refuses redirect targets that name the non-public part in any spelling or encoding',async()=>{
 for(const to of ['/protokolle/Protokoll_GR_2026-09-16_nicht%F6ffentlich.pdf','/protokolle/gr-2026-09-16-n.oeff.pdf','/protokolle/2026/geschlossen/gr-2026-09-16.pdf','/x/nichtoef/gr.pdf','/gr-2026-09-16-noeS.pdf','/gr-2026-09-16-nicht-oeffentlich.pdf']){
  const request=fakeFetch({[base+'a']:{status:302,headers:{location:to}},[new URL(to,base).href]:{body:'<p>geheim</p>',headers:{'content-type':'text/html'}}});
  await assert.rejects(fetchSiteText(base+'a',{base},5000,request),/nichtöffentlichen Teils/,to);
  assert.equal(request.seen.length,1,`${to} is never asked`);
 }
});

test('decodeText follows the bytes where answer and page name another charset',()=>{
 const page='<meta charset="iso-8859-1"><h2>Nichtöffentlicher Teil</h2>';
 assert.equal(decodeText(new TextEncoder().encode(page),'text/html'),page,'UTF-8 bytes declared as Latin-1');
 assert.equal(decodeText(Uint8Array.from([...page].map(c=>c.charCodeAt(0))),'text/html; charset=utf-8'),page,'Latin-1 bytes declared as UTF-8');
 assert.equal(decodeText(new TextEncoder().encode('Tagesordnung'),'text/html; charset=iso-8859-1'),'Tagesordnung');
});

test('collectWebsite takes a calendar entry only for the day of its DTSTART',async()=>{
 const ics=base+'veranstaltungen/kalender.ics',text='BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART;TZID=Europe/Berlin:20261014T190000\r\nSUMMARY:Öffentliche Sitzung des Gemeinderates am 07.10.2026\r\nDESCRIPTION:Tagesordnung:\\n1. Bauantrag Neubau Carport\\n2. Vergabe Straßenbeleuchtung\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
 const web=site({[ics]:text});
 const d=await collectWebsite({...oberdorf,pages:[],ics:[ics]},{now,window:'12m',get:web.get,getBytes:web.getBytes,pdfText});
 assert.deepEqual(d.topics.map(t=>t.eventDate),[]);
 assert.ok(d.coverage.issues.some(i=>/Kalendereintrag nennt einen anderen Sitzungstag/.test(i)));
});

test('collectWebsite leaves out meetings of another member municipality, an Amt, a Verbandsgemeinde, a county or a Zweckverband named above the head',async()=>{
 const text=`Mitteilungsblatt der Verwaltungsgemeinschaft Oberland Nr. 20/2026
Gemeinde Oberdorf
Am Dienstag, 14.10.2026, 19.30 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Bauantrag Neubau Scheune
Nichtöffentlicher Teil
2. Grundstücksangelegenheit
Gemeinde Unterdorf
Am Donnerstag, 16.10.2026, 20.00 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.
Tagesordnung
1. Feuerwehrbedarfsplan Unterdorf
Zweckverband Wasserversorgung Oberland
Am Dienstag, 20.10.2026, 18.00 Uhr, findet eine öffentliche Sitzung des Werkausschusses statt.
Öffentlicher Teil
1. Jahresabschluss 2025`;
 const {d}=await run({source:oberdorf,pdfText:async()=>text},listed({'b/mitteilungsblatt-2026-20.pdf':['Mitteilungsblatt Nr. 20/2026 – Sitzungen',pdf('vg')]}));
 assert.deepEqual(d.topics.map(t=>[t.eventDate,t.committee,t.title]),[['2026-10-14','Gemeinderat','Bauantrag Neubau Scheune']]);
});

test('standard rule: robotsGate asks nothing and opens every address',()=>standardRule(async()=>{
 const asked=[];const allows=await robotsGate(async url=>{asked.push(url);return 'User-agent: *\nDisallow: /\n';},{base});
 assert.equal(await allows(base+'gesperrt/a.pdf'),true);assert.equal(await allows('https://archiv.musterbach.example.test/x.pdf'),true);
 assert.deepEqual(asked,[]);assert.deepEqual(allows.issues,[]);
}));

test('standard rule: collectWebsite reads what robots.txt excludes, never the non-public part, the search or a foreign host',()=>standardRule(async()=>{
 const {web:{calls},d}=await run();
 assert.ok(!calls.some(u=>u.endsWith('robots.txt')),'robots.txt is recorded by robots.mjs, not asked by the reader');
 assert.ok(calls.includes(U.robots),'a path robots.txt excludes is read');
 for(const url of [U.closed,U.publisher,U.old,U.waste,U.job,base+'suche?q=Gemeinderat',base+'impressum.html'])assert.ok(!calls.includes(url),'never read: '+url);
 assert.ok(calls.every(u=>u.startsWith(base)),'only the site itself');
 assert.ok(!calls.some(u=>/[?&](?:search|q|s)=/.test(u)),'the search of the site is never used');
 assert.ok(!d.coverage.issues.some(i=>/robots\.txt/.test(i))&&!(d.coverage.warnings||[]).some(w=>/robots\.txt/.test(w)));
}));

test('standard rule: HTTP 403 stays final; the origin is not asked again in this import',()=>standardRule(async()=>{
 const refused=new Error('Quelle antwortet mit HTTP 403');
 const web=site({[base+'rathaus/bekanntmachungen/']:refused,[base+'aktuelles/feed.rss']:refused,[base+'veranstaltungen/kalender.ics']:refused,[wp.posts]:refused,[wp.media]:refused,[base+'sitemap.xml']:refused});
 const {d}=await run({},web);
 const first=web.calls.findIndex(u=>u.startsWith(base));
 assert.ok(first>=0);
 // At most the requests already under way when the first refusal came (two per server); none after them.
 assert.ok(web.calls.length<=2,'no request after the refusal: '+web.calls.join(', '));
 assert.equal(d.topics.length,0);assert.equal(d.coverage.complete,false);
 assert.ok(d.coverage.issues.some(i=>/HTTP 403/.test(i)));
}));

test('the file storage of a website CMS is read only where the entry names it; other hosts stay foreign',()=>{
 // Websites of verwaltungsportal.de link their notices as PDF on daten2.verwaltungsportal.de (www.lychen.de, 05.10.2026).
 const s={base:'https://www.lychen.de/',alsoFrom:['https://daten2.verwaltungsportal.de','https://www.elsewhere.example.test']};
 assert.equal(siteAllowed('https://daten2.verwaltungsportal.de/dateien/seitengenerator/abc/Einladung.pdf',s),'https://daten2.verwaltungsportal.de/dateien/seitengenerator/abc/Einladung.pdf');
 for(const url of ['https://www.elsewhere.example.test/a.pdf','https://daten2.verwaltungsportal.de.example.test/a.pdf','http://daten2.verwaltungsportal.de/a.pdf'])assert.throws(()=>siteAllowed(url,s),/Nicht freigegebene/,url);
 assert.throws(()=>siteAllowed('https://daten2.verwaltungsportal.de/a.pdf',{base:'https://www.lychen.de/'}),/Nicht freigegebene/,'not without alsoFrom');
});
