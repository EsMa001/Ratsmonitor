#!/usr/bin/env node
/**
 * Prüft eine Caddy-Konfiguration vor dem Neuladen (requirements/konten-konzept.md 6.3): Keine Site, die von außen
 * erreichbar ist, darf die Admin-Kennung setzen; jede solche Site muss public_site importieren (sperrt /admin, entfernt
 * gefälschte Kopfzeilen). Aufruf: node scripts/check-caddy.mjs /etc/caddy/Caddyfile  (Ende 0 = in Ordnung)
 */
import fs from 'node:fs';

export function checkCaddy(text){
 const problems=[];
 const snippets=new Map();
 // Blöcke auf oberster Ebene: Kopfzeile bis zur passenden schließenden Klammer
 const blocks=[];let depth=0,head=null,body=[];
 for(const raw of text.split(/\r?\n/)){
  const line=raw.replace(/(^|\s)#.*$/,'').trim();
  if(!line)continue;
  if(depth===0&&line.endsWith('{')){head=line.slice(0,-1).trim();body=[];depth=1;continue;}
  if(depth>0){depth+=(line.match(/\{/g)||[]).length-(line.match(/\}/g)||[]).length;if(depth===0)blocks.push({head,body:body.join('\n')});else body.push(line);}
 }
 for(const b of blocks)if(/^\(.+\)$/.test(b.head))snippets.set(b.head.slice(1,-1),b.body);
 const expand=(body,seen=new Set())=>body.replace(/^import\s+(\S+)$/gm,(m,name)=>seen.has(name)||!snippets.has(name)?m:expand(snippets.get(name),new Set([...seen,name])));
 for(const b of blocks){
  if(/^\(.+\)$/.test(b.head)||!b.head)continue; // Snippets und globale Optionen
  const body=expand(b.body);
  const binds=(b.body.match(/^bind\s+(.+)$/m)?.[1]||'').split(/\s+/).filter(Boolean);
  const loopback=binds.length>0&&binds.every(a=>/^(127\.0\.0\.1|::1|localhost)$/.test(a))&&b.head.split(',').every(a=>/^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(a.trim()));
  if(loopback)continue;
  if(/header_up\s+Oai-Authenticated/i.test(body))problems.push(`${b.head}: setzt die Admin-Kennung, ist aber von außen erreichbar`);
  if(!/^import\s+public_site$/m.test(b.body))problems.push(`${b.head}: importiert public_site nicht`);
 }
 return problems;
}

if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){
 const file=process.argv[2];
 if(!file){console.error('Aufruf: node scripts/check-caddy.mjs <Caddyfile>');process.exit(2);}
 const problems=checkCaddy(fs.readFileSync(file,'utf8'));
 for(const p of problems)console.error('Problem:',p);
 console.log(problems.length?`${problems.length} Problem(e), nicht neu laden.`:'In Ordnung.');
 process.exitCode=problems.length?1:0;
}
