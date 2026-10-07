// Browser-Import: öffentliche Ratsinformationen hinter einer Browserprüfung mit einem sichtbaren Chromium lesen.
//   node scripts/browser-import/cli.mjs detect   --instance land-hadeln
//   node scripts/browser-import/cli.mjs import   --instance land-hadeln [--window 3m] [--region nds-033525411] [--headless]
//   node scripts/browser-import/cli.mjs apply    --instance land-hadeln [--db <pfad.sqlite>]
//   node scripts/browser-import/cli.mjs record   --instance land-hadeln
//   node scripts/browser-import/cli.mjs download --instance land-hadeln [--max-documents 20]
// Instanzen: scripts/browser-import/instances/<name>.json (oder --instance <pfad.json>). Ergebnisse: tmp/browser-import/<instanceId>/.
import {loadInstance,detect,importInstance,apply,record,download} from './runner.mjs';
const [command,...rest]=process.argv.slice(2);
const options={};for(let i=0;i<rest.length;i++){const key=rest[i];if(!key.startsWith('--'))throw Error('Unbekanntes Argument: '+key);const name=key.slice(2);const flag=['headless','quiet'].includes(name);options[name]=flag?true:rest[++i];if(!flag&&options[name]===undefined)throw Error(`--${name} braucht einen Wert.`);}
if(!command||command==='--help'||!options.instance){
 console.log('node scripts/browser-import/cli.mjs <detect|import|apply|record|download> --instance <name|pfad.json> [--window 1w|1m|3m|12m] [--region <id,id>] [--headless] [--db <pfad>] [--max-documents <n>] [--quiet]');
 process.exit(command?1:0);
}
const instance=await loadInstance(options.instance);
if(options.headless)instance.access.headless=true;
const regions=options.region?options.region.split(',').map(s=>s.trim()).filter(Boolean):null;
const quiet=!!options.quiet;
let result;
if(command==='detect')result=await detect(instance,{quiet});
else if(command==='import')result=await importInstance(instance,{regions,window:options.window||instance.window,quiet});
else if(command==='apply')result=await apply(instance,{dbPath:options.db||null,regions});
else if(command==='record')result=await record(instance,{regions});
else if(command==='download')result=await download(instance,{regions,quiet,maxDocuments:options['max-documents']?Number(options['max-documents']):undefined});
else throw Error('Unbekannter Befehl: '+command);
if(command!=='import'&&command!=='download')console.log(JSON.stringify(result,null,1));
if(result?.scope==='stopped'||result?.error||result?.stopped)process.exitCode=2;
