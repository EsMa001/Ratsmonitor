// Misst das Thema aus dem Text an tests/fixtures/theme-text.json (Titel ohne Thema, Hauptdokument mit Text): heutige Regel
// (erstes starkes Wort in Betreff/Beschlussvorschlag) gegen die Zählregel auf Betreff/Beschlussvorschlag und auf dem Textanfang.
//   node scripts/theme-study/measure-text.mjs [--fehler=<variante>]
import fs from 'node:fs';
import {themeOf,prepare,SUBTOPICS} from '../../shared/themes.mjs';
const WEAK_THEMES=new Set(['finanzen','verwaltung']);
// Zählregel (nur hier gemessen, nicht übernommen: höchstens 62 % richtig, Messung 13.10.2026): verschiedene Treffer je Thema
// zählen (schwache Themen nur mit starken Begriffen); mindestens min Treffer und margin mehr als das nächste Thema.
function themeByCount(text,{min=2,margin=2}={}){
 const t=prepare(text);if(!t)return null;
 const words=new Map(),subs=new Map();
 for(const st of SUBTOPICS){
  if(WEAK_THEMES.has(st.theme)&&!st.strong)continue;
  if(st.not&&st.not.test(t))continue;if(st.needs&&!st.needs.test(t))continue;
  const m=t.match(new RegExp(st.re.source,'giu'));if(!m)continue;
  const w=words.get(st.theme)||new Set();for(const x of m)w.add(x.toLowerCase());words.set(st.theme,w);
  (subs.get(st.theme)||subs.set(st.theme,[]).get(st.theme)).push(st.id);
 }
 const ranked=[...words].map(([theme,w])=>[theme,w.size]).sort((a,b)=>b[1]-a[1]);
 if(!ranked.length||ranked[0][1]<min||(ranked[1]&&ranked[0][1]-ranked[1][1]<margin))return null;
 return {theme:ranked[0][0],subs:subs.get(ranked[0][0]),count:ranked[0][1]};
}

const ref=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/theme-text.json',import.meta.url),'utf8'));
const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
const V={
 heute:r=>themeOf({title:r.title,subject:r.subject}).theme,
};
for(const [min,margin] of [[1,1],[2,1],[2,2],[3,2]]){
 V[`zählen-betreff-${min}/${margin}`]=r=>themeByCount(r.subject,{min,margin})?.theme||'offen';
 for(const n of [1500,3000])V[`zählen-text${n}-${min}/${margin}`]=r=>themeByCount([r.subject,r.head.slice(0,n)].join(' | '),{min,margin})?.theme||'offen';
}
const must=ref.rows.filter(r=>!r.gold.themes.includes('offen')).length;
console.log(`${ref.rows.length} Berichte, davon ${must} sicher mit Thema, ${ref.rows.filter(r=>r.gold.themes.length===1&&r.gold.themes[0]==='offen').length} sicher ohne`);
for(const [name,fn] of Object.entries(V)){
 let given=0,right=0,hit=0;const bad=[];
 for(const r of ref.rows){const p=fn(r),g=r.gold.themes;if(p==='offen')continue;given++;if(g.includes(p)){right++;if(!g.includes('offen'))hit++;}else bad.push([p,g.join('/'),r.title]);}
 console.log(`${name.padEnd(24)} vergeben ${String(given).padStart(3)} · richtig ${given?(100*right/given).toFixed(0):'–'} % · gefunden ${(100*hit/must).toFixed(0)} % der sicheren`);
 if(arg('fehler')===name)for(const [p,g,t] of bad)console.log('   ',p.padEnd(11),'soll',g.padEnd(24),t.slice(0,70));
}
