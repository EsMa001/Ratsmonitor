import { useSyncExternalStore } from "react";

/** Die eine Handygrenze der App, dieselbe wie Tailwind max-sm (app/styles/tokens.css): schmal (unter 640 px) oder Handy quer (kurz, Touch, bis 1000 px breit). Wer im Code „Handy“ meint, nimmt diese. */
export const PHONE_QUERY = "(max-width: 639px), (max-height: 500px) and (pointer: coarse) and (max-width: 1000px)";

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

/** Sehr schmale Handys (unter 360 px, z. B. iPhone SE der ersten Generation): dort muss Text in der Suchleiste kürzer sein */
const TINY_QUERY = "(max-width: 359px)";
const subscribeTiny = (on: () => void) => {
  const mq = window.matchMedia(TINY_QUERY);
  mq.addEventListener("change", on);
  return () => mq.removeEventListener("change", on);
};
export function useTinyPhone() {
  return useSyncExternalStore(subscribeTiny, () => window.matchMedia(TINY_QUERY).matches, () => false);
}
