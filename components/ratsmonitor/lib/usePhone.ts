import { useSyncExternalStore } from "react";

/** Die eine Handygrenze der App: wie Tailwind max-sm (unter 640 px). Wer im Code „Handy“ meint, nimmt diese. */
export const PHONE_QUERY = "(max-width: 639px)";

/** Jetzt Handybreite? (außerhalb von React, auf dem Server false) */
export const isPhone = () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;

const subscribe = (on: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
};

/** Handybreite als Wert für React. Auf dem Server und beim Hydrieren false, damit das erste Rendern zum HTML passt. */
export function usePhone() {
  return useSyncExternalStore(subscribe, isPhone, () => false);
}
