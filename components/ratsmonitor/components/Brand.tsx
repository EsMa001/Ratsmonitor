import Link from "next/link";
import type { CSSProperties, ReactElement } from "react";
import { useBrand } from "../lib/brand";
import type { LogoId } from "../lib/brands";

/* Logos exakt nach Vorgabe „Kopfzeile-Logos v3“ (Code-Seite, direkt aus dem Prototyp) */
const TEAL = "#0d9488";
const WORD: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  fontWeight: 400,
  letterSpacing: "-.015em",
  fontSize: 26,
};
/* Inline-SVGs im Schriftzug: Tailwind setzt SVGs sonst auf display:block */
const INLINE: CSSProperties = { display: "inline-block" };

/* Plenum aus Punkten: [cx, cy, r, Deckkraft] */
const QUORUMO_O: [number, number, number, number][] = [
  [27.5, 76.8, 3.8, 1], [19.2, 66.7, 3.8, 1], [15.3, 54.2, 3.8, 1], [16.1, 41.2, 3.8, 1], [21.7, 29.4, 3.8, 1], [31.3, 20.4, 3.8, 1], [43.5, 15.6, 3.8, 1],
  [56.5, 15.6, 3.8, 1], [68.7, 20.4, 3.8, 1], [78.3, 29.4, 3.8, 1], [83.9, 41.2, 3.8, 1], [84.7, 54.2, 3.8, 1], [80.8, 66.7, 3.8, 1], [72.5, 76.8, 3.8, 1],
  [35.2, 67.6, 2.8, 0.55], [27.8, 56.0, 2.8, 0.55], [28.4, 42.1, 2.8, 0.55], [36.8, 31.2, 2.8, 0.55], [50.0, 27.0, 2.8, 0.55], [63.2, 31.2, 2.8, 0.55],
  [71.6, 42.1, 2.8, 0.55], [72.2, 56.0, 2.8, 0.55], [64.8, 67.6, 2.8, 0.55],
  [42.9, 58.4, 2, 0.3], [39.7, 46.2, 2, 0.3], [50.0, 39.0, 2, 0.3], [60.3, 46.2, 2, 0.3], [57.1, 58.4, 2, 0.3],
];

/* Plenarsaal aus Sitzpunkten: [cx, cy, r] */
const PLENARA_SEATS: [number, number, number][] = [
  [29.1, 71.2, 3.4], [37.1, 60.2, 3.4], [50.0, 56.0, 3.4], [62.9, 60.2, 3.4], [70.9, 71.2, 3.4],
  [16.9, 70.4, 3.4], [23.4, 56.8, 3.4], [35.2, 47.4, 3.4], [50.0, 44.0, 3.4], [64.8, 47.4, 3.4], [76.6, 56.8, 3.4], [83.1, 70.4, 3.4],
  [4.7, 70.0, 3.2], [10.2, 55.0, 3.2], [20.4, 42.8, 3.2], [34.3, 34.8, 3.2], [50.0, 32.0, 3.2], [65.7, 34.8, 3.2], [79.6, 42.8, 3.2], [89.8, 55.0, 3.2], [95.3, 70.0, 3.2],
];

/* v2: Q als Plenarsaal aus drei verblassenden Sitzreihen, Lücke am Q-Strich: [cx, cy, r, Deckkraft] */
const QUORUMO_Q: [number, number, number, number][] = [
  [50.0, 16.0, 3.6, 1], [60.5, 17.7, 3.6, 1], [70.0, 22.5, 3.6, 1], [77.5, 30.0, 3.6, 1], [82.3, 39.5, 3.6, 1], [84.0, 50.0, 3.6, 1], [82.3, 60.5, 3.6, 1],
  [60.5, 82.3, 3.6, 1], [50.0, 84.0, 3.6, 1], [39.5, 82.3, 3.6, 1], [30.0, 77.5, 3.6, 1], [22.5, 70.0, 3.6, 1], [17.7, 60.5, 3.6, 1], [16.0, 50.0, 3.6, 1],
  [17.7, 39.5, 3.6, 1], [22.5, 30.0, 3.6, 1], [30.0, 22.5, 3.6, 1], [39.5, 17.7, 3.6, 1],
  [50.0, 26.0, 3, 0.65], [60.4, 28.4, 3, 0.65], [68.8, 35.0, 3, 0.65], [73.4, 44.7, 3, 0.65], [73.4, 55.3, 3, 0.65], [50.0, 74.0, 3, 0.65],
  [39.6, 71.6, 3, 0.65], [31.2, 65.0, 3, 0.65], [26.6, 55.3, 3, 0.65], [26.6, 44.7, 3, 0.65], [31.2, 35.0, 3, 0.65], [39.6, 28.4, 3, 0.65],
  [50.0, 36.0, 2.5, 0.35], [59.9, 40.1, 2.5, 0.35], [64.0, 50.0, 2.5, 0.35], [59.9, 59.9, 2.5, 0.35], [50.0, 64.0, 2.5, 0.35], [40.1, 59.9, 2.5, 0.35],
  [36.0, 50.0, 2.5, 0.35], [40.1, 40.1, 2.5, 0.35],
];

