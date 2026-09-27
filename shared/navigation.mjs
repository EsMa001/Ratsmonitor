/** Preserve the chosen territory across the site's public pages. */
export function regionLink(path,region='billerbeck'){
 return path+(path.includes('?')?'&':'?')+new URLSearchParams({region:region||'billerbeck'});
}
