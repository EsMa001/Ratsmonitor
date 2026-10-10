import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CRAWL_SKIP,SERVICE,TRANSLATED,unwrapLink,followUpsAfterFailure,RUBIN_HOST,MEMBERS_AREA,publicSiblings,publicHosts,PUBLIC_HOST_LABELS,rankCandidates,PUBLIC_TEXT,STRONG_RIS,hrefs,allrisBases,allrisGeneration,allris3Siblings,ALLRIS3_PUBLIC_FOLDERS,identity,HOSTED,pageNamesArea,anchors,sharedBodies,nameTwins,namesDistinctly,platformLands} from '../scripts/source-discovery/rules.mjs';
import {foreignOwner,aliasInAddress,nameParts,ALIASES,addressNames} from '../scripts/source-discovery/areas.mjs';
import {CATALOG} from '../shared/catalog.mjs';
const area=id=>CATALOG.find(a=>a.id===id);
const fixture=name=>readFileSync(new URL('./fixtures/allris3/'+name,import.meta.url),'utf8');
const source=name=>readFileSync(new URL('../scripts/source-discovery/'+name,import.meta.url),'utf8');

test('directories, read-aloud and sharing services are no candidates; council systems are',()=>{
 for(const url of ['https://www.findcity.de/?id=12345','https://findcity.de/stadt/ratsinfo','https://app-eu.readspeaker.com/cgi-bin/rsent?url=x','https://www.xing.com/spi/shares/new?url=x','https://total-lokal.de/city/x'])assert.match(url,CRAWL_SKIP,url);
 for(const url of ['https://www.findcity.de/?id=12345','https://app-eu.readspeaker.com/cgi-bin/rsent?url=x','https://x.com/intent/tweet?url=x'])assert.match(url,SERVICE,url);
 for(const url of ['https://ratsinfo.kreis-lb.de/','https://www.heppenheim.de/sessionnet/','https://vg-wittlich.gremien.info/']){assert.doesNotMatch(url,CRAWL_SKIP,url);assert.doesNotMatch(url,SERVICE,url);}
});

test('a read-aloud link carries the page of the website it reads',()=>{
 const enz='https://app-eu.readspeaker.com/cgi-bin/rsent?customerid=5069&lang=de_de&readid=readthis&url=https%3A%2F%2Fwww.enzkreis.de%2F%2FEnzkreis-digital%2FRatsinfosystem%2F';
 assert.equal(unwrapLink(enz,'enzkreis.de'),'https://www.enzkreis.de//Enzkreis-digital/Ratsinfosystem/');
 assert.equal(unwrapLink(enz,'www.enzkreis.de'),'https://www.enzkreis.de//Enzkreis-digital/Ratsinfosystem/');
 // A subdomain of the website is the website as well (an RIS on its own host name becomes an ordinary candidate).
 assert.equal(unwrapLink('https://app-eu.readspeaker.com/cgi-bin/rsent?url=https%3A%2F%2Fratsinfo.kreis-freising.de%2Fbi%2F%23top','kreis-freising.de'),'https://ratsinfo.kreis-freising.de/bi/');
});

test('sharing links carry the address of the page; only an address of the area\'s own website counts',()=>{
 assert.equal(unwrapLink('https://x.com/intent/tweet?text=Sitzung&url=https%3A%2F%2Fwww.landkreis-guenzburg.de%2Fsitzungskalender%2F','www.landkreis-guenzburg.de'),'https://www.landkreis-guenzburg.de/sitzungskalender/');
 assert.equal(unwrapLink('https://www.xing.com/spi/shares/new?url=https://www.beispielstadt.de/politik/','beispielstadt.de'),'https://www.beispielstadt.de/politik/');
 assert.equal(unwrapLink('https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fbeispielstadt.de%2Frat%2F','beispielstadt.de'),'https://beispielstadt.de/rat/');
 // Another domain is no evidence of what the area links: a neighbour, a portal, the service itself.
 assert.equal(unwrapLink('https://x.com/intent/tweet?url=https%3A%2F%2Fwww.nachbarort.de%2Fbi%2F','beispielstadt.de'),null);
 assert.equal(unwrapLink('https://www.xing.com/spi/shares/new?url=https%3A%2F%2Fx.com%2Fintent%2Ftweet%3Furl%3Dhttps%3A%2F%2Fbeispielstadt.de%2F','x.com'),null);
});

test('no address is taken from other links, without a website, or from other protocols',()=>{
 assert.equal(unwrapLink('https://www.beispielstadt.de/redirect.php?url=https://www.beispielstadt.de/bi/','beispielstadt.de'),null);
 assert.equal(unwrapLink('https://x.com/intent/tweet?url=https%3A%2F%2Fbeispielstadt.de%2F',''),null);
 assert.equal(unwrapLink('https://x.com/intent/tweet?url=javascript%3Aalert(1)','beispielstadt.de'),null);
 assert.equal(unwrapLink('https://x.com/intent/tweet?url=https%3A%2F%2Fuser%3Apw%40beispielstadt.de%2F','beispielstadt.de'),null);
 assert.equal(unwrapLink('https://app-eu.readspeaker.com/cgi-bin/rsent?customerid=1','beispielstadt.de'),null);
 assert.equal(unwrapLink('kein Verweis','beispielstadt.de'),null);
});

