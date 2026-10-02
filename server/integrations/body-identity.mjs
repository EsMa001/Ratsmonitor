import {clean} from './oparl.mjs';
// "Stadt Duesseldorf" and "Stadt Düsseldorf" are the same name; providers transliterate umlauts.
const fold=value=>value.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
const sameAddress=(a,b)=>String(a).replace(/^http:/,'https:')===String(b).replace(/^http:/,'https:');
const normalizedName=value=>fold(clean(value).toLocaleLowerCase('de-DE')).replace(/^(?:(?:stadt|gemeinde|kreis|kreisverwaltung|landkreis|landeshauptstadt|bundesstadt|hansestadt|kolpingstadt|klingenstadt|universitaetsstadt)\s+)+/,'');
// Providers that store the official key as a number drop the leading zero of the state key (NRW: 05…).
// 7 digits are a municipal key, 4 digits a district key, 8 digits with an impossible state prefix a 9-digit key.
const officialKey=raw=>raw.length===7||raw.length===4||(raw.length===8&&Number(raw.slice(0,2))>16)?'0'+raw:raw;
/** Attribution must be unambiguous even when a provider hosts several municipalities. */
export function matchesBody(body,source){
 if(!body||body.deleted)return false;
 // A catalog entry may name the verified body of a shared system; then nothing else can match.
 if(source.body)return !!body.id&&sameAddress(body.id,source.body);
 const name=clean(body.name).toLocaleLowerCase('de-DE');
 if(source.kind==='city'&&/^(?:kreis|kreisverwaltung|landkreis)\s/.test(name))return false;
 if(source.kind==='district'&&/^(?:stadt|gemeinde|landeshauptstadt|bundesstadt|hansestadt)\s/.test(name))return false;
 const expected=source.ags||source.id?.match(/^nrw-(\d{5}|\d{8})$/)?.[1];
 const raw=officialKey(String(body.ags||'').replace(/\D/g,''));
 if(expected&&raw){
  const ags=source.kind==='district'&&/^\d{5}0{3}$/.test(raw)?raw.slice(0,5):raw.length===9&&raw.endsWith('0')?raw.slice(0,8):raw;
  return ags===expected;
 }
 return !!body.name&&normalizedName(body.name)===normalizedName(source.name);
}
export function chooseBody(bodies,source){
 const matched=bodies.filter(b=>matchesBody(b,source));
 if(matched.length!==1)throw Error('Körperschaft nicht eindeutig dem ausgewählten Gebiet zugeordnet');
 if(!matched[0].meeting)throw Error('Zugeordnete Körperschaft ohne Sitzungsliste');
 return matched[0];
}
