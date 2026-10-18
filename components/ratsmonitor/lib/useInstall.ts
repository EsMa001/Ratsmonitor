import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
}

/** Läuft die Seite schon als installierte App (Startbildschirm)? */
export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** „Als App hinzufügen“: auf Android/Chrome mit dem Installationsdialog des Browsers, auf dem iPhone als Hinweis (Teilen → Zum Home-Bildschirm); schon installiert: nichts */
export function useInstall(): { kind: "none" | "prompt" | "ios"; install: () => void } {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  if (typeof window === "undefined" || isStandalone()) return { kind: "none", install: () => {} };
  if (deferred) return { kind: "prompt", install: () => { void deferred?.prompt(); } };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return { kind: ios ? "ios" : "none", install: () => {} };
}