test('a SessionNet folder that answers 404 is looked for next to it',()=>{
 assert.deepEqual(followUpsAfterFailure('https://www.heppenheim.de/sessionnet/',{status:404}),{nearby:true,root:null});
 assert.deepEqual(followUpsAfterFailure('https://www.parsberg.de/sessionnet/bi/',{status:404}),{nearby:true,root:null});
 assert.deepEqual(followUpsAfterFailure('https://session.engen.de/buergerinfo/',{status:404}),{nearby:true,root:null});
 // A SessionNet host name counts without a folder.
 assert.deepEqual(followUpsAfterFailure('https://sitzungsdienst.example.de/start/',{status:404}),{nearby:true,root:null});
});

test('after a time limit, a network error or a broken redirect chain as well',()=>{
 assert.equal(followUpsAfterFailure('https://triberg-sitzungsdienst.komm.one/bi/',{status:0,error:'The operation was aborted due to timeout'}).nearby,true);
 assert.equal(followUpsAfterFailure('https://www.vgrd.de/sessionnet/',{status:0,error:'fetch failed'}).nearby,true);
 assert.equal(followUpsAfterFailure('https://buergerinfo.example.de/',{status:302,error:'zu viele Weiterleitungen'}).nearby,true);
});

test('never after 401 or 403: a refusal is not worked around',()=>{
 for(const status of [401,403])for(const url of ['https://www.heppenheim.de/sessionnet/','https://triberg-sitzungsdienst.komm.one/bi/','https://ratsinfo.example.de/','https://muenchen.gremien.info/users'])assert.deepEqual(followUpsAfterFailure(url,{status}),{nearby:false,root:null},status+' '+url);
});

test('never when robots.txt disallows the address or a redirect target',()=>{
 const refusal={status:0,url:'https://www.heppenheim.de/sessionnet/bi/',error:'robots.txt untersagt die Weiterleitungsadresse',robots:'verboten'};
 assert.deepEqual(followUpsAfterFailure('https://www.heppenheim.de/sessionnet/',refusal),{nearby:false,root:null});
 assert.deepEqual(followUpsAfterFailure('https://vg-x.gremien.info/users',refusal),{nearby:false,root:null});
 assert.deepEqual(followUpsAfterFailure('https://ratsinfo.example.de/',{status:0,error:'robots.txt untersagt den Pfad'}),{nearby:false,root:null});
});

test('other failures and other systems get no search next to them',()=>{
 // A server error or a rate limit says the system is there and busy; a page of the website is no SessionNet folder.
 assert.equal(followUpsAfterFailure('https://www.heppenheim.de/sessionnet/',{status:500}).nearby,false);
 assert.equal(followUpsAfterFailure('https://www.heppenheim.de/sessionnet/',{status:429}).nearby,false);
 assert.equal(followUpsAfterFailure('https://www.beispielstadt.de/politik/gemeinderat/',{status:404}).nearby,false);
 // ALLRIS sits in /bi/ folders as well; its hosts block networks after a few requests and never serve si0040.
 assert.equal(followUpsAfterFailure('https://www.henstedt-ulzburg.sitzung-online.de/bi/au010.asp',{status:404}).nearby,false);
 assert.equal(followUpsAfterFailure('https://www.sitzungsdienst-selm.de/bi/si010_r.asp',{status:404}).nearby,false);
 assert.equal(followUpsAfterFailure('https://ratsinfo-online.de/nordhausen-bi/',{status:404}).nearby,false);
 assert.equal(followUpsAfterFailure('https://www.heppenheim.de/sessionnet/',{status:200}).nearby,false);
});

test('More! Rubin: the root of the host after 404 or 0 of a deeper path, not after 403',()=>{
 assert.equal(followUpsAfterFailure('https://emstek.gremien.info/users',{status:404}).root,'https://emstek.gremien.info/');
 assert.equal(followUpsAfterFailure('https://gommern.more-rubin1.de/calendar.php?month=2022-08',{status:404}).root,'https://gommern.more-rubin1.de/');
 assert.equal(followUpsAfterFailure('https://ris-ruhla.zv-kisa.de/?&from&',{status:0,error:'fetch failed'}).root,'https://ris-ruhla.zv-kisa.de/');
 assert.equal(followUpsAfterFailure('https://emstek.gremien.info/users',{status:403}).root,null);
 assert.equal(followUpsAfterFailure('https://emstek.gremien.info/',{status:404}).root,null,'the root itself failed');
 assert.equal(followUpsAfterFailure('https://www.gremien.info.example.de/users',{status:404}).root,null);
 assert.match('vg-wittlich.gremien.info',RUBIN_HOST);assert.doesNotMatch('gremien-info.de',RUBIN_HOST);
});

