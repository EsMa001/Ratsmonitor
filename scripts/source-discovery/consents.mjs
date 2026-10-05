// Brings a list of written consents into the register (server/integrations/source-consents.json) and prepares the
// check of the areas it covers (concept section 6.4). No request is made here.
//
//   export LAND=de DIR=tmp/source-discovery-de/
//   node scripts/source-discovery/consents.mjs freigaben.csv     # DRY=1: only show what would change
//   CANDIDATES=candidates-consents.json OUT=verified-consents.json ONLY_FILE=$DIR/consents-<datum>.txt node scripts/source-discovery/verify.mjs
//   (then build.mjs, servers.mjs, ONLY_NEW=1 robots.mjs and the tests as after every search run)
//
// The list: CSV with semicolons and the header Gebiet;Land;Datum;Umfang;Kanal;Stelle;Adresse;Betreiber.
// Gebiet: name as in the catalog ("Gemeinde Musterdorf" or "Musterdorf"), catalog id or official key. Land: name or
// two-digit key, needed where a name occurs twice. Datum: 12.05.2026 or 2026-05-12. Umfang: robots, freischaltung,
// oparl, adresse (several separated by commas). Stelle: a role (Ratsbüro, Hauptamt), never a person's name. Adresse:
// the system the consent is for; on hosted platforms with the municipality's folder (https://sessionnet.owl-it.de/ort/bi/).
// Without an address the link the search found for the area is used, if there is one.
// The register is only added to: no line is removed or changed. Lines that match no area or more than one are listed
// and not taken over.
import fs from 'node:fs';
import {CATALOG,landName} from '../../shared/catalog.mjs';
import {loadAreas} from './areas.mjs';
import {parseConsentCsv,mergeConsents,validConsent} from '../../server/integrations/consents.mjs';

const file=process.argv[2];
if(!file){console.log('Aufruf: node scripts/source-discovery/consents.mjs <liste.csv>');process.exit(1);}
const dir=process.env.DIR||'tmp/source-discovery/',REGISTER='server/integrations/source-consents.json';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const register=read(REGISTER);
const {consents,problems}=parseConsentCsv(fs.readFileSync(file,'utf8'),CATALOG,{landName});
const {list,added}=mergeConsents(register.consents,consents);
for(const p of problems)console.log(' !',p);
console.log(`${consents.length} Zeilen erkannt, ${added.length} neu im Register, ${problems.length} zur Rückfrage.`);

// Links the search found for open areas (open.json of build.mjs) stand in for a missing address.
const open=fs.existsSync(dir+'open.json')?new Map(read(dir+'open.json').map(o=>[o.id,o.link])):new Map();
const areas=new Set(loadAreas().map(r=>r.id)),today=new Date().toISOString().slice(0,10);
const candidates={},check=[];
for(const c of list.filter(validConsent).filter(c=>areas.has(c.area))){
 // "freischaltung" changes nothing until the operator acts; it is not checked again here.
 if(!c.scope.some(s=>['robots','adresse','oparl'].includes(s)))continue;
 const url=c.system||(/^https?:/.test(open.get(c.area)||'')?open.get(c.area):null);
 if(!url){console.log(' ?',c.area,'Freigabe ohne Adresse und ohne gefundenen Link; Adresse in der Liste ergänzen');continue;}
 const area=CATALOG.find(r=>r.id===c.area);
 candidates[c.area]={id:c.area,name:area.name,kind:area.kind,ags:area.ags,sites:[],candidates:[{url,from:'Freigabe '+c.id,byHref:true,guessed:`Meldung (Freigabe ${c.id} vom ${c.date})`,...(c.scope.includes('oparl')&&!c.scope.includes('robots')?{oparlOnly:true}:{})}],log:[]};
 check.push(c.area);
}
if(process.env.DRY){console.log('DRY: nichts geschrieben.',check.length,'Gebiete wären zu prüfen.');process.exit(0);}
fs.writeFileSync(REGISTER,JSON.stringify({...register,consents:list},null,1)+'\n');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'candidates-consents.json',JSON.stringify(candidates,null,1));
const listFile=`${dir}consents-${today}.txt`;fs.writeFileSync(listFile,check.join('\n')+'\n');
console.log(`Register: ${REGISTER} (${list.length} Freigaben). Prüfliste: ${listFile} (${check.length} Gebiete in ${dir}).`);
