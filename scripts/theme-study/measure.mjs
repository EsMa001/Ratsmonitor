// Misst die Themenregeln (shared/themes.mjs) an einer von Hand eingeordneten Stichprobe (tests/fixtures/<set>.json).
// Thema: Genauigkeit (vergebene Themen richtig), Abdeckung (Vorgänge mit Thema, die es bekommen), Fehlalarm (Formalie mit Thema).
// Unterthema (nur wo das Thema stimmt): Genauigkeit je vergebenem Unterthema, Abdeckung je Vorgang mit Unterthema.
//   node scripts/theme-study/measure.mjs --set=theme-dev [--fehler] [--titel] [--lang=ja|nur]   (--titel: ohne Text und Kurzfassung;
//   --lang=ja: lange Regel-Zusammenfassung als letzte Stufe, --lang=nur: nur die lange Fassung)
import fs from 'node:fs';
import {themeOf,THEMES_VERSION} from '../../shared/themes.mjs';
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const set=arg('set','theme-dev'),titleOnly=process.argv.includes('--titel'),mode=arg('lang','nein');
const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/'+set+'.json',import.meta.url),'utf8'));
const c={n:0,mustRight:0,themed:0,given:0,right:0,wrongTheme:0,missed:0,falseAlarm:0,subGiven:0,subRight:0,subWant:0,subHit:0,text:0,textRight:0};const bad=[];
for(const [i,r] of ref.rows.entries()){
 if(!r.gold)continue;c.n++;
 const p=themeOf(titleOnly?{title:r.title}:mode==='nur'?{title:r.title,long:r.long}:{title:r.title,subject:r.subject,summary:r.summary,long:mode==='ja'?r.long:''});
 const g=r.gold,goldThemed=g.themes.some(t=>t!=='offen'),must=!g.themes.includes('offen'),ok=g.themes.includes(p.theme);
 if(must){c.themed++;if(ok)c.mustRight++;}
 if(p.theme!=='offen'){c.given++;if(ok)c.right++;else if(goldThemed){c.wrongTheme++;bad.push([i,'falsch',p,g,r.title]);}else{c.falseAlarm++;bad.push([i,'fehlalarm',p,g,r.title]);}
  if(p.source==='text'||p.source==='long'){c.text++;if(ok)c.textRight++;}}
 else if(!ok){c.missed++;bad.push([i,'fehlt',p,g,r.title]);}
 if(ok&&p.theme!=='offen'){
  const want=g.subs,got=p.subs.map(s=>s.split('.')[1]);
  c.subGiven+=got.length;c.subRight+=got.filter(s=>want.includes(s)).length;
  if(want.length){c.subWant++;if(got.some(s=>want.includes(s)))c.subHit++;}
  const wrong=got.filter(s=>!want.includes(s));
  if(wrong.length||(want.length&&!got.some(s=>want.includes(s))))bad.push([i,'unterthema',p,g,r.title]);
 }
}
const pc=(a,b)=>b?(100*a/b).toFixed(0)+' %':'–';
console.log(`${THEMES_VERSION} ${set}${titleOnly?' (nur Titel)':''}: ${c.n} Vorgänge, ${c.themed} sicher mit Thema`);
console.log(`Thema   Genauigkeit ${pc(c.right,c.given)} (${c.right}/${c.given}) · Abdeckung ${pc(c.mustRight,c.themed)} (${c.mustRight}/${c.themed}) · falsches Thema ${c.wrongTheme} · Formalie mit Thema ${c.falseAlarm} · nicht erkannt ${c.missed} · aus Text ${c.textRight}/${c.text}`);
console.log(`Unterth. Genauigkeit ${pc(c.subRight,c.subGiven)} (${c.subRight}/${c.subGiven}) · Abdeckung ${pc(c.subHit,c.subWant)} (${c.subHit}/${c.subWant})`);
if(process.argv.includes('--fehler'))for(const [i,k,p,g,t] of bad)console.log(String(i).padStart(3),k.padEnd(10),(p.theme+' '+p.subs.map(s=>s.split('.')[1]).join(',')).padEnd(28),'soll',(g.themes.join('/')+' '+g.subs.join(',')).padEnd(30),t.slice(0,80));
