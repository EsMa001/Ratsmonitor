import test from 'node:test';
import assert from 'node:assert/strict';
import {htmlToLines,pdfLines,parseSessionText} from '../server/integrations/website-text.mjs';
import {collectWebsite} from '../server/integrations/website.mjs';
import {cases,feedCases,closedLabels,closedPaths,multiCases,closedRedirects} from './fixtures/website/leaks/corpus.mjs';
import {fetchSiteText,fetchSiteBytes} from '../server/integrations/website.mjs';
// Every leak found so far (texts NACHGEBILDET, see the corpus) is read by the text parser and by the whole reader; no
// item of the non-public part, of a foreign body, with a wrong day or naming a person may come out.

const base='https://www.musterbach.example.test/';
const enc=s=>new TextEncoder().encode(s);
const latin1=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)<256?c.charCodeAt(0):63));
const low=s=>String(s).toLowerCase();
const fakeSite=({pages={},docs={}})=>{
 const calls=[],texts=new Map();
 const answer=(map,url)=>{calls.push(url);if(url===base+'robots.txt')return 'User-agent: *\nAllow: /\n';const v=map[url];if(v===undefined)throw Error('Quelle antwortet mit HTTP 404');return v;};
 const getBytes=async url=>{const v=answer(docs,url);if(v.pdf!==undefined){const key='%PDF-1.7 '+url;texts.set(key,v.pdf);return {bytes:enc(key),type:'application/pdf'};}return v;};
 return {calls,get:async url=>answer(pages,url),getBytes,pdfText:async bytes=>texts.get(new TextDecoder().decode(bytes))};
};
const collect=async(c,{pages,docs,source})=>{
 const site=fakeSite({pages,docs});
 const src={id:'de-09999001',name:'Gemeinde Musterbach',kind:'city',method:'scraper',adapter:'website',base,pages:[],...source,...c.source};
 const d=await collectWebsite(src,{now:new Date(`${c.now||'2026-10-04'}T10:00:00Z`),get:site.get,getBytes:site.getBytes,pdfText:site.pdfText,window:'12m'});
 return {d,calls:site.calls};
};
const docBytes=c=>c.encoding==='utf8-declared-latin1'?{bytes:enc(c.text),type:'text/html'}:c.encoding==='latin1-declared-utf8'?{bytes:latin1(c.text),type:'text/html; charset=utf-8'}:{bytes:enc(c.text),type:'text/html; charset=utf-8'};
// The address carries no part of the case's name ("…-np", "…-noet" would keep the reader from fetching it) and words that
// make the link one of a meeting; every case must be read.
const pathOf=c=>c.path||`${c.doc==='pdf'?'fileadmin/sitzung':'rathaus/sitzung'}/tagesordnung-${cases.indexOf(c)+1}.${c.doc==='pdf'?'pdf':'html'}`;
async function readCase(c){
 const path=pathOf(c);
 const list=base+'rathaus/bekanntmachungen/';
 const label=String(c.label).replace(/&/g,'&amp;').replace(/</g,'&lt;');
 const {d,calls}=await collect(c,{pages:{[list]:`<html><body><main><h1>Bekanntmachungen</h1><ul><li><a href="/${path}">${label}</a></li></ul></main></body></html>`},docs:{[base+path]:c.doc==='pdf'?{pdf:c.text}:docBytes(c)},source:{pages:[list]}});
 assert.ok(calls.includes(base+path),`${c.id}: the document must be read`);
 return d.topics.map(t=>({title:t.title,date:t.eventDate,committee:t.committee}));
}
function parsed(c){
 const html=c.encoding==='latin1-declared-utf8'?new TextDecoder('utf-8').decode(latin1(c.text)):c.text;
 const lines=c.doc==='pdf'?pdfLines(c.text):htmlToLines(html);
 return parseSessionText(lines,{title:c.label,wrapped:c.doc==='pdf'}).meetings.flatMap(m=>m.items.map(i=>({title:i.title,date:m.date,committee:m.committee})));
}
function check(c,items,level,allow){
 for(const it of items){
  for(const word of [...c.forbid||[],...level==='collectWebsite'?c.collectForbid||[]:[]])assert.ok(!low(it.title).includes(low(word)),`${c.id} (${level}): „${it.title}“ must not come out`);
  if(allow)assert.ok(allow.some(a=>low(it.title).startsWith(low(a))),`${c.id} (${level}): „${it.title}“ is not one of ${JSON.stringify(allow)}`);
  // A meeting without a day is not taken by the reader; with a day it must be the right one.
  if(c.date&&(level==='collectWebsite'||it.date!==null))assert.equal(it.date,c.date,`${c.id} (${level}): day of „${it.title}“`);
  if(c.committee)assert.ok(String(it.committee).startsWith(c.committee),`${c.id} (${level}): body of „${it.title}“ is ${it.committee}`);
  // Several meetings in one text: the items named by their start belong to the day and body given.
  for(const [start,date,committee] of c.expect||[])if(low(it.title).startsWith(low(start))){
   if(level==='collectWebsite'||it.date!==null)assert.equal(it.date,date,`${c.id} (${level}): day of „${it.title}“`);
   assert.ok(String(it.committee).startsWith(committee),`${c.id} (${level}): body of „${it.title}“ is ${it.committee}`);
  }
  if(c.check==='calendar'){
   const want=/Kita|Haushalt/.test(it.title)?['2026-10-14','Gemeinderat']:['2026-10-20','Bauausschuss'];
   assert.deepEqual([it.date,it.committee],want,`${c.id} (${level}): „${it.title}“ belongs to ${want.join(' ')}`);
  }
 }
}

for(const c of cases){
 test(`leak corpus ${c.id}: text parser`,()=>{check(c,parsed(c),'parseSessionText',c.allow);});
 test(`leak corpus ${c.id}: reader`,async()=>{check(c,await readCase(c),'collectWebsite',c.collectAllow??c.allow);});
}

const rss=c=>`<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Musterbach</title><item><title>${c.title}</title><link>${base}aktuelles/${c.id}.html</link><pubDate>Fri, 02 Oct 2026 08:00:00 +0200</pubDate><content:encoded><![CDATA[${c.html}]]></content:encoded></item></channel></rss>`;
const ics=c=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${c.id}\r\nDTSTART;TZID=Europe/Berlin:${c.dtstart}\r\nSUMMARY:${c.summary}\r\nDESCRIPTION:${c.description}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
for(const c of feedCases)test(`leak corpus ${c.id}: reader (${c.kind})`,async()=>{
 const url=base+(c.kind==='rss'?'aktuelles/feed.rss':'veranstaltungen/kalender.ics');
 const {d}=await collect(c,{pages:{[url]:c.kind==='rss'?rss(c):ics(c)},source:c.kind==='rss'?{feeds:[url]}:{ics:[url]}});
 check(c,d.topics.map(t=>({title:t.title,date:t.eventDate,committee:t.committee})),'collectWebsite');
});

