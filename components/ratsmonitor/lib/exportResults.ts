import type { Article } from "../types";
import { STATUS_BY_ID } from "./constants";

const MAX_PAGES = 25; // 25 × 20 = höchstens 500 Treffer je Export

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * Trefferliste der aktuellen Suche als CSV (Excel-tauglich: Semikolon, UTF-8 mit BOM).
 * key: Abfrage der Suche; withinAgs: Gebiete eines Umkreises (sonst leer).
 */
export async function exportResults(key: string, withinAgs: string[] | null, total: number): Promise<number> {
  const rows: Article[] = [];
  const pages = Math.min(MAX_PAGES, Math.ceil(total / 20));
  for (let page = 1; page <= pages; page++) {
    const p = new URLSearchParams(key);
    p.delete("around");
    if (withinAgs) p.set("within", withinAgs.join(","));
    p.set("page", String(page));
    const r = await fetch("/api/search?" + p);
    if (!r.ok) break;
    const d = (await r.json()) as { articles?: Article[] };
    rows.push(...(d.articles ?? []));
    if (!d.articles?.length) break;
  }
  const head = ["Datum", "Titel", "Ort", "Gremium", "Stand", "Thema", "Link"];
  const origin = window.location.origin;
  const lines = rows.map((a) =>
    [a.date, a.title, a.gemeinde, (a as Article & { gremium?: string }).gremium, STATUS_BY_ID[a.status]?.label ?? a.status, a.thema, `${origin}/beschluss/${a.id}`].map(cell).join(";"),
  );
  const blob = new Blob(["﻿" + [head.map(cell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `treffer-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  return rows.length;
}
