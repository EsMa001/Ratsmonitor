import type { Region } from "@/shared/regions";

/** Der Gebietskatalog (rund 500 KB mit allen Ländern) wird erst geladen, wenn ihn etwas braucht: ein Gebiet in der
 *  Adresse (?region=) oder eine Umkreissuche. Einmal geladen, bleibt er für die ganze Sitzung. */
let loading: Promise<typeof import("@/shared/regions")> | null = null;
export const loadCatalog = () => (loading ??= import("@/shared/regions"));
export type { Region };