test('leak corpus: links, sitemap addresses and labels that name the non-public part are never fetched',async()=>{
 const list=base+'rathaus/sitzungen/',links=[...closedLabels.map((l,i)=>[`/f/doc${i}.pdf`,l]),...closedPaths.map(p=>[p,'Niederschrift Gemeinderat 16.09.2026'])];
 const html=`<html><body><main><h1>Sitzungen</h1><ul>${links.map(([u,l])=>`<li><a href="${u}">${l}</a></li>`).join('')}</ul></main></body></html>`;
 const sitemap=base+'sitemap.xml',xml=`<?xml version="1.0"?><urlset>${closedPaths.map(p=>`<url><loc>${base}${p.slice(1)}</loc><lastmod>2026-09-20</lastmod></url>`).join('')}</urlset>`;
 const {calls}=await collect({id:'links'},{pages:{[list]:html,[sitemap]:xml},docs:{},source:{pages:[list],sitemap}});
 const asked=new Set(calls);
 for(const [u,l] of links)assert.ok(!asked.has(new URL(u,base).href),`${u} (${l}) must not be fetched`);
});

// Several documents of one meeting on one list page.
for(const c of multiCases)test(`leak corpus ${c.id}: reader (several documents)`,async()=>{
 const list=base+'rathaus/bekanntmachungen/';
 const html=`<html><body><main><h1>Bekanntmachungen</h1><ul>${c.docs.map(d=>`<li><a href="/${d.path}">${d.label}</a></li>`).join('')}</ul></main></body></html>`;
 const docs=Object.fromEntries(c.docs.map(d=>[base+d.path,d.doc==='pdf'?{pdf:d.text}:{bytes:enc(d.text),type:'text/html; charset=utf-8'}]));
 const {d,calls}=await collect(c,{pages:{[list]:html},docs,source:{pages:[list]}});
 for(const doc of c.docs)assert.ok(calls.includes(base+doc.path),`${c.id}: ${doc.path} must be read`);
 check(c,d.topics.map(t=>({title:t.title,date:t.eventDate,committee:t.committee})),'collectWebsite');
});

test('leak corpus: redirect targets that name the non-public part are never fetched',async()=>{
 const source={id:'x',base,alsoFrom:[]};
 for(const target of closedRedirects){
  const asked=[];
  const request=async url=>{asked.push(url);if(url.includes('dumpFile'))return new Response(null,{status:302,headers:{location:target}});return new Response('%PDF-1.7',{status:200,headers:{'content-type':'application/pdf'}});};
  await assert.rejects(fetchSiteBytes(base+'index.php?eID=dumpFile&f=102',source,5000,request));
  await assert.rejects(fetchSiteText(base+'index.php?eID=dumpFile&f=103',source,5000,request));
  assert.ok(!asked.some(u=>u.includes(target.split('/').pop())),`${target} must not be fetched`);
 }
});

// Round 3: a page that types off the agenda without its parts and links the official notice of the same day.
test('leak corpus r3-html-links-pdf: the notice linked from a page with items is read, its non-public items never come out',async()=>{
 const list=base+'rathaus/sitzungen/',detail=base+'rathaus/sitzungen/gr-2026-10-14.html',notice=base+'fileadmin/einladung-gemeinderat-2026-10-14.pdf';
 const html='<html><body><main><h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>Beginn: 19:00 Uhr</p><p>1. Bauantrag Carport Fl.Nr. 210</p><p>2. Haushalt 2027</p><p>3. Grundstücksangelegenheit Flurstück 412</p><p><a href="/fileadmin/einladung-gemeinderat-2026-10-14.pdf">Einladung Gemeinderat 14.10.2026 (PDF)</a></p></main></body></html>';
 const pdf=`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
Öffentlicher Teil
1. Bauantrag Carport Fl.Nr. 210
2. Haushalt 2027
Nichtöffentlicher Teil
3. Grundstücksangelegenheit Flurstück 412`;
 const {d,calls}=await collect({id:'r3-html-links-pdf'},{pages:{[list]:'<html><body><main><a href="/rathaus/sitzungen/gr-2026-10-14.html">Öffentliche Sitzung des Gemeinderates am 14.10.2026</a></main></body></html>'},docs:{[detail]:{bytes:enc(html),type:'text/html; charset=utf-8'},[notice]:{pdf}},source:{pages:[list]}});
 assert.ok(calls.includes(notice),'the linked notice of the same day is read');
 assert.deepEqual(d.topics.map(t=>t.title).sort(),['Bauantrag Carport Fl.Nr. 210','Haushalt 2027']);
});

// Round 3: minutes renumbered after an item was withdrawn; the outcome of one building application never lands on another.
test('leak corpus r3-renumbered-result: an outcome is not given to another item of similar wording',async()=>{
 const list=base+'rathaus/sitzungen/',inv=base+'fileadmin/einladung-gr-2026-09-16.pdf',min=base+'fileadmin/niederschrift-gr-2026-09-16.pdf';
 const {d}=await collect({id:'r3-renumbered-result'},{pages:{[list]:`<html><body><main><a href="/fileadmin/einladung-gr-2026-09-16.pdf">Einladung Gemeinderat 16.09.2026</a><a href="/fileadmin/niederschrift-gr-2026-09-16.pdf">Niederschrift Gemeinderat 16.09.2026</a></main></body></html>`},docs:{
  [inv]:{pdf:`Gemeinde Musterbach
Einladung zur öffentlichen Sitzung des Gemeinderates am Mittwoch, 16.09.2026, 19:00 Uhr
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Neubau eines Einfamilienhauses Am Hang
3. Bauantrag Neubau eines Einfamilienhauses Lindenweg
4. Anfragen`},
  [min]:{pdf:`Niederschrift über die öffentliche Sitzung des Gemeinderates
am Mittwoch, 16.09.2026
Der Bauantrag Am Hang wurde vom Antragsteller zurückgezogen; die folgenden Punkte wurden neu nummeriert.
1. Genehmigung der Niederschrift
Die Niederschrift wird genehmigt. Abstimmung: 12:0
2. Bauantrag Neubau eines Einfamilienhauses Lindenweg
Beschluss: Das gemeindliche Einvernehmen wird nicht erteilt. Abstimmung: 2:10
3. Anfragen
Keine.`}},source:{pages:[list]}});
 const hang=d.topics.find(t=>/Am Hang/.test(t.title)),linden=d.topics.filter(t=>/Lindenweg/.test(t.title));
 assert.ok(hang,'the item of the invitation stays');
 assert.notEqual(hang.status,'rejected');
 assert.ok(!hang.events.some(e=>/nicht erteilt/.test(e.result||'')),'the outcome of Lindenweg is not given to Am Hang');
 assert.ok(linden.some(t=>t.status==='rejected'),'Lindenweg carries its own outcome');
});