/* v3 (Ergänzung „Quorumo v3“): Q als Plenarsaal aus zwei Sitzreihen, Lücke am Q-Strich: [cx, cy, r, Deckkraft] */
const QUORUMO_Q3: [number, number, number, number][] = [
  [50.0, 16.0, 4.2, 1], [63.0, 18.6, 4.2, 1], [74.0, 26.0, 4.2, 1], [81.4, 37.0, 4.2, 1], [84.0, 50.0, 4.2, 1], [81.4, 63.0, 4.2, 1], [63.0, 81.4, 4.2, 1],
  [50.0, 84.0, 4.2, 1], [37.0, 81.4, 4.2, 1], [26.0, 74.0, 4.2, 1], [18.6, 63.0, 4.2, 1], [16.0, 50.0, 4.2, 1], [18.6, 37.0, 4.2, 1], [26.0, 26.0, 4.2, 1],
  [37.0, 18.6, 4.2, 1],
  [50.0, 28.0, 3.4, 0.6], [62.9, 32.2, 3.4, 0.6], [70.9, 43.2, 3.4, 0.6], [70.9, 56.8, 3.4, 0.6], [50.0, 72.0, 3.4, 0.6], [37.1, 67.8, 3.4, 0.6],
  [29.1, 56.8, 3.4, 0.6], [29.1, 43.2, 3.4, 0.6], [37.1, 32.2, 3.4, 0.6],
];

/* v2: Bauch des p aus zwei Sitzreihen: [cx, cy, r, Deckkraft] */
const PLENARA_P: [number, number, number, number][] = [
  [78.0, 50.0, 3.6, 1], [75.9, 60.7, 3.6, 1], [69.8, 69.8, 3.6, 1], [60.7, 75.9, 3.6, 1], [50.0, 78.0, 3.6, 1], [39.3, 75.9, 3.6, 1], [30.2, 69.8, 3.6, 1],
  [24.1, 60.7, 3.6, 1], [50.0, 22.0, 3.6, 1], [60.7, 24.1, 3.6, 1], [69.8, 30.2, 3.6, 1], [75.9, 39.3, 3.6, 1],
  [67.0, 50.0, 3, 0.55], [63.8, 60.0, 3, 0.55], [55.3, 66.2, 3, 0.55], [44.7, 66.2, 3, 0.55], [36.2, 60.0, 3, 0.55], [33.0, 50.0, 3, 0.55],
  [36.2, 40.0, 3, 0.55], [44.7, 33.8, 3, 0.55], [55.3, 33.8, 3, 0.55], [63.8, 40.0, 3, 0.55],
];

/* v2: zwei Reihen Sitzpunkte hinter dem Schallbogen: [cx, cy, Deckkraft] */
const PARLAMO_SEATS: [number, number, number][] = [
  [98.9, 38.6, 1], [102.5, 44.9, 1], [103.8, 52.0, 1], [102.5, 59.1, 1], [98.9, 65.4, 1],
  [109.4, 38.0, 0.45], [112.0, 44.8, 0.45], [112.9, 52.0, 0.45], [112.0, 59.2, 0.45], [109.4, 66.0, 0.45],
];

const Dots = ({ dots }: { dots: [number, number, number, number][] }) => (
  <>
    {dots.map(([cx, cy, r, o]) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={TEAL} fillOpacity={o} />
    ))}
  </>
);

/** Quadratischer Teal-Punkt auf der Grundlinie (v2 ■) */
const Square = () => <span style={{ display: "inline-block", width: ".15em", height: ".15em", background: TEAL, marginLeft: ".05em", verticalAlign: 0 }} />;

function Quorumo() {
  return (
    <span style={{ fontSize: 28, letterSpacing: "-0.42px" }}>
      <svg viewBox="14 14 76 76" aria-hidden="true" style={{ ...INLINE, height: ".86em", width: ".86em", verticalAlign: "-0.16em", marginRight: ".01em" }}>
        <circle cx="50" cy="50" r="30" stroke={TEAL} strokeWidth="8.5" fill="none" />
        <path d="M62 62L84 84" stroke={TEAL} strokeWidth="9.775" strokeLinecap="round" />
        <path d="M30.3 44.7A20.4 20.4 0 0 1 43.0 30.8" stroke={TEAL} strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
      <span>uorum</span>
      <svg viewBox="8 8 84 84" aria-hidden="true" style={{ ...INLINE, height: "0.84em", width: "0.84em", verticalAlign: "-0.2em", marginLeft: ".04em" }}>
        <Dots dots={QUORUMO_O} />
        <rect x="42" y="78" width="16" height="4.5" rx="2.2" fill={TEAL} />
      </svg>
    </span>
  );
}

