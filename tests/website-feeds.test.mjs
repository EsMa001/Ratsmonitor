import test from 'node:test';
import assert from 'node:assert/strict';
import {documentLinks,sessionScore,SESSION_THRESHOLD,listPageScore,paginationLinks,feedLinks,parseFeed,parseIcs,parseSitemap,robotsSitemaps,wpApiRoot,wpEndpoints,parseWpPosts,parseWpMedia,jsonLdEvents,generatorOf,isRisLink,isSearchLink} from '../server/integrations/website-feeds.mjs';
// All pages, feeds and files below are reproduced (nachgebildet), not live: small excerpts in the markup of the usual
// municipal CMS (TYPO3, WordPress, IKISS, Joomla), with invented hosts under *.example.test and without names of persons.
const base='https://www.gemeinde-musterdorf.example.test/rathaus/bekanntmachungen/';
const list=`<html><head><title>Öffentliche Bekanntmachungen – Gemeinde Musterdorf</title></head><body>
<h1>Amtstafel</h1><h2>Sitzungen des Gemeinderates</h2>
<ul>
 <li><a href="/fileadmin/user_upload/bekanntmachungen/2026/Einladung_GR_14.10.2026.pdf" title="Einladung zur öffentlichen Sitzung des Gemeinderates">Einladung Gemeinderat am 14.&nbsp;Oktober 2026 (PDF, 120 KB)</a></li>
 <li><a href="../sitzungen/tagesordnung-bauausschuss-2026-09-30.html#top">Tagesordnung Bauausschuss</a></li>
 <li><a href="/fileadmin/user_upload/protokolle/20260916_Niederschrift.pdf"><img src="/pdf.png" alt="Niederschrift Gemeinderat"></a></li>
 <li><a href="/fileadmin/user_upload/protokolle/20260916_Niederschrift.pdf">Niederschrift der Sitzung vom 16.09.2026</a></li>
 <li><a href="/fileadmin/nichtoeffentlich/Vorlage_7.pdf">Vorlage zu TOP 7</a></li>
 <li><a href="/fileadmin/sitzung/NOe-Teil.pdf">Tagesordnung nicht öffentlicher Teil</a></li>
 <li><a href="/output/download.php?fid=3373.1234.1.PDF">Aus dem Gemeinderat – Sitzungsbericht</a></li>
 <li><a href="/aktuelles/2026/10/02/haushaltssatzung-2026/">Haushaltssatzung 2026</a></li>
 <li><a href="/fileadmin/bauamt/BP_Nr_12_Bekanntmachung.pdf">Bekanntmachung Bebauungsplan Nr. 12 „Am Anger“</a></li>
 <li><a href="/stellenausschreibung-erzieher.html">Stellenausschreibung Erzieher/in</a></li>
 <li><a href="/service/abfallkalender-2026.pdf">Abfallkalender 2026</a></li>
 <li><a href="/veranstaltungen/kirchweih">Veranstaltung: Kirchweih am 18-10-2026</a></li>
 <li><a href="/datenschutz.html">Datenschutz</a></li><li><a href="/impressum">Impressum</a></li>
 <li><a href="/formulare/antrag-sondernutzung.pdf">Formular Sondernutzung</a></li>
 <li><a href="/wahlen/wahlbekanntmachung-buergermeisterwahl.pdf">Wahlbekanntmachung Bürgermeisterwahl</a></li>
 <li><a href="/amtsblatt/Mitteilungsblatt_KW41.pdf" type="application/pdf">Mitteilungsblatt KW 41</a></li>
 <li><a href="mailto:rathaus@gemeinde-musterdorf.example.test">E-Mail</a> <a href="tel:+49000">Telefon</a> <a href="javascript:print()">Drucken</a> <a href="#inhalt">Zum Inhalt</a></li>
 <li><a href="webcal://www.gemeinde-musterdorf.example.test/termine/sitzungen.ics">Sitzungstermine abonnieren</a></li>
</ul>
<script>const tpl='<a href="/aus-dem-script.pdf">Tagesordnung</a>';</script></body></html>`;
const origin='https://www.gemeinde-musterdorf.example.test';

