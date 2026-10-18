// Baut die technische Dokumentation (docs/technik/*.md) als eine PDF-Datei: Markdown → HTML (eigener kleiner Umsetzer für die
// Formen, die die Kapitel nutzen: Überschriften, Absätze, Listen mit Einrückung, Tabellen, Codeblöcke, Mermaid-Diagramme), die
// Diagramme zeichnet mermaid.js im Browser, Chrome druckt die Seite über playwright-core (aus docs/design/tools) als PDF.
//
//   node docs/technik/tools/build-pdf.mjs [--html]     --html: nur die HTML-Datei schreiben (tmp/technik-pdf/), ohne Chrome
//
// Ausgabe: docs/technik/technische-dokumentation.pdf. Chrome: CHROME_PATH, sonst die üblichen Pfade unter Windows und macOS.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');                 // docs/technik
const repo=path.resolve(root,'..','..');
const outDir=path.join(repo,'tmp','technik-pdf');
const pdfFile=path.join(root,'technische-dokumentation.pdf');
const ORDER=['README.md','glossar.md','abruf.md','pipeline.md','suche.md','auswertungen.md','datenmodell.md','zugang-und-oberflaeche.md'];
const slugOf=f=>'kap-'+f.replace(/\.md$/,'').toLowerCase();

/* ---------- Markdown → HTML ---------- */
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/** Inline: Code, fett, kursiv, Links; Links auf andere Kapitel werden Anker */
function inline(s){
 const parts=[];let last=0;const re=/`([^`]+)`/g;let m;
 const rest=t=>t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g,'$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,text,href)=>{const kap=href.match(/^([a-z-]+\.md)(#.*)?$/i);return `<a href="${kap?'#'+slugOf(kap[1]):esc(href)}">${text}</a>`;});
 while((m=re.exec(s))){parts.push(rest(esc(s.slice(last,m.index))));parts.push('<code>'+esc(m[1])+'</code>');last=m.index+m[0].length;}
 parts.push(rest(esc(s.slice(last))));
 return parts.join('');
}
const splitCells=l=>l.replace(/^\|/,'').replace(/\|\s*$/,'').split(/(?<!\\)\|/).map(c=>c.replace(/\\\|/g,'|').trim());
/** Ein Markdown-Kapitel → {html, title, h2[]} */
function convert(md,file){
 const lines=md.replace(/\r\n/g,'\n').split('\n');
 const out=[];const h2=[];let title='';
 let i=0;
 const listStack=[];                                   // {indent, tag}
 const closeListsTo=indent=>{while(listStack.length&&listStack.at(-1).indent>=indent){out.push(`</li></${listStack.pop().tag}>`);}};
 const closeAll=()=>{while(listStack.length)out.push(`</li></${listStack.pop().tag}>`);};
 while(i<lines.length){
  const line=lines[i];
  const indent=line.match(/^\s*/)[0].length;
  const body=line.trim();
  // Codeblock
  if(/^```/.test(body)){closeAll();const lang=body.slice(3).trim();const buf=[];i++;
   while(i<lines.length&&!/^\s*```/.test(lines[i])){buf.push(lines[i]);i++;}
   i++;
   if(lang==='mermaid')out.push(`<pre class="mermaid">${esc(buf.join('\n'))}</pre>`);
   else out.push(`<pre class="code">${esc(buf.join('\n'))}</pre>`);
   continue;}
  // Leerzeile
  if(!body){i++;continue;}
  // Überschrift
  const h=body.match(/^(#{1,4})\s+(.*)$/);
  if(h){closeAll();const lvl=h[1].length;const text=h[2];
   if(lvl===1){title=text;out.push(`<h1>${inline(text)}</h1>`);}
   else{const id=slugOf(file)+'-'+text.toLowerCase().replace(/[^a-z0-9äöüß]+/g,'-').replace(/^-|-$/g,'');
    if(lvl===2)h2.push({id,text});
    out.push(`<h${lvl} id="${id}">${inline(text)}</h${lvl}>`);}
   i++;continue;}
  // Tabelle (auch eingerückt in einer Liste)
  if(body.startsWith('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
   if(listStack.length&&indent<listStack.at(-1).indent)closeListsTo(indent);
   const head=splitCells(body);i+=2;const rows=[];
   while(i<lines.length&&lines[i].trim().startsWith('|')){rows.push(splitCells(lines[i].trim()));i++;}
   out.push('<table><thead><tr>'+head.map(c=>`<th>${inline(c)}</th>`).join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+head.map((_,k)=>`<td>${inline(r[k]??'')}</td>`).join('')+'</tr>').join('')+'</tbody></table>');
   continue;}
  // Listenpunkt
  const li=body.match(/^(?:[-*]|\d+\.)\s+(.*)$/);
  if(li){const tag=/^\d/.test(body)?'ol':'ul';
   if(listStack.length&&listStack.at(-1).indent===indent){out.push('</li>');}
   else if(listStack.length&&indent<listStack.at(-1).indent){closeListsTo(indent);if(listStack.length&&listStack.at(-1).indent===indent)out.push('</li>');else{listStack.push({indent,tag});out.push(`<${tag}>`);}}
   else{const start=tag==='ol'?` start="${parseInt(body,10)}"`:'';listStack.push({indent,tag});out.push(`<${tag}${start}>`);}
   out.push(`<li>${inline(li[1])}`);
   i++;continue;}
  // Fortsetzung eines Listenpunkts (eingerückt, kein neuer Punkt)
  if(listStack.length&&indent>=listStack.at(-1).indent+2){out.push(' '+inline(body));i++;continue;}
  // Absatz: Zeilen bis zur Leerzeile zusammenziehen
  closeAll();const para=[body];i++;
  while(i<lines.length&&lines[i].trim()&&!/^(#{1,4}\s|```|\||\s*(?:[-*]|\d+\.)\s)/.test(lines[i])){para.push(lines[i].trim());i++;}
  out.push(`<p>${inline(para.join(' '))}</p>`);
 }
 closeAll();
 return {html:out.join('\n'),title,h2};
}

