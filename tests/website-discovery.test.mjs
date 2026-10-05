import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {registrableDomain,sameSite,isRisLink,serverGate,readerFetch,robotsRefused,navScore,navLinks,listKey,pickListPages,orderSitemaps,sessionUrls,sitemapPages,selectAreas,sitesOf,expectNames,buildSource,hasMaterial,checkOf,isAccepted,acceptedEntry,reasonOf,bestReason,cmsOf,summary,REASONS,API_CHECK,MIN_LIST_SCORE} from '../scripts/source-discovery/website-plan.mjs';
// Nachgebildete Startseite (nicht live): Gemeinde Musterdorf unter erfundenen Adressen *.example.test, mit Navigation,
// einem Link auf ein RIS (auf eigener Unterdomain und im eigenen Pfad), einem Verlag, einer Amtsblatt-Unterdomain und
// Seiten, die nie gefolgt werden (nichtöffentlich, Stellen, Abfall, Impressum, Suche).
const home=readFileSync(new URL('./fixtures/website/discovery-home.html',import.meta.url),'utf8');
const site='https://www.gemeinde-musterdorf.example.test/',host='www.gemeinde-musterdorf.example.test',at=path=>'https://www.gemeinde-musterdorf.example.test'+path;
const area={id:'de-09999001',name:'Gemeinde Musterdorf a.d.Beispiel',shortName:'Musterdorf a.d.Beispiel',kind:'city',ags:'09999001'};
const union={id:'nds-039999401',name:'Samtgemeinde Beispielheide',shortName:'Beispielheide',kind:'city',ags:'039999401',members:[{ags:'03999001',name:'Ahlheim (Aller)'},{ags:'03999002',name:'Beispielheide'},{ags:'03999003',name:'Cedorf'}]};

test('website search: the website is the start host family on one registrable domain; RIS addresses are never followed',()=>{
 assert.equal(registrableDomain('www.gemeinde-musterdorf.de'),'gemeinde-musterdorf.de');
 assert.equal(registrableDomain('Amtsblatt.Musterdorf.DE.'),'musterdorf.de');
 // www, bare host, subdomain and parent belong to the site; a sibling under a shared domain, another domain and
 // addresses with credentials or other schemes do not.
 assert.ok(sameSite(at('/rathaus/'),host));
 assert.ok(sameSite('http://gemeinde-musterdorf.example.test/',host));
 assert.ok(sameSite('https://amtsblatt.gemeinde-musterdorf.example.test/a.pdf',host));
 assert.ok(sameSite('https://vg-beispiel.example.test/bekanntmachungen/','gemeinde-a.vg-beispiel.example.test'));
 assert.ok(!sameSite('https://gemeinde-b.vg-beispiel.example.test/','gemeinde-a.vg-beispiel.example.test'));
 assert.ok(!sameSite('https://www.verlag.example.test/musterdorf/',host));
 assert.ok(!sameSite('https://user:pw@www.gemeinde-musterdorf.example.test/',host));
 assert.ok(!sameSite('ftp://www.gemeinde-musterdorf.example.test/',host));
 assert.ok(!sameSite('kein Link',host));
 for(const u of ['https://ratsinfo.gemeinde-musterdorf.example.test/','https://buergerinfo.musterdorf.example.test/bi/si0040.asp',at('/buergerinfo/si0040.php'),at('/sessionnet/bi/'),at('/allris/public/si010'),'https://sdnet.musterdorf.example.test/',at('/ris/oparl/system'),'https://musterdorf.gremien.info/','https://ris.musterdorf.example.test/',at('/bi/to0040.asp?SILFDNR=1'),'kein Link'])assert.ok(isRisLink(u),u);
 for(const u of [at('/rathaus/bekanntmachungen/'),at('/politik/gemeinderat/sitzungen/'),at('/amtsblatt/2026/'),'https://amtsblatt.gemeinde-musterdorf.example.test/ausgaben/',at('/bildung/bibliothek/')])assert.ok(!isRisLink(u),u);
});

