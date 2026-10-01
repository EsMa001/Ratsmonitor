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
  ground: "#f6f7f9",
  neighbour: "#e5e8ec",
  line: "#d3d8df",
  national: "#8b95a1",
  hatch: "#c9cfd7",
  zero: "#d7dce3",
  scale: ["#b9eae4", "#72d4ca", "#0d9488", "#0f766e"],
  selection: "#0b1220",
  hover: "#0f766e",
  hoverFill: "rgba(13,148,136,.12)",
  ring: "#f59e0b",
  ringFill: "rgba(245,158,11,.08)",
  ringDot: "#d97706",
  dim: "rgba(246,247,249,.74)",
};

export function colorForCount(c: number): string {
  const s = MAP_COLORS.scale;
  return c === 0 ? MAP_COLORS.zero : c <= 25 ? s[0] : c <= 100 ? s[1] : c <= 500 ? s[2] : s[3];
}
