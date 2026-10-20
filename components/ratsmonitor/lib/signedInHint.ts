import { createContext, useContext } from "react";

/** Hinweis vom Server: Kam die Seite mit Sitzungs-Cookie? true/false, unbekannt null (z. B. ohne Layout).
 *  Nur für den ersten Aufbau, bevor /api/me antwortet: Gäste (auch Suchmaschinen) bekommen die Vorschau so schon im HTML. */
export const SignedInHint = createContext<boolean | null>(null);
export const useSignedInHint = () => useContext(SignedInHint);
