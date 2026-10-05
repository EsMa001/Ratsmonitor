/* ---------- Beschlüsse ---------- */
export type StatusId = "announced" | "consulting" | "recommended" | "approved" | "rejected" | "postponed" | "info" | "unknown";

export interface ArticleData {
  id: string;
  date: string; // ISO yyyy-mm-dd
  gemeinde: string;
  ags: string; // 8-stelliger Gemeindeschlüssel
  thema: string;
  gremium: string;
  status: StatusId;
  vorlage?: string;
  abstimmung?: string;
  title: string;
  teaser: string;
  hintergrund?: string;
  sachverhalt?: string;
  beschluss?: string;
  punkte?: string[];
  ausblick?: string;
  /** Stationen des Vorgangs (Datum, Status, Gremium) */
  steps?: { d: string; s: string; c: string }[];
}

export interface Article extends ArticleData {
  month: string; // yyyy-mm
  hay: string; // normalisierter Suchtext
}

/* ---------- Geodaten (vereinfachte VG250-Topologie) ---------- */
export interface MapLayerData {
  a: string[]; // AGS
  n: string[]; // Namen
  b?: number[]; // Bezeichnungsart
  p?: number[]; // Beschriftungspunkte x0,y0,x1,y1,…
  g: number[][][][]; // Features → Polygone → Ringe → Arc-Indizes (negativ = umgekehrt)
}

export interface MapData {
  arcs: string[]; // polyline-kodierte Arcs in 10-m-Einheiten
  ac: (number | string)[]; // Arc-Klasse: 0 Gemeinde, 1 Kreis, 2 Land, 3 Staatsgrenze
  gem: MapLayerData;
  krs: MapLayerData;
  land: MapLayerData;
  aus: string[]; // Nachbarstaaten
}

/* ---------- Suche und Filter ---------- */
export type AreaSource = "" | "search" | "ui" | "map";

export interface Radius {
  ags: string;
  x: number;
  y: number;
  km: number;
}

export interface SearchState {
  q: string;
  area: string;
  areaSrc: AreaSource;
  radius: Radius | null;
  thema: string;
  monat: string;
  von: string;
  bis: string;
  /** Gebietsumfang: nur das Gebiet oder inklusive (Kreis mit Gemeinden bzw. Gemeinde mit Kreis) */
  scope: "only" | "with";
  status: StatusId | "";
  sort: "desc" | "asc" | "relevance";
  /** Auch künftige Termine zeigen; sonst nur bis heute */
  future?: boolean;
  /** Auch Formalien zeigen (Niederschriften, Mitteilungen …); sonst ausgeblendet */
  formal?: boolean;
  level: "city" | "district";
  /** Vom Nutzer gewählte Alternativen der Ortserkennung (Suchphrase → AGS) */
  placeOverrides: Record<string, string>;
  /** Suchphrasen, die nicht als Ort erkannt werden sollen */
  placeIgnored: Record<string, true>;
  /** Umfang je weiterem Ort aus der Suche (AGS → nur Gebiet / inklusive Kreis bzw. Gemeinden) */
  placeScopes?: Record<string, "only" | "with">;
  /** Weitere als Filter übernommene Orte (stehen nicht mehr im Suchtext) */
  morePlaces?: { ags: string; scope: "only" | "with" }[];
}

/* ---------- Konto ---------- */
export type NotifyFreq = "instant" | "daily" | "weekly";

export interface SavedSearch {
  id: string;
  name: string;
  q: string;
  text: string;
  area: string;
  areaSrc: AreaSource;
  radius: { ags: string; km: number; x?: number; y?: number } | null;
  thema: string;
  monat: string;
  von?: string;
  bis?: string;
  scope?: "only" | "with";
  /** Weitere Orte aus der Suche */
  more?: { ags: string; scope: "only" | "with" }[];
  status: StatusId | "";
  level?: "city" | "district";
  /** Auch künftige Termine („inkl. Zukunft“) */
  future?: boolean;
  /** Auch Formalien („inkl. Formalien“) */
  formal?: boolean;
  /** Benachrichtigung: on = Push, mail = E-Mail an email; freq gilt für beide */
  notify: { on: boolean; freq: NotifyFreq; mail?: boolean; email?: string; /** weitere Empfänger dieser Suche (Enterprise) */ recipients?: string[] };
  created: string; // ISO
  lastSeen: string; // ISO
}

export interface Profile {
  first: string;
  last: string;
  email: string;
  org: string;
}
