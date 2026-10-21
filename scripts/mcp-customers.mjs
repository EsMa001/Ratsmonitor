// Kundendatei des Kunden-MCP pflegen (server/mcp/customers.mjs, docs/betrieb/claude-mcp-einbindung.md). Nur der Betreiber;
// auf dem Server als root: sudo node /srv/ratsmonitor/app/current/scripts/mcp-customers.mjs <befehl> …
// Datei aus --file oder MCP_CUSTOMERS_FILE. Schlüssel erscheinen genau einmal auf der Konsole, gespeichert wird nur ihr SHA-256.
//   init                                   leere Datei anlegen (falls noch keine da ist)
//   list | check                           Kunden zeigen | Datei prüfen
//   regions <text>                         Gebietskennungen zu einem Namen suchen
//   add <kennung> --name N --regions a,b [--rpm 60]
//   set <kennung> [--name N] [--regions a,b] [--rpm N] [--disable|--enable]
//   remove <kennung>
//   key <kennung> [--note text]            neuen Schlüssel ausgeben (plk_…)
//   revoke-key <kennung> <schlüssel-id>
//   account-add <kennung> <konto-id>       Konto (u_…, aus ratsmonitor-accounts list) darf sich per OAuth anmelden
//   account-remove <kennung> <konto-id>    gilt sofort, auch für schon ausgegebene Zugangstoken
import {readFileSync,writeFileSync,renameSync,statSync,existsSync,chmodSync} from 'node:fs';
import {dirname,join,basename} from 'node:path';
import {parseArgs} from 'node:util';
import {randomBytes} from 'node:crypto';
import {parseCustomers,emptyCustomers,keyHash,KEY_PREFIX,IDENTITY_RE,USER_ID_RE} from '../server/mcp/customers.mjs';
import {CATALOG} from '../shared/catalog.mjs';

const {values:opt,positionals:[command,...args]}=parseArgs({allowPositionals:true,options:{
 file:{type:'string'},name:{type:'string'},regions:{type:'string'},rpm:{type:'string'},note:{type:'string'},
 disable:{type:'boolean'},enable:{type:'boolean'},help:{type:'boolean'}}});
const file=opt.file||process.env.MCP_CUSTOMERS_FILE;
const fail=message=>{process.stderr.write(message+'\n');process.exit(1);};
const b64url=bytes=>Buffer.from(bytes).toString('base64url');
const list=value=>String(value||'').split(',').map(s=>s.trim()).filter(Boolean);
const rpm=value=>{const n=Number(value);if(!Number.isInteger(n)||n<1||n>300)fail('--rpm: ganze Zahl von 1 bis 300.');return n;};

if(opt.help||!command){process.stdout.write(readFileSync(new URL(import.meta.url),'utf8').split('\n').filter(l=>l.startsWith('//')).map(l=>l.slice(3)).join('\n')+'\n');process.exit(0);}
if(command==='regions'){
 const q=args.join(' ').toLowerCase();if(!q)fail('regions <text>');
 for(const r of CATALOG.filter(r=>r.name.toLowerCase().includes(q)||r.id.includes(q)).slice(0,30))console.log(`${r.id}\t${r.name}\t${r.kind||''}`);
 process.exit(0);
}
if(!file)fail('Kundendatei mit --file oder MCP_CUSTOMERS_FILE angeben.');

function load(){
 if(!existsSync(file))fail(`Keine Kundendatei unter ${file}. Zuerst: init`);
 try{return parseCustomers(JSON.parse(readFileSync(file,'utf8').replace(/^﻿/,'')));}
 catch(error){fail(error.message||'Kundendatei ungültig.');}
}
/** Atomar schreiben: Kopie im selben Ordner, dann umbenennen; Rechte der alten Datei bleiben */
function save(data){
 let checked;
 try{checked=parseCustomers(JSON.parse(JSON.stringify(data)));}catch(error){fail(error.message);}
 const tmp=join(dirname(file),'.'+basename(file)+'.'+process.pid+'.tmp');
 const mode=existsSync(file)?statSync(file).mode&0o777:0o640;
 writeFileSync(tmp,JSON.stringify(checked,null,1)+'\n',{mode});
 chmodSync(tmp,mode);
 renameSync(tmp,file);
}
const find=(data,identity)=>data.customers.find(c=>c.identity===identity)||fail(`Kein Kunde ${identity}.`);

