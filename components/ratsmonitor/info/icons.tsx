import {
  ArrowRight,
  Bell,
  Briefcase,
  BusFront,
  Calendar,
  Check,
  CircleCheck,
  CircleHelp,
  CirclePlay,
  ClipboardList,
  Clock,
  Droplet,
  Euro,
  Eye,
  FileText,
  Handshake,
  Heart,
  House,
  Landmark,
  Layers,
  LayoutGrid,
  Mail,
  Map,
  MapPin,
  Megaphone,
  Menu,
  Minus,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Target,
  TrendingUp,
  User,
  Users,
  Waypoints,
  X,
  Zap,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { iconStroke } from "../lib/iconStroke";

/* Linien-Icons im 24er-Raster wie im Prototyp; Baum und Straße gibt es dort als eigene Pfade */
function Tree(p: LucideProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true">
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M12 14v7M8 21h8M12 17.5l-2.2-1.8" />
    </svg>
  );
}
function Road(p: LucideProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true">
      <path d="M8.5 3 5 21M15.5 3 19 21M12 4v2.5M12 10.5v3M12 17.5V21" />
    </svg>
  );
}

/* X aus dem Plenara.X-Logo: vier Arme aus verblassenden Quadraten um einen Mittelpunkt (wie components/ratsmonitor/components/Brand.tsx) */
function PlenaraX(p: LucideProps) {
  const arms = [1, -1].flatMap((dx) => [1, -1].flatMap((dy) => Array.from({ length: 3 }, (_, i) => [12 + dx * (4.6 + i * 2.3), 12 + dy * (4.6 + i * 2.3), 1 - i * 0.15, 3.4 - i * 0.35] as const)));
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="#0d9488">
      {arms.map(([x, y, o, w]) => (
        <rect key={x + "-" + y} x={x - w / 2} y={y - w / 2} width={w} height={w} fillOpacity={o} />
      ))}
      <rect x={10.9} y={10.9} width={2.2} height={2.2} />
    </svg>
  );
}

const ICONS = {
  arrowRight: ArrowRight,
  bell: Bell,
  briefcase: Briefcase,
  bus: BusFront,
  calendar: Calendar,
  check: Check,
  circleCheck: CircleCheck,
  circleHelp: CircleHelp,
  circlePlay: CirclePlay,
  clipboardList: ClipboardList,
  clock: Clock,
  droplet: Droplet,
  euro: Euro,
  plenaraX: PlenaraX,
  eye: Eye,
  fileText: FileText,
  handshake: Handshake,
  heart: Heart,
  house: House,
  landmark: Landmark,
  layers: Layers,
  layoutGrid: LayoutGrid,
  mail: Mail,
  map: Map,
  mapPin: MapPin,
  megaphone: Megaphone,
  menu: Menu,
  minus: Minus,
  newspaper: Newspaper,
  plus: Plus,
  road: Road,
  search: Search,
  shieldCheck: ShieldCheck,
  tag: Tag,
  target: Target,
  tree: Tree,
  trendingUp: TrendingUp,
  user: User,
  users: Users,
  network: Waypoints,
  x: X,
  zap: Zap,
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof ICONS;

/** Dekoratives Icon (aria-hidden) */
export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={iconStroke(size)} className={className} aria-hidden="true" />;
}
