import { useSyncExternalStore } from "react";

/* Platz der Methodik in der Fußzeilen-Kachel der plenara.X-Seiten (Footer.tsx meldet ihn, Methodik.tsx hängt sich dort ein) */
let host: HTMLElement | null = null;
const subs = new Set<() => void>();
export const setMethodikHost = (el: HTMLElement | null) => { if (host === el) return; host = el; subs.forEach((f) => f()); };
export const useMethodikHost = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => host, () => null);
