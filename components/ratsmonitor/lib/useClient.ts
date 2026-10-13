import { useSyncExternalStore } from "react";

const never = () => () => {};
/** Wert, den es nur im Browser gibt (Datum in Ortszeit, Adresse, Bildschirmart): auf dem Server und beim Hydrieren
 *  `server`, danach `get()`. Ohne Effekt und ohne zweites Setzen; get muss für gleiche Lage dasselbe liefern
 *  (Zahl, Text, true/false), sonst rendert React endlos. */
export function useClient<T extends string | number | boolean>(get: () => T, server: T): T {
  return useSyncExternalStore(never, get, () => server);
}
/** true, sobald die Seite im Browser läuft (nach dem Hydrieren) */
export const useHydrated = () => useClient(() => true, false);