// Round 3: a WordPress post whose title names the day of the notice, its text only "am kommenden Mittwoch".
test('leak corpus r3-wp-title-posting-date: the day of a post title is not the meeting day',async()=>{
 const root=base+'wp-json/';
 const posts=JSON.stringify([{id:1,date:'2026-10-05T08:00:00',link:base+'aktuelles/bekanntmachung-sitzung/',title:{rendered:'Bekanntmachung vom 05.10.2026: Sitzung des Gemeinderates'},content:{rendered:'<p>Die nächste öffentliche Sitzung des Gemeinderates findet am kommenden Mittwoch um 19:00 Uhr im Sitzungssaal des Rathauses statt.</p><p>Tagesordnung:</p><p>1. Bauantrag Neubau Carport, Fl.Nr. 210<br>2. Haushaltsplan 2027 – Vorberatung<br>3. Anfragen</p>'}}]);
 const site=fakeSite({pages:{}}),asked=[];
 const get=async url=>{asked.push(url);if(url.startsWith(root+'wp/v2/posts'))return posts;if(url.startsWith(root+'wp/v2/media'))return '[]';return site.get(url);};
 const d=await collectWebsite({id:'de-09999001',name:'Gemeinde Musterbach',kind:'city',method:'scraper',adapter:'website',base,pages:[],wp:root},{now:new Date('2026-10-04T10:00:00Z'),get,getBytes:site.getBytes,pdfText:site.pdfText,window:'12m'});
 assert.ok(asked.some(u=>u.startsWith(root+'wp/v2/posts')),'the posts are read');
 assert.deepEqual(d.topics.map(t=>t.title),[]);
 assert.ok(d.coverage.issues.some(i=>/Keine Sitzung erkannt|ohne erkennbares Datum/.test(i)),'the post is read, its day is not known');
});

// --- round 4: documents of one meeting that must be read together ---------------------------------------------------
// A site of several documents: pages (text), documents (bytes or PDF text), robots.txt and errors per address.
const site4=({pages={},docs={},robots='User-agent: *\nAllow: /\n',fail={}})=>{
 const calls=[],texts=new Map();
 const answer=(map,url)=>{calls.push(url);if(fail[url])throw Error(fail[url]);if(url.endsWith('/robots.txt'))return robots;const v=map[url];if(v===undefined)throw Error('Quelle antwortet mit HTTP 404');return v;};
 return {calls,get:async url=>answer(pages,url),getBytes:async url=>{const v=answer(docs,url);if(v.pdf!==undefined){const key='%PDF-1.7 '+url;texts.set(key,v.pdf);return {bytes:enc(key),type:'application/pdf'};}return {bytes:enc(v),type:'text/html; charset=utf-8'};},pdfText:async bytes=>texts.get(new TextDecoder().decode(bytes))};
};
const collect4=async(source,web,now='2026-10-04')=>collectWebsite({id:'de-09999001',name:'Gemeinde Musterbach',kind:'city',method:'scraper',adapter:'website',base,pages:[],...source},{now:new Date(`${now}T10:00:00Z`),get:web.get,getBytes:web.getBytes,pdfText:web.pdfText,window:'12m'});
const SECRET4=/Grundstück|Personal|Erwerb|Einstellung/;
const titles4=d=>d.topics.map(t=>`${t.eventDate} ${t.title}`);
const noSecret=(d,what)=>{for(const t of titles4(d))assert.ok(!SECRET4.test(t),`${what}: „${t}“ must not come out`);};
const NOTICE_PAGE=(day='14.10.2026')=>`<html><body><main><h2>Öffentlicher Teil</h2><p>Sitzung des Gemeinderates am ${day}, 19:00 Uhr</p><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027</p><h2>Nichtöffentlicher Teil</h2><p>4. Grundstücksverkauf Fl.Nr. 412<br>5. Personalangelegenheit Bauhof</p></main></body></html>`;
const ALL_FIVE='1. Genehmigung der Niederschrift\n2. Bauantrag Kita Sonnenschein\n3. Haushalt 2027\n4. Grundstücksverkauf Fl.Nr. 412\n5. Personalangelegenheit Bauhof';
const PARTS_PDF=(day='14.10.2026')=>`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, ${day}, 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Kita Sonnenschein
3. Haushalt 2027
Nichtöffentlicher Teil
4. Grundstücksverkauf Fl.Nr. 412
5. Personalangelegenheit Bauhof`;

test('leak corpus r4-ics-links-notice: a calendar entry is cut by the non-public items of the notice it links',async()=>{
 const ics=base+'kalender.ics',page=base+'rathaus/sitzungen/gemeinderat-2026-10-14.html';
 const cal=`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a1\r\nDTSTART;TZID=Europe/Berlin:20261014T190000\r\nSUMMARY:Öffentliche Sitzung des Gemeinderates\r\nURL:${page}\r\nDESCRIPTION:Tagesordnung:\\n${ALL_FIVE.replace(/\n/g,'\\n')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
 const web=site4({pages:{[ics]:cal},docs:{[page]:NOTICE_PAGE()}});
 const d=await collect4({ics:[ics]},web);
 noSecret(d,'r4-ics-links-notice');
 assert.ok(titles4(d).some(t=>/Haushalt 2027/.test(t)),'the public items stay');
});

test('leak corpus r4-jsonld-inline-description: an event description with all items in one line yields no title holding several items',async()=>{
 const list=base+'rathaus/termine/',page=base+'rathaus/sitzungen/gemeinderat-2026-10-14.html';
 const ld=JSON.stringify({'@context':'https://schema.org','@type':'Event',name:'Öffentliche Sitzung des Gemeinderates',startDate:'2026-10-14T19:00',url:page,description:'<p>1. Genehmigung der Niederschrift 2. Bauantrag Kita Sonnenschein 3. Grundstücksverkauf Fl.Nr. 412 4. Personalangelegenheit</p>'});
 const web=site4({pages:{[list]:`<html><head><script type="application/ld+json">${ld}</script></head><body><main><h1>Termine</h1></main></body></html>`},docs:{[page]:NOTICE_PAGE()}});
 const d=await collect4({pages:[list]},web);
 noSecret(d,'r4-jsonld-inline-description');
});

for(const [id,link,nolink] of [['r4-rss-foreign-host','https://musterbach.example.test/aktuelles/',false],['r4-rss-no-link','',true]])test(`leak corpus ${id}: entries of one feed check each other also where they share the feed's address`,async()=>{
 const feed=base+'aktuelles/feed.rss';
 const item=(title,slug,html)=>`<item><title>${title}</title>${nolink?'':`<link>${link}${slug}.html</link>`}<pubDate>Mon, 19 Oct 2026 08:00:00 +0200</pubDate><content:encoded><![CDATA[${html}]]></content:encoded></item>`;
 const xml=`<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Musterbach</title>${item('Niederschrift Gemeinderatssitzung vom 14.10.2026','niederschrift-gr',`<p>Niederschrift über die öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr</p><p>Tagesordnung:</p><p>${ALL_FIVE.replace(/\n/g,'<br>')}</p><p>Zu 1.: Die Niederschrift wird genehmigt.</p>`)}${item('Einladung zur Sitzung des Gemeinderates am 14.10.2026','einladung-gr',`<p>Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr</p><p><strong>Öffentlicher Teil</strong></p><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027</p><p><strong>Nichtöffentlicher Teil</strong></p><p>4. Grundstücksverkauf Fl.Nr. 412<br>5. Personalangelegenheit Bauhof</p>`)}</channel></rss>`;
 const d=await collect4({feeds:[feed]},site4({pages:{[feed]:xml}}),'2026-10-20');
 noSecret(d,id);
});