test('website search: navigation is scored by its words; non-public, noise, services and single dated notices are not followed',()=>{
 const score=(path,label)=>navScore({url:at(path),label});
 assert.ok(score('/politik/sitzungstermine/','Sitzungstermine')>score('/rathaus/','Rathaus'));
 assert.ok(score('/rathaus/bekanntmachungen/','Öffentliche Bekanntmachungen')>score('/aktuelles/','Aktuelles'));
 assert.ok(score('/politik/gemeinderat/','Gemeinderat')>=5);
 assert.ok(score('/politik/','Politik')>score('/rathaus/','Rathaus'));
 assert.equal(score('/rathaus/','Rathaus'),1);
 assert.equal(score('/freizeit/','Freizeit & Tourismus'),0);
 assert.equal(score('/politik/nichtoeffentliche-sitzungen/','Nichtöffentliche Sitzungen'),-100);
 assert.equal(score('/rathaus/stellenangebote/','Stellenangebote'),0);
 assert.equal(score('/service/abfallkalender/','Abfallkalender'),0);
 assert.equal(score('/impressum/','Impressum'),0);
 assert.equal(score('/suche/?q=gemeinderat','Suche Gemeinderat'),0);
 assert.equal(score('/index.php?id=4&tx_kesearch_pi1[sword]=sitzung','Sitzung'),0);
 assert.equal(score('/bekanntmachungen/einladung.pdf','Einladung Gemeinderat'),0);
 assert.equal(navScore({url:'https://ratsinfo.gemeinde-musterdorf.example.test/',label:'Sitzungskalender'}),0);
 assert.equal(navScore({}),0);
 // A dated notice is a document, not a list: the page linking it is what the search wants.
 assert.equal(score('/rathaus/bekanntmachungen/einladung-gemeinderat-14-10-2026.html','Einladung zur Sitzung des Gemeinderates am 14.10.2026'),1);
});

test('website search: links of the mocked start page, best first, on the website only and never into an RIS',()=>{
 const links=navLinks(home,site,host),urls=links.map(l=>l.url);
 assert.deepEqual(urls.slice(0,3),['http://www.gemeinde-musterdorf.example.test/politik/sitzungstermine/',at('/rathaus/bekanntmachungen/'),at('/politik/gemeinderat/')]);
 assert.ok(urls.includes('https://amtsblatt.gemeinde-musterdorf.example.test/ausgaben/'));
 for(const not of ['https://www.verlag.example.test/musterdorf/','https://ratsinfo.gemeinde-musterdorf.example.test/bi/si0040.asp',at('/buergerinfo/si0040.php'),at('/politik/nichtoeffentliche-sitzungen/'),at('/rathaus/stellenangebote/'),at('/service/abfallkalender/'),at('/impressum/'),at('/freizeit/'),at('/rathaus/bekanntmachungen/haushaltssatzung-2026.pdf')])assert.ok(!urls.includes(not),not);
 assert.ok(links.every(l=>l.score>0));
 assert.deepEqual(links.map(l=>l.score),[...links.map(l=>l.score)].sort((a,b)=>b-a));
});

test('website search: list pages are chosen by score, one per list, never non-public or RIS, at most five',()=>{
 assert.equal(listKey(at('/bekanntmachungen/page/2/')),listKey(at('/bekanntmachungen/')));
 assert.equal(listKey(at('/bekanntmachungen/index.php?seite=3')),listKey(at('/bekanntmachungen/')));
 assert.equal(listKey(at('/news.html?tx_news_pi1[@widget_0][currentPage]=2&cat=4')),listKey(at('/news.html?cat=4')));
 assert.notEqual(listKey(at('/news.html?cat=4')),listKey(at('/news.html?cat=5')));
 const scored=[
  {url:at('/rathaus/bekanntmachungen/'),score:9},{url:at('/rathaus/bekanntmachungen/page/2/'),score:11},
  {url:at('/politik/gemeinderat/'),score:6},{url:at('/politik/nicht-oeffentliche-beschluesse/'),score:20},
  {url:'https://ratsinfo.gemeinde-musterdorf.example.test/bi/si0040.asp',score:30},{url:at('/'),score:MIN_LIST_SCORE},
  {url:at('/aktuelles/'),score:MIN_LIST_SCORE-1},{url:at('/amtsblatt/'),score:4},{url:at('/sitzungsberichte/'),score:5},{url:at('/termine/'),score:3},{score:9},null];
 // The following page scored higher, the list is taken once with the higher score.
 assert.deepEqual(pickListPages(scored),[at('/rathaus/bekanntmachungen/page/2/'),at('/politik/gemeinderat/'),at('/sitzungsberichte/'),at('/amtsblatt/'),at('/')]);
 assert.deepEqual(pickListPages(scored,{max:2}),[at('/rathaus/bekanntmachungen/page/2/'),at('/politik/gemeinderat/')]);
 assert.deepEqual(pickListPages([{url:at('/a/'),score:2}]),[]);
 assert.deepEqual(pickListPages(undefined),[]);
});

