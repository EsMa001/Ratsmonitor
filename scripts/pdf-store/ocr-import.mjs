// Einspielen der Mac-OCR (ocr-mac.mjs) in die Ablage des Servers: je <sha>.json eines Ordners wird die Textfassung geschrieben,
// aber nur, wenn die Datei in der Ablage noch OCR braucht (texts.ocr_needed > 0), Seitenzahl und Textfassung passen und die
// Prüfsumme in der Ablage steht. Schreiben über putText (Textdatei und Zeile in texts), keine Direkteingriffe in die Tabellen.
//   node scripts/pdf-store/ocr-import.mjs <ordner> [--dry-run]
// Die Ablage ist RM_PDF_STORE (auf dem Server: /srv/ratsmonitor/data/pdf-store). Ohne --dry-run wird geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import {openPdfStore,DEFAULT_PDF_STORE} from '../../server/node/pdf-store.mjs';
import {TEXT_VERSION} from './store-lib.mjs';

const args=process.argv.slice(2),dir=args.find(a=>!a.startsWith('--'));
const dry=args.includes('--dry-run');
if(!dir){console.error('Ordner fehlt: node scripts/pdf-store/ocr-import.mjs <ordner> [--dry-run]');process.exit(1);}

const store=openPdfStore(process.env.RM_PDF_STORE||DEFAULT_PDF_STORE);
const row=store.db.prepare('SELECT status,pages,ocr_needed AS ocrNeeded,version FROM texts WHERE sha256=?');
const has=store.db.prepare("SELECT 1 FROM pdfs WHERE sha256=? LIMIT 1");
const res={geschrieben:0,nichtOffen:0,seitenPassenNicht:0,versionPasstNicht:0,unbekannt:0,kaputt:0};

for(const name of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
 let j;
 try{j=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));}catch{res.kaputt++;continue;}
 const {sha,pages,ocrPages}=j;
 if(!sha||!Array.isArray(pages)){res.kaputt++;continue;}
 // Methode fehlt in älteren Ergebnissen: aus der Zahl der OCR-Seiten ableiten (text, ocr, mixed wie in ocr-mac.mjs)
 const method=j.method||((ocrPages??0)===0?'text':(ocrPages===pages.length?'ocr':'mixed'));
 if(j.version!==TEXT_VERSION){res.versionPasstNicht++;continue;}
 if(!has.get(sha)){res.unbekannt++;continue;}
 const t=row.get(sha);
 if(!t){res.unbekannt++;continue;}
 // Nur offene Dateien: war die Datei inzwischen gelesen, bleibt die bestehende Fassung
 if(!(t.ocrNeeded>0)){res.nichtOffen++;continue;}
 if(t.pages!==pages.length){res.seitenPassenNicht++;continue;}
 if(!dry)store.putText(sha,pages,{method,version:TEXT_VERSION,ocrPages:ocrPages??0,ocrNeeded:0});
 res.geschrieben++;
}
store.close();
console.log(`${dry?'Probelauf, nichts geschrieben: ':''}${JSON.stringify(res)}`);
