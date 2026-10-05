import type { Article } from "../types";
import { STATUS_BY_ID } from "./constants";
import { download, makeCsv, makeXlsx } from "./xlsx";

/** Höchstzahl je Export: 25 Seiten × 20 Treffer */
export const EXPORT_MAX = 500;
export type ExportFormat = "csv" | "xlsx";

const HEAD = ["Datum", "Titel", "Ort", "Gremium", "Stand", "Thema", "Link"];
const row = (a: Article & { gremium?: string }) => [a.date, a.title, a.gemeinde, a.gremium ?? "", STATUS_BY_ID[a.status]?.label ?? a.status, a.thema, `${window.location.origin}/beschluss/${a.id}`];
const stamp = () => new Date().toISOString().slice(0, 10);

/** Trefferliste der aktuellen Suche als CSV oder Excel; key: Abfrage der Suche, withinAgs: Gebiete eines Umkreises */
export async function exportResults(key: string, withinAgs: string[] | null, total: number, format: ExportFormat): Promise<number> {
  const rows: Article[] = [];
  const pages = Math.min(EXPORT_MAX / 20, Math.ceil(total / 20));
  for (let page = 1; page <= pages; page++) {
    const p = new URLSearchParams(key);
    p.delete("around");
    if (withinAgs) p.set("within", withinAgs.join(","));
    p.set("size", "20"); /* Export immer in Seiten zu 20, auch wenn die Suche am Handy 15 je Seite zeigt */
    p.set("page", String(page));
    const r = await fetch("/api/search?" + p);
    if (!r.ok) break;
    const d = (await r.json()) as { articles?: Article[] };
    rows.push(...(d.articles ?? []));
    if (!d.articles?.length) break;
  }
  const table = [HEAD, ...rows.map(row)];
  download(format === "xlsx" ? makeXlsx(table) : makeCsv(table), `treffer-${stamp()}.${format}`);
  return rows.length;
}
