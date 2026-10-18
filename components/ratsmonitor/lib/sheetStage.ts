import { useSyncExternalStore } from "react";

/** Ergebnisblatt der Suche am Handy, zwei Stufen: „klein“ (Karte groß, nur die Zeile mit der Trefferzahl) und „voll“ (Liste groß, Karte als schmaler Streifen mit der Suchleiste).
 *  Nur für die Darstellung unter 640 px (app/ratsmonitor.css, `data-stage`); am Desktop ohne Wirkung. Bleibt beim Wechsel auf Artikelseiten erhalten. */
export type SheetStage = "klein" | "voll";
let stage: SheetStage = "klein";
/** Stufe der Liste: beim Einklappen bleibt sie so lange „voll“, wie die Karte noch wächst, damit die Liste nicht vor der Bewegung verschwindet */
let listStage: SheetStage = "klein";
let timer = 0;
const CLOSE_MS = 320;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const setSheetStage = (s: SheetStage) => {
  if (s === stage) return;
  stage = s;
  clearTimeout(timer);
  if (s === "voll") listStage = "voll";
  else timer = window.setTimeout(() => { listStage = "klein"; notify(); }, CLOSE_MS);
  notify();
};
export const toggleSheetStage = () => setSheetStage(stage === "klein" ? "voll" : "klein");
export const useSheetStage = (): SheetStage => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => stage, () => "klein");
export const useListStage = (): SheetStage => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => listStage, () => "klein");
