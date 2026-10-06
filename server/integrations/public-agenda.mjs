import {clean} from './oparl.mjs';
/** Preserve source order: publicity may be established by an explicit section header. */
export function publicAgenda(items){
 let section=null;const accepted=[];let unclear=0;
 for(const item of items){
  // Providers word the heading differently: "Öffentliche Sitzung", "Öffentlicher Teil", "- Öffentlicher Teil -", "Öffentlich";
  // SD.NET RIM (OParl without public flag) "Sitzungsteil öffentlich" / "Sitzungsteil nicht öffentlich", also "Öffentlicher
  // Sitzungsteil". A heading that says "nicht" anywhere opens no public section.
  const name=clean(item.name).toLocaleLowerCase('de-DE').replace(/^[\s\-–—.:]+|[\s\-–—.:]+$/g,'');
  const heading=/^(?:nicht[ -]?)?öffentlich(?:e[rs]?)?(?: (?:sitzung|teil|sitzungsteil)(?: der sitzung)?)?$/.test(name)||/^sitzungsteil[ :–-]+(?:nicht[ -]?)?öffentlich$/.test(name);
  if(item.deleted){if(heading)section=null;continue;}
  if(heading){section=/nicht/.test(name)?null:item.public===false?null:item.id;continue;}
  // Unknown top-level headings (Roman numerals or a single capital letter) terminate the previous section.
  if(/^(?:[IVXLCDM]+|[A-Z])\.?$/.test(String(item.number||'')))section=null;
  if(item.public===false){section=null;continue;}
  if(item.public===true)accepted.push({...item,publicEvidence:{method:'explicit-flag',source:item.id}});
  else if(section)accepted.push({...item,publicEvidence:{method:'public-section',source:section}});
  else unclear++;
 }
 return {items:accepted,unclear};
}
