'use client';
import {RegionSelect,type RegionAvailability} from './region-select';
export function RegionPicker({region,availability}:{region:string;availability:RegionAvailability}){return <div className="region-picker"><label htmlFor="feed-region">Stadt, Gemeinde oder Kreis in NRW</label><RegionSelect availability={availability} id="feed-region" value={region} onChange={v=>window.location.assign('/?region='+v)}/><p className="page-note">396 Kommunen und 31 Kreise. Noch nicht angebundene Quellen bleiben als Datenlücke sichtbar.</p></div>}
