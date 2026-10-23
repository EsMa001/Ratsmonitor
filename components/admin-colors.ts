import {MAP_COLORS} from '@/components/ratsmonitor/lib/constants';
// Farben der Adminseiten: dieselben wie auf der Startseite (Petrol, Schwarz, Grautöne). Die Farben in shared/coverage.mjs,
// shared/source-access.mjs und shared/atlas-categories.mjs bleiben unverändert, denn der eigenständige Atlas
// (scripts/dashboard/build.mjs) nutzt sie; der Admin überschreibt sie hier.
// Linien, Text und Flächen folgen dem hellen und dem dunklen Modus (Variablen --rm-* in app/styles/tokens.css).
export const AC={accent:'var(--color-teal-500)',ink:'var(--rm-c900)',muted:'var(--rm-c400)',grid:'var(--rm-c200)',base:'var(--rm-c300)',axis:'var(--rm-c500)',track:'var(--rm-c100)',
 zero:MAP_COLORS.zero,hatch:MAP_COLORS.hatch,scale:MAP_COLORS.scale,warn:MAP_COLORS.ring,selection:'var(--rm-c900)',land:MAP_COLORS.national,
 /** dritte Linie im Verlauf der Abdeckung: Abruf in den letzten 7 Tagen gelungen (Dunkelblau des Farbschemas) */
 active:'var(--color-sky-700)'} as const;
/** Schraffur „angebunden, ohne Berichte“: CSS-Fläche (Legende, Listenpunkt, Balken). */
export const HATCH_CSS=`repeating-linear-gradient(135deg,#fff 0 2px,${AC.hatch} 2px 3px)`;
// SVG: <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#fff"/><path d="M0 5L5 0" stroke={AC.hatch} strokeWidth="1"/></pattern>
export const COVERAGE={data:AC.scale[3],partial:AC.scale[1],failed:AC.warn,none:AC.zero} as const;
/** Anteile: bis 20 %, bis 50 %, bis 80 %, darüber (Schwellen wie admin-processing-map.tsx). */
export const shareColor=(a:number)=>a>.8?AC.scale[3]:a>.5?AC.scale[2]:a>.2?AC.scale[1]:AC.scale[0];
const BUCKET_COLOR:Record<string,string>={'fresh:d180':AC.muted,'fresh:old':AC.warn,'reach:none':HATCH_CSS,'fresh:none':HATCH_CSS};
export const bucketColor=(kind:'reach'|'fresh',b:{id:string;color:string})=>BUCKET_COLOR[kind+':'+b.id]??b.color;
export const ACCESS_COLOR:Record<string,string>={oparl:AC.scale[3],api:AC.accent,scraping:AC.scale[2],'api-noreader':'var(--rm-c500)',noreader:AC.muted,blocked:AC.warn,none:AC.zero};
/** Gründe des Lückenatlas (shared/atlas-categories.mjs) in den Farben des Farbschemas: Petrol = angebunden oder auf dem Weg,
    Dunkelblau = Quelle da, aber nicht lesbar, Orange-Braun = gesperrt oder gescheitert, Grau = nichts gefunden. */
export const CATEGORY_COLOR:Record<string,string>={ok:AC.scale[3],shared:AC.scale[2],ready:AC.scale[1],consent:'var(--color-sky-300)',
 website:'var(--color-sky-500)',robots:'var(--color-sky-700)',noreader:'var(--color-amber-300)',readfail:'var(--color-amber-500)',blocked:AC.warn,
 special:'var(--rm-c900)',nolink:'var(--rm-c300)',other:'var(--rm-c400)'};
