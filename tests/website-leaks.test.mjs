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
