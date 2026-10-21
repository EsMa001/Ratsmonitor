import { useSyncExternalStore } from "react";

/** Ergebnisblatt der Suche am Handy, zwei Stufen: „klein“ (Karte groß, nur die Zeile mit der Trefferzahl) und „voll“ (Liste groß, Karte als schmaler Streifen mit der Suchleiste).
 *  Nur für die Darstellung unter 640 px (app/styles/search.css, `data-stage`); am Desktop ohne Wirkung. Bleibt beim Wechsel auf Artikelseiten erhalten. */
export type SheetStage = "klein" | "voll";
let stage: SheetStage = "klein";
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const setSheetStage = (s: SheetStage) => {
  if (s === stage) return;
  stage = s;
  notify();
};
export const toggleSheetStage = () => setSheetStage(stage === "klein" ? "voll" : "klein");
export const useSheetStage = (): SheetStage => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => stage, () => "klein");

/** Handy: „Minimal“ = kleines Blatt ohne die Vorschau der ersten Treffer (Wischen nach unten im kleinen Blatt). Drei Stufen: voll, mittel (klein mit Vorschau), minimal. Ohne Suche beginnt es minimal; eine neue Suche oder „voll“ zeigt die Vorschau */
let peekHidden = true;
const peekListeners = new Set<() => void>();
export const setPeekHidden = (v: boolean) => {
  if (v === peekHidden) return;
  peekHidden = v;
  peekListeners.forEach((l) => l());
};
export const usePeekHidden = (): boolean => useSyncExternalStore((l) => { peekListeners.add(l); return () => { peekListeners.delete(l); }; }, () => peekHidden, () => true);
