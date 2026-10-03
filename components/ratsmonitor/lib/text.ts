/** Kleinschreibung, Umlaute und ß gefaltet, damit „dulmen“ auch „Dülmen“ findet */
export function normChar(c: string): string {
  const l = c.toLowerCase();
  if (l === "ß") return "ss";
  return l.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function norm(s: string): string {
  let o = "";
  for (const c of s) o += normChar(c);
  return o;
}

/** Füllwörter, die die Suche ignoriert (gleiche Liste wie server/integrations/monitor-search.mjs) */
export const FILLER = new Set(["und", "oder", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "in", "im", "am", "an", "zu", "zum", "zur", "von", "vom", "fur", "mit", "bei", "auf", "aus", "nach"]);

export function terms(text: string): string[] {
  /* Füllwörter (wie serverseitig) nicht hervorheben */
  return norm(text).split(/[\s,;|]+/).filter((w) => w && !FILLER.has(w));
}

export interface Segment {
  text: string;
  hl: boolean;
}

/** Zerlegt einen Text in markierte und unmarkierte Abschnitte für die Trefferhervorhebung */
export function highlightSegments(str: string, ts: string[]): Segment[] {
  if (!ts.length) return [{ text: str, hl: false }];
  let n = "";
  const map: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = normChar(str[i]);
    for (let k = 0; k < c.length; k++) {
      n += c[k];
      map.push(i);
    }
  }
  const ranges: [number, number][] = [];
  for (const t of ts) {
    let from = 0;
    let idx: number;
    while ((idx = n.indexOf(t, from)) !== -1) {
      ranges.push([map[idx], map[idx + t.length - 1] + 1]);
      from = idx + t.length;
    }
  }
  if (!ranges.length) return [{ text: str, hl: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [[...ranges[0]]];
  for (const r of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: Segment[] = [];
  let pos = 0;
  for (const [a, b] of merged) {
    if (a > pos) out.push({ text: str.slice(pos, a), hl: false });
    out.push({ text: str.slice(a, b), hl: true });
    pos = b;
  }
  if (pos < str.length) out.push({ text: str.slice(pos), hl: false });
  return out;
}

export function limitSentences(text: string, max: number): string {
  return text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„0-9])/)
    .slice(0, max)
    .join(" ");
}

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const MONTH_FMT = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
export const MONTH_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const DAY_FMT = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
export const TIME_FMT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

export const monthLabel = (ym: string) => MONTH_FMT.format(parseDate(ym + "-01"));

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