test('the public part next to a tenant\'s members\' area: suelze_ri/ → suelze_bi/',()=>{
 assert.ok(publicSiblings('https://ratsinfo.kitu-genossenschaft.de/suelze_ri/').includes('https://ratsinfo.kitu-genossenschaft.de/suelze_bi/'));
 assert.ok(publicSiblings('https://ratsinfo.kitu-genossenschaft.de/suelze_ri/').includes('https://buergerinfo.kitu-genossenschaft.de/suelze_bi/'));
 assert.ok(publicSiblings('https://ris.example.de/ri/').includes('https://ris.example.de/bi/'));
 assert.deepEqual(publicSiblings('https://ris.example.de/bi/'),['https://ris.example.de/bi/']);
 for(const base of ['https://ratsinfo.kitu-genossenschaft.de/biederitz_ri/','https://ris.example.de/gi/','https://x.example.de/rat-ri/'])assert.match(base,MEMBERS_AREA,base);
 assert.doesNotMatch('https://ris.example.de/bi/',MEMBERS_AREA);assert.doesNotMatch('https://ris.example.de/bri/',MEMBERS_AREA);
});

test('a page that links only ALLRIS 3 programs is not asked for ALLRIS 4 under /public/',()=>{
 const folder='https://ratsinfo-online.net/landkreismittelsachsen-bi/',start=fixture('wst-allris.net.html').replaceAll('/bi/allris.net.asp','/landkreismittelsachsen-bi/allris.net.asp');
 assert.deepEqual(allrisBases(folder,start),[]);
 assert.equal(allrisGeneration(folder,start),3);
 assert.equal(allrisGeneration('https://www.sehnde.de/bi/','<html><frameset><frame src="allris.net.asp" name="main"></frameset></html>'),3);
 assert.equal(allrisGeneration('https://www.steinburg.sitzung-online.de/pi/pa021.asp',''),3);
 // ALLRIS 4: a link to the host alone is answered from /public/; linked pages name their folder; Wicket pages their own.
 assert.deepEqual(allrisBases('https://www.kreis-soest.sitzung-online.de/','<html><title>ALLRIS</title></html>'),['https://www.kreis-soest.sitzung-online.de/public/']);
 assert.deepEqual(allrisBases('https://www.example.de/politik/','<a href="/allris/si010?MM=9">Kalender</a>'),['https://www.example.de/allris/','https://www.example.de/public/']);
 assert.equal(allrisGeneration('https://www.example.de/politik/','<a href="/allris/si010?MM=9">Kalender</a><a href="/alt/si010.asp">Archiv</a>'),4);
 assert.equal(allrisGeneration('https://ris.example.de/public/si010','<html><script src="wicket/resource/x.js"></script></html>'),4);
});

test('an alias counts as a whole host label or path segment only',()=>{
 assert.deepEqual(ALIASES['nds-03459019'],['gmh']);assert.deepEqual(ALIASES['de-15083490'],['suelze']);
 assert.equal(aliasInAddress(area('nds-03459019'),'https://gmh.ris.itebo.de/bi/info.asp'),'gmh');
 assert.equal(aliasInAddress(area('nds-03459019'),'https://ris.example.de/gmh/bi/'),'gmh');
 assert.equal(aliasInAddress(area('de-15083490'),'https://ratsinfo.kitu-genossenschaft.de/suelze_bi/'),'suelze');
 for(const url of ['https://gmhxyz.example.de/','https://ris.example.de/agmh/','https://ris.example.de/?q=gmh','https://ris-gmh-test.example.de/'])assert.equal(aliasInAddress(area('nds-03459019'),url),null,url);
 assert.equal(aliasInAddress(area('nds-03459019'),'https://gmh.ris.itebo.de/',{}),null,'without an entry no alias');
 const who=identity(area('nds-03459019'),'https://gmh.ris.itebo.de/bi/','<html><title>SessionNet | Startseite</title></html>');
 assert.deepEqual(who,{ok:true,by:'Adresse (Alias)'});
 assert.equal(identity(area('nds-03459019'),'https://ris.gmhx.example.de/bi/','<html><title>SessionNet</title></html>').ok,false);
 assert.deepEqual(identity(area('de-15083490'),'https://ratsinfo.kitu-genossenschaft.de/suelze_bi/','<html><title>SessionNet</title></html>'),{ok:true,by:'Adresse (Alias)'});
});