test('website search: sitemaps are read with their meeting and news parts first; their addresses become candidates',()=>{
 assert.deepEqual(orderSitemaps([at('/sitemap-produkte.xml'),at('/sitemap-seiten.xml'),at('/sitemap-bekanntmachungen.xml'),at('/sitemap-news.xml'),at('/sitemap-seiten.xml')]),
  [at('/sitemap-bekanntmachungen.xml'),at('/sitemap-news.xml'),at('/sitemap-produkte.xml'),at('/sitemap-seiten.xml')]);
 const urls=[{url:at('/rathaus/bekanntmachungen/'),lastmod:'2026-09-01'},{url:at('/politik/sitzungen/einladung-gemeinderat-2026-10-14.pdf'),lastmod:null},{url:at('/politik/sitzung-gemeinderat-2026-09-16-niederschrift/'),lastmod:'2026-09-20'},
  {url:at('/politik/nichtoeffentliche-sitzung-2026-09-16/'),lastmod:null},{url:at('/freizeit/kirchweih/'),lastmod:null},{url:'https://www.verlag.example.test/einladung-sitzung-gemeinderat.pdf',lastmod:null},{url:at('/politik/gemeinderat/'),lastmod:'2026-08-01'}];
 // The site filter is the caller's (website.mjs keeps only addresses of the website).
 assert.deepEqual(sessionUrls(urls),[at('/politik/sitzungen/einladung-gemeinderat-2026-10-14.pdf'),at('/politik/sitzung-gemeinderat-2026-09-16-niederschrift/'),'https://www.verlag.example.test/einladung-sitzung-gemeinderat.pdf']);
 assert.deepEqual(sessionUrls([at('/politik/sitzungen/')]),[]);
 assert.deepEqual(sessionUrls([at('/einladung-gemeinderatssitzung.html')]),[at('/einladung-gemeinderatssitzung.html')]);
 const pages=sitemapPages(urls,host);
 // Equal scores: the newer lastmod first. Dated documents, PDF, the non-public page and other hosts are no list pages.
 assert.deepEqual(pages.map(p=>p.url),[at('/rathaus/bekanntmachungen/'),at('/politik/gemeinderat/')]);
 assert.ok(pages.every(p=>p.score>=3&&p.label===''));
 assert.equal(sitemapPages(urls,host,1).length,1);
});

test('website search: areas are those without connected source and not yet checked; named ones and REASONS narrow',()=>{
 const areas=[{id:'a'},{id:'b'},{id:'c'},{id:'d'},{id:'berlin'}];
 const skip=a=>a.id==='berlin'?'Stadtstaat':null,connected=new Set(['a']),done={c:{id:'c'}};
 const open=new Map([['b','Auf der offiziellen Website kein Link zu einem Ratsinformationssystem gefunden'],['c','Kein unterstütztes Ratsinformationssystem erkannt'],['d','robots.txt des gefundenen Systems untersagt Programmen den Abruf; Freigabe beim Betreiber anfragen']]);
 const ids=o=>selectAreas(areas,{connected,done,skip,...o}).map(a=>a.id);
 assert.deepEqual(ids({}),['b','d']);
 // Named areas are checked again, also checked ones; a city state never.
 assert.deepEqual(ids({only:new Set(['c','berlin'])}),['c']);
 assert.deepEqual(ids({reasons:/kein Link|Kein unterstütztes/i,open}),['b']);
 assert.deepEqual(ids({reasons:/robots/,open}),['d']);
 assert.deepEqual(ids({only:new Set(['c','d']),reasons:/Kein unterstütztes/,open}),['c']);
 assert.deepEqual(selectAreas(undefined),[]);
});

