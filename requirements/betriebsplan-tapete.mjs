// Prozesstapete des Betriebsplans als großformatiges PDF (requirements/betriebsplan-prozesstapete.pdf): der ganze Ablauf mit allen
// Verzweigungen und Varianten auf einer Seite (1600 × 1133 mm). Zeichnet ein SVG, Chrome druckt es als Vektor-PDF. Namen der Abläufe,
// Stufen und Schritte aus shared/pipeline-terms.mjs, Inhalt nach requirements/betriebsplan-konzept.md.
//
//   node requirements/betriebsplan-tapete.mjs [--html]      --html: nur die HTML-Datei schreiben (ohne Chrome)
// Chrome: CHROME_PATH, sonst die üblichen Pfade unter Windows, macOS und Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stepName as S,CLASS_TERMS,PHASES,FLOWS} from '../shared/pipeline-terms.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const W=4800,H=3470;
const C={
 text:'#17222b',muted:'#55636e',line:'#2b3640',grid:'#d9e0e5',
 night:['#eeedfe','#534ab7','#3c3489'],fix:['#fbe9e3','#c94f28','#7a2d14'],alt:['#faeeda','#a8690f','#633806'],
 ki:['#eaf3de','#3b6d11','#27500a'],store:['#e6f1fb','#185fa5','#0c447c'],neutral:['#f3f2ee','#6b6a64','#3a3a37'],
 fail:'#c94f28',decision:['#ffffff','#2b3640','#17222b'],
};
const FONT=`'Segoe UI','IBM Plex Sans',Arial,sans-serif`;
const out=[];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/* Zeilenumbruch nach geschätzter Breite (Segoe UI ≈ 0,52 × Schriftgröße je Zeichen) */
function wrap(text,width,fs){
 const max=Math.max(4,Math.floor(width/(fs*0.52))),lines=[];
 for(const para of String(text).split('\n')){
  let cur='';
  for(const w of para.split(' ')){if((cur+' '+w).trim().length>max&&cur){lines.push(cur);cur=w;}else cur=(cur+' '+w).trim();}
  lines.push(cur);
 }
 return lines;
}
const warn=[];
function textBlock(x,y,w,lines,{fs=16,weight=400,color=C.text,anchor='start',lh=1.25}={}){
 const tx=anchor==='middle'?x+w/2:x;
 lines.forEach((l,i)=>out.push(`<text x="${tx}" y="${y+i*fs*lh}" font-size="${fs}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${esc(l)}</text>`));
 return lines.length*fs*lh;
}
/** Kasten: Titel fett, darunter Text; prüft, ob alles hineinpasst */
function box(x,y,w,h,title,sub='',kind='neutral',{fs=20,sfs=15,dash=false,thick=false,align='start'}={}){
 const [fill,stroke,ink]=C[kind]||C.neutral;
 out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${thick?3.5:2}"${dash?' stroke-dasharray="10 7"':''}/>`);
 const pad=14,tl=wrap(title,w-2*pad,fs),sl=sub?wrap(sub,w-2*pad,sfs):[];
 const need=pad+tl.length*fs*1.2+(sl.length?6+sl.length*sfs*1.25:0)+pad*0.6;
 if(need>h+2)warn.push(`Kasten „${title}“: braucht ${Math.round(need)}, hat ${h}`);
 let cy=y+pad+fs*0.85;
 cy+=textBlock(x+pad,cy,w-2*pad,tl,{fs,weight:600,color:ink,anchor:align==='middle'?'middle':'start',lh:1.2});
 if(sl.length)textBlock(x+pad,cy+4,w-2*pad,sl,{fs:sfs,color:C.muted,anchor:align==='middle'?'middle':'start'});
 return {x,y,w,h,cx:x+w/2,cy:y+h/2,r:x+w,b:y+h};
}
/** Entscheidung (Raute) mit Frage */
function decision(cx,cy,w,h,q,{fs=15}={}){
 out.push(`<polygon points="${cx},${cy-h/2} ${cx+w/2},${cy} ${cx},${cy+h/2} ${cx-w/2},${cy}" fill="#ffffff" stroke="${C.line}" stroke-width="2.5"/>`);
 const lines=wrap(q,w*0.6,fs),th=lines.length*fs*1.15;
 if(lines.length*fs*1.15>h*0.62)warn.push(`Raute „${q}“: zu viel Text`);
 textBlock(cx-w/2,cy-th/2+fs*0.85,w,lines,{fs,weight:600,anchor:'middle',lh:1.15});
 return {cx,cy,l:cx-w/2,r:cx+w/2,t:cy-h/2,b:cy+h/2};
}
const MARK={flow:C.line,fail:C.fail,loop:C.fail,trig:'#534ab7',ref:'#6b6a64'};
/** Pfeil über Punkte; Art: flow (Ablauf), fail (Fehler → Fehlerspeicher), loop (Wiederholung), trig (Auslöser), ref (Verweis) */
function arrow(pts,kind='flow',label='',lp=null,{fs=14,end=true}={}){
 const d=pts.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join(' ');
 const dash=kind==='fail'?' stroke-dasharray="12 8"':kind==='trig'?' stroke-dasharray="3 7" stroke-linecap="round"':kind==='ref'?' stroke-dasharray="6 6"':'';
 out.push(`<path d="${d}" fill="none" stroke="${MARK[kind]}" stroke-width="${kind==='loop'?3:2.4}"${dash}${end?` marker-end="url(#m-${kind})"`:''}/>`);
 if(label){const [lx,ly]=lp||pts[Math.floor(pts.length/2)];
  out.push(`<text x="${lx}" y="${ly}" font-size="${fs}" font-weight="600" fill="${MARK[kind]}" text-anchor="middle" stroke="#ffffff" stroke-width="7" paint-order="stroke">${esc(label)}</text>`);}
}
const lab=(x,y,t,{fs=14,color=C.muted,anchor='middle',weight=600}={})=>out.push(`<text x="${x}" y="${y}" font-size="${fs}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" stroke="#ffffff" stroke-width="6" paint-order="stroke">${esc(t)}</text>`);
/** Bahn: farbiger Streifen links mit Namen, heller Hintergrund */
function lane(y,h,title,sub,kind){
 const [fill,stroke]=C[kind];
 out.push(`<rect x="30" y="${y}" width="${W-60}" height="${h}" rx="16" fill="${fill}" fill-opacity="0.35" stroke="${stroke}" stroke-width="2"/>`);
 out.push(`<rect x="30" y="${y}" width="270" height="${h}" rx="16" fill="${stroke}"/>`);
 textBlock(48,y+44,240,wrap(title,240,30),{fs:30,weight:700,color:'#ffffff',lh:1.15});
 textBlock(48,y+44+wrap(title,240,30).length*36+10,240,wrap(sub,240,16),{fs:16,color:'#ffffff'});
}
const group=(x,y,w,h,title,kind)=>{const [,stroke,ink]=C[kind];out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="none" stroke="${stroke}" stroke-width="2" stroke-dasharray="14 8"/>`);
 out.push(`<text x="${x+16}" y="${y+28}" font-size="20" font-weight="700" fill="${ink}" stroke="#ffffff" stroke-width="6" paint-order="stroke">${esc(title)}</text>`);};

/* ───────────── Kopf ───────────── */
out.push(`<text x="40" y="78" font-size="58" font-weight="700" fill="${C.text}">Plenara · Betriebsplan der Server-Pipeline</text>`);
out.push(`<text x="40" y="122" font-size="24" fill="${C.muted}">Prozesstapete: Tagespipeline, Fehlerspeicher, Nacharbeit, Altbestand und KI mit allen Verzweigungen · Stand 15.10.2026 · Branch betriebsplan, noch nicht ausgerollt · Namen aus shared/pipeline-terms.mjs</text>`);
// Legende
{
 let x=3060;const y=40;
 const chip=(k,t)=>{const [f,s]=C[k];out.push(`<rect x="${x}" y="${y}" width="36" height="26" rx="5" fill="${f}" stroke="${s}" stroke-width="2"/>`);out.push(`<text x="${x+44}" y="${y+20}" font-size="17" fill="${C.text}">${esc(t)}</text>`);x+=44+t.length*9.2+26;};
 chip('night',FLOWS.tages.name);chip('fix',FLOWS.nacharbeit.name+', Fehlerspeicher');chip('alt',FLOWS.altbestand.name);chip('ki','KI');chip('store','Speicher');
 x=3060;const y2=96;
 const ln=(k,t)=>{arrow([[x,y2],[x+60,y2]],k);out.push(`<text x="${x+72}" y="${y2+6}" font-size="17" fill="${C.text}">${esc(t)}</text>`);x+=72+t.length*9.2+30;};
 ln('flow','Ablauf');ln('fail','Fehler → Fehlerspeicher');ln('loop','Wiederholung, Folgekette');ln('trig','Auslöser');
 out.push(`<polygon points="${x+18},${y2-14} ${x+36},${y2} ${x+18},${y2+14} ${x},${y2}" fill="#fff" stroke="${C.line}" stroke-width="2"/><text x="${x+46}" y="${y2+6}" font-size="17" fill="${C.text}">Entscheidung</text>`);
}

/* ───────────── Tagesuhr ───────────── */
{
 const x0=320,x1=W-60,y0=170,hpx=(x1-x0)/24,X=h=>x0+h*hpx;
 out.push(`<text x="40" y="${y0+18}" font-size="26" font-weight="700" fill="${C.text}">Tagesuhr</text>`);
 for(let h=0;h<=24;h++){out.push(`<line x1="${X(h)}" y1="${y0+20}" x2="${X(h)}" y2="${y0+380}" stroke="${C.grid}" stroke-width="${h%6?1:2}"/>`);if(h<24)out.push(`<text x="${X(h)+4}" y="${y0+16}" font-size="15" fill="${C.muted}">${String(h).padStart(2,'0')}:00</text>`);}
 const rows=[
  ['night',`${S('backup')}`,[[0.5,0.75]],'00:30'],
  ['night','Abruf, nachts',[[1,4,'typisch 3 h'],[4,5,'höchstens bis 05:00',true]],'01:00 · 1 Tag zurück, sonntags 1 Monat'],
  ['night','Startseite: Karte und Trends',[[5.17,5.35]],'05:10'],
  ['night','Extraktion, nachts',[[5.5,7.5,'PDF laden · Anlagen laden · Text lesen · OCR ≤ 45 min']],'05:30, höchstens 2 h'],
  ['night','Verarbeitung, nachts',[[7.5,8.5,'Regeln · Suche · Zahlen']],'direkt danach (Rückfall 08:50)'],
  ['fix','OCR, tagsüber',[[7,23,'Rest der Nacht im Tagesbereich, danach Regeln; Altbestand 10–22 Uhr nur auf Anforderung',true]],'alle 10 min'],
  ['fix','Nacharbeit',Array.from({length:28},(_,i)=>[9+i*0.5,9+i*0.5+0.33]),'alle 30 min, je Lauf ≤ 20 min'],
  ['alt','Altbestand',[[10,22,'nur mit Anforderung (Seite Altbestand); Nacharbeit hat Vorrang',true]],'alle 10 min'],
  ['alt','PDF-Aufträge (Altbestand)',[[10,22,'Ältere Monate laden · Anlagen laden · Text lesen; Start bis 21:30, Ende 22:00',true]],''],
  ['ki','KI (Agent, von Hand)',[[9,18,'wenn ein Agent arbeitet',true]],''],
 ];
 rows.forEach(([k,name,bars,note],i)=>{
  const y=y0+30+i*35,[f,s,ink]=C[k];
  out.push(`<text x="${x0-12}" y="${y+21}" font-size="17" font-weight="600" fill="${ink}" text-anchor="end">${esc(name)}</text>`);
  for(const [a,b,t,light] of bars){out.push(`<rect x="${X(a)}" y="${y+4}" width="${Math.max(6,X(b)-X(a))}" height="24" rx="5" fill="${light?f:s}" stroke="${s}" stroke-width="1.5"${light?' stroke-dasharray="6 4"':''}/>`);
   if(t)out.push(`<text x="${X(a)+8}" y="${y+21}" font-size="14" fill="${light?ink:'#fff'}">${esc(t)}</text>`);}
  if(note){const last=bars.at(-1);out.push(`<text x="${X(last[1])+10}" y="${y+21}" font-size="14" fill="${C.muted}">${esc(note)}</text>`);}
 });
}

/* ───────────── Bahn 1: Tagespipeline ───────────── */
const L1=560;
lane(L1,620,FLOWS.tages.name,'jede Nacht, feste Reihenfolge; was scheitert, kommt in den Fehlerspeicher, die Pipeline wartet nicht','night');
group(320,L1+16,1240,588,'Sichern und Stufe 1: '+PHASES.abruf.name,'night');
group(1590,L1+16,1580,588,'Stufe 2: '+PHASES.extraktion.name+' (05:30, „Extraktion, nachts“, höchstens 2 h)','night');
group(3200,L1+16,1570,588,'Stufe 3: '+PHASES.verarbeitung.name+' („Verarbeitung, nachts“)','night');
const BUS=L1+640; // Sammelleitung der Fehler zum Fehlerspeicher
{
 const sb=box(340,L1+60,230,132,'00:30 '+S('backup'),'Datenbank, Index und Texte der PDF-Ablage → backups/ (2 Stände; mit BACKUP_REMOTE außer Haus)','night');
 const d1=decision(680,L1+120,190,120,'Sonntag?');
 arrow([[sb.r,sb.cy],[d1.l,d1.cy]]);
 const m=box(840,L1+60,170,52,'Fenster 1 Monat','','night',{fs:17});
 const t=box(840,L1+128,170,52,'Fenster 1 Tag','','night',{fs:17});
 arrow([[d1.r,d1.cy],[805,d1.cy],[805,m.cy],[m.x,m.cy]],'flow','ja',[820,m.cy-10]);
 arrow([[805,d1.cy],[805,t.cy],[t.x,t.cy]],'flow','nein',[822,t.cy+26]);
 const a1=box(1060,L1+60,240,132,'01:00 Abruf, nachts','Auftrag für alle angebundenen Quellen; dazu angesetzte künftige Sitzungen','night');
 arrow([[m.r,m.cy],[1035,m.cy],[1035,a1.cy-10],[a1.x,a1.cy-10]]);arrow([[t.r,t.cy],[1035,t.cy],[1035,a1.cy-10]],'flow','',null,{end:false});
 const d2=decision(1180,L1+275,250,130,'Gebiet oder sein Server wartet im Fehlerspeicher?',{fs:14});
 arrow([[a1.cx,a1.b],[a1.cx,d2.t]]);
 const z=box(1340,L1+225,200,100,'Zurückgestellt','bis zum Termin; die Nacharbeit holt es','night',{fs:17,sfs:14});
 arrow([[d2.r,d2.cy],[z.x,d2.cy]],'flow','ja',[d2.r+28,d2.cy-8]);
 const a2=box(1060,L1+380,240,110,S('import')+' je Gebiet','runSync; 24 Bahnen, je Server höchstens 2','night');
 arrow([[d2.cx,d2.b],[d2.cx,a2.y]],'flow','nein',[d2.cx+30,d2.b+18]);
 const d3=decision(790,L1+435,190,120,'Ergebnis je Gebiet?');
 arrow([[a2.x,a2.cy],[d3.r,d3.cy]]);
 const g1=box(340,L1+336,300,88,'gespeichert','topics, Suche, Werte je Gebiet; Eintrag gelöscht, Server liefert','night',{fs:17,sfs:14});
 const g2=box(340,L1+438,300,88,'Zeitgrenze erreicht','Teil n: nächste Nacht hinter dem Cursor','night',{fs:17,sfs:14});
 arrow([[d3.l,d3.cy-20],[690,d3.cy-20],[690,g1.cy],[g1.r,g1.cy]],'flow','',null);lab(668,g1.cy-8,'ok');
 arrow([[d3.l,d3.cy+15],[660,d3.cy+15],[660,g2.cy],[g2.r,g2.cy]]);lab(624,g2.cy+28,'Zeit');
 arrow([[d3.cx,d3.b],[d3.cx,BUS]],'fail','Quelle bremst · Fehler',[d3.cx+92,d3.b+34]);
 const st=box(1340,L1+380,200,110,'05:10 Startseite','nach allen Gebieten: Karte und Trends vorrechnen','night',{fs:17,sfs:14});
 arrow([[a2.r,a2.cy],[st.x,a2.cy]]);
 arrow([[st.cx,st.b],[st.cx,L1+545],[1575,L1+545],[1575,L1+120],[1610,L1+120]],'flow','',null);lab(1440,L1+575,'weiter mit der Extraktion');
}
{
 const e0=box(1610,L1+60,250,120,'Auswahl','seit dem letzten Lauf geschrieben + alle mit Sitzung im Tagesbereich (2 Indexabfragen)','night',{fs:18,sfs:14});
 const e1=box(1895,L1+60,200,120,S('pdf'),'Hauptdokumente, ≤ 29 min','night',{fs:18,sfs:14});
 const e2=box(2125,L1+60,220,120,S('others'),'übrige PDFs, ≤ 19 min; in der Grenze unter allen Hauptdokumenten','night',{fs:18,sfs:13});
 const e3=box(2375,L1+60,170,120,S('text'),'Textebene','night',{fs:18,sfs:14});
 const dO=decision(2640,L1+120,170,120,'Seiten ohne Text?',{fs:14});
 const e4=box(2770,L1+60,170,120,S('ocr'),'Hauptdokumente zuerst, ≤ 45 min','night',{fs:18,sfs:14});
 const e5=box(2975,L1+60,180,120,S('doctype')+', '+S('stats'),'dann Verarbeitung anstoßen','night',{fs:17,sfs:13});
 arrow([[e0.r,e0.cy],[e1.x,e0.cy]]);arrow([[e1.r,e1.cy],[e2.x,e1.cy]]);arrow([[e2.r,e2.cy],[e3.x,e2.cy]]);arrow([[e3.r,e3.cy],[dO.l,dO.cy]]);
 arrow([[dO.r,dO.cy],[e4.x,dO.cy]],'flow','ja',[dO.r+14,dO.cy-10]);arrow([[e4.r,e4.cy],[e5.x,e4.cy]]);
 arrow([[dO.cx,dO.t],[dO.cx,L1+46],[e5.cx,L1+46],[e5.cx,e5.y]],'flow','nein',[dO.cx+26,L1+42]);
 // Varianten beim Laden (gilt für PDF laden und Anlagen laden)
 const dh=decision(2000,L1+275,190,120,'Server?');
 arrow([[e1.cx,e1.b],[e1.cx,dh.t]]);arrow([[e2.cx,e2.b],[e2.cx,L1+200],[e1.cx+20,L1+200]],'flow','',null);
 const w1=box(1610,L1+215,250,62,'wartet: auslassen','Dokument bleibt offen','night',{fs:16,sfs:13});
 const w2=box(1610,L1+290,250,82,'fällig: Stichprobe','3 Dokumente; eine gelingt → liefert, der Rest folgt','night',{fs:16,sfs:13});
 arrow([[dh.l,dh.cy-20],[w1.r,dh.cy-20]],'flow','wartet',[dh.l-36,dh.cy-28]);
 arrow([[dh.l,dh.cy+20],[1890,dh.cy+20],[1890,w2.cy],[w2.r,w2.cy]]);lab(1920,dh.cy+44,'fällig');
 const da=decision(2000,L1+450,190,120,'Antwort?');
 arrow([[dh.cx,dh.b],[dh.cx,da.t]],'flow','liefert',[dh.cx+34,dh.b+20]);
 const gone=box(1610,L1+420,250,82,'fehlt dauerhaft','404, 410, kein PDF, über 30 MB','night',{fs:16,sfs:13});
 arrow([[da.l,da.cy],[gone.r,da.cy]],'flow','',null);lab(1882,da.cy-8,'404 · kein PDF');
 arrow([[gone.cx,gone.b],[gone.cx,BUS]],'fail');
 arrow([[da.cx,da.b],[da.cx,BUS]],'fail','429 · 403 · Timeout · 5xx',[da.cx+120,da.b+30]);
 const dg=decision(2290,L1+450,200,120,'Platz in der 80-GB-Grenze?',{fs:14});
 arrow([[da.r,da.cy],[dg.l,dg.cy]],'flow','PDF',[da.r+24,da.cy-10]);
 const k1=box(2420,L1+300,190,70,'behalten','Text gleich gelesen','night',{fs:16,sfs:13});
 const k2=box(2420,L1+385,240,100,'Tausch','besser als die schlechteste Datei: die fliegt raus (Text bleibt), sonst die neue','night',{fs:16,sfs:13});
 const k3=box(2420,L1+500,240,70,'über 10 MB','nur der Text bleibt','night',{fs:16,sfs:13});
 arrow([[dg.cx,dg.t],[dg.cx,k1.cy],[k1.x,k1.cy]],'flow','ja',[dg.cx-18,dg.t-6]);
 arrow([[dg.r,dg.cy],[k2.x,dg.cy]],'flow','voll',[dg.r+20,dg.cy-10]);
 arrow([[dg.cx,dg.b],[dg.cx,k3.cy],[k3.x,k3.cy]]);
 // Varianten der OCR
 const dl=decision(2860,L1+300,220,130,'Seite > 90 s oder Datei > 5 min?',{fs:14});
 arrow([[e4.cx,e4.b],[e4.cx,dl.t]]);
 arrow([[dl.r,dl.cy],[3110,dl.cy],[3110,BUS]],'fail','zu langsam',[3110,dl.cy-12]);
 const dt=decision(2860,L1+470,220,110,'45 Minuten um?',{fs:14});
 arrow([[dl.cx,dl.b],[dl.cx,dt.t]],'flow','nein',[dl.cx+28,dl.b+20]);
 arrow([[dt.cx,dt.b],[dt.cx,L1+550]],'flow');lab(2860,L1+576,'ja: Rest → „OCR, tagsüber“',{color:C.fix[2]});
 arrow([[dt.l,dt.cy],[2725,dt.cy],[2725,L1+205],[2810,L1+205],[2810,e4.b]],'loop','',null);lab(2734,L1+400,'nein: nächste Datei',{color:C.fail,fs:13,anchor:'start'});
}
{
 const v1=box(3220,L1+60,200,120,S('title'),'Regel-Label: nur fehlende oder veraltete','night',{fs:18,sfs:14});
 const v2=box(3450,L1+60,230,120,S('rules'),'Art des Punkts, Thema, Regel-Zusammenfassung, Fakten; KI-Felder unberührt','night',{fs:18,sfs:14});
 const v3=box(3710,L1+60,200,120,S('search'),'Wortliste nachführen','night',{fs:18,sfs:14});
 const v4=box(3940,L1+60,190,120,S('xcases'),'plenara.X','night',{fs:18,sfs:14});
 const v5=box(4160,L1+60,230,120,'KI-Stand, '+S('trace'),'Zähler für Pipeline-Debug und Altbestand','night',{fs:17,sfs:14});
 const v6=box(4420,L1+60,330,120,'fertig','die KI arbeitet von Hand (Bahn KI); neuer Text macht KI-Fassungen „veraltet“','night',{fs:18,sfs:13});
 arrow([[3160,L1+120],[v1.x,L1+120]],'trig','stößt an',[3180,L1+108]);
 arrow([[v1.r,v1.cy],[v2.x,v1.cy]]);arrow([[v2.r,v2.cy],[v3.x,v2.cy]]);arrow([[v3.r,v3.cy],[v4.x,v3.cy]]);arrow([[v4.r,v4.cy],[v5.x,v4.cy]]);arrow([[v5.r,v5.cy],[v6.x,v5.cy]]);
 const dk=decision(3565,L1+290,260,130,'Eingaben geändert? (Schlüssel mit Textstand)',{fs:14});
 arrow([[v2.cx,v2.b],[v2.cx,dk.t]]);
 const sk=box(3220,L1+250,200,70,'überspringen','unverändert','night',{fs:16,sfs:13});
 arrow([[dk.l,dk.cy],[sk.r,dk.cy]],'flow','nein',[dk.l-22,dk.cy-10]);
 const ds=decision(3565,L1+460,260,120,'Hauptdokument ist Unterlage der ganzen Sitzung?',{fs:13});
 arrow([[dk.cx,dk.b],[dk.cx,ds.t]],'flow','ja',[dk.cx+20,dk.b+18]);
 const ns=box(3220,L1+425,200,70,'keine Zusammenfassung','Art, Thema bleiben','night',{fs:15,sfs:13});
 arrow([[ds.l,ds.cy],[ns.r,ds.cy]],'flow','ja',[ds.l-20,ds.cy-10]);
 const dc=decision(3900,L1+460,190,120,'Regel stürzt ab?',{fs:14});
 arrow([[ds.r,ds.cy],[dc.l,dc.cy]],'flow','nein',[ds.r+20,ds.cy-10]);
 const ok=box(4060,L1+425,300,90,'gespeichert','Payload, report_rules, topic_facts; per Trigger die Suchkarte','night',{fs:16,sfs:13});
 arrow([[dc.r,dc.cy],[ok.x,dc.cy]],'flow','nein',[dc.r+18,dc.cy-10]);
 arrow([[dc.cx,dc.b],[dc.cx,BUS]],'fail','Fehler im eigenen Code',[dc.cx+110,dc.b+28]);
}

/* ───────────── Bahn 2: Fehlerspeicher ───────────── */
const L2=1230;
// Sammelleitung
arrow([[4752,BUS],[470,BUS],[470,L2+40]],'fail','',null);
lab(2500,BUS+22,'jeder Fehlschlag: recordFailure; jeder Erfolg löscht den Eintrag (clearFailure)',{color:C.fail,fs:16});
lane(L2,560,'Fehler­speicher','work_failures und source_hosts (Migration 0040); entscheidet, wann erneut','fix');
{
 const f0=box(340,L2+40,270,150,'Eintrag schreiben','Schritt, Gegenstand, Grund, Versuche, nächster Termin, Sitzungstag, Herkunft; ein neuer Fehlschlag ersetzt den alten','fix',{fs:18,sfs:13});
 box(340,L2+220,270,140,'Altfehler übertragen','beim ersten Lauf: alte Abruf- und OCR-Fehler der Ablage und die alte Serversperre, alle als Altbestand','fix',{fs:16,sfs:13,dash:true});
 const dc=decision(735,L2+115,180,120,'Grund?');
 arrow([[f0.r,f0.cy-40],[dc.l,dc.cy]]);
 const cls=[['blocked','429, 503, Abweisung'],['denied','401, 403, 451'],['transient','Timeout, keine Antwort, 5xx'],['gone','404, 410, kein PDF, > 30 MB, geändert'],['slow','OCR über der Zeitgrenze'],['busy','409, Datenbank gesperrt'],['internal','Ausnahme im eigenen Code']];
 cls.forEach(([k,why],i)=>{const y=L2+28+i*72,t=CLASS_TERMS[k];
  box(880,y,620,64,`${t.name} (${why})`,t.then,k==='gone'?'neutral':'fix',{fs:16,sfs:14});
  arrow([[dc.r,dc.cy],[855,dc.cy],[855,y+32],[880,y+32]],'flow','',null,{end:true});
 });
 lab(1190,L2+553,'Endgültig ist nur „fehlt dauerhaft“ und eine OCR, die auch beim zweiten Versuch zu langsam ist; alles andere läuft regelmäßig weiter.',{fs:15,color:C.fix[2]});
 // Serverstufe
 group(1540,L2+20,1080,515,'Serverstufe je Server (source_hosts)','fix');
 const s1=box(1570,L2+66,150,88,'liefert','ok','fix',{fs:18,sfs:13,align:'middle'});
 const s2=box(1870,L2+66,170,88,'bremst','1 h → 4 h → 12 h → 1 Tag → 3 Tage → 7 Tage','fix',{fs:18,sfs:12});
 const s3=box(2150,L2+66,170,88,'gesperrt','7 Tage → 30 Tage','fix',{fs:18,sfs:13});
 const s4=box(2420,L2+66,170,88,'prüfen','Stichprobe alle 30 Tage','fix',{fs:18,sfs:13});
 arrow([[s1.r,s1.cy-18],[s2.x,s1.cy-18]],'flow','429, 503 sofort',[1795,s1.cy-26],{fs:13});
 arrow([[s1.r,s1.cy+18],[s2.x,s1.cy+18]],'flow','3 Fehler in Folge',[1795,s1.cy+40],{fs:13});
 arrow([[s1.cx,s1.b],[s1.cx,L2+180],[s3.cx,L2+180],[s3.cx,s3.b]],'flow','3 × verweigert in Folge (401, 403, 451)',[2000,L2+174],{fs:13});
 arrow([[s3.r,s3.cy],[s4.x,s3.cy]],'flow','',null);
 out.push(`<text x="1570" y="${L2+222}" font-size="15" fill="${C.muted}">In der Wartezeit lassen alle Abrufer den Server aus (Abruf, PDF laden, OCR-Nachladen); seine Einträge zählen keine Versuche.</text>`);
 const dT=decision(1700,L2+320,200,120,'Termin erreicht?');
 const pr=box(1880,L2+275,220,90,'Stichprobe','3 Einträge des Servers','fix',{fs:18,sfs:14});
 const dP=decision(2225,L2+320,190,120,'eine gelingt?');
 arrow([[dT.r,dT.cy],[pr.x,dT.cy]],'flow','ja',[dT.r+20,dT.cy-10]);arrow([[pr.r,pr.cy],[dP.l,dP.cy]]);
 const up=box(2380,L2+380,220,80,'Stufe + 1','neue, längere Wartezeit','fix',{fs:17,sfs:13});
 const okk=box(2380,L2+250,220,80,'liefert wieder','Rest folgt','fix',{fs:17,sfs:13});
 arrow([[dP.r,dP.cy],[2350,dP.cy],[2350,okk.cy],[okk.x,okk.cy]],'flow','ja',[2336,okk.cy-10]);
 arrow([[2350,dP.cy],[2350,up.cy],[up.x,up.cy]],'flow','nein',[2330,up.cy+24]);
 arrow([[dT.cx,dT.b],[dT.cx,L2+470],[1600,L2+470],[1600,dT.cy],[dT.l,dT.cy]],'loop','nein: warten',[1700,L2+492]);
 lab(2080,L2+512,'„Freigeben“ (Pipeline-Debug, Altbestand) zieht die Prüfung vor.',{fs:14});
 // Tagesbereich / Altbestand
 group(2660,L2+20,1070,515,'Tagesbereich oder Altbestand?','fix');
 const dR=decision(2860,L2+190,320,190,'Sitzung höchstens 7 Tage zurück (oder künftig), frühestens 12.10.2026, und Fehler nicht vor dem 12.10.?',{fs:14});
 const ab=box(3130,L2+70,330,100,'Altbestand','nur auf Knopfdruck: Seite Altbestand (10–22 Uhr)','alt',{fs:19,sfs:14,thick:true});
 const tb=box(3130,L2+215,330,100,'Tagesbereich','automatisch: Nacharbeit (09–23 Uhr), OCR tagsüber','fix',{fs:19,sfs:14,thick:true});
 arrow([[dR.r,dR.cy],[3080,dR.cy],[3080,ab.cy],[ab.x,ab.cy]],'flow','nein',[3108,L2+150]);
 arrow([[3080,dR.cy],[3080,tb.cy],[tb.x,tb.cy]],'flow','ja',[3102,L2+240]);
 box(2690,L2+390,550,132,'Wandert von selbst','Nach 7 Tagen gehört ein Eintrag zum Altbestand; die Nacharbeit lässt ihn dann liegen. Herkunft „Altbestand“ (übertragene Altfehler, Läufe des Altbestands) gehört nie zum Tagesbereich. Ohne Sitzungstag zählt der erste Fehlschlag.','fix',{fs:17,sfs:14});
 // nichts vergessen
 box(3770,L2+30,960,500,'Nichts wird dauerhaft vergessen','• vorübergehend: nach der Leiter wöchentlich weiter\n• Zugriff verweigert: monatlich weiter; Server in „prüfen“ alle 30 Tage Stichprobe\n• Eintrag ohne Termin (eigener Code) hält den Nachtabruf nicht auf\n• sonntags Abruf 1 Monat zurück: spät veröffentlichte Niederschriften und Beschlüsse\n• Extraktion nimmt auch alle Berichte mit Sitzung im Tagesbereich (OParl: updated_at ist das Änderungsdatum der Quelle)\n• nicht drangekommen: eine Stunde weiter, nicht jede halbe Stunde\n• bei gleichem Sitzungstag kommen die mit den wenigsten Versuchen zuerst\n• die Seiten zeigen je Grund: jetzt fällig · wartet · kein Versuch mehr','neutral',{fs:24,sfs:21,thick:true});
 // Wege aus dem Speicher
 arrow([[tb.cx,tb.b],[tb.cx,L2+590],[1000,L2+590],[1000,L2+650]],'loop','fällige Einträge des Tagesbereichs → Nacharbeit',[2200,L2+582]);
 arrow([[ab.r,ab.cy],[3505,ab.cy],[3505,2505],[1250,2505],[1250,2570]],'loop','',null);
 lab(3520,L2+800,'Altbestand → Job „Altbestand“ (nur angefordert)',{color:C.alt[2],fs:15,anchor:'start'});
}

/* ───────────── Bahn 3: Nacharbeit und OCR tagsüber ───────────── */
const L3=1840;
lane(L3,640,FLOWS.nacharbeit.name,'tagsüber automatisch, nur Tagesbereich; Stufe für Stufe, mit Folgekette','fix');
{
 const n0=box(340,L3+40,250,110,'Zeitplaner','alle 30 min, 09:00 bis 23:00','fix',{fs:18,sfs:14});
 const dL=decision(700,L3+95,190,120,'Bahn „Laden“ frei?',{fs:14});
 arrow([[n0.r,n0.cy],[dL.l,dL.cy]],'trig');
 const sk=box(615,L3+190,170,62,'lässt aus','nächster Lauf','fix',{fs:16,sfs:13});
 arrow([[dL.cx,dL.b],[dL.cx,sk.y]],'flow','nein',[dL.cx+28,dL.b+16]);
 const n1=box(850,L3+40,320,190,'Auswahl (dueEntries)','fällig im Tagesbereich, Server nicht wartend. Reihenfolge: Abruf → Extraktion → Verarbeitung; neueste Sitzung; wenigste Versuche; am längsten nicht versucht. Je Server ≤ 20 (fällige 3), je Lauf ≤ 500 Einträge, ≤ 20 min','fix',{fs:18,sfs:13});
 arrow([[dL.r,dL.cy],[n1.x,dL.cy]],'flow','ja',[dL.r+18,dL.cy-10]);
 const st=[[S('import'),'import-worker --direct; Fenster seit dem ersten Fehlschlag, mindestens 1 Woche'],[S('pdf'),'fetch.mjs --urls'],[S('text')+', '+S('ocr'),'text.mjs --shas; OCR mit 15 min je Datei (zweiter Versuch)'],[S('rules'),'read-reports.mjs --ids']];
 st.forEach(([t,s],i)=>{const b=box(1210,L3+20+i*76,360,74,t,s,'fix',{fs:15,sfs:12});arrow([[n1.r,n1.cy],[1190,n1.cy],[1190,b.cy],[b.x,b.cy]],'flow','',null);});
 const dO=decision(1720,L3+135,220,130,'Ausgang je Eintrag?');
 arrow([[1570,L3+135],[dO.l,dO.cy]]);
 const fk=box(1880,L3+30,540,130,'gelungen: Folgekette','nach Abruf: '+S('pdf')+', '+S('others')+', '+S('text')+', '+S('ocr')+', '+S('rules')+' für die geschriebenen Berichte · nach '+S('pdf')+': '+S('text')+', '+S('ocr')+', Regeln · nach '+S('text')+'/'+S('ocr')+': Regeln','fix',{fs:18,sfs:14,thick:true});
 arrow([[dO.cx,dO.t],[dO.cx,L3+50],[fk.x,L3+50]],'loop','gelungen',[dO.cx+60,L3+42]);
 const ai=box(2480,L3+30,250,130,'bereit für die KI','Zähler im Protokoll (nacharbeit-last)','ki',{fs:18,sfs:14});
 arrow([[fk.r,fk.cy],[ai.x,fk.cy]]);
 const nt=box(1880,L3+190,270,80,'nicht drangekommen','Server wartet, Zeitgrenze → eine Stunde weiter','fix',{fs:15,sfs:12});
 arrow([[dO.r,dO.cy],[1860,dO.cy],[1860,nt.cy],[nt.x,nt.cy]]);
 arrow([[dO.cx,dO.b],[dO.cx,L3+300],[2450,L3+300],[2450,L3+8]],'fail','gescheitert: neuer Termin nach Grund · kein Versuch mehr',[2080,L3+322]);
 // OCR tagsüber
 group(320,L3+345,4430,280,'„OCR, tagsüber“ (eigene Einheit; Anhalten trifft nur die OCR)','fix');
 const o0=box(340,L3+390,250,100,'Zeitplaner','alle 10 min, 07:00 bis 23:00','fix',{fs:18,sfs:14});
 const o1=box(640,L3+380,360,130,'Reihe des Tagesbereichs','Rest der Nacht; Hauptdokumente vor Anlagen, abgelegte vor gelöschten (kurz nachgeladen), neueste Sitzung; wartende Einträge ausgelassen','fix',{fs:18,sfs:13});
 arrow([[o0.r,o0.cy],[o1.x,o0.cy]],'trig');
 const o2=box(1040,L3+380,300,130,'OCR in Paketen','25 Dateien je Prozess, 2 Worker; Seite ≤ 90 s, Datei ≤ 5 min; Wächter beendet Pakete ohne Lebenszeichen nach 3 min','fix',{fs:18,sfs:13});
 arrow([[o1.r,o1.cy],[o2.x,o1.cy]]);
 arrow([[o2.cx,o2.b],[o2.cx,L3+585]],'fail');lab(o2.cx,L3+610,'zu langsam, Nachladen gescheitert → Fehlerspeicher',{color:C.fail});
 const RY=L3+435;
 const dA=decision(1500,RY,200,130,'Altbestand angefordert und 10–22 Uhr?',{fs:13});
 arrow([[o2.r,RY],[dA.l,RY]]);
 const oa=box(1610,L3+515,300,90,'OCR des Altbestands','15 min je Datei, auch zu langsame vom letzten Mal','alt',{fs:17,sfs:13});
 arrow([[dA.cx,dA.b],[dA.cx,oa.cy],[oa.x,oa.cy]],'flow','ja',[dA.cx+20,dA.b+18]);
 const dG=decision(2080,RY,200,120,'Dateien gelesen?',{fs:14});
 arrow([[dA.r,RY],[dG.l,RY]],'flow','nein',[dA.r+30,RY-10]);arrow([[oa.r,oa.cy],[1950,oa.cy],[1950,RY]],'flow','',null,{end:false});
 const en=box(1995,L3+535,180,62,'endet sofort','kein Protokoll','fix',{fs:15,sfs:12});
 arrow([[dG.cx,dG.b],[dG.cx,en.y]],'flow','nein',[dG.cx+26,dG.b+18]);
 const dV=decision(2420,RY,240,130,'„Verarbeitung, nachts“ läuft?',{fs:14});
 arrow([[dG.r,RY],[dV.l,RY]],'flow','ja',[dG.r+22,RY-10]);
 const vk=box(2620,L3+520,280,80,'Text kommt dort an','nächster Lauf liest den Bericht','fix',{fs:15,sfs:12});
 arrow([[dV.cx,dV.b],[dV.cx,vk.cy],[vk.x,vk.cy]],'flow','ja',[dV.cx-20,dV.b+16]);
 const vr=box(2620,L3+380,520,110,S('doctype')+' → '+S('rules')+' → '+S('search'),'für die Berichte, deren Text die OCR gerade ergänzt hat (Folgekette)','fix',{fs:18,sfs:14,thick:true});
 arrow([[dV.r,RY],[vr.x,RY]],'loop','nein',[dV.r+12,RY-10]);
 const va=box(3180,L3+380,300,110,'KI: „veraltet“','neuer Text ändert den Eingabehash','ki',{fs:18,sfs:14});
 arrow([[vr.r,vr.cy],[va.x,vr.cy]]);
 box(3530,L3+380,1200,220,'Wo die Nacharbeit herkommt und wohin sie führt','Sie liest nur den Tagesbereich des Fehlerspeichers. Gelingt ein Schritt, verschwindet der Eintrag und die nächste Stufe läuft für dieselben Berichte (Folgekette): ein erneut gelungener Abruf führt so bis zu Regeln und KI-Bereitschaft. Scheitert er, gibt der Grund den nächsten Termin. Hält ein Auftrag des Altbestands oder die Nacht die Bahn „Laden“, lässt sie aus.','neutral',{fs:22,sfs:20});
}

/* ───────────── Bahn 4: Altbestand ───────────── */
const L4=2530;
lane(L4,560,FLOWS.altbestand.name,'nur auf Knopfdruck, 10 bis 22 Uhr; dieselben Schritte wie nachts','alt');
{
 const p0=box(340,L4+50,280,150,'Seite Altbestand','/admin?seite=altbestand, Debug-Bereich; legt nur Wünsche ab (altbestand-requests)','alt',{fs:19,sfs:14});
 const p1=box(340,L4+230,280,110,'Reiter PDF-Import','„Alte Fehler erneut versuchen“, „OCR des Altbestands“ fordern dasselbe an','alt',{fs:17,sfs:13});
 const reqs=[['Rückwirkend abrufen','Gebiete (alle oder Liste), 1, 3, 12 oder 24 Monate'],['Alte Fehler erneut versuchen','alle, je Stufe oder je Grund; macht auch „kein Versuch mehr“ wieder fällig'],['Ältere Monate laden · Anlagen laden · Text lesen','Aufträge der PDF-Ablage'],['OCR des Altbestands','anfordern, anhalten'],['Verarbeitung jetzt · alle neu','Berichte mit neuen Eingaben, oder alle']];
 const rb=reqs.map(([t,s],i)=>box(680,L4+30+i*104,360,92,t,s,'alt',{fs:16,sfs:13}));
 rb.forEach(b=>arrow([[p0.r,p0.cy],[655,p0.cy],[655,b.cy],[b.x,b.cy]],'flow','',null));
 arrow([[p1.r,p1.cy],[655,p1.cy]],'flow','',null,{end:false});
 const j0=box(1100,L4+40,300,170,'Job „Altbestand“','alle 10 min, 10:00 bis 22:00, nur mit Anforderung; je Lauf ≤ 2 h, endet 22:00','alt',{fs:19,sfs:14,thick:true});
 arrow([[rb[0].r,rb[0].cy],[1075,rb[0].cy],[1075,j0.cy-30],[j0.x,j0.cy-30]]);arrow([[rb[1].r,rb[1].cy],[1075,rb[1].cy],[1075,j0.cy-30]],'flow','',null,{end:false});
 const dN=decision(1540,L4+125,230,140,'Nacharbeit hat Fälliges und lief > 25 min nicht?',{fs:13});
 arrow([[j0.r,j0.cy-30],[dN.l,dN.cy]]);
 const ls=box(1440,L4+230,200,62,'lässt aus','Vorrang des Tagesbereichs','alt',{fs:15,sfs:12});
 arrow([[dN.cx,dN.b],[dN.cx,ls.y]],'flow','ja',[dN.cx+20,dN.b+16]);
 const j1=box(1720,L4+30,460,110,'1. Alte Fehler','Nacharbeit mit Bereich Altbestand, Stufe für Stufe mit Folgekette, bis nichts mehr fällig ist','alt',{fs:18,sfs:14});
 const j2=box(1720,L4+160,460,130,'2. Rückwirkender Abruf','je 8 Gebiete über import-worker --direct; jedes gelungene gleich mit Extraktion und Regeln; erledigt und gescheitert gemerkt; fortsetzbar über Tage, anhaltbar','alt',{fs:18,sfs:13});
 arrow([[dN.r,dN.cy],[1700,dN.cy],[1700,j1.cy],[j1.x,j1.cy]],'flow','nein',[dN.r+20,dN.cy-10]);
 arrow([[1700,dN.cy],[1700,j2.cy],[j2.x,j2.cy]],'flow','',null);
 const fk=box(2230,L4+60,520,200,'Folgekette wie in der Nacharbeit',S('import')+' → '+S('pdf')+', '+S('others')+', '+S('text')+', '+S('ocr')+' → '+S('rules')+'; Fehler mit Herkunft Altbestand zurück in den Fehlerspeicher; gelungen: Eintrag weg, Bericht für die KI bereit','alt',{fs:18,sfs:15,thick:true});
 arrow([[j1.r,j1.cy],[fk.x,j1.cy]],'loop');arrow([[j2.r,j2.cy],[fk.x,j2.cy]],'loop');
 const pj=box(1100,L4+330,520,90,'Job „PDF-Aufträge“','startet bis 21:30, endet 22:00; einer zur Zeit; Fehler als Altbestand','alt',{fs:17,sfs:13});
 arrow([[rb[2].r,rb[2].cy],[1060,rb[2].cy],[1060,pj.cy],[pj.x,pj.cy]]);
 const oj=box(1100,L4+428,520,66,'Job „OCR, tagsüber“: nach dem Tagesbereich','10 bis 22 Uhr, bis angehalten','alt',{fs:16,sfs:13});
 arrow([[rb[3].r,rb[3].cy],[1080,rb[3].cy],[1080,oj.cy],[oj.x,oj.cy]]);
 const vj=box(1660,L4+430,520,82,'Job „Verarbeitung, nachts“ sofort','Titel einordnen, Regeln anwenden (geänderte Eingaben oder alle), Suche, Zahlen','alt',{fs:16,sfs:13});
 arrow([[rb[4].r,L4+525],[1640,L4+525],[1640,vj.cy],[vj.x,vj.cy]]);
 arrow([[fk.cx,fk.b],[fk.cx,L4+330],[4752,L4+330],[4752,BUS]],'fail','',null);lab(3400,L4+322,'Fehler mit Herkunft Altbestand → Fehlerspeicher',{color:C.fail,fs:15});
 box(2800,L4+40,1930,240,'Warum getrennt','Die Nacht gehört der Tagespipeline, tagsüber hat die Nacharbeit Vorrang. Der Altbestand ist groß (Stand 14.10.: 84.489 alte Abruffehler, rund 40.000 Anlagen mit 270.000 Seiten ohne Text, 32.088 Dokumente auf Servern, die 401/403 liefern) und darf Wochen brauchen; er läuft nur, wenn jemand ihn anfordert, Paket für Paket und fortsetzbar. Was er schafft, landet in denselben Speichern und wird wie nachts weiterverarbeitet.','neutral',{fs:24,sfs:21});
 box(2800,L4+360,1930,170,'Was endgültig bleibt (mit Zahl auf den Seiten)','Adressen mit 404 oder 410, Antworten ohne PDF, PDFs über 30 MB, Dateien, die sich beim Nachladen geändert haben, und OCR-Dateien, die auch mit 15 Minuten zu langsam sind (die Textebene bleibt). „Erneut versuchen“ im Altbestand öffnet sie wieder.','neutral',{fs:24,sfs:21});
}

/* ───────────── Bahn 5: KI ───────────── */
const L5=3120;
lane(L5,170,'KI','eigenes Ergebnis neben den Regeln; von Hand über den Agenten, keine Modell-API','ki');
{
 const k0=box(340,L5+30,300,110,'Liste: bereit, veraltet','ai_list; Zähler auf Pipeline-Debug und Altbestand','ki',{fs:18,sfs:13});
 const k1=box(690,L5+30,180,110,'claim','Reservierung','ki',{fs:18,sfs:13});
 const k2=box(920,L5+30,330,110,'read','alle PDFs des Berichts (Hauptdokument und Anlagen), alle Seiten','ki',{fs:18,sfs:13});
 const dQ=decision(1380,L5+85,200,120,'Quelle reicht?',{fs:14});
 const k3=box(1530,L5+30,380,110,'submit','Kurzfassung, Langfassung, KI-Einordnung gemeinsam; Eingabehash geprüft','ki',{fs:18,sfs:13});
 const k4=box(1960,L5+30,330,110,'Quelle reicht nicht','neuer Versuch erst bei geänderten Quelldaten','ki',{fs:17,sfs:13});
 arrow([[k0.r,k0.cy],[k1.x,k0.cy]]);arrow([[k1.r,k1.cy],[k2.x,k1.cy]]);arrow([[k2.r,k2.cy],[dQ.l,dQ.cy]]);
 arrow([[dQ.r,dQ.cy],[k3.x,dQ.cy]],'flow','ja',[dQ.r+12,dQ.cy-10]);
 arrow([[dQ.cx,dQ.b],[dQ.cx,L5+160],[k4.cx,L5+160],[k4.cx,k4.b]],'flow','nein',[dQ.cx+24,dQ.b+14]);
 const k5=box(2340,L5+30,600,110,'neuer Text → „veraltet“','OCR, Nacharbeit oder Altbestand ergänzen Text → Eingabehash ändert sich → der Bericht kommt wieder in die Liste','ki',{fs:18,sfs:14});
 arrow([[k5.cx,k5.y],[k5.cx,L5+14],[k0.cx,L5+14],[k0.cx,k0.y]],'loop','↻ wieder bearbeiten',[1600,L5+8]);
 box(2990,L5+30,1740,110,'Ergebnis: getrennt von den Regeln','Kurzfassung (ein Satz), Langfassung und KI-Label in topics.payload, dazu article_analyses, ai_usage. Regel-Label, Regel-Zusammenfassung und Einordnung von Hand bleiben stehen; beim Label gilt: von Hand → KI-Label → Thema der Regeln → Titelregel','ki',{fs:20,sfs:18});
}

/* ───────────── Fuß: Speicher und Seiten ───────────── */
{
 const y=L5+200;
 box(30,y,1560,H-y-20,'Speicher','Hauptdatenbank ratsmonitor.sqlite: topics, article_versions, source_coverage, import_runs, search_cards, search_words, report_rules, topic_facts, x_cases, ai_work_items, work_failures, source_hosts, system_state (Aufträge, Laufbuch schedule-log, pdf-daily-last, altbestand-requests, ai-counts, pipeline-trace) · PDF-Ablage RM_PDF_STORE: index.sqlite (pdfs, texts), files/<ab>/<sha>.pdf und .txt (80 GB für PDFs und Texte) · backups/','store',{fs:20,sfs:15});
 box(1620,y,1560,H-y-20,'Admin-Seiten','Jobs & Zeitpläne: alle Jobs mit Zeit oder Fenster · PDF-Import: Ablage, Aufträge, Server nach Serverstufe · Themen & Texte: Verarbeitung je Schritt · Pipeline-Debug (vorübergehend): Tagesuhr, Läufe, Wege der Berichte, Fehlerspeicher des Tagesbereichs · Altbestand: Abruf, Extraktion, Verarbeitung, alte Fehler','neutral',{fs:20,sfs:15});
 box(3210,y,1560,H-y-20,'Begriffe','Tagesbereich: Sitzungen der letzten 7 Tage, frühestens 12.10.2026 · Folgekette: gelingt eine Stufe, startet die nächste für dieselben Berichte · Stichprobe: 3 Einträge eines fälligen Servers · Stufen: Abruf, Extraktion, Verarbeitung · Quelle: requirements/betriebsplan-konzept.md','neutral',{fs:20,sfs:15});
}

const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W/3}mm" height="${H/3}mm" font-family="${FONT}">
<defs>${Object.entries(MARK).map(([k,c])=>`<marker id="m-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9z" fill="${c}"/></marker>`).join('')}</defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${out.join('\n')}
</svg>`;
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Plenara Betriebsplan, Prozesstapete</title>
<style>@page{size:${W/3}mm ${H/3}mm;margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}</body></html>`;
const htmlFile=path.join(os.tmpdir(),'betriebsplan-tapete.html'),pdfFile=path.join(here,'betriebsplan-prozesstapete.pdf');
fs.writeFileSync(htmlFile,html);fs.writeFileSync(path.join(os.tmpdir(),'betriebsplan-tapete.svg'),svg);
for(const w of warn)console.warn('Hinweis:',w);
if(process.argv.includes('--html')){console.log(htmlFile);process.exit(0);}
const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
if(!chrome){console.error('Kein Chrome gefunden (CHROME_PATH).');process.exit(1);}
execFileSync(chrome,['--headless=new','--disable-gpu','--no-pdf-header-footer','--print-to-pdf-no-header',`--print-to-pdf=${pdfFile}`,pathToFileURL(htmlFile).href],{stdio:'ignore',timeout:120000});
console.log(pdfFile,Math.round(fs.statSync(pdfFile).size/1024)+' KB');