test('leak corpus r4-wp-http-links: WordPress posts of one meeting check each other also with http links',async()=>{
 const root=base+'wp-json/';
 const posts=JSON.stringify([{id:12,date:'2026-10-19T08:00:00',link:'http://www.musterbach.example.test/2026/10/19/niederschrift-gr/',title:{rendered:'Niederschrift der Gemeinderatssitzung vom 14.10.2026'},content:{rendered:`<p>Niederschrift über die öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr</p><p>Tagesordnung:</p><p>${ALL_FIVE.replace(/\n/g,'<br>')}</p>`}},
  {id:11,date:'2026-10-07T08:00:00',link:'http://www.musterbach.example.test/2026/10/07/einladung-gr/',title:{rendered:'Einladung zur Sitzung des Gemeinderates am 14.10.2026'},content:{rendered:'<p>Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr</p><h3>Öffentlicher Teil</h3><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027</p><h3>Nichtöffentlicher Teil</h3><p>4. Grundstücksverkauf Fl.Nr. 412<br>5. Personalangelegenheit Bauhof</p>'}}]);
 const web=site4({});const get=async url=>{if(url.startsWith(root+'wp/v2/posts'))return posts;if(url.startsWith(root+'wp/v2/media'))return '[]';return web.get(url);};
 const d=await collect4({wp:root},{...web,get},'2026-10-20');
 noSecret(d,'r4-wp-http-links');
});

// A page that types off the agenda without its parts and links the notice as PDF: the PDF is read, or the page yields nothing.
const PAGE5=pdfHref=>`<html><body><main><h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>${ALL_FIVE.replace(/\n/g,'<br>')}</p><p><a href="${pdfHref}">Einladung Gemeinderatssitzung (PDF)</a></p></main></body></html>`;
const pageCase=async({pdfPath,pdfLink=pdfPath,listExtra='',robots,fail={},pdf=PARTS_PDF(),label='Sitzung Gemeinderat 14.10.2026'})=>{
 const list=base+'bek/',page=base+'rathaus/sitzungen/gemeinderat-2026-10-14.html';
 const web=site4({robots,fail,pages:{[list]:`<html><body><main><ul><li><a href="/rathaus/sitzungen/gemeinderat-2026-10-14.html">${label}</a> ${listExtra}</li></ul></main></body></html>`},docs:{[page]:PAGE5(pdfLink),...(pdfPath?{[new URL(pdfPath,base).href]:{pdf}}:{})}});
 return {web,d:await collect4({pages:[list]},web)};
};
test('leak corpus r4-page-pdf-icon-in-list: the PDF linked next to the page in the list is read in the second round',async()=>{
 const pdf='/fileadmin/einladungen/einladung-gr-2026-10-14.pdf';
 const {d,web}=await pageCase({pdfPath:pdf,listExtra:`<a href="${pdf}"><img src="/icons/pdf.svg" alt="PDF"></a>`});
 assert.ok(web.calls.includes(base+pdf.slice(1)),'the PDF is read');
 noSecret(d,'r4-page-pdf-icon-in-list');
 assert.ok(titles4(d).some(t=>/Haushalt 2027/.test(t)));
});
for(const [id,pdfPath] of [['r4-page-pdf-undated','/fileadmin/user_upload/Einladung_GR.pdf'],['r4-page-pdf-download-php','/output/download.php?fid=3412.88.1.PDF'],['r4-page-pdf-posting-date','/fileadmin/einladungen/2026-10-07_einladung_gr.pdf']])
 test(`leak corpus ${id}: a page's linked notice without its day is read`,async()=>{const {d}=await pageCase({pdfPath});noSecret(d,id);});
test('leak corpus r4-page-pdf-other-host: a notice the reader may not read keeps the page from giving items',async()=>{
 const {d}=await pageCase({pdfLink:'https://musterbach.example.test/fileadmin/einladungen/einladung-gr-2026-10-14.pdf'});
 noSecret(d,'r4-page-pdf-other-host');
});
for(const [id,opts] of [['r4-page-pdf-robots',{robots:'User-agent: *\nDisallow: /*.pdf$\n'}],['r4-page-pdf-503',{fail:{[base+'fileadmin/einladungen/einladung-gr-2026-10-14.pdf']:'Quelle antwortet mit HTTP 503'}}],['r4-page-pdf-scan',{pdf:' \n '}]])
 test(`leak corpus ${id}: a notice that cannot be read keeps the page from giving items`,async()=>{const {d}=await pageCase({pdfPath:'/fileadmin/einladungen/einladung-gr-2026-10-14.pdf',...opts});noSecret(d,id);});
test('leak corpus r4-page-pdf-limit: pages whose notice is left by the document limit give no items',async()=>{
 const list=base+'bek/',pages={},docs={};const items=[];
 for(let k=0;k<60;k++){
  const day=new Date(Date.UTC(2025,10,1+5*k)),iso=day.toISOString().slice(0,10),de=iso.split('-').reverse().join('.');
  const p=`rathaus/sitzungen/gr-${iso}.html`,pdf=`fileadmin/einladungen/einladung-gr-${iso}.pdf`;
  items.push(`<li><a href="/${p}">Öffentliche Sitzung des Gemeinderates am ${de}</a></li>`);
  docs[base+p]=`<html><body><main><h1>Öffentliche Sitzung des Gemeinderates am ${de}</h1><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita<br>3. Haushalt<br>4. Grundstücksverkauf Fl.Nr. ${400+k}<br>5. Personalangelegenheit Bauhof</p><p><a href="/${pdf}">Einladung Gemeinderatssitzung ${de} (PDF)</a></p></main></body></html>`;
  docs[base+pdf]={pdf:PARTS_PDF(de).replace('Fl.Nr. 412',`Fl.Nr. ${400+k}`)};
 }
 pages[list]=`<html><body><main><ul>${items.join('')}</ul></main></body></html>`;
 const d=await collect4({pages:[list]},site4({pages,docs}),'2026-10-04');
 noSecret(d,'r4-page-pdf-limit');
});