test('website search: websites from Wikidata, for an association without one those of its members (named member first, at most three)',()=>{
 const wikidata=[{kind:'city',ags:'09999001',website:'https://www.gemeinde-musterdorf.example.test/'},{kind:'city',ags:'09999001',website:'https://www.gemeinde-musterdorf.example.test/'},{kind:'district',ags:'09999001',website:'https://kreis.example.test/'},
  {kind:'city',ags:'03999001',website:'https://ahlheim.example.test/'},{kind:'city',ags:'03999002',website:'https://beispielheide.example.test/'},{kind:'city',ags:'03999003',website:'https://cedorf.example.test/'},{kind:'city',ags:'03999004',website:'https://dorf.example.test/'}];
 assert.deepEqual(sitesOf(area,wikidata),['https://www.gemeinde-musterdorf.example.test/']);
 assert.deepEqual(sitesOf(union,wikidata),['https://beispielheide.example.test/','https://ahlheim.example.test/','https://cedorf.example.test/']);
 assert.deepEqual(sitesOf({...union,members:[...union.members,{ags:'03999004',name:'Dorf'}]},wikidata).length,3);
 assert.deepEqual(sitesOf({id:'x',kind:'city',ags:'00000000'},wikidata),[]);
});

test('website search: expected names are full and short name, both without addition, and the members',()=>{
 assert.deepEqual(expectNames(area),['Gemeinde Musterdorf a.d.Beispiel','Gemeinde Musterdorf','Musterdorf a.d.Beispiel','Musterdorf']);
 assert.deepEqual(expectNames(union),['Samtgemeinde Beispielheide','Beispielheide','Ahlheim (Aller)','Ahlheim','Cedorf']);
 assert.deepEqual(expectNames({name:'Stadt Lahr/Schwarzwald',shortName:'Lahr/Schwarzwald'}),['Stadt Lahr/Schwarzwald','Stadt Lahr','Lahr/Schwarzwald','Lahr']);
 assert.deepEqual(expectNames({name:'Landkreis Beispiel',shortName:'Beispiel'}),['Landkreis Beispiel','Beispiel']);
 assert.deepEqual(expectNames(null),[]);
});

test('website search: the catalog entry carries only what was found, on the website family and over https',()=>{
 const source=buildSource({area,base:at('/startseite/'),
  pages:[at('/rathaus/bekanntmachungen/'),at('/rathaus/bekanntmachungen/'),'https://amtsblatt.gemeinde-musterdorf.example.test/ausgaben/','http://www.gemeinde-musterdorf.example.test/alt/','https://www.verlag.example.test/musterdorf/','https://nachbar.example.test/'],
  feeds:[at('/aktuelles/rss.xml')],ics:[],wp:'https://gemeinde-musterdorf.example.test/wp-json/',sitemap:[at('/sitemap-bekanntmachungen.xml'),at('/sitemap-news.xml')]});
 assert.deepEqual(source,{id:area.id,name:area.name,kind:'city',method:'scraper',adapter:'website',base:at('/'),
  pages:[at('/rathaus/bekanntmachungen/'),'https://amtsblatt.gemeinde-musterdorf.example.test/ausgaben/'],feeds:[at('/aktuelles/rss.xml')],
  wp:'https://gemeinde-musterdorf.example.test/wp-json/',sitemap:at('/sitemap-bekanntmachungen.xml'),
  alsoFrom:['https://amtsblatt.gemeinde-musterdorf.example.test','https://gemeinde-musterdorf.example.test']});
 assert.ok(hasMaterial(source));
 const bare=buildSource({area,base:site,pages:[],sitemap:'https://www.verlag.example.test/sitemap.xml',wp:'https://www.verlag.example.test/wp-json/'});
 assert.deepEqual(bare,{id:area.id,name:area.name,kind:'city',method:'scraper',adapter:'website',base:site,pages:[]});
 assert.ok(!hasMaterial(bare));
 assert.ok(hasMaterial({...bare,ics:[at('/termine.ics')]}));
 assert.ok(!hasMaterial(null));
});

