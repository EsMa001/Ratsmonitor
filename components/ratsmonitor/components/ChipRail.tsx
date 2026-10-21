import type { ReactNode } from "react";

export interface RailItem { id: string; label: string; icon?: ReactNode; iconOn?: ReactNode }


/** Handy: lange Namen mit „und“ auf den ersten Teil kürzen („Sport und Bäder“ → „Sport“), damit sie in die kleinen Kacheln passen */
export const kurz = (s: string) => (s.length > 12 && s.includes(" und ") ? s.split(" und ")[0] : s);