/* ---------- Seite ---------- */
const CSS=`
@page{size:A4;margin:16mm 14mm 18mm 14mm}
html{font-family:"IBM Plex Sans","Segoe UI",Arial,sans-serif;font-size:10.5pt;line-height:1.42;color:#18181b}
body{margin:0}
h1{font-size:22pt;font-weight:600;margin:0 0 10pt;color:#268478;letter-spacing:-.01em;page-break-before:always;break-before:page}
h2{font-size:14.5pt;font-weight:600;margin:16pt 0 6pt;color:#0f172a;page-break-after:avoid;break-after:avoid}
h3{font-size:11.5pt;font-weight:600;margin:12pt 0 4pt;page-break-after:avoid;break-after:avoid}
h4{font-size:10.5pt;font-weight:600;margin:10pt 0 3pt}
p{margin:0 0 6pt;text-wrap:pretty}
a{color:#0369a1;text-decoration:none}
code{font-family:"IBM Plex Mono",Consolas,monospace;font-size:.9em;background:#f1f5f9;padding:0 .2em;border-radius:2px}
pre.code{font-family:"IBM Plex Mono",Consolas,monospace;font-size:8.5pt;background:#f1f5f9;padding:6pt 8pt;border-radius:4px;white-space:pre-wrap;word-break:break-word;margin:4pt 0 8pt}
ul,ol{margin:0 0 6pt;padding-left:18pt}
li{margin:0 0 2pt}
li>ul,li>ol{margin-top:2pt}
table{border-collapse:collapse;width:100%;margin:4pt 0 10pt;font-size:8.3pt;line-height:1.3;page-break-inside:auto}
th,td{border:1px solid #cbd5e1;padding:2.5pt 4pt;vertical-align:top;text-align:left;overflow-wrap:break-word}
th{background:#f1f5f9;font-weight:600}
th:first-child{width:13%}
tr{page-break-inside:avoid;break-inside:avoid}
td code,th code{font-size:.95em;background:none;padding:0}
pre.mermaid{margin:6pt 0 10pt;text-align:center;page-break-inside:avoid;break-inside:avoid}
pre.mermaid svg{max-width:100%;height:auto}
@page wide{size:A4 landscape;margin:12mm 14mm 16mm 14mm}
pre.mermaid.wide{page:wide;page-break-before:always;break-before:page;page-break-after:always;break-after:page;margin:0}
.title{page-break-before:auto;break-before:auto;padding-top:60mm}
.title h1{page-break-before:auto;break-before:auto;font-size:30pt;margin-bottom:6pt}
.title .sub{font-size:13pt;color:#52525b;margin-bottom:28pt}
.title ol{font-size:11.5pt}
.title li{margin-bottom:4pt}
.toc{page-break-before:always;break-before:page}
.toc h1{page-break-before:auto;break-before:auto}
.toc ul{list-style:none;padding-left:0;columns:2;column-gap:10mm;font-size:9.5pt}
.toc li{break-inside:avoid;margin-bottom:1pt}
.toc li.k{font-weight:600;margin-top:6pt}
.toc li.s{padding-left:10pt;color:#3f3f46}
`;
function page(sections,toc){
 const date=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date());
 return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Plenara – Technische Dokumentation</title><style>${CSS}</style></head><body>