test('website documentLinks resolves links, drops fragments and non-documents, joins labels and finds dates',()=>{
 const links=documentLinks(list,base),by=path=>links.find(l=>l.url===origin+path);
 assert.deepEqual(by('/fileadmin/user_upload/bekanntmachungen/2026/Einladung_GR_14.10.2026.pdf'),{url:origin+'/fileadmin/user_upload/bekanntmachungen/2026/Einladung_GR_14.10.2026.pdf',label:'Einladung Gemeinderat am 14. Oktober 2026 (PDF, 120 KB) Einladung zur öffentlichen Sitzung des Gemeinderates',date:'2026-10-14',kind:'pdf'});
 // Relative address and fragment; the date only in the address.
 assert.deepEqual(by('/rathaus/sitzungen/tagesordnung-bauausschuss-2026-09-30.html'),{url:origin+'/rathaus/sitzungen/tagesordnung-bauausschuss-2026-09-30.html',label:'Tagesordnung Bauausschuss',date:'2026-09-30',kind:'html'});
 // Image link and text link to one file: one entry, words of both, date of the label before that of the address.
 assert.deepEqual(by('/fileadmin/user_upload/protokolle/20260916_Niederschrift.pdf'),{url:origin+'/fileadmin/user_upload/protokolle/20260916_Niederschrift.pdf',label:'Niederschrift Gemeinderat Niederschrift der Sitzung vom 16.09.2026',date:'2026-09-16',kind:'pdf'});
 assert.equal(links.filter(l=>l.url.endsWith('20260916_Niederschrift.pdf')).length,1);
 // IKISS download script names the PDF in its query; a WordPress date path; dd-mm-yyyy in a label is not German.
 assert.equal(by('/output/download.php?fid=3373.1234.1.PDF').kind,'pdf');
 assert.equal(by('/aktuelles/2026/10/02/haushaltssatzung-2026/').date,'2026-10-02');
 assert.equal(by('/veranstaltungen/kirchweih').date,null);
 assert.equal(by('/amtsblatt/Mitteilungsblatt_KW41.pdf').kind,'pdf');
 // webcal:// is read over https; mail, phone, script and in-page anchors are no documents; script templates are not links.
 assert.equal(by('/termine/sitzungen.ics').kind,'ics');
 assert.ok(!links.some(l=>/^(?:mailto|tel|javascript):|#|aus-dem-script/.test(l.url)));
 assert.equal(links.length,17);
});
test('website documentLinks takes the date from the address in its other spellings and the kind from type',()=>{
 const html=['/a/2026/10/14/sitzung/','/b/protokoll-14-10-2026.pdf','/c/20261014-gr.pdf','/d/datei?id=7','/e/bild.jpg','/f/feed/','/g/?type=9818'].map(h=>`<a href="${h}">x</a>`).join('')+'<a href="/h/x" type="application/pdf">PDF</a><a href="/i/sitzung_1990_02_30.pdf">ungültig</a>';
 assert.deepEqual(documentLinks(html,base).map(l=>[l.date,l.kind]),[['2026-10-14','html'],['2026-10-14','pdf'],['2026-10-14','pdf'],[null,'html'],[null,'other'],[null,'feed'],[null,'feed'],[null,'pdf'],[null,'pdf']]);
});
test('website sessionScore separates meeting documents from the non-public part and from noise',()=>{
 const links=documentLinks(list,base),score=path=>sessionScore(links.find(l=>l.url===origin+path));
 for(const path of ['/fileadmin/user_upload/bekanntmachungen/2026/Einladung_GR_14.10.2026.pdf','/rathaus/sitzungen/tagesordnung-bauausschuss-2026-09-30.html','/fileadmin/user_upload/protokolle/20260916_Niederschrift.pdf','/output/download.php?fid=3373.1234.1.PDF'])
  assert.ok(score(path)>=SESSION_THRESHOLD,path);
 // "nichtöffentlich" in the address or "nicht öffentlich" in the label: -100, whatever else is said.
 assert.equal(score('/fileadmin/nichtoeffentlich/Vorlage_7.pdf'),-100);assert.equal(score('/fileadmin/sitzung/NOe-Teil.pdf'),-100);
 assert.equal(sessionScore({url:origin+'/x.pdf',label:'Niederschrift nicht-öffentliche Sitzung Gemeinderat'}),-100);
 for(const path of ['/aktuelles/2026/10/02/haushaltssatzung-2026/','/fileadmin/bauamt/BP_Nr_12_Bekanntmachung.pdf','/stellenausschreibung-erzieher.html','/service/abfallkalender-2026.pdf','/veranstaltungen/kirchweih','/datenschutz.html','/impressum','/formulare/antrag-sondernutzung.pdf','/wahlen/wahlbekanntmachung-buergermeisterwahl.pdf'])
  assert.ok(score(path)<0,path);
 // A gazette is worth a look, never enough on its own.
 const gazette=score('/amtsblatt/Mitteilungsblatt_KW41.pdf');assert.ok(gazette>0&&gazette<SESSION_THRESHOLD);
 // A statute or a plan named with a meeting is no noise; a bare meeting word is too little.
 assert.ok(sessionScore({url:origin+'/b.pdf',label:'Bekanntmachung der Sitzung des Marktgemeinderates – Haushaltssatzung'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:origin+'/r.html',label:'Ratssitzung am 5. November'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:origin+'/s.html',label:'Beschlüsse des Stadtrates'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:origin+'/einladung-seniorennachmittag.html',label:'Einladung zum Seniorennachmittag'})<SESSION_THRESHOLD);
 assert.equal(sessionScore({}),0);
});
test('website listPageScore rewards lists of meeting documents and their headings',()=>{
 // Four links reach the threshold, the headings name "Amtstafel", "Bekanntmachungen", "Sitzungen" and "Gemeinderat".
 assert.equal(listPageScore(list,base),4+2*4);
 assert.equal(listPageScore('<h1>Willkommen</h1><a href="/impressum">Impressum</a>',base),0);
 assert.equal(listPageScore('<h2>Niederschriften</h2><a href="/p/niederschrift-gr-2026-07-01.pdf">Niederschrift</a>',base),1+2);
});
test('website paginationLinks follows TYPO3 news pages on the same list, at most three, never back',()=>{
 const page=origin+'/rathaus/bekanntmachungen/';
 const typo3=[1,2,3,4,5].map(n=>`<li><a href="/rathaus/bekanntmachungen/?tx_news_pi1%5B%40widget_0%5D%5BcurrentPage%5D=${n}&amp;cHash=ab${n}">${n}</a></li>`).join('')
  +'<li><a href="/rathaus/bekanntmachungen/?tx_news_pi1%5B%40widget_0%5D%5BcurrentPage%5D=2&amp;cHash=ab2">weiter »</a></li>'
  +'<a href="https://www.andere-gemeinde.example.test/rathaus/bekanntmachungen/?page=2">2</a><a href="/rathaus/stellen/?page=2">Stellen 2</a><a href="/rathaus/bekanntmachungen/artikel-7">weiter</a>';
 const q=n=>`${page}?tx_news_pi1%5B%40widget_0%5D%5BcurrentPage%5D=${n}&cHash=ab${n}`;
 assert.deepEqual(paginationLinks(typo3,page),[q(2),q(3),q(4)]);
 // From page 3 on, pages 1 to 3 are not asked again.
 assert.deepEqual(paginationLinks(typo3,q(3)),[q(4),q(5)]);
});
test('website paginationLinks takes rel=next, WordPress page paths and "Seite 2", not other origins',()=>{
 const page=origin+'/aktuelles/';
 const html='<link rel="next" href="https://www.gemeinde-musterdorf.example.test/aktuelles/page/2/"><a href="/aktuelles/page/3/">3</a><a href="/aktuelles/page/2/">Ältere Beiträge</a>'
  +'<a href="https://www.gemeinde-musterdorf.example.test:8443/aktuelles/page/4/">4</a><a href="http://www.gemeinde-musterdorf.example.test/aktuelles/page/5/">5</a>';
 assert.deepEqual(paginationLinks(html,page),[origin+'/aktuelles/page/2/',origin+'/aktuelles/page/3/']);
 assert.deepEqual(paginationLinks('<a href="?seite=2">Seite 2</a><a href="?seite=1">Seite 1</a><a rel="next" href="https://cdn.example.test/aktuelles/?seite=2">x</a>',page),[origin+'/aktuelles/?seite=2']);
 assert.deepEqual(paginationLinks('<a href="index.php?start=20">»</a><a href="index.php?start=0">«</a>',origin+'/termine/index.php'),[origin+'/termine/index.php?start=20']);
 assert.deepEqual(paginationLinks('<a href="/x">',page),[]);
});
test('website feedLinks finds announced and linked RSS, Atom and iCal feeds',()=>{
 const html=`<head><link rel="alternate" type="application/rss+xml" title="Aktuelles" href="/aktuelles/rss.xml">
<link rel="alternate" type="application/atom+xml" href="https://www.gemeinde-musterdorf.example.test/feed/atom/"><link rel="alternate" hreflang="en" href="/en/">
<link rel="alternate" type="text/calendar" title="Termine" href="/termine.ics"></head>
<a href="webcal://www.gemeinde-musterdorf.example.test/kalender/sitzungen.ical">Sitzungskalender</a><a href="/index.php?id=12&amp;type=9818">RSS</a>
<a href="/index.php?option=com_content&amp;view=category&amp;id=8&amp;format=feed&amp;type=atom">Atom</a><a href="/news?format=feed&amp;type=rss">Feed</a>
<a href="/aktuelles/rss.xml">doppelt</a><a href="/feed.php" type="application/rss+xml">Nachrichten</a><a href="/bericht.pdf">Bericht</a>`;
 assert.deepEqual(feedLinks(html,base),[
  {url:origin+'/aktuelles/rss.xml',type:'rss',title:'Aktuelles'},{url:origin+'/feed/atom/',type:'atom',title:''},{url:origin+'/termine.ics',type:'ics',title:'Termine'},
  {url:origin+'/kalender/sitzungen.ical',type:'ics',title:'Sitzungskalender'},{url:origin+'/index.php?id=12&type=9818',type:'rss',title:'RSS'},
  {url:origin+'/index.php?option=com_content&view=category&id=8&format=feed&type=atom',type:'atom',title:'Atom'},{url:origin+'/news?format=feed&type=rss',type:'rss',title:'Feed'},
  {url:origin+'/feed.php',type:'rss',title:'Nachrichten'}]);
});
test('website parseFeed reads RSS 2.0 with CDATA, entities and content:encoded',()=>{
 const rss=`<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Kanal</title><link>${origin}/</link>
<item><title><![CDATA[Einladung zur Sitzung des Gemeinderates & Bauausschusses]]></title><link>/aktuelles/einladung-gr-2026-10-14/</link>
<pubDate>Fri, 02 Oct 2026 09:15:00 +0200</pubDate><description>&lt;p&gt;Kurz&lt;/p&gt;</description>
<content:encoded><![CDATA[<p>Am 14.10.2026 findet eine öffentliche Sitzung statt.</p><ol><li>Eröffnung</li></ol>]]></content:encoded></item>
<item><title>Aus dem Gemeinderat &#8211; Sitzung vom 16.&#160;September</title><guid isPermaLink="true">https://www.gemeinde-musterdorf.example.test/?p=812</guid>
<pubDate>Tue, 22 Sep 2026 22:30:00 GMT</pubDate><description>&lt;p&gt;Beschl&amp;uuml;sse&lt;/p&gt;</description></item>
<item><title>Ohne Adresse</title><guid isPermaLink="false">tag:x,812</guid><pubDate>Mo, 21 Sep 2026</pubDate></item></channel></rss>`;
 assert.deepEqual(parseFeed(rss,origin+'/feed/'),[
  {title:'Einladung zur Sitzung des Gemeinderates & Bauausschusses',url:origin+'/aktuelles/einladung-gr-2026-10-14/',date:'2026-10-02',html:'<p>Am 14.10.2026 findet eine öffentliche Sitzung statt.</p><ol><li>Eröffnung</li></ol>'},
  // 22:30 GMT in September is 00:30 of the next day in Germany.
  {title:'Aus dem Gemeinderat – Sitzung vom 16. September',url:origin+'/?p=812',date:'2026-09-23',html:'<p>Beschl&uuml;sse</p>'},
  // A guid that is no address gives none; a German weekday does not hide the date.
  {title:'Ohne Adresse',url:null,date:'2026-09-21',html:''}]);
});
test('website parseFeed reads Atom entries with alternate links, dates and content',()=>{
 const atom=`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Bekanntmachungen</title><link rel="self" href="/feed/atom/"/>
<entry><title type="html">Tagesordnung Hauptausschuss &amp;amp; Finanzen</title><link rel="edit" href="/wp-admin/post.php?post=9"/><link rel="alternate" type="text/html" href="/2026/10/01/tagesordnung-ha/"/>
<updated>2026-10-01T18:00:00+02:00</updated><published>2026-09-30T23:30:00Z</published><summary>Kurz</summary><content type="html">&lt;p&gt;Öffentliche Sitzung&lt;/p&gt;</content></entry>
<entry><title>Niederschrift</title><link href="https://www.gemeinde-musterdorf.example.test/niederschrift-1"/><updated>2026-08-12</updated><summary type="html">&lt;b&gt;Teil&lt;/b&gt;</summary></entry></feed>`;
 assert.deepEqual(parseFeed(atom,origin+'/feed/atom/'),[
  {title:'Tagesordnung Hauptausschuss & Finanzen',url:origin+'/2026/10/01/tagesordnung-ha/',date:'2026-10-01',html:'<p>Öffentliche Sitzung</p>'},
  {title:'Niederschrift',url:origin+'/niederschrift-1',date:'2026-08-12',html:'<b>Teil</b>'}]);
 assert.deepEqual(parseFeed('kein Feed',origin),[]);
});
test('website parseIcs unfolds lines, unescapes text and reads TZID, VALUE=DATE and UTC times in German local time',()=>{
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:19700329T020000','END:DAYLIGHT','END:VTIMEZONE',
  'BEGIN:VEVENT','UID:gr-2026-10-14@gemeinde-musterdorf.example.test','DTSTART;TZID=Europe/Berlin:20261014T190000','SUMMARY:Sitzung des Gemeinderates\\, öffentlich',
  'DESCRIPTION:Tagesordnung:\\n1. Eröffnung\\N2. Bauanträge\\; Vorbescheide\\nPfad C:\\\\Daten','  und weiter','LOCATION:Rathaus\\, Sitzungssaal',
  'URL;VALUE=URI:https://www.gemeinde-musterdorf.example.test/termine/gr-14-10/','BEGIN:VALARM','TRIGGER:-PT15M','DESCRIPTION:Erinnerung','END:VALARM','END:VEVENT',
  'BEGIN:VEVENT','UID:ha-1','DTSTART;VALUE=DATE:20261020','SUMMARY:Hauptausschuss','RRULE:FREQ=MONTHLY','END:VEVENT',
  'BEGIN:VEVENT','UID:ba-1','DTSTART:20260929T223000Z','SUMMARY:Bauausschuss (Sommerzeit)','END:VEVENT',
  'BEGIN:VEVENT','UID:ba-2','DTSTART:20261201T183000Z','SUMMARY:Bauausschuss (Winterzeit)','END:VEVENT',
  'BEGIN:VEVENT','UID:ba-3','DTSTART:20261025T005959Z','SUMMARY:Letzte Sommerminute','END:VEVENT',
  'BEGIN:VTODO','DTSTART:20261001T080000','SUMMARY:Aufgabe','END:VTODO','BEGIN:VEVENT','UID:kaputt','DTSTART:2026-10-01','END:VEVENT','END:VCALENDAR'].join('\r\n');
 const events=parseIcs(ics);
 assert.deepEqual(events[0],{uid:'gr-2026-10-14@gemeinde-musterdorf.example.test',summary:'Sitzung des Gemeinderates, öffentlich',date:'2026-10-14',time:'19:00',
  description:'Tagesordnung:\n1. Eröffnung\n2. Bauanträge; Vorbescheide\nPfad C:\\Daten und weiter',url:'https://www.gemeinde-musterdorf.example.test/termine/gr-14-10/',location:'Rathaus, Sitzungssaal',organizer:'',cancelled:false,attachments:[]});
 assert.deepEqual(events.slice(1).map(e=>[e.uid,e.date,e.time]),[['ha-1','2026-10-20',null],['ba-1','2026-09-30','00:30'],['ba-2','2026-12-01','19:30'],['ba-3','2026-10-25','02:59']]);
});
test('website parseSitemap reads a sitemap index and a URL set; robotsSitemaps reads Sitemap lines',()=>{
 const index=`<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://www.gemeinde-musterdorf.example.test/sitemap.xml?page=1&amp;sitemap=pages</loc><lastmod>2026-09-01</lastmod></sitemap>
<sitemap><loc> /post-sitemap.xml </loc></sitemap></sitemapindex>`;
 assert.deepEqual(parseSitemap(index,origin+'/sitemap_index.xml'),{sitemaps:[origin+'/sitemap.xml?page=1&sitemap=pages',origin+'/post-sitemap.xml'],urls:[]});
 const set=`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/rathaus/bekanntmachungen/</loc><lastmod>2026-10-01T08:00:00+02:00</lastmod><changefreq>daily</changefreq></url>
<url><loc><![CDATA[${origin}/sitzungen/gr-2026-10-14.html]]></loc></url><url><loc>ftp://x.example.test/a</loc></url></urlset>`;
 assert.deepEqual(parseSitemap(set,origin+'/sitemap.xml'),{sitemaps:[],urls:[{url:origin+'/rathaus/bekanntmachungen/',lastmod:'2026-10-01'},{url:origin+'/sitzungen/gr-2026-10-14.html',lastmod:null}]});
 assert.deepEqual(robotsSitemaps(`User-agent: *\nDisallow: /intern/\nSitemap: ${origin}/sitemap.xml\nsitemap:${origin}/news-sitemap.xml\n# Sitemap: ${origin}/alt.xml\nSITEMAP: ${origin}/sitemap.xml\nSitemap: /relativ.xml`),[origin+'/sitemap.xml',origin+'/news-sitemap.xml']);
});
test('website wpApiRoot finds the REST API in both forms and wpEndpoints builds the addresses without search',()=>{
 assert.equal(wpApiRoot(`<link rel='https://api.w.org/' href='${origin}/wp-json/' />`,origin+'/'),origin+'/wp-json/');
 assert.equal(wpApiRoot('<link rel="https://api.w.org/" href="https://wp.gemeinde-musterdorf.example.test/?rest_route=/">',origin),'https://wp.gemeinde-musterdorf.example.test/?rest_route=/');
 assert.equal(wpApiRoot('<link rel="stylesheet" href="/style.css">',origin),null);
 assert.deepEqual(wpEndpoints(origin+'/wp-json/','2026-04-01'),{
  posts:origin+'/wp-json/wp/v2/posts?after=2026-04-01T00:00:00&per_page=50&orderby=date&order=desc&_fields=id,date,link,title,content',
  media:origin+'/wp-json/wp/v2/media?after=2026-04-01T00:00:00&per_page=50&mime_type=application/pdf&_fields=id,date,link,title,source_url'});
 const rest=wpEndpoints(origin+'/?rest_route=/','2026-04-01T12:00:00Z');
 assert.equal(rest.posts,origin+'/?rest_route=/wp/v2/posts&after=2026-04-01T00:00:00&per_page=50&orderby=date&order=desc&_fields=id,date,link,title,content');
 assert.equal(rest.media,origin+'/?rest_route=/wp/v2/media&after=2026-04-01T00:00:00&per_page=50&mime_type=application/pdf&_fields=id,date,link,title,source_url');
 assert.ok(!/search/.test(JSON.stringify([rest,wpEndpoints(origin+'/wp-json','2026-04-01')])));
 assert.equal(wpEndpoints(origin+'/wp-json','2026-04-01').posts.startsWith(origin+'/wp-json/wp/v2/posts?'),true);
 assert.throws(()=>wpEndpoints(origin+'/wp-json/','gestern'),RangeError);
});
test('website parseWpPosts and parseWpMedia read the REST answers',()=>{
 const posts=JSON.stringify([{id:812,date:'2026-10-02T09:15:00',link:origin+'/2026/10/02/einladung-gr/',title:{rendered:'Einladung zur Sitzung des Gemeinderates am 14.10.2026 &#8211; öffentlich'},content:{rendered:'<p>Öffentliche Sitzung</p>'}},{id:813,date:'2026-10-03T08:00:00',title:{rendered:'ohne Link'}}]);
 assert.deepEqual(parseWpPosts(posts),[{title:'Einladung zur Sitzung des Gemeinderates am 14.10.2026 – öffentlich',url:origin+'/2026/10/02/einladung-gr/',date:'2026-10-02',html:'<p>Öffentliche Sitzung</p>'}]);
 const media=[{id:901,date:'2026-09-17T10:00:00',link:origin+'/niederschrift-gr/',title:{rendered:'Niederschrift GR 16.09.2026'},source_url:origin+'/wp-content/uploads/2026/09/Niederschrift_GR_2026-09-16.pdf'},{id:902,date:'2026-09-18T10:00:00',title:{rendered:'Bild'},source_url:origin+'/a.jpg',mime_type:'image/jpeg'}];
 assert.deepEqual(parseWpMedia(media),[{title:'Niederschrift GR 16.09.2026',url:origin+'/wp-content/uploads/2026/09/Niederschrift_GR_2026-09-16.pdf',date:'2026-09-17',kind:'pdf'}]);
 assert.deepEqual(parseWpPosts('<html>Fehler</html>'),[]);assert.deepEqual(parseWpMedia({code:'rest_forbidden'}),[]);
});
test('website jsonLdEvents reads schema.org events, also in @graph and arrays',()=>{
 const html=`<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","@id":"${origin}/termine/"},
{"@type":"Event","name":"Sitzung des Gemeinderates &amp; Ortsbeirates","startDate":"2026-10-14T19:00:00+02:00","description":"<p>Öffentliche Sitzung</p>","url":"/termine/gr-14-10/"}]}</script>
<script type="application/ld+json">[{"@type":["Event"],"name":"Bauausschuss","startDate":"2026-09-29T22:30:00Z","@id":"${origin}/termine/ba#event"},{"@type":"EducationEvent","name":"Kurs","startDate":"2026-11-02"},{"@type":"Event","name":"ohne Datum"}]</script>
<script type="application/ld+json">{ kaputt </script><script>var x={"@type":"Event","name":"kein JSON-LD","startDate":"2026-10-01"};</script>`;
 assert.deepEqual(jsonLdEvents(html,origin+'/termine/'),[
  {name:'Sitzung des Gemeinderates & Ortsbeirates',date:'2026-10-14',time:'19:00',description:'Öffentliche Sitzung',url:origin+'/termine/gr-14-10/',location:'',organizer:'',cancelled:false,links:[]},
  {name:'Bauausschuss',date:'2026-09-30',time:'00:30',description:'',url:origin+'/termine/ba',location:'',organizer:'',cancelled:false,links:[]},
  {name:'Kurs',date:'2026-11-02',time:null,description:'',url:null,location:'',organizer:'',cancelled:false,links:[]}]);
});
test('website generatorOf names the CMS of a page',()=>{
 assert.equal(generatorOf('<meta name="generator" content="TYPO3 CMS">'),'TYPO3 CMS');
 assert.equal(generatorOf(`<meta content='WordPress 6.6.2' name='generator'/>`),'WordPress 6.6.2');
 assert.equal(generatorOf('<META NAME="Generator" CONTENT="Joomla! - Open Source Content Management">'),'Joomla! - Open Source Content Management');
 assert.equal(generatorOf('<meta name="description" content="Gemeinde"><meta name="generator" content="IKISS">'),'IKISS');
 assert.equal(generatorOf('<meta name="viewport" content="width=device-width">'),null);assert.equal(generatorOf(null),null);
});
test('website documentLinks reads German month names and ignores impossible dates and empty pages',()=>{
 const html='<a href="/a">Sitzung am 3. Okt. 2026</a><a href="/b">Einladung 1.März 2026</a><a href="/c">Niederschrift 31.02.2026</a><a href="/d" aria-label="Tagesordnung 07.10.2026">TO</a>';
 assert.deepEqual(documentLinks(html,base).map(l=>[l.label,l.date]),[['Sitzung am 3. Okt. 2026','2026-10-03'],['Einladung 1.März 2026','2026-03-01'],['Niederschrift 31.02.2026',null],['TO Tagesordnung 07.10.2026','2026-10-07']]);
 assert.deepEqual(documentLinks('',base),[]);assert.deepEqual(documentLinks(null,base),[]);
 // An address that cannot be resolved is no link.
 assert.deepEqual(documentLinks('<a href="https://[kaputt">x</a><a>ohne</a>',base),[]);
});
test('website sessionScore reads words of the address where the label says little',()=>{
 assert.ok(sessionScore({url:origin+'/aktuelles/aus-dem-gemeinderat-september/',label:'mehr'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:origin+'/files/Protokoll_Ortschaftsrat_2026-09-02.pdf',label:'Download'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:origin+'/files/protokoll.pdf',label:'Protokoll'})<SESSION_THRESHOLD);
 assert.equal(sessionScore({url:origin+'/files/sitzung-nicht_oeffentlich.pdf',label:'Download'}),-100);
 // The meeting of the electoral committee is a meeting; the notice of an election is not.
 assert.ok(sessionScore({url:origin+'/a.pdf',label:'Bekanntmachung der Sitzung des Wahlausschusses'})>=SESSION_THRESHOLD);
 assert.ok(sessionScore({url:origin+'/b.pdf',label:'Bekanntmachung zur Wahl des Ortsbeirates'})<0);
 // The host is not read: a host name with "sitzung" or "gemeinderat" scores nothing.
 assert.equal(sessionScore({url:'https://sitzung.gemeinderat.example.test/',label:''}),0);
});
test('website paginationLinks reads offset and p parameters and keeps the list path',()=>{
 const page=origin+'/termine/?p=2';
 assert.deepEqual(paginationLinks('<a href="?p=1">1</a><a href="?p=2">2</a><a href="?p=3">3</a><a href="/termine/?p=3#liste">nächste Seite</a><a href="/termine/archiv/?p=4">4</a>',page),[origin+'/termine/?p=3']);
 assert.deepEqual(paginationLinks('<a href="?offset=10">›</a><a href="?offset=20">2</a><a href="?offset=30">3</a><a href="?offset=40">4</a>',origin+'/news/'),[origin+'/news/?offset=10',origin+'/news/?offset=20',origin+'/news/?offset=30']);
 assert.deepEqual(paginationLinks('<a href="?page=2">2</a>','kein Link'),[]);
});
test('website parseIcs reads LF lines, tab folding, TZID=UTC and the turn of the year in winter time',()=>{
 const ics='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nDTSTART;TZID=UTC:20261231T233000\nSUMMARY:Gemeinde\n\tvertretung\nEND:VEVENT\nBEGIN:VEVENT\nUID:b\nDTSTART:20260328T230000Z\nSUMMARY:vor der Umstellung\nEND:VEVENT\nBEGIN:VEVENT\nUID:c\nDTSTART:20260329T010000Z\nSUMMARY:nach der Umstellung\nEND:VEVENT\nBEGIN:VEVENT\nUID:d\nDTSTART:20261014T190000\nSUMMARY:schwebend\nURL:mailto:x@example.test\nEND:VEVENT\nEND:VCALENDAR';
 assert.deepEqual(parseIcs(ics).map(e=>[e.uid,e.summary,e.date,e.time,e.url]),[['a','Gemeindevertretung','2027-01-01','00:30',null],['b','vor der Umstellung','2026-03-29','00:00',null],['c','nach der Umstellung','2026-03-29','03:00',null],['d','schwebend','2026-10-14','19:00',null]]);
 assert.deepEqual(parseIcs(''),[]);assert.deepEqual(parseIcs('BEGIN:VEVENT\nSUMMARY:ohne Ende'),[]);
});
test('website parseFeed reads Atom XHTML content and RSS dates in ISO form',()=>{
 const atom=`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Sitzungsbericht</title><link href="/b-1"/><published>2026-07-08T19:00:00</published><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Beschl&#252;sse</p></div></content></entry></feed>`;
 assert.deepEqual(parseFeed(atom,origin+'/'),[{title:'Sitzungsbericht',url:origin+'/b-1',date:'2026-07-08',html:'<div xmlns="http://www.w3.org/1999/xhtml"><p>Beschlüsse</p></div>'}]);
 const rss=`<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><item><title>Niederschrift</title><link>${origin}/n-1</link><dc:date>2026-06-30T23:15:00Z</dc:date></item></channel></rss>`;
 assert.deepEqual(parseFeed(rss,origin).map(e=>e.date),['2026-07-01']);
});
test('website jsonLdEvents finds events nested in lists and pages, and none in an empty page',()=>{
 const html=`<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Event","name":"Ortschaftsrat","startDate":"2026-10-21 18:30","url":"${origin}/t/or"}}]}</script>`;
 assert.deepEqual(jsonLdEvents(html,origin),[{name:'Ortschaftsrat',date:'2026-10-21',time:'18:30',description:'',url:origin+'/t/or',location:'',organizer:'',cancelled:false,links:[]}]);
 assert.deepEqual(jsonLdEvents('',origin),[]);assert.deepEqual(robotsSitemaps(''),[]);assert.deepEqual(parseSitemap('',origin),{sitemaps:[],urls:[]});
});

test('website isRisLink knows the council systems the project has readers for; isSearchLink the site search',()=>{
 for(const u of ['https://www.stadt.example.test/pio/index.php?aktiv=tagesordnungen&id=5','https://risi.stadt.example.test/risi/sitzung/detail/123','https://www.stadt.example.test/piwi/sitzung/detail/123','https://www.stadt.example.test/sitzungsdienst/sitzung/123','https://www.stadt.example.test/gremieninfo/sitzung.php?id=3','https://www.stadt.example.test/buergerinfo/to0040.asp?__ksinr=1'])assert.equal(isRisLink(u),true,u);
 for(const u of ['https://www.stadt.example.test/rathaus/bekanntmachungen/','https://www.stadt.example.test/politik/sitzungen/2026/'])assert.equal(isRisLink(u),false,u);
 for(const u of ['https://www.stadt.example.test/suche?q=Sitzung','https://www.stadt.example.test/search/?query=Gemeinderat','https://www.stadt.example.test/index.php?id=5&tx_kesearch_pi1%5Bsword%5D=Sitzung','https://www.stadt.example.test/?s=Gemeinderat','https://www.stadt.example.test/seite?tx_solr[q]=rat'])assert.equal(isSearchLink(u),true,u);
 for(const u of ['https://www.stadt.example.test/rathaus/bekanntmachungen/?seite=2','https://www.stadt.example.test/aktuelles/sitzung-gemeinderat.html'])assert.equal(isSearchLink(u),false,u);
});

test('website sessionScore closes short forms of the non-public part and umlauts in any Unicode form',()=>{
 for(const l of [{url:'https://www.stadt.example.test/dl/protokoll_noe_2026-09-16.pdf',label:''},{url:'https://www.stadt.example.test/dl/nichtoeff-gr-2026-09-16.pdf',label:''},{url:'https://www.stadt.example.test/a.pdf',label:'Protokoll (nö) Gemeinderat 16.09.2026'},{url:'https://www.stadt.example.test/a.pdf',label:'Niederschrift N.Ö. Sitzung Gemeinderat'},{url:'https://www.stadt.example.test/a.pdf',label:'Niederschrift nichtöffentliche Sitzung Gemeinderat'.normalize('NFD')}])assert.equal(sessionScore(l),-100,l.label||l.url);
 assert.ok(sessionScore({url:'https://www.stadt.example.test/a.pdf',label:'Niederschrift öffentliche Sitzung Gemeinderat'.normalize('NFD')})>=SESSION_THRESHOLD);
});

test('website sessionScore gives -100 to the short forms, typos and encodings of the non-public part (hardening round 1)',()=>{
 for(const label of ['Protokoll Gemeinderatssitzung 16.09.2026 (n.öff.)','Protokoll Gemeinderatssitzung 16.09.2026 nöff. Teil','Niederschrift Gemeinderat 16.09.2026 (NÖS)','Niederschrift Gemeinderat 16.09.2026 (geschl. Sitzung)',
  'Niederschrift Gemeinderat 16.09.2026 – nichtöfftl.','Niederschrift Gemeinderat 16.09.2026 (vertr.)','Niederschrift Gemeinderat 16.09.2026 – Teil N','Niederschrift Gemeinderat 16.09.2026 Nichtöfentlich','Niederschrift Gemeinderat 16.09.2026 Nicht&amp;ouml;ffentlich'])
  assert.equal(sessionScore({url:'https://www.gemeinde-musterdorf.example.test/f/a.pdf',label}),-100,label);
 for(const path of ['/f/Protokoll_GR_2026-09-16_nicht%F6ffentlich.pdf','/f/protokoll-gr-16-09-2026-nichtoef.pdf','/f/protokoll_gr_20260916_noeS.pdf','/f/gr-2026-09-16-n-oeff.pdf'])
  assert.equal(sessionScore({url:'https://www.gemeinde-musterdorf.example.test'+path,label:'Niederschrift Gemeinderat 16.09.2026'}),-100,path);
 assert.ok(sessionScore({url:'https://www.gemeinde-musterdorf.example.test/f/a.pdf',label:'Niederschrift Gemeinderat 16.09.2026'})>=SESSION_THRESHOLD);
});
