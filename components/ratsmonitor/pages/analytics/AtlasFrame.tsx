import type { ReactNode } from "react";

/** Rahmen einer Radar-Seite: eigenständig als Hauptinhalt, im plenara.X Atlas als Abschnitt unter der Themenleiste */
export function Frame({ embedded, children }: { embedded?: boolean; children: ReactNode }) {
  return embedded ? <section aria-label="Auswertung des Themas">{children}</section> : <main id="inhalt" className="w-full px-[max(1vw,16px)] pb-10 text-slate-900">{children}</main>;
}
