import {MAP_COLORS} from '@/components/ratsmonitor/lib/constants';
// Farben der Adminseiten: dieselben wie auf der Startseite (Petrol, Schwarz, Grautöne). Die Farben in shared/coverage.mjs,
// shared/source-access.mjs und shared/atlas-categories.mjs bleiben unverändert, denn der eigenständige Atlas
// (scripts/dashboard/build.mjs) nutzt sie; der Admin überschreibt sie hier.
// Linien, Text und Flächen folgen dem hellen und dem dunklen Modus (Variablen --rm-* in app/ratsmonitor.css).
export const AC={accent:'#0d9488',ink:'var(--rm-c900,#0f172a)',muted:'var(--rm-c400,#94a3b8)',grid:'var(--rm-c200,#e2e8f0)',base:'var(--rm-c300,#cbd5e1)',axis:'var(--rm-c500,#64748b)',track:'var(--rm-c100,#f1f5f9)',
 zero:MAP_COLORS.zero,hatch:MAP_COLORS.hatch,scale:MAP_COLORS.scale,warn:MAP_COLORS.ring,selection:'var(--rm-c900,#0f172a)',land:MAP_COLORS.national} as const;
/** Schraffur „angebunden, ohne Berichte“: CSS-Fläche (Legende, Listenpunkt, Balken). */
export const HATCH_CSS=`repeating-linear-gradient(135deg,#fff 0 2px,${AC.hatch} 2px 3px)`;
// SVG: <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#fff"/><path d="M0 5L5 0" stroke={AC.hatch} strokeWidth="1"/></pattern>
export const COVERAGE={data:AC.scale[3],partial:AC.scale[1],failed:AC.warn,none:AC.zero} as const;
/** Anteile: bis 20 %, bis 50 %, bis 80 %, darüber (Schwellen wie admin-processing-map.tsx). */
export const shareColor=(a:number)=>a>.8?AC.scale[3]:a>.5?AC.scale[2]:a>.2?AC.scale[1]:AC.scale[0];
export const BUCKET_COLOR:Record<string,string>={'fresh:d180':AC.muted,'fresh:old':AC.warn,'reach:none':HATCH_CSS,'fresh:none':HATCH_CSS};
export const bucketColor=(kind:'reach'|'fresh',b:{id:string;color:string})=>BUCKET_COLOR[kind+':'+b.id]??b.color;
export const ACCESS_COLOR:Record<string,string>={oparl:AC.scale[3],api:AC.accent,scraping:AC.scale[2],'api-noreader':'#64748b',noreader:AC.muted,blocked:AC.warn,none:AC.zero};
