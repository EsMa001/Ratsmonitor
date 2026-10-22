import { usePathname } from "next/navigation";
import { Bell, Bookmark, CalendarDays, Heart } from "lucide-react";
import { useTier } from "../lib/tier";
import { Sheet } from "./Sheet";
import { Tile } from "./SegTiles";

/** „Favoriten“ in der unteren Leiste (Handy): öffnet ein Blatt mit vier Bereichen (Meine Suchen, Benachrichtigungen, Kalender, Artikel); jede ist eine eigene Seite wie Atlas */
export function MeinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { limits, ready } = useTier();
  /* Kalender nur für Stufen mit Kalender (heute Enterprise): alle anderen sehen das Schloss, die Seite zeigt dann eine Vorschau */
  const locked = ready && !limits.calendar;
  const items = [
    { href: "/konto/suchen", label: "Meine Suchen", icon: <Heart size={22} strokeWidth={1.6} /> },
    { href: "/konto/benachrichtigungen", label: "Benachrichtigungen", icon: <Bell size={22} strokeWidth={1.6} /> },
    { href: "/konto/kalender", label: "Kalender", icon: <CalendarDays size={22} strokeWidth={1.6} />, locked },
    { href: "/konto/artikel", label: "Artikel", icon: <Bookmark size={22} strokeWidth={1.6} /> },
  ];
  return (
    <Sheet open={open} onClose={onClose} label="Favoriten">
      <ul className="m-0 mt-2 grid list-none grid-cols-2 gap-2 p-0">
        {items.map((f) => (
          <li key={f.href}><Tile href={f.href} icon={f.icon} label={f.label} on={path === f.href} locked={f.locked} onClick={() => path === f.href && onClose()} /></li>
        ))}
      </ul>
    </Sheet>
  );
}
