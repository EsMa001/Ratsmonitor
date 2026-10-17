import type {StatusId} from '../types';
import {STATUS as SOURCE_STATUS} from '@/shared/types';
import {LABELS} from '@/shared/labels.mjs';
export const THEMEN=LABELS.map(l=>l.name);
/** Thema für die Trefferkarte: jedes eingeordnete Label, auch Sitzungsablauf und Allgemeines; „Noch nicht eingeordnet“ bleibt leer */
const OHNE_THEMA=LABELS.find(l=>l.id==='unklar')?.name;
export const shownThema=(thema?:string)=>thema&&thema!==OHNE_THEMA&&THEMEN.includes(thema)?thema:'';
export interface StatusInfo {id:StatusId;label:string;badge:string;dot:string}
export const STATUS:StatusInfo[]=Object.entries(SOURCE_STATUS).map(([id,s])=>({id:id as StatusId,label:s.label,badge:id==='approved'?'bg-sky-50 text-sky-900 border-sky-200':id==='rejected'?'bg-amber-50 text-amber-700 border-amber-200':'bg-slate-100 text-slate-600 border-slate-200',dot:id==='approved'?'bg-sky-900':id==='rejected'?'bg-amber-700':'bg-slate-300'}));
export const STATUS_BY_ID=Object.fromEntries(STATUS.map(s=>[s.id,s])) as Record<StatusId,StatusInfo>;
/** Kartenstufen, identisch mit tailwind.preset (colors.map) */
export const MAP_COLORS = {
  ground: "#ffffff",
  neighbour: "#fafafa",
  line: "#e4e4e7",
  national: "#a1a1aa",
  hatch: "#d4d4d8",
  zero: "#e4e4e7",
  scale: ["#c4e5e0", "#86cbc1", "#4fa89b", "#0f5249"],
  selection: "#0f5249",
  hover: "#0f5249",
  hoverFill: "rgba(38,132,120,.12)",
  ring: "#c8732f",
  ringFill: "rgba(200,115,47,.08)",
  ringDot: "#8f420a",
  dim: "rgba(255,255,255,.74)",
  mesh: "#ffffff",
  meshNb: "#f4f4f5",
  label: "#52525b",
};

/** Dunkle Palette der Startseitenkarte (Flächen heller = mehr Abdeckung) */
export const MAP_COLORS_DARK = {
  ...MAP_COLORS,
  ground: "#18181b",
  neighbour: "#18181b",
  national: "#52525b",
  line: "#27272a",
  zero: "#27272a",
  scale: ["#10574e", "#268478", "#4fa89b", "#86cbc1"],
  selection: "#86cbc1",
  hover: "#86cbc1",
  hoverFill: "rgba(134,203,193,.14)",
  dim: "rgba(24,24,27,.72)",
  mesh: "#18181b",
  meshNb: "#27272a",
  label: "#a1a1aa",
};

export function colorForCoverageDark(level: number): string {
  const s = MAP_COLORS_DARK.scale;
  return level >= 4 ? s[3] : level === 3 ? s[2] : level === 2 ? s[1] : s[0];
}

/** Abdeckungsstufe: 1 = Teilbestand (letzter Abruf lückenhaft), 2 = vollständig abgerufen; 3 und 4 nur für plenara.X (Alter, 4 = am dunkelsten) */
export function colorForCoverage(level: number): string {
  return level >= 4 ? MAP_COLORS.scale[3] : level === 3 ? MAP_COLORS.scale[2] : level === 2 ? MAP_COLORS.scale[1] : MAP_COLORS.scale[0];
}


/** Farben je Status für Balken und Legenden (Farbkonzept: beschlossen Dunkelblau, in Arbeit Blaugrau, abgelehnt Orange-Braun) */
export const STATUS_COLOR: Record<string, string> = { approved: "var(--rm-ok)", recommended: "var(--rm-ok2)", consulting: "var(--rm-ok3)", announced: "var(--rm-c300)", rejected: "var(--rm-no)", postponed: "var(--rm-c400)", info: "var(--rm-c200)", unknown: "var(--rm-c100)" };
