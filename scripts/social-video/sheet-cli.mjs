// Datenblatt zu einem Bericht ausgeben: node scripts/social-video/sheet-cli.mjs <bericht.json> <Ortsname> [JJJJ-MM-TT] [Kommune, z. B. "Verbandsgemeinde Bad Hönningen"]
// bericht.json: {title,status,events:[{date,committee,result}],ruleSummary:{short,long},theme:{id}} (Payload eines Berichts)
import fs from 'node:fs';
import {videoSheet} from '../../shared/social-video-sheet.mjs';
const [file,region,today=new Date().toISOString().slice(0,10),kommune]=process.argv.slice(2);
if(!file||!region){console.error('Aufruf: sheet-cli.mjs <bericht.json> <Ortsname> [Stichtag]');process.exit(2);}
const sheet=videoSheet(JSON.parse(fs.readFileSync(file,'utf8')),{regionName:region,today,kommune});
console.log(JSON.stringify(sheet,null,1));
process.exit(sheet.ok?0:1);
