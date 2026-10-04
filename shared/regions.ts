import {CATALOG} from './catalog.mjs';
/** ags: 8 Stellen je Gemeinde, 5 je Kreis, 9 (Regionalschlüssel) je niedersächsischer Samtgemeinde mit members */
export interface Region {id:string;name:string;shortName:string;kind:'city'|'district';district:string|null;ags:string;municipalityType?:string;independent?:boolean;members?:{ags:string;name:string}[];formerAgs?:string[]}
/** Gemeindeschlüssel, unter denen die öffentliche Karte (Stand 2018) das Gebiet zeigt */
export const mapKeys=(r:Region)=>r.members?r.members.map(m=>m.ags):r.formerAgs??[r.ags];
export const REGIONS=CATALOG as Region[];
export type RegionId=string;
export function regionName(id?:string){return REGIONS.find(r=>r.id===(id||'muenster'))?.name||'Unbekanntes Gebiet'}
export function validRegion(id:string){return REGIONS.some(r=>r.id===id)}
export function pendingCoverage(regionId:string){return {regionId,method:'pending',from:null,to:null,importedAt:null,meetings:0,sourceCount:0,complete:false,issues:['Dieses Gebiet ist auswählbar. Noch kein politischer Datenbestand angebunden.'],sourceUrl:null};}
