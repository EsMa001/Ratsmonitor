import type {StatusId} from '../types';
import {STATUS as SOURCE_STATUS} from '@/shared/types';
import {LABELS} from '@/shared/labels.mjs';
export const THEMEN=LABELS.map(l=>l.name);
export interface StatusInfo {id:StatusId;label:string;badge:string;dot:string}
export const STATUS:StatusInfo[]=Object.entries(SOURCE_STATUS).map(([id,s])=>({id:id as StatusId,label:s.label,badge:id==='approved'?'bg-emerald-50 text-emerald-700 border-emerald-200':id==='rejected'?'bg-rose-50 text-rose-700 border-rose-200':id==='unknown'?'bg-slate-100 text-slate-600 border-slate-200':'bg-sky-50 text-sky-700 border-sky-200',dot:id==='approved'?'bg-emerald-500':id==='rejected'?'bg-rose-500':'bg-slate-400'}));
export const STATUS_BY_ID=Object.fromEntries(STATUS.map(s=>[s.id,s])) as Record<StatusId,StatusInfo>;
export const TEASER_MAX_SENTENCES=4;
export const isCovered=(ags:string,coverage:{ags:string}[])=>coverage.some(r=>r.ags===ags||r.ags.startsWith(ags));
/** Kartenstufen, identisch mit tailwind.preset (colors.map) */
export const MAP_COLORS = {
  ground: "#ffffff",
  neighbour: "#f8f9fa",
  line: "#d3d8df",
  national: "#8b95a1",
  hatch: "#c9cfd7",
  zero: "#d7dce3",
  scale: ["#b3dfda", "#8ccdc7", "#6ebfb8", "#0f766e"],
  selection: "#0f766e",
  hover: "#0f766e",
  hoverFill: "rgba(13,148,136,.12)",
  ring: "#d1665a",
  ringFill: "rgba(209,102,90,.08)",
  ringDot: "#b4493e",
  dim: "rgba(255,255,255,.74)",
};

/** Abdeckungsstufe: 1 = Teilbestand (letzter Abruf lückenhaft), 2 = vollständig abgerufen */
export function colorForCoverage(level: number): string {
  return level >= 3 ? MAP_COLORS.scale[2] : level === 2 ? MAP_COLORS.scale[1] : MAP_COLORS.scale[0];
}

export function colorForCount(c: number): string {
  const s = MAP_COLORS.scale;
  return c === 0 ? MAP_COLORS.zero : c <= 25 ? s[0] : c <= 100 ? s[1] : c <= 500 ? s[2] : s[3];
}
