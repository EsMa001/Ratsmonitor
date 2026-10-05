// Register of written consents of municipalities and operators (server/integrations/source-consents.json, concept
// section 6 "Welle 0"). A consent with scope "robots" is a permission: the source search may read a system whose
// robots.txt refuses programs, but only the system the consent names. Since 05.10.2026 robots.txt is recorded, not
// obeyed (robots-policy.mjs), so the scope matters only with ROBOTS_POLICY=obey. It changes nothing for a system that
// refuses programs technically (HTTP 403, firewall, access check): that needs the operator ("freischaltung").
// No personal data: grantedBy is a role (Ratsbüro, Hauptamt …), evidence a register number; letters and names stay
// with the owner outside the repository.
import register from './source-consents.json' with {type:'json'};

export const SCOPES=['robots','freischaltung','oparl','adresse'];
const day=/^\d{4}-\d{2}-\d{2}$/;

/** A consent counts if it names an area, a date, a scope and the role that gave it, and is not revoked. */
export function validConsent(c){
 return Boolean(c&&typeof c==='object'&&String(c.area||'').trim()&&day.test(String(c.date||''))&&String(c.grantedBy||'').trim()&&Array.isArray(c.scope)&&c.scope.length&&c.scope.every(s=>SCOPES.includes(s))&&!c.revokedAt);
}

// The part of an address a consent covers: the system's folder ("https://ratsinfo.ort.de/bi/" covers everything below
// it; "https://sessionnet.owl-it.de/ort/bi/" only that tenant, not the other municipalities on the same host).
const prefix=url=>{try{const u=new URL(url);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;return u.host.toLowerCase()+u.pathname.replace(/[^/]*$/,'').toLowerCase();}catch{return null;}};

/** The valid consent with the given scope that covers this address, or null. */
export function consentFor(url,{scope='robots',area=null,list=register.consents}={}){
 const target=prefix(url);if(!target)return null;
 for(const c of list||[]){
  if(!validConsent(c)||!c.scope.includes(scope))continue;
  if(area&&c.area!==area)continue;
  // The host alone ("https://ratsinfo.ort.de/") covers the whole host, a tenant folder only itself. On hosted platforms
  // the list has to name the tenant's folder; the host alone would cover every municipality there.
  const own=prefix(c.system);if(own&&target.startsWith(own))return c;
 }
 return null;
}
export const consentAllows=(url,options)=>Boolean(consentFor(url,options));

/** Consents of one area (any scope), newest first. */
export function consentsOf(area,list=register.consents){return (list||[]).filter(c=>validConsent(c)&&c.area===area).sort((a,b)=>b.date.localeCompare(a.date));}

/** The field build.mjs writes into a catalog entry whose robots.txt refuses programs but is covered by a consent. */
export const robotsOverride=c=>({by:c.operator?'Betreiber':'Kommune',role:c.grantedBy,date:c.date,evidence:c.evidence||c.id});

