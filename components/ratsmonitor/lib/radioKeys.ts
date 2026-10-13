import type { KeyboardEvent } from "react";

/** Pfeiltasten in einer Radiogruppe (role="radiogroup" mit Knöpfen role="radio"): wie bei echten Radioknöpfen wählen
 *  Pfeil rechts/unten den nächsten, links/oben den vorigen Eintrag (am Ende wieder vorn). An die Gruppe hängen. */
export function radioKeys(e: KeyboardEvent<HTMLElement>) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const i = radios.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const next = radios[(i + step + radios.length) % radios.length];
  next.focus();
  next.click();
}
/** tabIndex für einen Eintrag: nur der gewählte ist mit Tab erreichbar, die übrigen über die Pfeiltasten */
export const radioTab = (checked: boolean) => (checked ? 0 : -1);
