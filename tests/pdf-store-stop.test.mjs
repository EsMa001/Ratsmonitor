// Anhalten ohne Warten (onStop in scripts/pdf-store/state.mjs): SIGTERM beendet den Prozess nicht sofort, sondern ruft den
// Handler einmal auf; das Skript schreibt noch, was fertig ist, und endet selbst.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const script=`
import {onStop} from './scripts/pdf-store/state.mjs';
let calls=0;
onStop(null,Date.now(),why=>{calls++;setTimeout(()=>{console.log('fertig',why,calls);process.exit(3);},200);});
console.log('bereit');setInterval(()=>{},1000);
`;
test('onStop: SIGTERM (auch doppelt) ruft den Handler einmal, der Prozess endet geordnet',async()=>{
 const child=spawn(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,DATABASE_FILE:''}});
 let out='';child.stdout.on('data',d=>{out+=d;if(out.includes('bereit')&&!child.sent){child.sent=true;child.kill('SIGTERM');child.kill('SIGTERM');}});
 const code=await new Promise(r=>child.on('exit',r));
 assert.equal(code,3);
 assert.match(out,/fertig SIGTERM 1/);
});
