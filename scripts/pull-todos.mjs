/**
 * Holt Abhaken und Termine der To-do-Liste vom Server in docs/todo/todos.json (Quelle der Liste, siehe
 * server/integrations/todos-store.mjs). Übernommen wird nur, was auf dem Server geändert wurde, und nur, wenn der
 * Eintrag in der Datei noch auf dem Stand ist, an dem die Änderung gemacht wurde; sonst gilt die Datei (Meldung).
 *
 *   ssh -N -L 8080:127.0.0.1:8080 ratsmonitor      # Tunnel, in einem zweiten Terminal
 *   node scripts/pull-todos.mjs                     # Server über http://localhost:8080
 *   node scripts/pull-todos.mjs --url http://localhost:8080 --probe   # nur anzeigen, nichts schreiben
 *
 * Danach committen und ausrollen; auf dem Server gilt dann wieder die Datei, die alten Einträge räumt das nächste Speichern ab.
 */
import {readFile,writeFile,rename} from 'node:fs/promises';
import {mergeTodos} from '../server/integrations/todos-store.mjs';

const FILE='docs/todo/todos.json';
const args=process.argv.slice(2);
const url=(args.includes('--url')?args[args.indexOf('--url')+1]:'http://localhost:8080').replace(/\/$/,'');
const probe=args.includes('--probe');

const res=await fetch(url+'/api/admin/todos?aenderungen=1',{headers:{accept:'application/json'}}).catch(e=>{
 console.error(`Server nicht erreichbar (${url}): ${e.message}. Ist der Tunnel offen?`);process.exit(1);
});
const body=await res.json().catch(()=>({}));
if(!res.ok){console.error(`Server antwortet ${res.status}: ${body.error||'ohne Begründung'}`);process.exit(1);}
const changes=body.changes||{};

const local=JSON.parse(await readFile(FILE,'utf8'));
const merged=mergeTodos(local,changes);
const before=new Map(local.kategorien.flatMap(c=>c.items).map(i=>[i.id,i]));
const state=i=>`${i.erledigt?'erledigt'+(i.erledigtAm?' am '+i.erledigtAm:''):'offen'}${i.faellig?', fällig '+i.faellig:''}`;
let taken=0,skipped=0;
for(const item of merged.kategorien.flatMap(c=>c.items)){
 const old=before.get(item.id);
 if(old.erledigt!==item.erledigt||old.faellig!==item.faellig||old.erledigtAm!==item.erledigtAm){taken++;console.log(`übernommen  ${item.id}: ${state(old)} → ${state(item)}`);}
}
for(const [id,change] of Object.entries(changes)){
 const item=before.get(id);
 if(!item){skipped++;console.log(`ausgelassen ${id}: steht nicht mehr in der Datei`);continue;}
 const same=item.erledigt===change.erledigt&&item.faellig===change.faellig&&item.erledigtAm===change.erledigtAm;
 if(!same&&(item.erledigt!==change.base?.erledigt||item.faellig!==change.base?.faellig)){skipped++;console.log(`ausgelassen ${id}: Datei seither geändert (${state(item)}), Server: ${state(change)}`);}
}
console.log(`${taken} übernommen, ${skipped} ausgelassen${probe?' (nur angezeigt)':''}.`);
if(taken&&!probe){
 const temp=FILE.replace(/todos\.json$/,'.todos.json.tmp');
 await writeFile(temp,JSON.stringify(merged,null,2)+'\n','utf8');
 await rename(temp,FILE);
}