test('hyphenated names also by a part of six letters or more that names no other area',()=>{
 assert.deepEqual(nameParts('Schladen-Werla',area('nds-03158039')),['schladen']);
 // "Wittlich" in "Wittlich-Land" is the town next to the association; "Land" is too short.
 assert.deepEqual(nameParts('Wittlich-Land',area('de-072315008')),[]);
 assert.deepEqual(identity(area('nds-03158039'),'https://session.schladen.de/buergerinfo/','<html><title>SessionNet</title></html>'),{ok:true,by:'Adresse'});
 assert.equal(identity(area('de-072315008'),'https://stadt-wittlich.gremien.info/','<html><title>More! Rubin</title></html>').ok,false);
 // Names without a hyphen are unchanged.
 assert.deepEqual(identity(area('de-07231134'),'https://stadt-wittlich.gremien.info/','<html><title>More! Rubin</title></html>'),{ok:true,by:'Adresse'});
});

test('a municipality named in an address owns the system only if it does not read another one',()=>{
 const grasleben=area('nds-031545401'),url='https://ris-sg-gl-migration.edv-helmstedt.de/';
 // The town of Helmstedt reads ris.stadt-helmstedt.de: the system of the Samtgemeinde is no system of the town.
 assert.equal(foreignOwner(grasleben,url,CATALOG,new Map([['nds-03154028',['https://ris.stadt-helmstedt.de/']]])),null);
 assert.equal(foreignOwner(grasleben,url,CATALOG),null,'by the source files');
 // The town reads this very system, or has no entry yet: it stays the owner.
 assert.equal(foreignOwner(grasleben,url,CATALOG,new Map([['nds-03154028',['https://ris-sg-gl-migration.edv-helmstedt.de/']]])),'Stadt Helmstedt');
 assert.equal(foreignOwner(grasleben,url,CATALOG,new Map()),'Stadt Helmstedt');
 // Fleischwangen and Altshausen (no entry): unchanged; a tenant folder decides on a shared host.
 assert.equal(foreignOwner(area('de-08436032'),'https://sessionnet.owl-it.de/altshausen/bi/',CATALOG),'Gemeinde Altshausen');
 assert.equal(foreignOwner(area('de-08436032'),'https://sessionnet.owl-it.de/altshausen/bi/',CATALOG,new Map([['de-08436005',['https://sessionnet.owl-it.de/altshausen/bi/']]])),'Gemeinde Altshausen');
 assert.notEqual(foreignOwner(area('de-08436032'),'https://sessionnet.owl-it.de/altshausen/bi/',CATALOG,new Map([['de-08436005',['https://sessionnet.owl-it.de/altshausen-neu/bi/']]])),'Gemeinde Altshausen');
 // An alias of the area itself is its own name.
 assert.equal(foreignOwner(area('nds-03459019'),'https://gmh.ris.itebo.de/bi/',CATALOG),null);
});

