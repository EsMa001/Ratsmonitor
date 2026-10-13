// Ordnet alle aktiven Berichte der lokalen Datenbank nur nach Titel ein (shared/themes.mjs) und vergleicht mit den
// heutigen Labels (search_cards.label): Anteile je Thema, Unterthema, „noch nicht zugeordnet“, Übereinstimmung, Laufzeit.
//   node scripts/theme-study/census.mjs
import {readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {themeOf,THEMES,SUBTOPICS} from '../../shared/themes.mjs';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject/';
const db=new DatabaseSync(process.env.DATABASE_FILE||dir+readdirSync(dir).find(x=>x.endsWith('.sqlite')&&x!=='metadata.sqlite'),{readOnly:true});
const MAP={umwelt:'umwelt',klima:'umwelt',soziales:'soziales',gesundheit:'soziales',kultur:'kultur',sport:'kultur',sitzung:'offen',allgemein:'offen',unklar:'offen'};
const t0=Date.now(),theme={},sub={},src={},same={n:0,eq:0,newOpenOldTheme:0,newThemeOldOpen:0,diff:0};let n=0,withSub=0;
for(const r of db.prepare('SELECT title,label FROM search_cards').iterate()){
 const p=themeOf({title:r.title||''});n++;
 theme[p.theme]=(theme[p.theme]||0)+1;src[p.source]=(src[p.source]||0)+1;
 if(p.theme!=='offen'&&p.subs.length)withSub++;
 for(const s of p.subs)sub[s]=(sub[s]||0)+1;
 const old=MAP[r.label]||r.label;same.n++;
 if(old===p.theme)same.eq++;else if(p.theme==='offen')same.newOpenOldTheme++;else if(old==='offen')same.newThemeOldOpen++;else same.diff++;
}
const pc=x=>(100*x/n).toFixed(1)+' %';
console.log(`${n} Karten in ${((Date.now()-t0)/1000).toFixed(0)} s`);
for(const t of [...THEMES.map(t=>t.id),'offen'])console.log(t.padEnd(11),String(theme[t]||0).padStart(7),pc(theme[t]||0));
console.log('Quelle',src);
const themed=n-(theme.offen||0);console.log('mit Unterthema',(100*withSub/themed).toFixed(0)+' % der Vorgänge mit Thema');
console.log('Vergleich mit heutigen Labels',{gleich:pc(same.eq),neuOffenAltThema:pc(same.newOpenOldTheme),neuThemaAltOffen:pc(same.newThemeOldOpen),anderesThema:pc(same.diff)});
for(const t of THEMES){const ss=SUBTOPICS.filter(s=>s.theme===t.id).map(s=>`${s.id.split('.')[1]} ${(100*(sub[s.id]||0)/(theme[t.id]||1)).toFixed(0)}`);console.log(t.id.padEnd(11),ss.join(' · '));}
