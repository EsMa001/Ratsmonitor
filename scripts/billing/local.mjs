// Hilfen für die lokale Einrichtung von Stripe (scripts/billing/setup-stripe.mjs, listen.mjs): .dev.vars lesen und
// schreiben, Stripe CLI finden. .dev.vars liest der Dev-Server beim Start; die Datei steht nicht in Git.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const DEV_VARS='.dev.vars';
/** Werte aus .dev.vars (KEY=VALUE, Wert auch in Anführungszeichen) */
export function readVars(file=DEV_VARS){
 const out={};
 if(!fs.existsSync(file))return out;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
  const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
  if(m)out[m[1]]=m[2];
 }
 return out;
}
/** Werte setzen oder mit null entfernen; alle anderen Zeilen bleiben, wie sie sind */
export function writeVars(updates,file=DEV_VARS){
 const text=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
 const eol=text.includes('\r\n')?'\r\n':'\n';
 const lines=text?text.split(/\r?\n/):[];
 if(lines.length&&lines.at(-1)==='')lines.pop();
 const done=new Set(),next=[];
 for(const line of lines){
  const key=line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
  if(key&&Object.hasOwn(updates,key)){
   if(!done.has(key)&&updates[key]!==null)next.push(`${key}=${updates[key]}`);
   done.add(key);
   continue;
  }
  next.push(line);
 }
 for(const [key,value] of Object.entries(updates))if(!done.has(key)&&value!==null)next.push(`${key}=${value}`);
 fs.writeFileSync(file,next.join(eol)+eol);
}
/** Stripe CLI im PATH oder dort, wo winget sie ablegt (gleich nach der Installation noch nicht im PATH) */
export function stripeCli(){
 const local=process.env.LOCALAPPDATA;
 const candidates=['stripe'];
 if(local){
  candidates.push(path.join(local,'Microsoft','WinGet','Links','stripe.exe'));
  const packages=path.join(local,'Microsoft','WinGet','Packages');
  if(fs.existsSync(packages))for(const dir of fs.readdirSync(packages).filter(d=>d.startsWith('Stripe.StripeCli')))candidates.push(path.join(packages,dir,'stripe.exe'));
 }
 for(const cli of candidates)if(spawnSync(cli,['--version'],{encoding:'utf8'}).status===0)return cli;
 return null;
}
/** Geheimnis für die Ausgabe kürzen: Anfang und die letzten vier Zeichen */
export const mask=value=>value?`${value.slice(0,12)}…${value.slice(-4)}`:'(leer)';