test('crawl.mjs and verify.mjs apply these rules: no search next to a refused page, robots.txt for every address asked',()=>{
 const verify=source('verify.mjs'),crawl=source('crawl.mjs');
 assert.match(crawl,/const skip=CRAWL_SKIP;/);assert.match(crawl,/unwrapLink\(link\.url,host\)/);
 assert.match(verify,/filter\(c=>!SERVICE\.test\(c\.url\)\)/);assert.match(verify,/unwrapLink\(c\.url,new URL\(c\.from\)\.hostname\)/);
 // In the branch of a failed page, findSessionNet is asked only when followUpsAfterFailure says so.
 const failed=verify.slice(verify.indexOf('if(p.status!==200){'),verify.indexOf('result.tried.push(note);continue;}',verify.indexOf('if(p.status!==200){')));
 assert.match(failed,/const next=followUpsAfterFailure\(/);assert.match(failed,/if\(next\.nearby\)\{const sn=await findSessionNet\(/);
 assert.equal(failed.match(/findSessionNet\(/g).length,1);
 // findSessionNet asks robots.txt before every entry page.
 const nearby=verify.slice(verify.indexOf('async function findSessionNet'),verify.indexOf('return null;',verify.indexOf('async function findSessionNet')));
 assert.ok(nearby.indexOf("robotsAllow(base+'si0040.'+extension)")>0&&nearby.indexOf("robotsAllow(base+'si0040.'+extension)")<nearby.indexOf("page(base+'si0040.'+extension"));
 // The public hosts next to a login are asked only when the login was recognised, each with one extension.
 assert.match(nearby,/publicSiblings\(here,\{login\}\)/);assert.match(nearby,/hostname===u\.hostname\?\['asp','php'\]:once/);
 assert.match(verify,/findSessionNet\(sn\.base,\{login:loginPage\(p\)\}\)/);assert.match(verify,/findSessionNet\(p\.url,\{login:true\}\)/);
 assert.equal(verify.match(/findSessionNet\([^)]*\{login:true\}\)/g).length,1);
 // Candidates in the order of rankCandidates; a system with no meeting in the window is asked once more over twelve months.
 assert.match(verify,/const ordered=rankCandidates\(/);assert.match(verify,/const strong=STRONG_RIS;/);
 assert.equal(verify.match(/await widen\(/g).length,4);assert.match(verify,/const WIDE_WINDOW='12m'/);
 // The page that embeds the council service is recognised by the shared rule of the reader.
 assert.match(crawl,/if\(embeddedCouncilservice\(page\.html\)\)/);assert.match(crawl,/exportTokens\(code\)\.length===1/);
 for(const file of ['crawl.mjs','verify.mjs','rules.mjs','areas.mjs'])execFileSync(process.execPath,['--check',fileURLToPath(new URL('../scripts/source-discovery/'+file,import.meta.url))]);
});

test('hosted platforms: digitalfabriX is asked on its info page; a page names its area in text, title or the logo title',()=>{
 // Nachgebildet nach den öffentlichen Seiten vom 05.10.2026: die Startseite von digitalfabriX leitet nur weiter, die
 // Infoseite nennt den Mandanten; ALLRIS bei sitzung-mv.de nennt das Amt nur im Titel des Logos.
 assert.equal(HOSTED.find(p=>p.name==='digitalfabriX').path,'/info.asp');
 const aholming=area('de-09271111'),goldberg=area('de-130765656');
 const redirect='<html><head><meta http-equiv="REFRESH" content="0; URL=default.asp"><meta name="sessionnet" content="1"><title></title></head><body><a href="default.asp">WEITERLEITUNG</a></body></html>';
 assert.equal(pageNamesArea(redirect,aholming),false);
 assert.equal(pageNamesArea('<title>SessionNet | B&uuml;rgerinfoportal der Gemeinde Aholming</title>',aholming),true);
 const allris='<title>ALLRIS - Sitzungen Kalender</title><body><span id="logo" title="Amt Goldberg-Mildenitz"></span><a href="si010">Kalender</a></body>';
 assert.equal(pageNamesArea(allris,goldberg),true);
 assert.equal(pageNamesArea(allris.replace('Goldberg-Mildenitz','Usedom-Nord'),goldberg),false,'another Amt on the same platform');
});

test('hosted platforms: KOMFA per Land and komuna by path, each recognised from its page, komuna with its own names',()=>{
 const komfa=HOSTED.filter(p=>p.name==='KOMFA');
 assert.deepEqual(komfa.map(p=>p.land),['12','13','14','15','16']);
 assert.deepEqual(komfa[0].hosts('woldegk'),['ris-woldegk.komfa.de']);
 assert.ok(komfa[0].marker.test(readFileSync(new URL('./fixtures/komfa/delitzsch-cal-2026-09.html',import.meta.url),'utf8')));
 const komuna=HOSTED.find(p=>p.name==='komuna');
 assert.equal(komuna.land,'09');assert.equal(komuna.manual,true,'a name without a system is redirected; the redirect is not followed');assert.equal(komuna.confirm,'kic-clients');
 assert.ok(komuna.marker.test(readFileSync(new URL('./fixtures/kic/komuna-ainring-shell.html',import.meta.url),'utf8')));
 // A Verwaltungsgemeinschaft is asked under "vg<name>" as well; a name with its addition also in one word.
 const vg={name:'Verwaltungsgemeinschaft Aidenbach',shortName:'Aidenbach',municipalityType:'Verwaltungsgemeinschaft'},town={name:'Gemeinde Aschau a.Inn',shortName:'Aschau a.Inn',municipalityType:'Gemeinde'};
 assert.deepEqual(komuna.hosts('aidenbach',vg),['ris.komuna.net/aidenbach','ris.komuna.net/vgaidenbach']);
 assert.deepEqual(komuna.hosts('aschauainn',town),['ris.komuna.net/aschauainn']);
 assert.deepEqual(HOSTED.filter(p=>p.name==='ratsinfo-online').map(p=>p.land),['12','14','15','16']);
 assert.deepEqual(HOSTED.find(p=>p.name==='ratsinfo-online').hosts('brieselang'),['ratsinfo-online.de/brieselang-bi','ratsinfo-online.net/brieselang-bi']);
 assert.deepEqual(HOSTED.find(p=>p.name==='OWL-IT'&&p.land==='01').hosts('heide'),['sessionnet.owl-it.de/heide/bi']);assert.equal(HOSTED.find(p=>p.name==='OWL-IT').path,'/info.asp');
 assert.deepEqual(komuna.slugs(town),['aschauainn']);assert.deepEqual(komuna.slugs({name:'Gemeinde Neufahrn i.NB',shortName:'Neufahrn i.NB'}),['neufahrninb']);
});

test('a guessed address counts only where no other area bears the name, or where the page names the area distinctly',()=>{
 // Found by guessing on 05./06.10.2026: sessionnet.owl-it.de/borken is the town in North Rhine-Westphalia.
 const borkenHessen=area('de-06634001'),donau=area('de-08327036'),main=area('de-06438008');
 assert.ok(nameTwins(borkenHessen).some(a=>a.id==='nrw-05554008'||/Borken/.test(a.name)&&a.id!=='de-06634001'));
 assert.equal(namesDistinctly('<title>SessionNet | Bürgerinfoportal</title><h1>Stadt Borken</h1>',borkenHessen,nameTwins(borkenHessen)),false);
 assert.equal(namesDistinctly('<h1>Stadt Borken (Hessen)</h1>',borkenHessen,nameTwins(borkenHessen)),true);
 // Mühlheim: the addition decides, in either direction.
 assert.equal(namesDistinctly('Bürgerinfoportal der Stadt M&uuml;hlheim an der Donau',donau,nameTwins(donau)),true);
 assert.equal(namesDistinctly('Bürgerinfoportal der Stadt Mühlheim an der Donau',main,nameTwins(main)),false);
 // Two areas of the same name (Rimbach in Bavaria and in Hesse): no page can tell them apart by the name alone.
 const rimbach=area('de-09372151');
 assert.ok(nameTwins(rimbach).length>0);assert.equal(namesDistinctly('Mandant der Schnittstelle: Gemeinde Rimbach',rimbach,nameTwins(rimbach)),false);
 // An association by all its members (komuna: the interface names the municipalities of the Verwaltungsgemeinschaft).
 const vg={id:'x',name:'Verwaltungsgemeinschaft Königstein',shortName:'Königstein',members:[{name:'Königstein'},{name:'Hirschbach'}]};
 assert.equal(namesDistinctly('Mandant der Schnittstelle: Gemeinde Hirschbach, Markt Königstein',vg,nameTwins(vg)),true);
 // A name no other area bears has no twins.
 assert.deepEqual(nameTwins(area('de-09189111')),[]);
 // An address claimed from two Länder: it names the town of Seligenstadt (Hesse), not Karlstein a.Main (Bavaria).
 assert.equal(addressNames(area('de-06438013'),'https://www.seligenstadt.sitzung-online.de/public/'),true);
 assert.equal(addressNames(area('de-09671114'),'https://www.seligenstadt.sitzung-online.de/public/'),false);
 // Only the Länder of the platform count: komuna serves Bavaria (Rimbach in Hesse is no twin there), OWL-IT nearly all.
 assert.deepEqual(platformLands('komuna-Adresse, Mandant der Schnittstelle: Gemeinde Rimbach'),['09']);
 assert.equal(nameTwins(rimbach,undefined,platformLands('komuna-Adresse, Mandant der Schnittstelle: Gemeinde Rimbach')).length,0);
 assert.ok(nameTwins(rimbach,undefined,platformLands('OWL-IT-Adresse, Seite nennt das Gebiet')).some(a=>a.ags.startsWith('06')));
 assert.deepEqual(platformLands('KISA-Adresse (DNS), Name im Land eindeutig'),['14']);
 assert.equal(platformLands('RIS-Portal-Adresse (DNS), Name eindeutig'),null,'a platform of all Länder');
 assert.equal(platformLands('eigene Domain'),null);
 // A town and the district of its name are no twins (Stadt Rosenheim, Landkreis Rosenheim): identity() tells them apart.
 assert.ok(!nameTwins(area('de-09163000')).some(a=>a.kind!=='city'));
});

test('links of a page: in quotes or without them, with the title as text, frames as embedded; no script or mail links',()=>{
 // Nachgebildet: Rödermark schreibt den Link auf sein ALLRIS ohne Anführungszeichen.
 const html='<a href=https://www.roedermark.sitzung-online.de/public/ class=nav>Ratsinformation</a> <a href="/rathaus/politik" title="Gremien">Politik</a> <a href="javascript:void(0)">x</a> <a href="mailto:a@b.de">Mail</a> <iframe src="https://ris.beispiel.de/bi/"></iframe>';
 assert.deepEqual(anchors(html,'https://www.roedermark.de/'),[
  {url:'https://www.roedermark.sitzung-online.de/public/',text:'Ratsinformation'},
  {url:'https://www.roedermark.de/rathaus/politik',text:'Politik Gremien'},
  {url:'https://ris.beispiel.de/bi/',text:'(eingebettet)'}]);
});

test('a system with the councils of other municipalities of the district is shared; joint bodies, localities and members are not',()=>{
 // Bodies of vv-langenau.ris-portal.de (05.10.2026), checked for Altheim (Alb) with the real catalog.
 const altheim=area('de-08425005');
 const langenau=['Gemeinderat Altheim (Alb)','Gemeinderat Asselfingen','Gemeinderat Stadt Langenau','Ausschuss für Technik und Umwelt Stadt Langenau','Ortschaftsrat Göttingen','Verbandsversammlung Zweckverband Grundschulverband Altheim (Alb) – Weidenstetten','Verwaltungsrat Verwaltungsverband Langenau'];
 const shared=sharedBodies(altheim,langenau);
 assert.deepEqual(shared.own,['Gemeinderat Altheim (Alb)','Verbandsversammlung Zweckverband Grundschulverband Altheim (Alb) – Weidenstetten']);
 assert.deepEqual(shared.others,['Gemeinde Asselfingen','Stadt Langenau']);
 assert.deepEqual(shared.foreign.map(x=>x.area),['de-08425011','de-08425072']);
 // Its own bodies only, a joint body and a locality that bears another municipality's name: no shared system.
 assert.equal(sharedBodies(altheim,['Gemeinderat Altheim (Alb)','Verbandsversammlung Zweckverband Grundschulverband Altheim (Alb) – Weidenstetten','Ortschaftsrat Asselfingen']),null);
 // The members of an Amt are its own, also where a catalog area bears a member's name.
 const amt={id:'de-120665607',name:'Amt Ruhland',shortName:'Ruhland',kind:'city',district:'de-12066',members:[{name:'Hermsdorf'},{name:'Guteborn'}]};
 const areas=[amt,{id:'de-12066999',name:'Gemeinde Hermsdorf',shortName:'Hermsdorf',kind:'city',district:'de-12066'},{id:'de-12066998',name:'Stadt Lauchhammer',shortName:'Lauchhammer',kind:'city',district:'de-12066'}];
 assert.equal(sharedBodies(amt,['Amtsausschuss Ruhland','Gemeindevertretung Hermsdorf','Gemeindevertretung Guteborn'],areas),null);
 assert.deepEqual(sharedBodies(amt,['Amtsausschuss Ruhland','Stadtverordnetenversammlung Lauchhammer'],areas).others,['Stadt Lauchhammer']);
 // A district's system with the council of one of its municipalities is shared as well; the Kreistag alone is not.
 const kreis={id:'de-12066',name:'Landkreis Oberspreewald-Lausitz',kind:'district'};
 assert.equal(sharedBodies(kreis,['Kreistag','Ausschuss für Umwelt'],areas),null);
 assert.deepEqual(sharedBodies(kreis,['Kreistag','Stadtverordnetenversammlung Lauchhammer'],areas).others,['Stadt Lauchhammer']);
 // The councils of the members of another area (an Amt run by the town) are that area's.
 const town={id:'de-13075105',name:'Stadt Pasewalk',shortName:'Pasewalk',kind:'city',district:'de-13075'},urt={id:'de-130755560',name:'Amt Uecker-Randow-Tal',shortName:'Uecker-Randow-Tal',kind:'city',district:'de-13075',members:[{name:'Jatznick'},{name:'Polzow'}]};
 assert.deepEqual(sharedBodies(town,['Stadtvertretung der Stadt Pasewalk','Gemeindevertretung Jatznick'],[town,urt]).foreign,[{committee:'Gemeindevertretung Jatznick',area:'de-130755560',name:'Amt Uecker-Randow-Tal'}]);
 assert.equal(sharedBodies(urt,['Amtsausschuss Uecker-Randow-Tal','Gemeindevertretung Jatznick'],[town,urt]),null);
 // An area without a district is not checked.
 assert.equal(sharedBodies({id:'x',name:'Stadt X',kind:'city'},['Gemeinderat Asselfingen'],areas),null);
});

test('after a login the public hosts of the same domain are asked once each: bis., sbi., buergerinfo., bi.',()=>{
 // Landkreis Ludwigslust-Parchim and its municipalities: ris.<domain> is the login, bis.<domain> the public Bürgerinfo.
 assert.deepEqual(publicHosts('ris.kreis-lup.de'),['bis.kreis-lup.de','sbi.kreis-lup.de','buergerinfo.kreis-lup.de','bi.kreis-lup.de']);
 assert.deepEqual(publicSiblings('https://ris.kreis-lup.de/',{login:true}),['https://ris.kreis-lup.de/','https://bis.kreis-lup.de/','https://sbi.kreis-lup.de/','https://buergerinfo.kreis-lup.de/','https://bi.kreis-lup.de/']);
 assert.deepEqual(publicSiblings('https://ris.kreis-lup.de/'),['https://ris.kreis-lup.de/']);
 // Deeper labels stay; the public path of the folder is taken along; no host variants for a domain without a subdomain.
 assert.deepEqual(publicHosts('ris.stadt.amt-eldenburg-luebz.de'),PUBLIC_HOST_LABELS.map(l=>l+'.stadt.amt-eldenburg-luebz.de'));
 assert.ok(publicSiblings('https://ris.example.de/ri/',{login:true}).includes('https://bis.example.de/bi/'));
 assert.deepEqual(publicHosts('example.de'),[]);assert.deepEqual(publicHosts('bis.kreis-lup.de'),[]);
 // Platform hosts: only the tenant label changes (ratsinfo-vg-strasskirchen → buergerinfo-vg-strasskirchen), never the platform.
 assert.deepEqual(publicSiblings('https://ratsinfo-vg-strasskirchen.digitalfabrix.de/',{login:true}),['https://ratsinfo-vg-strasskirchen.digitalfabrix.de/','https://buergerinfo-vg-strasskirchen.digitalfabrix.de/']);
 assert.deepEqual(publicHosts('ratsinfo-x.livingdata.de'),[]);assert.deepEqual(publicHosts('sessionnet.owl-it.de'),[]);
 // ratsinfo. → buergerinfo. on an own domain as before (Ostrhauderfehn, Laaber), now with the other labels after it.
 const laaber=publicSiblings('https://ratsinfo.vg-laaber.de/',{login:true});
 assert.equal(laaber[1],'https://buergerinfo.vg-laaber.de/');assert.ok(laaber.includes('https://bis.vg-laaber.de/'));assert.equal(laaber.length,5);
 assert.equal(new Set(laaber).size,laaber.length);
});

test('a link named "Bürgerinformationssystem" is checked before a "Ratsinformationssystem" link, then addresses that show a system',()=>{
 const ris={url:'https://ris.kreis-lup.de/',text:'Ratsinformationssystem',byHref:true},bis={url:'https://bis.kreis-lup.de/',text:'Bürgerinformationssystem',byText:true};
 assert.deepEqual(rankCandidates([ris,bis]).map(c=>c.url),[bis.url,ris.url]);
 // Ludwigsburg: the login address names "ratsinfo" (strong), the public one does not; the text still decides.
 assert.deepEqual(rankCandidates([{url:'https://ratsinfo.kreis-lb.de/',text:'Ratsinformationssystem',byHref:true},{url:'https://sbi.landkreis-ludwigsburg.de/',text:'Bürgerinfo',byText:true}]).map(c=>c.url),['https://sbi.landkreis-ludwigsburg.de/','https://ratsinfo.kreis-lb.de/']);
 // Among the rest: strong addresses first, hits by address before hits by text, equal candidates in their order.
 const a={url:'https://www.example.de/politik/',text:'Politik',byText:true},b={url:'https://www.example.de/sitzungen/',text:'Sitzungen',byHref:true},c={url:'https://sessionnet.example.de/bi/si0040.asp',text:'Sitzungen',byHref:true};
 assert.deepEqual(rankCandidates([a,b,c]).map(x=>x.url),[c.url,b.url,a.url]);
 assert.deepEqual(rankCandidates([b,{...b,url:'https://www.example.de/rat/'}]).map(x=>x.url),[b.url,'https://www.example.de/rat/']);
 for(const t of ['Bürgerinformationssystem','Bürgerinfo','Rats- und Bürgerinfo','buergerinfo'])assert.match(t,PUBLIC_TEXT);
 assert.doesNotMatch('Ratsinformationssystem',PUBLIC_TEXT);assert.match('https://ris.example.de/sessionnet/bi/',STRONG_RIS);
});

test('links without quotes count; translated copies of a website are never candidates or pages to explore',()=>{
 const html='<a href=https://www.vgmering.sitzung-online.de/pi2/yw040_r.asp\r\n class="x">Textrecherche</a><a href="./si010_r.asp?MM=9">K</a><frame src=allris.net.asp>';
 assert.deepEqual(hrefs(html,'https://www.vgmering.sitzung-online.de/pi2/'),['https://www.vgmering.sitzung-online.de/pi2/yw040_r.asp','https://www.vgmering.sitzung-online.de/pi2/si010_r.asp?MM=9','https://www.vgmering.sitzung-online.de/pi2/allris.net.asp']);
 assert.equal(allrisGeneration('https://www.vgmering.sitzung-online.de/pi2/yw040_r.asp',html),3);
 for(const u of ['https://www.saarpfalz-kreis.de/:translation/fr/politik/kreistag/','https://www.saarpfalz-kreis.de/:translation/en/']){assert.match(u,CRAWL_SKIP);assert.match(u,TRANSLATED);}
 assert.doesNotMatch('https://www.saarpfalz-kreis.de/politik/kreistag/',TRANSLATED);assert.doesNotMatch('https://www.example.de/translation-service/',TRANSLATED);
});

test('ALLRIS 3: the public folders next to a members\' folder, the derived one first; nothing for other addresses',()=>{
 assert.deepEqual(allris3Siblings('https://www.example.de/bi/'),ALLRIS3_PUBLIC_FOLDERS.map(f=>'https://www.example.de/'+f+'/'));
 assert.deepEqual(allris3Siblings('https://www.landkreis-diepholz.sitzung-online.de/ri/').slice(0,4),['https://www.landkreis-diepholz.sitzung-online.de/bi/','https://www.landkreis-diepholz.sitzung-online.de/pi/','https://www.landkreis-diepholz.sitzung-online.de/bi2/','https://www.landkreis-diepholz.sitzung-online.de/pi2/']);
 assert.deepEqual(allris3Siblings('https://ssl.ratsinfo-online.net/landkreisshk-bi/')[1],'https://ssl.ratsinfo-online.net/landkreisshk-pi/');
 assert.deepEqual(allris3Siblings('https://www.example.de/rat_ri/')[0],'https://www.example.de/rat_bi/');
 assert.deepEqual(allris3Siblings('https://www.example.de/pi2/'),[]);assert.deepEqual(allris3Siblings('https://www.example.de/bri/'),[]);assert.deepEqual(allris3Siblings('nicht'),[]);
});
