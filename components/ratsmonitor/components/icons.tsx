import type { ReactNode, SVGProps } from "react";
import { iconStroke } from "../lib/iconStroke";

type IconProps = SVGProps<SVGSVGElement> & { size?: number; filled?: boolean };

function Svg({ size = 16, filled = false, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
      strokeWidth={iconStroke(size)}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);
export const IconPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);
export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
/* Listenansicht: ausführlich (Zeilen mit Text) bzw. kompakt (nur Zeilen) */
export const IconViewFull = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="7" rx="1.5" />
    <rect x="3.5" y="13" width="17" height="7" rx="1.5" />
  </Svg>
);
export const IconViewCompact = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5h16M4 9.67h16M4 14.33h16M4 19h16" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconCenter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
    <circle cx="12" cy="12" r="2.5" />
  </Svg>
);
export const IconReset = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </Svg>
);
export const IconArrowUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </Svg>
);
export const IconBookmark = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);
export const IconEmptySearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M8.5 11h5" />
  </Svg>
);
export const IconDoc = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Svg>
);
export const IconRules = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 6h14M5 12h14M5 18h9" />
    <path d="M17 16l2 2 3-4" />
  </Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </Svg>
);
export const IconFilter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);
export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v11" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 20h14" />
  </Svg>
);

/** Kalender mit Pfeilkreis: Abo, das sich selbst aktualisiert */
export const IconCalendarSync = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
    <path d="M4 9h16M8 2v4M16 2v4" />
    <path d="M21 16a4 4 0 0 0-7-2.5L13 15" />
    <path d="M13 12v3h3" />
    <path d="M14 20a4 4 0 0 0 6-1.5" />
  </Svg>
);

/* Icons der 10 Themen (shared/themes.mjs), gleicher feiner Strich wie oben; ThemeIcon wählt nach Themen-ID */
const THEME_PATHS: Record<string, ReactNode> = {
  alle: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  bauen: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  finanzen: <><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" /><path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" /></>,
  mobilitaet: <><rect x="5" y="3" width="14" height="13" rx="3" /><path d="M5 10h14" /><circle cx="9" cy="13" r="0.8" /><circle cx="15" cy="13" r="0.8" /><path d="m8 16-2 4M16 16l2 4" /></>,
  bildung: <><path d="M3 9 12 5l9 4-9 4-9-4Z" /><path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" /><path d="M21 9v5" /></>,
  umwelt: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19 13 11" /></>,
  soziales: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" /><circle cx="17" cy="9" r="2.3" /><path d="M16 14.2c2.7.3 4.5 2.6 4.5 5.8" /></>,
  kultur: <><path d="M4 5h11v6a5.5 5.5 0 0 1-11 0V5Z" /><path d="M7 9h.01M12 9h.01M7.5 13c.8.8 2 1.2 3 1.2" /><path d="M15 8h5v5a5 5 0 0 1-6.5 4.8" /></>,
  sicherheit: <><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  verwaltung: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  wirtschaft: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M3 12h18" /></>,
};
export const ThemeIcon = ({ theme, ...p }: IconProps & { theme: string }) => (THEME_PATHS[theme] ? <Svg {...p}>{THEME_PATHS[theme]}</Svg> : null);
