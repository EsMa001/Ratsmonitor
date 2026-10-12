/**
 * Pulls server task edits and board-created tasks into docs/todo/todos.json.
 * Existing categories and IDs are retained; actual server overrides take precedence.
 *
 *   ssh -N -L 8080:127.0.0.1:8080 ratsmonitor
 *   node scripts/pull-todos.mjs --url http://localhost:8080 --probe
 *   node scripts/pull-todos.mjs
 */
import {readFile,writeFile,rename} from 'node:fs/promises';
import {mergeTodos,normalizeTodos} from '../server/integrations/todos-store.mjs';

const FILE='docs/todo/todos.json';
const args=process.argv.slice(2);
const url=(args.includes('--url')?args[args.indexOf('--url')+1]:'http://localhost:8080').replace(/\/$/,'');
const probe=args.includes('--probe');

const res=await fetch(url+'/api/admin/todos?aenderungen=1',{headers:{accept:'application/json'}}).catch(error=>{
 console.error(`Server nicht erreichbar (${url}): ${error.message}. Ist der Tunnel offen?`);process.exit(1);
});
const body=await res.json().catch(()=>({}));
if(!res.ok){console.error(`Server antwortet ${res.status}: ${body.error||'ohne Begruendung'}`);process.exit(1);}
const stored=body.changes||{};
const changes=stored.format===2?stored.changes:stored;
const creates=stored.format===2?stored.creates:[];

const local=JSON.parse(await readFile(FILE,'utf8'));
const merged=mergeTodos(local,stored);
delete merged.revision;
const before=new Map(normalizeTodos(local).kategorien.flatMap(category=>category.items.map(item=>[item.id,{item,kategorieId:category.id}])));
const categoryIds=new Set(local.kategorien.map(category=>category.id));
const priorities={1:'hoch',2:'mittel',3:'niedrig'};
const resolutions={done:'erledigt',wont_do:'wird nicht umgesetzt',duplicate:'Duplikat'};
const state=item=>`${item.status}, Prioritaet ${priorities[item.prio]}${item.abschluss?', '+resolutions[item.abschluss]:''}${item.bearbeiter?', '+item.bearbeiter:''}${item.faellig?', faellig '+item.faellig:''}${item.erledigtAm?', geschlossen am '+item.erledigtAm:''}`;
let taken=0,skipped=0;
for(const category of merged.kategorien)for(const item of category.items){
 const old=before.get(item.id);
 if(!old){taken++;console.log(`neu         ${item.id}: ${state(item)} (${category.name})`);continue;}
 if(old.kategorieId!==category.id||JSON.stringify(old.item)!==JSON.stringify(item)){
  taken++;console.log(`uebernommen ${item.id}: ${state(old.item)} -> ${state(item)} (${category.name})`);
 }
}
for(const id of Object.keys(changes))if(!before.has(id)){
 skipped++;console.log(`ausgelassen ${id}: steht nicht mehr in der Datei`);
}
for(const create of creates)if(!categoryIds.has(create.kategorieId)){
 skipped++;console.log(`ausgelassen ${create.item.id}: Kategorie ${create.kategorieId} steht nicht mehr in der Datei`);
}
console.log(`${taken} uebernommen, ${skipped} ausgelassen${probe?' (nur angezeigt)':''}.`);
if(taken&&!probe){
 const temp=FILE.replace(/todos\.json$/,'.todos.json.tmp');
 await writeFile(temp,JSON.stringify(merged,null,2)+'\n','utf8');
 await rename(temp,FILE);
}