test('website search: a check is taken only with public items that name the area; the entry records the evidence',()=>{
 // Coverage as the reader gives it: unparsed and unreadable as lists of addresses, namesArea only with expected names.
 const result={topics:[{id:1},{id:2},{id:3}],coverage:{meetings:2,documents:4,namesArea:true,unparsed:[at('/a.pdf')],unreadable:[],issues:['a','a','b']}};
 const check=checkOf(result);
 assert.deepEqual(check,{topics:3,meetings:2,documents:4,namesArea:true,unparsed:1,unreadable:0,issues:['a','b']});
 assert.ok(isAccepted(check));
 assert.ok(!isAccepted(checkOf({topics:[{id:1}],coverage:{meetings:1}})));
 assert.ok(!isAccepted(checkOf({topics:[],coverage:{namesArea:true}})));
 assert.ok(!isAccepted(null));
 assert.deepEqual(checkOf(undefined),{topics:0,meetings:0,documents:0,namesArea:false,unparsed:0,unreadable:0,issues:[]});
 const source=buildSource({area,base:site,pages:[at('/rathaus/bekanntmachungen/')]});
 assert.deepEqual(acceptedEntry(source,{website:'http://www.gemeinde-musterdorf.example.test',today:'2026-10-04',window:'3m',check}),{...source,verifiedSource:'http://www.gemeinde-musterdorf.example.test',verifiedAt:'2026-10-04',apiCheck:API_CHECK,evidence:{window:'3m',topics:3,meetings:2,documents:4}});
 assert.equal(API_CHECK,'Kein Ratsinformationssystem angebunden; öffentliche Bekanntmachungen der offiziellen Website.');
});

