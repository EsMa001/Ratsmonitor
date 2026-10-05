import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {CRAWL_SKIP,SERVICE,unwrapLink,followUpsAfterFailure,RUBIN_HOST,MEMBERS_AREA,publicSiblings,allrisBases,allrisGeneration,identity} from '../scripts/source-discovery/rules.mjs';
import {foreignOwner,aliasInAddress,nameParts,ALIASES} from '../scripts/source-discovery/areas.mjs';
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
 for(const file of ['crawl.mjs','verify.mjs','rules.mjs','areas.mjs'])execFileSync(process.execPath,['--check',new URL('../scripts/source-discovery/'+file,import.meta.url).pathname]);
});
