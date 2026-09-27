import catalog from './nrw-regions.json';
export interface Region {id:string;name:string;shortName:string;kind:'city'|'district';district:string|null;ags:string;municipalityType?:string;independent?:boolean}
export const REGIONS=catalog as Region[];
export type RegionId=string;
export function regionName(id?:string){return REGIONS.find(r=>r.id===(id||'muenster'))?.name||'Unbekanntes Gebiet'}
export function validRegion(id:string){return REGIONS.some(r=>r.id===id)}
export function pendingCoverage(regionId:string){return {regionId,method:'pending',from:null,to:null,importedAt:null,meetings:0,sourceCount:0,complete:false,issues:['Dieses Gebiet ist auswählbar. Noch kein politischer Datenbestand angebunden.'],sourceUrl:null};}
