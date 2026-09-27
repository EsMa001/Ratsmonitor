'use client';
import {useState} from 'react';
import {RegionSelect,type RegionAvailability} from './region-select';
export function SourceRegionFilter({selected,availability}:{selected:string|null;availability:RegionAvailability}){const [value,setValue]=useState(selected||'billerbeck');return <form method="get" className="source-filter"><label>Gebiet suchen<RegionSelect availability={availability} value={value} onChange={setValue}/></label><button type="submit">Anzeigen</button><a href="/quellen">Alle konfigurierten Quellen</a></form>}