const norm=s=>String(s||'').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/^(stadt|gemeinde|markt|samtgemeinde|verbandsgemeinde|verwaltungsgemeinschaft|verwaltungsverband|amt|landkreis|kreis)\s+/,'').replace(/[^a-z0-9]/g,'');
const SCOPE_WORDS={robots:/robots|abruf|lesen|crawl|programm/i,freischaltung:/freischalt|403|firewall|zugriff/i,oparl:/oparl|schnittstelle/i,adresse:/adresse|link|url/i};
const dateOf=v=>{const s=String(v||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return s;m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;};

/**
 * Lines of a consent list (CSV with semicolons, header Gebiet;Land;Datum;Umfang;Kanal;Stelle;Adresse;Betreiber) matched
 * to catalog areas by id, official key, or name within the Land. Returns {consents, problems}; a line that is not
 * unique or not complete is a problem, never a guess.
 */
export function parseConsentCsv(text,areas,{landName=l=>l}={}){
 const lines=String(text||'').replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());
 if(!lines.length)return {consents:[],problems:['Datei ist leer']};
 const head=lines[0].split(';').map(h=>norm(h));
 const col=name=>head.indexOf(norm(name));
 const at={area:col('Gebiet'),land:col('Land'),date:col('Datum'),scope:col('Umfang'),channel:col('Kanal'),role:col('Stelle'),address:col('Adresse'),operator:col('Betreiber')};
 if(at.area<0||at.date<0||at.role<0)return {consents:[],problems:['Kopfzeile braucht mindestens Gebiet;Datum;Stelle (gefunden: '+lines[0]+')']};
 const consents=[],problems=[];
 lines.slice(1).forEach((line,i)=>{
  const f=line.split(';').map(v=>v.trim()),get=k=>at[k]>=0?f[at[k]]||'':'';
  const name=get('area'),land=get('land'),wanted=norm(name),landKey=land&&/^\d{1,2}$/.test(land)?land.padStart(2,'0'):null;
  const inLand=r=>!land||(landKey?r.ags.startsWith(landKey):norm(landName(r.ags.slice(0,2)))===norm(land));
  const hits=areas.filter(r=>r.id===name||r.ags===name.replace(/\s/g,'')||(inLand(r)&&(norm(r.name)===wanted||norm(r.shortName)===wanted)));
  const row=`Zeile ${i+2} (${name||'ohne Gebiet'})`;
  if(hits.length!==1){problems.push(`${row}: ${hits.length?'mehrdeutig ('+hits.map(r=>r.name+' '+r.ags).join(', ')+'); Land oder Schlüssel ergänzen':'kein Gebiet im Katalog'}`);return;}
  const date=dateOf(get('date'));if(!date){problems.push(`${row}: Datum fehlt oder unlesbar`);return;}
  const words=get('scope')||'robots',scope=SCOPES.filter(s=>SCOPE_WORDS[s].test(words));
  if(!scope.length){problems.push(`${row}: Umfang unbekannt ("${words}"); robots, freischaltung, oparl oder adresse`);return;}
  const address=get('address');let system=null;if(address){try{const u=new URL(/^https?:/.test(address)?address:'https://'+address);system=u.href;}catch{problems.push(`${row}: Adresse unlesbar`);return;}}
  const area=hits[0],review=new Date(Date.parse(date)+365*86400000).toISOString().slice(0,10);
  consents.push({area:area.id,key:area.ags,land:area.ags.slice(0,2),date,grantedBy:get('role'),channel:get('channel')||null,scope,system,address:null,operator:get('operator')||null,operatorState:scope.includes('freischaltung')||scope.includes('oparl')?'offen':null,evidence:null,reviewAt:review,revokedAt:null});
 });
 return {consents,problems};
}

/** Adds new consents to a register: never removes or changes one; the same area, date and scope count once. */
export function mergeConsents(list,added){
 const key=c=>[c.area,c.date,[...c.scope].sort().join(',')].join('|'),seen=new Set(list.map(key)),out=[...list];
 let n=list.reduce((m,c)=>Math.max(m,Number(String(c.id||'').match(/(\d+)$/)?.[1]||0)),0);
 const year=new Date().getUTCFullYear(),fresh=[];
 for(const c of added){if(seen.has(key(c)))continue;seen.add(key(c));n++;const id=`fr-${year}-${String(n).padStart(4,'0')}`;const entry={...c,id,evidence:c.evidence||'beleg:'+id};out.push(entry);fresh.push(entry);}
 return {list:out,added:fresh};
}

/**
 * Addresses of council systems found by hand (CSV Gebiet;Land;Adresse), matched to catalog areas like a consent list.
 * They are candidates only: verify.mjs checks them like every link (system, area name, public agenda items, robots.txt).
 */
export function parseAddressCsv(text,areas,{landName=l=>l}={}){
 const lines=String(text||'').replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());
 if(!lines.length)return {rows:[],problems:['Datei ist leer']};
 const head=lines[0].split(';').map(h=>norm(h)),at={area:head.indexOf('gebiet'),land:head.indexOf('land'),address:head.indexOf('adresse')};
 if(at.area<0||at.address<0)return {rows:[],problems:['Kopfzeile braucht mindestens Gebiet;Adresse (gefunden: '+lines[0]+')']};
 const rows=[],problems=[];
 lines.slice(1).forEach((line,i)=>{
  const f=line.split(';').map(v=>v.trim()),name=f[at.area]||'',land=at.land>=0?f[at.land]||'':'',wanted=norm(name),landKey=/^\d{1,2}$/.test(land)?land.padStart(2,'0'):null;
  const inLand=r=>!land||(landKey?r.ags.startsWith(landKey):norm(landName(r.ags.slice(0,2)))===norm(land));
  const hits=areas.filter(r=>r.id===name||r.ags===name.replace(/\s/g,'')||(inLand(r)&&(norm(r.name)===wanted||norm(r.shortName)===wanted)));
  const row=`Zeile ${i+2} (${name||'ohne Gebiet'})`;
  if(hits.length!==1){problems.push(`${row}: ${hits.length?'mehrdeutig ('+hits.map(r=>r.name+' '+r.ags).join(', ')+'); Land oder Schlüssel ergänzen':'kein Gebiet im Katalog'}`);return;}
  let url;try{const raw=f[at.address]||'';url=new URL(/^https?:/.test(raw)?raw:'https://'+raw).href;}catch{problems.push(`${row}: Adresse unlesbar`);return;}
  rows.push({area:hits[0],url});
 });
 return {rows,problems};
}
