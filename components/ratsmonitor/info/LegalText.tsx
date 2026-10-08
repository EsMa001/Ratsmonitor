import type { ReactNode } from "react";

/* Textbausteine der Rechtstexte (Impressum, Datenschutz, AGB, Widerruf).
   Abstände als Inline-Style: ratsmonitor-info.css setzt Ränder zurück, Tailwind-Abstände greifen dort nicht. */
export function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: "44px 0 12px", fontSize: 18, lineHeight: 1.35, fontWeight: 600, color: "#0f172a" }}>{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p style={{ margin: "0 0 14px", fontSize: 16, lineHeight: 1.7, color: "#64748b" }}>{children}</p>;
}
export function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 14px", paddingLeft: 22, listStyle: "disc", fontSize: 16, lineHeight: 1.7, color: "#64748b" }}>
      {items.map((x, i) => (
        <li key={i} style={{ marginBottom: 6 }}>{x}</li>
      ))}
    </ul>
  );
}