test('website search: reasons follow the furthest step reached; the best of several websites wins',()=>{
 const ok={topics:2,namesArea:true,unparsed:0,unreadable:0};
 assert.equal(reasonOf({robots:'verboten',status:0}),REASONS.robots);
 assert.equal(reasonOf({status:403}),REASONS.forbidden);
 assert.equal(reasonOf({status:429}),REASONS.unreachable+' (HTTP 429)');
 assert.equal(reasonOf({robots:'unklar',status:0}),REASONS.unreachable+' (robots.txt ohne Antwort)');
 assert.equal(reasonOf({status:0}),REASONS.unreachable);
 assert.equal(reasonOf({}),REASONS.unreachable);
 assert.equal(reasonOf({status:200,found:false}),REASONS.nothing);
 assert.equal(reasonOf({status:200,found:true,check:ok}),null);
 assert.equal(reasonOf({status:200,found:true,check:{...ok,namesArea:false}}),REASONS.foreign);
 assert.equal(reasonOf({status:200,found:true,check:{topics:0,namesArea:true,unparsed:3,unreadable:1}}),REASONS.unreadable+' (3 ohne erkennbaren öffentlichen Teil, 1 nicht lesbar)');
 assert.match(reasonOf({status:200,found:true,error:'Zeitlimit überschritten'}),/^Bekanntmachungen gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar \(Leser brach ab: Zeitlimit/);
 assert.equal(bestReason([REASONS.unreachable,REASONS.unreadable+' (1 ohne erkennbaren öffentlichen Teil, 0 nicht lesbar)',REASONS.nothing]),REASONS.unreadable+' (1 ohne erkennbaren öffentlichen Teil, 0 nicht lesbar)');
 assert.equal(bestReason([REASONS.robots,REASONS.forbidden]),REASONS.forbidden);
 assert.equal(bestReason([null,REASONS.foreign,REASONS.nothing]),REASONS.foreign);
 assert.equal(bestReason([]),null);
 // The six reasons of the task, word for word.
 assert.deepEqual(Object.values(REASONS),['robots.txt der Website untersagt Programmen den Abruf','Website antwortet Programmen mit HTTP 403','Website nicht erreichbar','Keine Seite mit Sitzungsbekanntmachungen gefunden','Bekanntmachungen gefunden, aber keine öffentlichen Tagesordnungspunkte lesbar','Gefundene Bekanntmachungen nennen das Gebiet nicht']);
});

test('website search: the summary counts reasons without their brackets and names the content management systems',()=>{
 assert.equal(cmsOf('TYPO3 CMS'),'TYPO3');
 assert.equal(cmsOf('WordPress 6.6.2'),'WordPress');
 assert.equal(cmsOf('Contao Open Source CMS'),'Contao');
 assert.equal(cmsOf('Joomla! - Open Source Content Management'),'Joomla');
 assert.equal(cmsOf('IKISS (advantic)'),'IKISS');
 assert.equal(cmsOf('Weblication® CMS'),'Weblication');
 assert.equal(cmsOf('Musterbaukasten 3.1'),'Musterbaukasten');
 assert.equal(cmsOf(''),null);
 const rows={a:{accepted:{}},b:{reason:REASONS.nothing},c:{reason:REASONS.unreadable+' (1 ohne erkennbaren öffentlichen Teil, 0 nicht lesbar)'},d:{reason:REASONS.unreadable+' (2 ohne erkennbaren öffentlichen Teil, 1 nicht lesbar)'}};
 const candidates={a:{found:[{generator:'TYPO3 CMS'},{generator:null}]},b:{found:[{generator:'WordPress 6.5'}]},c:{found:[{generator:'TYPO3 CMS - OpenSource'}]},d:{found:[]}};
 assert.deepEqual(summary(rows,candidates),{areas:4,accepted:1,reasons:[[REASONS.unreadable,2],[REASONS.nothing,1]],cms:[['TYPO3',2],['WordPress',1]]});
 assert.deepEqual(summary(undefined,undefined),{areas:0,accepted:0,reasons:[],cms:[]});
});

test('website search: the plan module touches neither network nor files, and the script parses',()=>{
 const source=readFileSync(new URL('../scripts/source-discovery/website-plan.mjs',import.meta.url),'utf8');
 assert.deepEqual([...source.matchAll(/^import\s.*from\s+'([^']+)'/gm)].map(m=>m[1]),['../../server/integrations/website-feeds.mjs']);
 assert.doesNotMatch(source,/\bfetch\s*\(|node:|readFileSync|writeFileSync|process\.env/);
 const feeds=readFileSync(new URL('../server/integrations/website-feeds.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(feeds,/^import\s/m);
 // Syntax check only: the script itself reads files and asks the network, so it is not run.
 execFileSync(process.execPath,['--check',fileURLToPath(new URL('../scripts/source-discovery/website.mjs',import.meta.url))]);
});

test('website search: the reader check asks request by request with the consideration of the search (two per server, one second apart)',async()=>{
 const starts=[];let active=0,most=0;
 const withHost=serverGate({perServer:2,gap:40,keysOf:async url=>['domain:'+registrableDomain(new URL(url).hostname),'ip:192.0.2.1']});
 const request=async(url,init)=>{starts.push({at:Date.now(),ua:init.headers['User-Agent']});active++;most=Math.max(most,active);await new Promise(d=>setTimeout(d,15));active--;return new Response(url.endsWith('/x403')?'':'ok',{status:url.endsWith('/x403')?403:200});};
 const blocked=new Map(),ask=readerFetch({withHost,blocked,userAgent:'Ratsmonitor-SourceCatalog/1.0 (test)',request});
 await Promise.all(Array.from({length:5},(_,i)=>ask(at(`/b/${i}.html`),{redirect:'manual',headers:{'User-Agent':'VorOrt-PoliticalTopics/0.5',Accept:'text/html'}})));
 assert.ok(most<=2);
 const at0=[...starts].sort((a,b)=>a.at-b.at),gaps=at0.slice(1).map((s,i)=>s.at-at0[i].at);assert.ok(gaps.every(g=>g>=39),gaps.join());
 assert.ok(starts.every(s=>s.ua==='Ratsmonitor-SourceCatalog/1.0 (test)'),'the identity of the search, not that of the import');
 // An answer 403 closes the origin; an RIS address is never asked.
 assert.equal((await ask(at('/x403'))).status,403);
 const before=starts.length;assert.equal((await ask(at('/b/later.html'))).status,403);assert.equal(starts.length,before,'no request after 403');
 await assert.rejects(ask('https://www.anderer-ort.example.test/buergerinfo/to0040.asp?__ksinr=1'),/Ratsinformationssystems/);
 assert.equal(robotsRefused(429),true);assert.equal(robotsRefused(404),false);
});

test('website search: the CMS file storage that the list pages link goes into alsoFrom, other foreign hosts do not',()=>{
 const s=buildSource({area,base:site,pages:[at('/seite/1/bekanntmachungen.html')],files:['https://daten2.verwaltungsportal.de/dateien/seitengenerator/abc/Einladung.pdf','https://www.amtsblatt-verlag.example.test/a.pdf']});
 assert.deepEqual(s.alsoFrom,['https://daten2.verwaltungsportal.de']);
 assert.equal(buildSource({area,base:site,pages:[at('/seite/1/bekanntmachungen.html')]}).alsoFrom,undefined);
});