<section class="title"><h1>Plenara</h1><div class="sub">Technische Dokumentation · Stand der Kapitel 17. Oktober 2026 · gedruckt am ${date}</div>
<ol>${toc.map(t=>`<li><a href="#${t.id}">${inline(t.title)}</a></li>`).join('')}</ol>
<p style="margin-top:28pt;color:#52525b;font-size:9.5pt">Quelle: <code>docs/technik/*.md</code> im Repository, erzeugt mit <code>node docs/technik/tools/build-pdf.mjs</code>. Die Markdown-Fassung ist maßgeblich; Querverweise zwischen den Kapiteln sind in dieser PDF Sprungmarken.</p></section>
<section class="toc"><h1>Inhalt</h1><ul>${toc.map(t=>`<li class="k"><a href="#${t.id}">${inline(t.title)}</a></li>`+t.h2.map(h=>`<li class="s"><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')).join('')}</ul></section>
${sections.join('\n')}
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
mermaid.initialize({startOnLoad:false,securityLevel:'loose',theme:'neutral',fontFamily:'"IBM Plex Sans","Segoe UI",Arial,sans-serif',flowchart:{useMaxWidth:true,htmlLabels:true},sequence:{useMaxWidth:true,wrap:true}});
try{await mermaid.run({querySelector:'pre.mermaid',suppressErrors:true});}catch(e){console.error(e);}
// Jedes Diagramm bekommt eine feste Größe, die auf eine Seite passt (Hochformat 680×960 px, Querformat 1010×660 px);
// breite Diagramme (über 1.300 px und breiter als hoch) kommen auf eine eigene Querformatseite.
for(const svg of document.querySelectorAll('pre.mermaid svg')){
 const w=svg.viewBox?.baseVal?.width||svg.getBBox().width,h=svg.viewBox?.baseVal?.height||svg.getBBox().height;if(!w||!h)continue;
 const wide=w>1300&&w>h;if(wide)svg.parentElement.classList.add('wide');
 const s=wide?Math.min(1010/w,660/h,1):Math.min(680/w,960/h,1);
 svg.style.maxWidth='none';svg.style.width=Math.floor(w*s)+'px';svg.style.height=Math.floor(h*s)+'px';
}
await document.fonts.ready;
window.__done=true;
</script></body></html>`;
}

/* ---------- Bau ---------- */
const toc=[],sections=[];
for(const f of ORDER){
 const {html,title,h2}=convert(fs.readFileSync(path.join(root,f),'utf8'),f);
 toc.push({id:slugOf(f),title:title||f,h2});
 sections.push(`<section id="${slugOf(f)}">${html}</section>`);
}
fs.mkdirSync(outDir,{recursive:true});
const htmlFile=path.join(outDir,'technische-dokumentation.html');
fs.writeFileSync(htmlFile,page(sections,toc));
console.log(`HTML: ${htmlFile} (${ORDER.length} Kapitel, ${sections.join('').split('class="mermaid"').length-1} Diagramme)`);
if(process.argv.includes('--html'))process.exit(0);

const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>fs.existsSync(p));
if(!chrome){console.error('Kein Chrome gefunden (CHROME_PATH).');process.exit(1);}
const pwPath=path.join(repo,'docs','design','tools','node_modules','playwright-core','index.mjs');
if(!fs.existsSync(pwPath)){console.error('playwright-core fehlt: in docs/design/tools einmal npm install ausführen.');process.exit(1);}
const {chromium}=await import(pathToFileURL(pwPath).href);
const browser=await chromium.launch({executablePath:chrome,headless:true});
try{
 const pg=await browser.newPage();
 const errors=[];pg.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await pg.goto(pathToFileURL(htmlFile).href,{waitUntil:'load'});
 await pg.waitForFunction(()=>window.__done===true,null,{timeout:120000});
 const broken=await pg.evaluate(()=>[...document.querySelectorAll('pre.mermaid')].filter(p=>!p.querySelector('svg')).length);
 if(broken)console.warn(`WARNUNG: ${broken} Diagramme ohne SVG`);
 if(errors.length)console.warn('Konsole: '+errors.slice(0,5).join(' | '));
 await pg.pdf({path:pdfFile,format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,
  headerTemplate:'<div></div>',
  footerTemplate:'<div style="width:100%;font-family:\'IBM Plex Sans\',\'Segoe UI\',Arial,sans-serif;font-size:7.5pt;color:#52525b;padding:0 14mm;display:flex;justify-content:space-between"><span>Plenara · Technische Dokumentation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>'});
 console.log(`PDF: ${pdfFile} (${Math.round(fs.statSync(pdfFile).size/1024)} KB)`);
}finally{await browser.close();}
