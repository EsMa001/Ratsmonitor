import test from 'node:test';
import assert from 'node:assert/strict';
import {conferenceLists,conferenceEntries,conferenceAgenda,bodyOf,collectSiteparkRatsinfo} from '../server/integrations/sitepark-ratsinfo.mjs';
// Nachgebildet nach www.bitburg-pruem.de und www.amt-itzstedt.de (Sitepark, Oktober 2026).
const base='https://www.beispiel-amt.de/';
const listPage=`<div data-src="${base}politik/termine/conferences.json?i4xpath=6a5e&amp;h=2&amp;h_=2"></div>`;
const LIST=[
 {id:'a1',title:'Sitzung der Gemeindevertretung der Gemeinde Musterdorf',url:base+'ratsinfo/sitzungstermin/a1/sitzung/',start:'2026-10-28T17:30:00Z'},
 {id:'a2',title:'Sitzung der Gemeindevertretung der Gemeinde Nachbarort - DIE SITZUNG FÄLLT AUS! -',url:base+'ratsinfo/sitzungstermin/a2/x/',start:'2026-10-29T17:30:00Z'},
 {id:'a3',title:'Sitzung des Amtsausschusses des Amtes Beispiel',url:base+'ratsinfo/sitzungstermin/a3/y/',start:'2026-11-05T18:00:00Z'},
];
const item=(st,n,title,paper)=>`<li class="conference-detail__item unordered-list-item list-item"><span class="conference-detail__agenda-title"><span title="${st==='Ö'?'öffentlich':'nichtöffentlich'}" class="conference-detail__agenda-status ${st==='Ö'?'public':'non-public'}">${st}</span><span class="conference-detail__agenda-number">${n}</span>${title}</span><div class="conference-detail__attachments">${paper?`<a class="icon-linklist__link " href="${base}ratsinfo/vorlage/p${n}/x/"><ionas-icon-ris-folder></ionas-icon-ris-folder>${paper}</a>`:''}</div></li>`;
const MEETING=`<h2>Tagesordnungspunkte</h2><ul>${item('Ö','1','Eröffnung der Sitzung','')}${item('Ö','2','Auftragsvergabe;\nNeubau Feuerwehrhaus','VO/12/2026')}${item('N','3','Grundstücksangelegenheit Herr Müller','')}</ul>`;
const pages={[base+'politik/termine/']:listPage,[base+'politik/termine/conferences.json?i4xpath=6a5e&h=2&h_=2']:JSON.stringify(LIST),[LIST[0].url]:MEETING,[LIST[2].url]:'<h2>Tagesordnungspunkte</h2><ul></ul>'};

test('Sitepark: list address, meetings in German time, agenda with Ö/N, number, paper',()=>{
 assert.deepEqual(conferenceLists(listPage,base+'politik/termine/'),[base+'politik/termine/conferences.json?i4xpath=6a5e&h=2&h_=2']);
 const m=conferenceEntries(JSON.stringify(LIST));
 assert.deepEqual(m[0],{url:LIST[0].url,title:LIST[0].title,date:'2026-10-28',time:'18:30'});
 const a=conferenceAgenda(MEETING,LIST[0].url);
 assert.deepEqual(a.map(i=>[i.publicity,i.number,i.title,i.paper]),[['public','1','Eröffnung der Sitzung',''],['public','2','Auftragsvergabe; Neubau Feuerwehrhaus','VO/12/2026'],['nonpublic','3','Grundstücksangelegenheit Herr Müller','']]);
 assert.equal(a[1].paperUrl,base+'ratsinfo/vorlage/p2/x/');
 assert.equal(bodyOf('Sitzung der Gemeindevertretung der Gemeinde Musterdorf'),'Gemeindevertretung Musterdorf');
 assert.equal(bodyOf('öffentliche/nichtöffentliche Sitzung des Kreisausschusses'),'Kreisausschuss');
});

test('Sitepark: reports of the meetings; cancelled meetings skipped; non-public items title only without names',async()=>{
 const asked=[];const get=async url=>{asked.push(url);if(!(url in pages))throw Error('unexpected '+url);return pages[url];};
 const d=await collectSiteparkRatsinfo({id:'de-1',name:'Amt Beispiel',kind:'city',base,pages:[base+'politik/termine/']},{now:new Date('2026-10-20T10:00:00Z'),window:'3m',get});
 assert.ok(!asked.includes(LIST[1].url),'cancelled meeting not asked');
 assert.deepEqual(d.topics.map(t=>[t.title,t.committee,t.eventDate,t.publicity||'']).sort(),[
  ['Auftragsvergabe; Neubau Feuerwehrhaus','Gemeindevertretung Musterdorf','2026-10-28',''],
  ['Eröffnung der Sitzung','Gemeindevertretung Musterdorf','2026-10-28',''],
  ['Grundstücksangelegenheit Herr …','Gemeindevertretung Musterdorf','2026-10-28','nonpublic']]);
 const closed=d.topics.find(t=>t.publicity);assert.deepEqual(closed.documents,[]);
 for(const t of d.topics)for(const k of ['id','eventDate','updatedAt','status','source'])assert.notEqual(t[k],undefined,k);
 assert.equal(d.coverage.meetingsWithoutAgenda,1);assert.equal(d.coverage.complete,true);
});

test('Sitepark: meetings of another area named in excludeTitles are not read',async()=>{
 const asked=[];const get=async url=>{asked.push(url);return pages[url]??'<ul></ul>';};
 const d=await collectSiteparkRatsinfo({id:'de-1',name:'Amt Beispiel',kind:'city',base,pages:[base+'politik/termine/'],excludeTitles:['Gemeinde Musterdorf']},{now:new Date('2026-10-20T10:00:00Z'),window:'3m',get});
 assert.ok(!asked.includes(LIST[0].url));assert.equal(d.topics.length,0);
});
