import {clean} from './oparl.mjs';
/** Preserve source order: publicity may be established by an explicit section header. */
export function publicAgenda(items){
 let section=null;const accepted=[];let unclear=0;
 for(const item of items){
  const name=clean(item.name).toLocaleLowerCase('de-DE');
  const heading=/^(?:nicht[ -]?)?öffentliche(?:r|s)? (?:sitzung|teil)(?: der sitzung)?$/.test(name);
  if(item.deleted){if(heading)section=null;continue;}
  if(heading){section=/^nicht/.test(name)?null:item.public===false?null:item.id;continue;}
  // Unknown top-level Roman headings terminate the previous section.
  if(/^[IVXLCDM]+\.?$/.test(String(item.number||'')))section=null;
  if(item.public===false){section=null;continue;}
  if(item.public===true)accepted.push({...item,publicEvidence:{method:'explicit-flag',source:item.id}});
  else if(section)accepted.push({...item,publicEvidence:{method:'public-section',source:section}});
  else unclear++;
 }
 return {items:accepted,unclear};
}
