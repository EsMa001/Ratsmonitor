/** Keep the visible layer, selected territory and inspector in the same set. */
export function mapSelection(places,origin,requested,layer){
 const kinds=[...new Set(places.map(p=>p.kind))];
 const activeLayer=kinds.length===1?kinds[0]:kinds.includes(layer)?layer:(places.find(p=>p.id===origin)?.kind||kinds[0]||'city');
 const visible=places.filter(p=>p.kind===activeLayer);
 const current=visible.find(p=>p.id===requested)||visible.find(p=>p.id===origin)||visible.find(p=>p.total>0)||visible[0]||null;
 return {activeLayer,visible,current,selectedId:current?.id||''};
}