/** Q aus Sitzpunkten; v2 mit Linien-Strich, v3 mit Kapsel-Strich auf der 45°-Diagonale */
function QuorumoSeats({ v3, square }: { v3?: boolean; square?: boolean }) {
  return (
    <span style={{ fontSize: 28, letterSpacing: "-.015em" }}>
      <svg viewBox="8 8 84 84" overflow="visible" aria-hidden="true" style={{ ...INLINE, height: ".86em", width: ".86em", verticalAlign: "-0.16em", marginRight: ".02em" }}>
        {v3 ? (
          <>
            <Dots dots={QUORUMO_Q3} />
            <rect x="60.45584412271572" y="70.95584412271572" width="30" height="9" rx="4.5" transform="rotate(45 75.45584412271572 75.45584412271572)" fill={TEAL} />
          </>
        ) : (
          <>
            <Dots dots={QUORUMO_Q} />
            <path d="M64 64L84 84" stroke={TEAL} strokeWidth="9" strokeLinecap="round" />
          </>
        )}
      </svg>
      {square ? (
        <>
          uorumo
          <Square />
        </>
      ) : (
        <>
          uorum<span style={{ color: TEAL }}>o</span>
        </>
      )}
    </span>
  );
}

function Plenara() {
  return (
    <span style={WORD}>
      <svg width="44" height="44" viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0, margin: "-6px 0 -6px -6px" }}>
        <g stroke={TEAL} strokeWidth="2.9" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {PLENARA_SEATS.map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={TEAL} stroke="none" />
          ))}
          <path d="M44 84h12" />
        </g>
      </svg>
      <span className="rm-logo__text">
        plenara<span style={{ color: TEAL }}>.</span>
      </span>
    </span>
  );
}

function PlenaraV2({ square }: { square?: boolean }) {
  return (
    <span style={{ fontSize: 28, letterSpacing: "-.015em" }}>
      <svg viewBox="15 15 70 70" overflow="visible" aria-hidden="true" style={{ ...INLINE, height: ".66em", width: ".66em", verticalAlign: "-0.07em", marginRight: ".01em" }}>
        <Dots dots={PLENARA_P} />
        <path d="M22 108V50A28 28 0 0 1 38.2 24.6" stroke={TEAL} strokeWidth="7" fill="none" strokeLinecap="round" />
      </svg>
      {square ? (
        <>
          lenara
          <Square />
        </>
      ) : (
        <>
          lenar<span style={{ color: TEAL }}>a</span>
        </>
      )}
    </span>
  );
}

/** Linienvogel; v1 mit zwei Schallbögen, v2 mit einem Schallbogen und zwei Reihen Sitzpunkten */
function Parlamo({ v2, square }: { v2?: boolean; square?: boolean }) {
  return (
    <span style={{ ...WORD, gap: v2 ? 22 : 12 }}>
      <svg width="52" height="52" viewBox="0 0 100 100" overflow="visible" aria-hidden="true" style={{ flexShrink: 0, position: "relative", top: -4, margin: "-8px -2px -8px -8px" }}>
        <g stroke={TEAL} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g transform="translate(-4 0)">
            <path d="M26 66c0-16 12-28 28-28 9 0 16 5 19 12l11 2-10 4c-2 14-14 24-30 24H26z" />
            <circle cx="64" cy="48" r="2.6" fill={TEAL} stroke="none" />
          </g>
          {v2 ? (
            <>
              <path d="M90.5 43.0A11.7 11.7 0 0 1 90.5 61.0" />
              {PARLAMO_SEATS.map(([cx, cy, o]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill={TEAL} fillOpacity={o} stroke="none" />
              ))}
            </>
          ) : (
            <path transform="translate(3 0)" d="M86 42a10 10 0 0 1 0 14M92 36a18 18 0 0 1 0 26" opacity=".6" />
          )}
        </g>
      </svg>
      <span className="rm-logo__text">
        parlamo{square ? <Square /> : <span style={{ color: TEAL }}>.</span>}
      </span>
    </span>
  );
}

const LOGO: Record<LogoId, () => ReactElement> = {
  quorumo: () => <Quorumo />,
  "quorumo-v2o": () => <QuorumoSeats />,
  "quorumo-v2sq": () => <QuorumoSeats square />,
  "quorumo-v3o": () => <QuorumoSeats v3 />,
  "quorumo-v3sq": () => <QuorumoSeats v3 square />,
  plenara: () => <Plenara />,
  "plenara-v2a": () => <PlenaraV2 />,
  "plenara-v2sq": () => <PlenaraV2 square />,
  parlamo: () => <Parlamo />,
  "parlamo-v2dot": () => <Parlamo v2 />,
  "parlamo-v2sq": () => <Parlamo v2 square />,
};

/** Logo der gewählten Variante; führt zur Übersicht */
export function Brand({ onClick, asLink = true }: { onClick?: () => void; asLink?: boolean }) {
  const { logo, name } = useBrand();
  const Logo = LOGO[logo];
  if (!asLink)
    return (
      <div className="rm-logo">
        <Logo />
      </div>
    );
  return (
    <Link
      href="/"
      aria-label={`${name}, zur Übersicht`}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className="rm-logo max-sm:py-2 [grid-area:brand]"
    >
      <Logo />
    </Link>
  );
}