switch(command){
 case 'init':{
  if(existsSync(file))fail(`${file} gibt es schon.`);
  save(emptyCustomers());console.log(`Angelegt: ${file}`);break;
 }
 case 'check':{const data=load();console.log(`gültig: ${data.customers.length} Kunden`);break;}
 case 'list':{
  const data=load();
  if(!data.customers.length)console.log('Keine Kunden.');
  for(const c of data.customers){
   console.log(`${c.identity}${c.disabled?' (gesperrt)':''}: ${c.name}; ${c.allowedRegionIds.length} Gebiete; ${c.requestsPerMinute}/min; ${c.accounts.length} Konten; ${c.keys.length} Schlüssel`);
   for(const k of c.keys)console.log(`  Schlüssel ${k.id} seit ${k.created}${k.note?' – '+k.note:''}`);
   for(const a of c.accounts)console.log(`  Konto ${a}`);
  }
  break;
 }
 case 'add':{
  const [identity]=args,data=load();
  if(!IDENTITY_RE.test(identity||''))fail('Kennung: 2 bis 63 Zeichen a-z, 0-9, Punkt, Strich, Unterstrich.');
  if(data.customers.some(c=>c.identity===identity))fail(`${identity} gibt es schon.`);
  if(!opt.name||!opt.regions)fail('add <kennung> --name N --regions a,b');
  data.customers.push({identity,name:opt.name,allowedRegionIds:list(opt.regions),requestsPerMinute:opt.rpm?rpm(opt.rpm):60,accounts:[],keys:[],disabled:false});
  save(data);console.log(`Kunde ${identity} angelegt.`);break;
 }
 case 'set':{
  const data=load(),c=find(data,args[0]);
  if(opt.name)c.name=opt.name;
  if(opt.regions)c.allowedRegionIds=list(opt.regions);
  if(opt.rpm)c.requestsPerMinute=rpm(opt.rpm);
  if(opt.disable)c.disabled=true;
  if(opt.enable)c.disabled=false;
  save(data);console.log(`Kunde ${c.identity} geändert.`);break;
 }
 case 'remove':{
  const data=load();find(data,args[0]);
  data.customers=data.customers.filter(c=>c.identity!==args[0]);
  save(data);console.log(`Kunde ${args[0]} entfernt.`);break;
 }
 case 'key':{
  const data=load(),c=find(data,args[0]);
  const value=KEY_PREFIX+b64url(randomBytes(32)),id='k_'+b64url(randomBytes(6));
  c.keys.push({id,sha256:keyHash(value),created:new Date().toISOString().slice(0,10),...(opt.note?{note:opt.note.slice(0,200)}:{})});
  save(data);
  // Nur hier im Klartext: gleich sicher an den Kunden geben, nicht in Chats, Tickets oder Git
  process.stderr.write(`Schlüssel ${id} für ${c.identity} (nur jetzt sichtbar):\n`);
  process.stdout.write(value+'\n');
  break;
 }
 case 'revoke-key':{
  const data=load(),c=find(data,args[0]);
  if(!c.keys.some(k=>k.id===args[1]))fail(`Kein Schlüssel ${args[1]} bei ${c.identity}.`);
  c.keys=c.keys.filter(k=>k.id!==args[1]);
  save(data);console.log(`Schlüssel ${args[1]} zurückgezogen (gilt sofort).`);break;
 }
 case 'account-add':case 'account-remove':{
  const data=load(),c=find(data,args[0]),user=args[1]||'';
  if(!USER_ID_RE.test(user))fail('Konto-ID wie u_… angeben (ratsmonitor-accounts list), keine Adresse.');
  if(command==='account-add'){if(!c.accounts.includes(user))c.accounts.push(user);}
  else c.accounts=c.accounts.filter(a=>a!==user);
  save(data);console.log(command==='account-add'?`Konto ${user} darf sich für ${c.identity} anmelden.`:`Konto ${user} aus ${c.identity} entfernt (gilt sofort).`);break;
 }
 default:fail(`Unbekannter Befehl ${command}. Hilfe: --help`);
}
