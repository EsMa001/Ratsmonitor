// Katalog der Themen für Suche, Filter, Karte, Lena, Admin und plenara.X (seit labels-v3, 14.10.2026: die 10 Themen aus
// shared/themes.mjs plus „noch nicht eingeordnet“; Plan requirements/regel-schritt-plan.md, Schritt 5). Ältere Einordnungen
// im Katalog labels-v2 (16 Labels, von Hand oder per KI) werden fest übersetzt (LEGACY_LABELS), auch im View
// topic_effective_labels (drizzle/0034).
import {THEMES,OPEN,themeOf} from './themes.mjs';
import {itemKind} from './item-kind.mjs';
export const LABEL_VERSION='labels-v3';
export const CLASSIFIER_VERSION='title-rules-v5';
const COLORS={bauen:'#945432',finanzen:'#526086',mobilitaet:'#2b6f91',bildung:'#2352ad',umwelt:'#31774f',soziales:'#965775',
 kultur:'#a14a60',sicherheit:'#965134',verwaltung:'#64606e',wirtschaft:'#86682e'};
export const LABELS=[
 ...THEMES.map(t=>({id:t.id,name:t.name,color:COLORS[t.id]})),
 {id:'unklar',name:'Noch nicht eingeordnet',color:'#777777'}
];
/** Übersetzung der 16 Labels aus labels-v2; Formalien erkennt die Suche über itemKind (drizzle/0033), nicht über ein Label. */
export const LEGACY_LABELS={bildung:'bildung',bauen:'bauen',mobilitaet:'mobilitaet',umwelt:'umwelt',klima:'umwelt',soziales:'soziales',
 gesundheit:'soziales',wirtschaft:'wirtschaft',kultur:'kultur',sport:'kultur',sicherheit:'sicherheit',finanzen:'finanzen',
 verwaltung:'verwaltung',sitzung:'unklar',allgemein:'unklar',unklar:'unklar'};
/** Label einer Einordnung im Katalog version (labels-v2 übersetzt, labels-v3 direkt), sonst null. */
export function labelOf(primary,version){
 if(version===LABEL_VERSION)return LABELS.some(l=>l.id===primary)?primary:null;
 if(version==='labels-v2')return LEGACY_LABELS[primary]||null;
 return null;
}
export const labelName=id=>LABELS.find(x=>x.id===id)?.name||'Noch nicht eingeordnet';
/** Titelregel: Stufen 2 und 3 von readReport (server/integrations/report-rules.mjs) ohne Text, also Art des Punkts und Thema
 *  nur aus dem Titel. Gilt, bis read-reports.mjs den Bericht mit seinem Dokument gelesen hat (payload.theme).
 *  @param {any} t */
export function classifyTopic(t){
 const evidence=t.officialTitle||t.title||'';
 const kind=itemKind(evidence);
 const r=kind==='subject'?themeOf({title:evidence}):{theme:OPEN,subs:[],source:'formal'};
 const primary=r.theme===OPEN?'unklar':r.theme;
 const reason=kind!=='subject'?'Kein eigener Sachpunkt (Sitzungsablauf, Sammelpunkt oder Routine).'
  :primary==='unklar'?'Titel benennt kein ausreichend eindeutiges Thema.':'Thema aus dem Titel'+(r.subs.length?' ('+r.subs.join(', ')+')':'')+'.';
 return {primary,secondary:[],subs:r.subs,version:LABEL_VERSION,method:CLASSIFIER_VERSION,evidence,sourceUrl:t.sourceUrl||'',reason,classifiedAt:t.updatedAt||null};
}
