import {clean} from './oparl.mjs';
import {isNonPublicText} from './website-text.mjs';
/**
 * Preserve source order: publicity may be established by an explicit section header.
 * assumePublic (catalog field assumePublicAgenda): the interface delivers only public items, so an item without flag
 * and without heading counts as public — decided for the OParl interface of SD.NET RIM on 06.10.2026 (it gives no
 * public flag and leaves gaps in the numbering where non-public items stand). Never for an item with public:false,
 * after a heading of the non-public part, or with a title that names the non-public part.
 */
export function publicAgenda(items,{assumePublic=false}={}){
 let section=null,closed=false;const accepted=[];let unclear=0;
 for(const item of items){
  // Providers word the heading differently: "Öffentliche Sitzung", "Öffentlicher Teil", "- Öffentlicher Teil -", "Öffentlich";
  // SD.NET RIM (OParl without public flag) "Sitzungsteil öffentlich" / "Sitzungsteil nicht öffentlich", also "Öffentlicher
  // Sitzungsteil". A heading that says "nicht" anywhere opens no public section.
  const name=clean(item.name).toLocaleLowerCase('de-DE').replace(/^[\s\-–—.:]+|[\s\-–—.:]+$/g,'');
  const heading=/^(?:nicht[ -]?)?öffentlich(?:e[rs]?)?(?: (?:sitzung|teil|sitzungsteil)(?: der sitzung)?)?$/.test(name)||/^sitzungsteil[ :–-]+(?:nicht[ -]?)?öffentlich$/.test(name);
  if(item.deleted){if(heading)section=null;continue;}
  if(heading){const open=!/nicht/.test(name)&&item.public!==false;section=open?item.id:null;closed=!open;continue;}
  // Unknown top-level headings (Roman numerals or a single capital letter) terminate the previous section.
  if(/^(?:[IVXLCDM]+|[A-Z])\.?$/.test(String(item.number||'')))section=null;
  if(item.public===false){section=null;closed=true;continue;}
  if(item.public===true)accepted.push({...item,publicEvidence:{method:'explicit-flag',source:item.id}});
  else if(section)accepted.push({...item,publicEvidence:{method:'public-section',source:section}});
  else if(assumePublic&&!closed&&!isNonPublicText(item.name))accepted.push({...item,publicEvidence:{method:'interface-public-only',source:item.id}});
  else unclear++;
 }
 return {items:accepted,unclear};
}
