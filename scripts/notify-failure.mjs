#!/usr/bin/env node
/**
 * Fehlermail einer systemd-Einheit (Betriebsüberwachung, docs/betrieb/node-server.md „Betriebsüberwachung“): jede
 * ratsmonitor-*.service hat OnFailure=ratsmonitor-notify@%n.service; die Einheit ratsmonitor-notify@<Einheit>.service ruft
 * dieses Skript mit dem Namen der gescheiterten Einheit auf. Es sammelt Ergebnis und Zeit (systemctl show), die letzten 30
 * Zeilen aus dem Journal (journalctl -u) und, wenn die Einheit in eine Protokolldatei schreibt (StandardOutput=append:…),
 * deren letzte 30 Zeilen, und schickt alles als eine Mail an OPERATOR_EMAIL über den Webdienst (scripts/operator-mail.mjs).
 *
 *   node scripts/notify-failure.mjs <einheit> [--print]     --print: nur ausgeben, nicht verschicken
 *   systemctl start ratsmonitor-notify@test                  Probe: schickt eine Testmail (Einheit „test“ gibt es nicht)
 * Endet mit 1, wenn die Mail nicht verschickt werden konnte (dann steht der Grund im Journal der notify-Einheit).
 */
import fs from 'node:fs';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {sendOperatorMail} from './operator-mail.mjs';

const LINES=30;
const args=process.argv.slice(2),unit=args.find(a=>!a.startsWith('--'))||'',print=args.includes('--print');
if(!unit){console.error('Aufruf: node scripts/notify-failure.mjs <einheit> [--print]');process.exit(2);}
const run=(cmd,argv)=>{const r=spawnSync(cmd,argv,{encoding:'utf8',timeout:20000});return r.error||typeof r.stdout!=='string'?'':r.stdout;};
/** Letzte Zeilen einer Protokolldatei (nur das Ende lesen, die Dateien werden groß) */
function tail(file,n){
 try{
  const size=fs.statSync(file).size,span=Math.min(size,64*1024),buf=Buffer.alloc(span),fd=fs.openSync(file,'r');
  try{fs.readSync(fd,buf,0,span,size-span);}finally{fs.closeSync(fd);}
  return buf.toString('utf8').split('\n').filter(l=>l.trim()).slice(-n).join('\n');
 }catch{return '';}
}

const test=unit==='test'||unit==='test.service';
const props=Object.fromEntries((test?'':run('systemctl',['show',unit,'-p','Description','-p','Result','-p','ExecMainStatus','-p','ExecMainCode','-p','ExecMainExitTimestamp','-p','InactiveEnterTimestamp','-p','StandardOutput']))
 .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const journal=test?'':run('journalctl',['-u',unit,'-n',String(LINES),'--no-pager','-o','short-iso']).trim();
const logFile=/^append:(.+)$/.exec(props.StandardOutput||'')?.[1];
const logTail=logFile?tail(logFile,LINES):'';
const now=new Date().toISOString(),host=os.hostname();

const lines=test
 ?[`Testmail der Fehlermeldung von ${host}, ${now}.`,'','Wenn diese Mail ankommt, erreichen Fehlermails der systemd-Einheiten den Betreiber.']
 :[`Einheit:   ${unit}${props.Description?` (${props.Description})`:''}`,`Rechner:   ${host}`,`Zeit:      ${now}`,
   `Ergebnis:  ${props.Result||'unbekannt'}${props.ExecMainStatus?`, Exit ${props.ExecMainStatus}`:''}${props.ExecMainCode&&props.ExecMainCode!=='exited'?` (${props.ExecMainCode})`:''}`,
   ...(props.ExecMainExitTimestamp?[`Beendet:   ${props.ExecMainExitTimestamp}`]:[]),
   '',`Journal (letzte ${LINES} Zeilen, journalctl -u ${unit}):`,journal||'(keine Zeilen; läuft die notify-Einheit mit SupplementaryGroups=systemd-journal?)',
   ...(logFile?['',`Protokolldatei ${logFile} (letzte ${LINES} Zeilen):`,logTail||'(leer oder nicht lesbar)']:[]),
   '','Nächste Schritte: systemctl status '+unit+' · /admin?seite=nacht · /admin?seite=zeitplaene'];
const mail={subject:test?'Testmail der Fehlermeldung':`Job fehlgeschlagen: ${unit}`,message:lines.join('\n')};
if(print){console.log(mail.subject);console.log('');console.log(mail.message);process.exit(0);}
const result=await sendOperatorMail(mail);
if(result.sent){console.log(`${now} Fehlermail zu ${unit} verschickt (${result.transport||'?'})`);process.exit(0);}
console.error(`${now} Fehlermail zu ${unit} nicht verschickt: ${result.reason||'?'}`);
console.error(mail.message);
process.exit(1);
