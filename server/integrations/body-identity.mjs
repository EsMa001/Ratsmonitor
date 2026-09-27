import {clean} from './oparl.mjs';
const normalizedName=value=>clean(value).toLocaleLowerCase('de-DE').replace(/^(?:(?:stadt|gemeinde|kreis|landkreis|landeshauptstadt|bundesstadt|hansestadt|kolpingstadt|klingenstadt|universitätsstadt)\s+)+/,'');
/** Attribution must be unambiguous even when a provider hosts several municipalities. */
export function matchesBody(body,source){
 if(!body||body.deleted)return false;
 const name=clean(body.name).toLocaleLowerCase('de-DE');
 if(source.kind==='city'&&/^(?:kreis|landkreis)\s/.test(name))return false;
 if(source.kind==='district'&&/^(?:stadt|gemeinde|landeshauptstadt|bundesstadt|hansestadt)\s/.test(name))return false;
 const expected=source.ags||source.id?.match(/^nrw-(\d{5}|\d{8})$/)?.[1];
 const raw=String(body.ags||'').replace(/\D/g,'');
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
