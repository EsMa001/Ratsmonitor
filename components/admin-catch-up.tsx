'use client';
import {useRegionCatchUp} from '@/components/admin-store';
// Line under the page navigation of the administration: while values per area are stale or missing, the open page
// computes them in short steps (useRegionCatchUp) and says so; otherwise it shows nothing.
export function RegionCatchUp(){
 const {pending,unbuilt}=useRegionCatchUp(),left=pending+unbuilt;
 if(!left)return null;
 return <p role="status" className="px-[max(1vw,16px)] py-1 text-[14px] text-slate-500">Kennzahlen für {left.toLocaleString('de-DE')} {left===1?'Gebiet':'Gebiete'} werden nachgerechnet …</p>;
}
