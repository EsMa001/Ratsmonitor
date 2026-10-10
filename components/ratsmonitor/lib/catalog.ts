import type { Region } from "@/shared/regions";

/** Der Gebietskatalog (rund 500 KB mit allen Ländern) wird erst geladen, wenn ihn etwas braucht: ein Gebiet in der
 *  Adresse (?region=), eine Umkreissuche, der Gebietsname der Detailseite. Einmal geladen, bleibt er für die Sitzung;
 *  ein fehlgeschlagener Abruf (Funkloch, neuer Stand auf dem Server) wird beim nächsten Mal wiederholt. */
let loading: Promise<typeof import("@/shared/regions")> | null = null;
export const loadCatalog = () => (loading ??= import("@/shared/regions").catch((e) => { loading = null; throw e; }));
export type { Region };
