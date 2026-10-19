import type { ReactNode } from "react";

/* Reiter auf langen Analyseseiten (Desktop): alle Teile bleiben eingehängt (nichts lädt neu), nur der gewählte ist sichtbar; Handy und Druck zeigen alles untereinander (per CSS) */
export function TabPane({ on, children }: { on: boolean; children: ReactNode }) {
  return <div className={on ? "" : "hidden max-sm:block print:block"}>{children}</div>;
}