for(const [id,html] of [['r4-rss-teaser-ellipsis','<p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.</p><p>Tagesordnung:<br>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027<br>4. Grundstücksverkauf Fl.Nr. 412 …</p>'],
 ['r4-rss-teaser-more','<p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.</p><p>Tagesordnung:<br>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027<br>4. Grundstücksverkauf Fl.Nr. 412</p><p><a href="https://www.musterbach.example.test/aktuelles/einladung-gr.html">Weiterlesen</a></p>'],
 ['r4-rss-teaser-cut-word','<p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.</p><p>Tagesordnung:<br>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027<br>4. Grundstücksverkauf Fl.Nr. 412 (nich…</p>'],
 ['r4-rss-teaser-dots','<p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.</p><p>Tagesordnung:<br>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027<br>4. Grundstücksverkauf Fl.Nr. 412 (n...</p>']])
 test(`leak corpus ${id}: a cropped feed text yields no item; the article is read instead`,async()=>{
  const feed=base+'aktuelles/feed.rss',article=base+'aktuelles/einladung-gr.html';
  const xml=`<?xml version="1.0"?><rss version="2.0"><channel><title>Musterbach</title><item><title>Einladung zur Sitzung des Gemeinderates am 14.10.2026</title><link>${article}</link><description><![CDATA[${html}]]></description></item></channel></rss>`;
  const web=site4({pages:{[feed]:xml},docs:{[article]:`<html><body><main><h1>Einladung zur Sitzung des Gemeinderates am 14.10.2026</h1><p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal eine öffentliche Sitzung des Gemeinderates statt.</p><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Kita Sonnenschein<br>3. Haushalt 2027<br>4. Grundstücksverkauf Fl.Nr. 412 (nichtöffentlich)<br>5. Personalangelegenheit (nichtöffentlich)</p></main></body></html>`}});
  const d=await collect4({feeds:[feed]},web);
  noSecret(d,id);
  assert.ok(web.calls.includes(article),'the article is read');
 });
