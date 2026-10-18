import { useSyncExternalStore } from "react";

/** Ergebnisblatt der Suche am Handy, zwei Stufen: „klein“ (Karte groß, nur die Zeile mit der Trefferzahl) und „voll“ (Liste groß, Karte als schmaler Streifen mit der Suchleiste).
 *  Nur für die Darstellung unter 640 px (app/ratsmonitor.css, `data-stage`); am Desktop ohne Wirkung. Bleibt beim Wechsel auf Artikelseiten erhalten. */
export type SheetStage = "klein" | "voll";
let stage: SheetStage = "klein";
const listeners = new Set<() => void>();
export const setSheetStage = (s: SheetStage) => { if (s === stage) return; stage = s; listeners.forEach((l) => l()); };
export const toggleSheetStage = () => setSheetStage(stage === "klein" ? "voll" : "klein");
export const useSheetStage = (): SheetStage => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => stage, () => "klein");