test('leak corpus r4-ics-cropped: a cropped calendar description yields no item',async()=>{
 const ics=base+'kalender.ics';
 const cal=`BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:c6\r\nDTSTART;TZID=Europe/Berlin:20261014T190000\r\nSUMMARY:Öffentliche Sitzung des Gemeinderates\r\nDESCRIPTION:Tagesordnung:\\n1. Genehmigung der Niederschrift\\n2. Bauantrag Kita\\n3. Grundstücksverkauf Fl.Nr. 412 ...\r\nX-ALT-DESC;FMTTYPE=text/html:<p>3. Grundstücksverkauf Fl.Nr. 412 (nichtöffentlich)</p>\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
 const d=await collect4({ics:[ics]},site4({pages:{[ics]:cal}}));
 noSecret(d,'r4-ics-cropped');
});

test('leak corpus r4-minutes-renumbered-after-withdrawal: an item of the minutes that is none of the invitation\'s public items does not come out',async()=>{
 const list=base+'bek/',inv=base+'fileadmin/einladung-gr-2026-10-14.pdf',min=base+'fileadmin/niederschrift-gr-2026-10-14.pdf';
 const web=site4({pages:{[list]:'<html><body><main><a href="/fileadmin/einladung-gr-2026-10-14.pdf">Einladung Gemeinderat 14.10.2026</a><a href="/fileadmin/niederschrift-gr-2026-10-14.pdf">Niederschrift Gemeinderat 14.10.2026</a></main></body></html>'},docs:{
  [inv]:{pdf:`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Kita Sonnenschein
3. Feuerwehrbedarfsplan
4. Haushalt 2027
Nichtöffentlicher Teil
5. Grundstücksangelegenheiten
6. Personalangelegenheiten`},
  [min]:{pdf:`Niederschrift über die öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026
Der Punkt Feuerwehrbedarfsplan wurde von der Tagesordnung abgesetzt.
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Kita Sonnenschein
3. Haushalt 2027
4. Erwerb Fl.Nr. 412 Am Mühlbach
5. Einstellung einer Erzieherin
Zu 1. Die Niederschrift wird genehmigt. Abstimmung: 12:0`}}});
 const d=await collect4({pages:[list]},web,'2026-10-25');
 noSecret(d,'r4-minutes-renumbered-after-withdrawal');
});

test('leak corpus r4-moved-meeting: the invitation of a moved meeting cuts the minutes of the new day; the old day yields nothing',async()=>{
 const list=base+'bek/',inv=base+'fileadmin/einladung-gr-2026-10-07.pdf',move=base+'fileadmin/verlegung-gr.pdf',min=base+'fileadmin/niederschrift-gr-2026-10-14.pdf';
 const web=site4({pages:{[list]:'<html><body><main><a href="/fileadmin/einladung-gr-2026-10-07.pdf">Einladung Gemeinderat 07.10.2026</a><a href="/fileadmin/verlegung-gr.pdf">Bekanntmachung Verlegung Sitzung Gemeinderat</a><a href="/fileadmin/niederschrift-gr-2026-10-14.pdf">Niederschrift Gemeinderat 14.10.2026</a></main></body></html>'},docs:{
  [inv]:{pdf:`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 07.10.2026, 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Kita Sonnenschein
3. Feuerwehrbedarfsplan
4. Haushalt 2027
Nichtöffentlicher Teil
5. Grundstücksangelegenheiten
6. Personalangelegenheiten`},
  [move]:{pdf:`Gemeinde Musterbach
Bekanntmachung
Die für Mittwoch, 07.10.2026 angesetzte Sitzung des Gemeinderates wird auf Mittwoch, 14.10.2026, 19:00 Uhr verlegt. Die Tagesordnung bleibt unverändert.`},
  [min]:{pdf:`Niederschrift über die öffentliche Sitzung des Gemeinderates am Mittwoch, 14.10.2026
Tagesordnung
1. Genehmigung der Niederschrift
2. Bauantrag Kita Sonnenschein
3. Haushalt 2027
4. Grundstücksangelegenheiten
5. Personalangelegenheiten
Zu 1. Die Niederschrift wird genehmigt. Abstimmung: 12:0`}}});
 const d=await collect4({pages:[list]},web,'2026-10-25');
 noSecret(d,'r4-moved-meeting');
 assert.ok(!d.topics.some(t=>t.eventDate==='2026-10-07'),'nothing on the day the meeting did not take place');
});

// --- round 5: copies of a notice (calendar, JSON-LD, WordPress, feed) and the documents they link ------------------------
const SECRET5=/Grundstück|Personal|Rohbau|Stundung|Erwerb|Einstellung/;
const noSecret5=(d,what)=>{for(const t of titles4(d))assert.ok(!SECRET5.test(t),`${what}: „${t}“ must not come out`);};
const vevent=({dtstart='20261014T190000',summary='Öffentliche Sitzung des Gemeinderates',description='',extra=[]})=>['BEGIN:VEVENT',`UID:${Math.random().toString(36).slice(2)}`,`DTSTART;TZID=Europe/Berlin:${dtstart}`,`SUMMARY:${summary}`,...extra,...(description?[`DESCRIPTION:${description}`]:[]),'END:VEVENT'];
const vcal=(events,head=[])=>['BEGIN:VCALENDAR','VERSION:2.0',...head,...events.flatMap(vevent),'END:VCALENDAR'].join('\r\n')+'\r\n';
const AGENDA4='Tagesordnung:\\n1. Genehmigung der Niederschrift\\n2. Bauantrag Neubau Kindertagesstätte\\n3. Vergabe der Rohbauarbeiten Kindertagesstätte\\n4. Antrag auf Stundung von Erschließungsbeiträgen';
const AGENDA4_HTML='<p>Tagesordnung:</p><p>1. Genehmigung der Niederschrift<br>2. Bauantrag Neubau Kindertagesstätte<br>3. Vergabe der Rohbauarbeiten Kindertagesstätte<br>4. Antrag auf Stundung von Erschließungsbeiträgen</p>';
const NOTICE5=`Gemeinde Musterbach
Einladung zur Sitzung des Gemeinderates am Mittwoch, 14.10.2026, 19:00 Uhr
Öffentlicher Teil
1. Genehmigung der Niederschrift
2. Bauantrag Neubau Kindertagesstätte
Nichtöffentlicher Teil
3. Vergabe der Rohbauarbeiten Kindertagesstätte
4. Antrag auf Stundung von Erschließungsbeiträgen`;
const UPLOAD5=base+'wp-content/uploads/2026/10/Einladung-GR-2026-10-14.pdf';
const BLOCK_UPLOADS='User-agent: *\nDisallow: /wp-content/uploads/\n';

test('leak corpus r5-ics-copy-of-page: a calendar entry that copies a page whose linked notice is not read gives nothing',async()=>{
 const ics=base+'kalender.ics',page=base+'aktuelles/einladung-gemeinderat-2026-10-14.html';
 const html=`<html><body><main><h1>Einladung zur öffentlichen Sitzung des Gemeinderates am 14.10.2026</h1><p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.</p>${AGENDA4_HTML}<p><a href="/wp-content/uploads/2026/10/Einladung-GR-2026-10-14.pdf">Einladung Gemeinderat 14.10.2026 (PDF)</a></p></main></body></html>`;
 const d=await collect4({ics:[ics]},site4({robots:BLOCK_UPLOADS,pages:{[ics]:vcal([{description:AGENDA4,extra:[`URL:${page}`]}])},docs:{[page]:html,[UPLOAD5]:{pdf:NOTICE5}}}));
 noSecret5(d,'r5-ics-copy-of-page');
});
test('leak corpus r5-jsonld-description-links-notice: an event description that links its notice gives nothing while the notice is not read',async()=>{
 const list=base+'termine/';
 const ld=JSON.stringify({'@context':'https://schema.org','@type':'Event',name:'Sitzung des Gemeinderates',startDate:'2026-10-14T19:00:00',description:`<p>Öffentliche Sitzung</p>${AGENDA4_HTML}<p><a href="/wp-content/uploads/2026/10/Einladung-GR-2026-10-14.pdf">Bekanntmachung (PDF)</a></p>`});
 const d=await collect4({pages:[list]},site4({robots:BLOCK_UPLOADS,pages:{[list]:`<html><head><script type="application/ld+json">${ld}</script></head><body><main><h1>Termine</h1></main></body></html>`},docs:{[UPLOAD5]:{pdf:NOTICE5}}}));
 noSecret5(d,'r5-jsonld-description-links-notice');
});
const WP_POST5=[{id:1,date:'2026-10-07T08:00:00',link:base+'2026/10/07/einladung-gemeinderat/',title:{rendered:'Einladung zur öffentlichen Sitzung des Gemeinderates am 14.10.2026'},content:{rendered:`<p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal des Rathauses eine Sitzung des Gemeinderates statt.</p>${AGENDA4_HTML}<p>Die amtliche Bekanntmachung finden Sie hier: <a href="${UPLOAD5}">Einladung Gemeinderat 14.10.2026 (PDF)</a></p>`}}];
for(const [id,robots] of [['r5-wp-post-links-notice-read',undefined],['r5-wp-post-links-notice-blocked',BLOCK_UPLOADS]])test(`leak corpus ${id}: a WordPress post with the agenda typed off reads its linked notice or gives nothing`,async()=>{
 const root=base+'wp-json/',web=site4({robots,docs:{[UPLOAD5]:{pdf:NOTICE5}}});
 const get=async url=>{if(url.startsWith(root+'wp/v2/posts'))return JSON.stringify(WP_POST5);if(url.startsWith(root+'wp/v2/media'))return '[]';return web.get(url);};
 const d=await collect4({wp:root},{...web,get});
 noSecret5(d,id);
 if(!robots){assert.ok(web.calls.includes(UPLOAD5),'the notice is read');assert.ok(titles4(d).some(t=>/Kindertagesstätte/.test(t)),'the public items stay');}
});
test('leak corpus r5-rss-full-text-links-notice: an RSS full text that links its notice gives nothing while the notice is not read',async()=>{
 const feed=base+'feed.rss';
 const xml=`<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Musterbach</title><item><title>Einladung zur öffentlichen Sitzung des Gemeinderates am 14.10.2026</title><link>${base}2026/10/07/einladung-gemeinderat/</link><content:encoded><![CDATA[${WP_POST5[0].content.rendered}]]></content:encoded></item></channel></rss>`;
 const d=await collect4({feeds:[feed]},site4({robots:BLOCK_UPLOADS,pages:{[feed]:xml},docs:{[base+'2026/10/07/einladung-gemeinderat/']:`<html><body><main><h1>Einladung</h1>${WP_POST5[0].content.rendered}</main></body></html>`,[UPLOAD5]:{pdf:NOTICE5}}}));
 noSecret5(d,'r5-rss-full-text-links-notice');
});
for(const [id,link] of [['r5-page-pdf-label-amtlich','<a href="/fileadmin/user_upload/bekanntmachung_2026_41.pdf">Amtliche Bekanntmachung (PDF, 85 KB)</a>'],['r5-page-pdf-label-download','<a href="/fileadmin/user_upload/bekanntmachung_2026_41.pdf">Download (PDF)</a>'],
 ['r5-page-pdf-label-icon','<a href="/fileadmin/user_upload/bekanntmachung_2026_41.pdf"><img src="/icons/pdf.svg" alt="PDF"></a>'],['r5-page-pdf-label-aushang','<a href="/fileadmin/user_upload/bekanntmachung_2026_41.pdf">Aushang vom 07.10.2026</a>']])
 test(`leak corpus ${id}: a PDF that a page with items links counts as its notice whatever its link text`,async()=>{
  const list=base+'l/',page=base+'rathaus/aktuelles/sitzung-gemeinderat-2026-10-14.html',pdf=base+'fileadmin/user_upload/bekanntmachung_2026_41.pdf';
  const web=site4({pages:{[list]:'<html><body><main><a href="/rathaus/aktuelles/sitzung-gemeinderat-2026-10-14.html">Öffentliche Sitzung des Gemeinderates am 14.10.2026</a></main></body></html>'},docs:{[page]:`<html><body><main><h1>Öffentliche Sitzung des Gemeinderates am 14.10.2026</h1><p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet eine öffentliche Sitzung des Gemeinderates statt.</p>${AGENDA4_HTML}<p>${link}</p></main></body></html>`,[pdf]:{pdf:NOTICE5}}});
  const d=await collect4({pages:[list]},web);
  noSecret5(d,id);
  assert.ok(web.calls.includes(pdf),'the PDF is read');
 });
for(const [id,description] of [['r5-jsonld-teil-b','Teil A (öffentlich)\n1. Bauantrag Neubau Kindertagesstätte\n2. Haushalt 2027 – Eckwerte\nTeil B\n3. Grundstücksverkauf Fl.Nr. 412\n4. Personalangelegenheit'],
 ['r5-jsonld-roman','Öffentliche Sitzung\nI.\n1. Bauantrag Neubau Kindertagesstätte\n2. Haushalt 2027 – Eckwerte\nII.\n3. Grundstücksverkauf Fl.Nr. 412\n4. Personalangelegenheit'],
 ['r5-jsonld-teil-2','Teil 1 – öffentlich\n1. Bauantrag Neubau Kindertagesstätte\n2. Haushalt 2027 – Eckwerte\nTeil 2\n3. Grundstücksverkauf Fl.Nr. 412\n4. Personalangelegenheit'],
 ['r5-jsonld-teil-b-br','Teil A (öffentlich)<br>1. Bauantrag Neubau Kindertagesstätte<br>2. Haushalt 2027 – Eckwerte<br>Teil B<br>3. Grundstücksverkauf Fl.Nr. 412<br>4. Personalangelegenheit']])
 test(`leak corpus ${id}: the parts of a JSON-LD description keep their lines`,async()=>{
  const list=base+'termine/',ld=JSON.stringify({'@context':'https://schema.org','@type':'Event',name:'Sitzung des Gemeinderates',startDate:'2026-10-14T19:00:00',description});
  const d=await collect4({pages:[list]},site4({pages:{[list]:`<html><head><script type="application/ld+json">${ld}</script></head><body><main><h1>Termine</h1></main></body></html>`}}));
  noSecret5(d,id);
  for(const t of titles4(d))assert.ok(!/Teil|II\./.test(t),`${id}: „${t}“ carries the heading of a part`);
 });
for(const [id,cut] of [['r5-rss-teaser-word-cut','4. Grundstücksangelegenheit Fl.Nr. 412'],['r5-rss-teaser-bracket-cut','4. Grundstücksangelegenheit Fl.Nr. 412 (nicht']])
 test(`leak corpus ${id}: a feed teaser cut without ellipsis yields no item of the non-public part; the article is read`,async()=>{
  const feed=base+'feed.rss',article=base+'aktuelles/einladung-gemeinderat-14-10-2026.html';
  const teaser=`<p>Am Mittwoch, 14.10.2026, 19:00 Uhr, findet im Sitzungssaal des Rathauses eine Sitzung des Gemeinderates statt.</p><p>Öffentlicher Teil</p><p>1. Genehmigung der Niederschrift</p><p>2. Bauantrag Neubau Kindertagesstätte</p><p>3. Haushalt 2027 – Eckwerte</p><p>${cut}</p>`;
  const xml=`<?xml version="1.0"?><rss version="2.0"><channel><title>Musterbach</title><item><title>Einladung zur Sitzung des Gemeinderates am 14.10.2026</title><link>${article}</link><description><![CDATA[${teaser}]]></description></item></channel></rss>`;
  const web=site4({pages:{[feed]:xml},docs:{[article]:`<html><body><main><h1>Einladung zur Sitzung des Gemeinderates am 14.10.2026</h1>${teaser.replace(cut,'4. Grundstücksangelegenheit Fl.Nr. 412 (nichtöffentlich)')}</main></body></html>`}});
  const d=await collect4({feeds:[feed]},web);
  noSecret5(d,id);
  assert.ok(web.calls.includes(article),'the article is read');
 });
test('leak corpus r5-ics-wordwrap-teil-b: a part heading folded without its space ("TeilB") ends the public part',async()=>{
 const ics=base+'k.ics';
 const description='Öffentliche Sitzung\\n1. Bauantrag Neubau Kindertagesstätte\\n2. Haushalt 2027 – Eckwerte\\nTeil\r\n B\\n3. Grundstücksverkauf Fl.Nr. 412\\n4. Personalangelegenheit';
 const d=await collect4({ics:[ics]},site4({pages:{[ics]:vcal([{description}])}}));
 noSecret5(d,'r5-ics-wordwrap-teil-b');
 assert.ok(titles4(d).some(t=>/Kindertagesstätte$/.test(t)),'the public items stay, without the heading');
});
const COUNTY5='Öffentliche Sitzung\\nTagesordnung:\\n1. Ausbau der Kreisstraße MK 12\\n2. Fortschreibung des Abfallwirtschaftskonzepts\\n3. Bericht der Kreiswerke';
for(const [id,ev] of [['r5-ics-location-county',{dtstart:'20261014T140000',summary:'Sitzung des Ausschusses für Umwelt und Landwirtschaft',description:COUNTY5,extra:['LOCATION:Landratsamt Musterkreis\\, Großer Sitzungssaal']}],
 ['r5-ics-organizer-county',{dtstart:'20261014T140000',summary:'Sitzung des Jugendhilfeausschusses',description:COUNTY5,extra:['ORGANIZER;CN="Landkreis Musterkreis":mailto:kreistag@musterkreis.example.test']}],
 ['r5-ics-location-zv',{dtstart:'20261021T170000',summary:'Sitzung des Werkausschusses',description:'Öffentliche Sitzung\\n1. Feststellung des Jahresabschlusses 2025\\n2. Wasserpreiskalkulation 2027\\n3. Erneuerung Hochbehälter Eichberg',extra:['LOCATION:Verwaltungsgebäude des Zweckverbandes Wasserversorgung Oberland\\, Brunnenweg 3\\, Musterbach']}],
 ['r5-ics-location-other-member',{dtstart:'20261015T193000',summary:'Öffentliche Sitzung des Gemeinderates',description:'Tagesordnung:\\n1. Bauantrag Errichtung einer Garage Fl.Nr. 77\\n2. Feuerwehrbedarfsplan Nachbarhausen\\n3. Anfragen',extra:['LOCATION:Sitzungssaal Rathaus Nachbarhausen\\, Kirchplatz 2\\, 99999 Nachbarhausen']}],
 ...['Gemeinde Nachbarhausen – Sitzung des Gemeinderates','Nachbarhausen: Sitzung des Gemeinderates','Sitzung des Gemeinderates (Nachbarhausen)','Öffentliche Gemeinderatssitzung in Nachbarhausen'].map((summary,n)=>[`r5-ics-heading-other-town-${n+1}`,{dtstart:'20261015T193000',summary,description:'Öffentliche Sitzung\\n1. Bauantrag Errichtung einer Garage Fl.Nr. 77\\n2. Feuerwehrbedarfsplan\\n3. Anfragen'}])])
 test(`leak corpus ${id}: a calendar entry of a foreign body gives nothing`,async()=>{
  const ics=base+'kalender.ics',d=await collect4({ics:[ics]},site4({pages:{[ics]:vcal([ev])}}));
  assert.deepEqual(titles4(d),[]);
 });
for(const [id,event] of [['r5-jsonld-location-county',{name:'Sitzung des Bau- und Umweltausschusses',startDate:'2026-10-14T14:00:00',location:{'@type':'Place',name:'Landratsamt Musterkreis'},organizer:{'@type':'Organization',name:'Landkreis Musterkreis'},description:'Öffentliche Sitzung\n1. Ausbau der Kreisstraße MK 12\n2. Radwegekonzept\n3. Anfragen'}],
 ['r5-jsonld-location-other-member',{name:'Öffentliche Sitzung des Gemeinderates',startDate:'2026-10-15T19:30:00',location:{'@type':'Place',name:'Rathaus Nachbarhausen',address:{'@type':'PostalAddress',addressLocality:'Nachbarhausen'}},description:'Tagesordnung:\n1. Bauantrag Errichtung einer Garage Fl.Nr. 77\n2. Feuerwehrbedarfsplan Nachbarhausen\n3. Anfragen'}],
 ['r5-jsonld-signature-zv',{name:'Sitzung des Werkausschusses',startDate:'2026-10-21T17:00:00',description:'Öffentliche Sitzung\nTagesordnung:\n1. Feststellung des Jahresabschlusses 2025\n2. Wasserpreiskalkulation 2027\n3. Erneuerung Hochbehälter Eichberg\nMusterbach, 07.10.2026\nMax Muster\nVerbandsvorsitzender'}],
 ['r5-jsonld-signature-county',{name:'Sitzung des Bau- und Umweltausschusses',startDate:'2026-10-14T14:00:00',description:'Öffentliche Sitzung\nTagesordnung:\n1. Ausbau der Kreisstraße MK 12\n2. Radwegekonzept\n3. Anfragen\nMusterstadt, 05.10.2026\nDr. Anna Kreis\nLandrätin'}]])
 test(`leak corpus ${id}: a JSON-LD event of a foreign body gives nothing`,async()=>{
  const list=base+'termine/',ld=JSON.stringify({'@context':'https://schema.org','@type':'Event',...event});
  const d=await collect4({pages:[list]},site4({pages:{[list]:`<html><head><script type="application/ld+json">${ld}</script></head><body><main><h1>Termine</h1></main></body></html>`}}));
  assert.deepEqual(titles4(d),[]);
 });
test('leak corpus r5-html-heading-other-town: a page whose heading names another town gives nothing',async()=>{
 for(const h of ['Gemeinde Nachbarhausen – Sitzung des Gemeinderates','Nachbarhausen: Sitzung des Gemeinderates','Sitzung des Gemeinderates (Nachbarhausen)','Öffentliche Gemeinderatssitzung in Nachbarhausen']){
  const list=base+'l/',page=base+'rathaus/sitzungen/gr-2026-10-15.html';
  const d=await collect4({pages:[list]},site4({pages:{[list]:`<html><body><main><a href="/rathaus/sitzungen/gr-2026-10-15.html">Sitzung Gemeinderat 15.10.2026</a></main></body></html>`},docs:{[page]:`<html><body><main><h1>${h}</h1><p>Donnerstag, 15.10.2026, 19:30 Uhr</p><p>Öffentliche Sitzung</p><p>1. Bauantrag Errichtung einer Garage Fl.Nr. 77<br>2. Feuerwehrbedarfsplan<br>3. Anfragen</p></main></body></html>`}}));
  assert.deepEqual(titles4(d),[],h);
 }
});
const CANCELLED_AGENDA='Tagesordnung (öffentlich):\\n1. Genehmigung der Niederschrift\\n2. Bauantrag Kita\\n3. Haushalt 2027';
for(const [id,cal] of [['r5-ics-cancelled-and-moved',vcal([{dtstart:'20261007T190000',summary:'Sitzung des Gemeinderates',description:CANCELLED_AGENDA,extra:['STATUS:CANCELLED']},{dtstart:'20261014T190000',summary:'Sitzung des Gemeinderates (verlegt)',description:CANCELLED_AGENDA}])],
 ['r5-ics-cancelled',vcal([{dtstart:'20261007T190000',summary:'Sitzung des Gemeinderates',description:CANCELLED_AGENDA,extra:['STATUS:CANCELLED']}])],
 ['r5-ics-method-cancel',vcal([{dtstart:'20261007T190000',summary:'Sitzung des Gemeinderates',description:CANCELLED_AGENDA}],['METHOD:CANCEL'])]])
 test(`leak corpus ${id}: a cancelled calendar entry gives nothing on its day`,async()=>{
  const ics=base+'kalender.ics',d=await collect4({ics:[ics]},site4({pages:{[ics]:cal}}));
  assert.ok(!d.topics.some(t=>t.eventDate==='2026-10-07'),'nothing on the cancelled day');
  if(id==='r5-ics-cancelled-and-moved')assert.ok(d.topics.some(t=>t.eventDate==='2026-10-14'),'the new day is the meeting\'s');
 });
test('leak corpus r5-jsonld-cancelled: an event marked EventCancelled gives nothing',async()=>{
 const list=base+'termine/',ld=JSON.stringify({'@context':'https://schema.org','@type':'Event',name:'Sitzung des Gemeinderates',startDate:'2026-10-07T19:00:00',eventStatus:'https://schema.org/EventCancelled',description:'Tagesordnung (öffentlich):\n1. Genehmigung der Niederschrift\n2. Bauantrag Kita\n3. Haushalt 2027'});
 const d=await collect4({pages:[list]},site4({pages:{[list]:`<html><head><script type="application/ld+json">${ld}</script></head><body><main><h1>Termine</h1></main></body></html>`}}));
 assert.deepEqual(titles4(d),[]);
});
test('leak corpus r5-minutes-refusal-unanimous: minutes whose decision refuses the motion unanimously give it as rejected',async()=>{
 const list=base+'bek/',page=base+'rathaus/sitzungen/niederschrift-gr-2026-09-16.html';
 const d=await collect4({pages:[list]},site4({pages:{[list]:'<html><body><main><a href="/rathaus/sitzungen/niederschrift-gr-2026-09-16.html">Niederschrift Gemeinderat 16.09.2026</a></main></body></html>'},docs:{[page]:'<html><body><main><h1>Niederschrift über die öffentliche Sitzung des Gemeinderates am 16.09.2026</h1><p>Beginn: 19:00 Uhr</p><h3>TOP 1 Antrag des Sportvereins auf Zuschuss für Flutlichtanlage</h3><p>Beschluss: Der Antrag wird nicht genehmigt.</p><p>Abstimmung: 13:0</p><h3>TOP 2 Bauantrag Errichtung einer Werbeanlage, Fl.Nr. 87</h3><p>Beschluss: Die Zustimmung zum Bauvorhaben wird nicht gegeben.</p><p>Abstimmung: 13:0</p><h3>TOP 3 Antrag auf Aufstellung eines Bebauungsplans „Sonnenhang“</h3><p>Der Gemeinderat sieht keine Möglichkeit, dem Antrag zuzustimmen.</p><p>Abstimmung: 13:0</p></main></body></html>'}}));
 assert.equal(d.topics.length,3);
 for(const t of d.topics)assert.equal(t.status,'rejected',t.title);
});
