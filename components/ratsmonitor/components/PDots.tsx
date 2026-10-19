import { PLENARA_P } from "./Brand";

/**
 * Das „p“ des Logos (Punkte und Stamm) als stille Zeichnung im Hintergrund der Startseite: eine sehr langsame Helligkeitswelle
 * läuft einmal um die Punkte (reine CSS-Animation, nichts wird neu gezeichnet; bei „Bewegung reduzieren“ steht sie still).
 */
export function PDots() {
  return (
    <svg className="rm-pdots pointer-events-none absolute left-[30%] top-12 w-[min(24vw,360px)] max-sm:hidden" viewBox="10 10 80 105" aria-hidden="true">
      <path className="rm-pstem" d="M22 108V50A28 28 0 0 1 38.2 24.6" pathLength={1} stroke="var(--rm-fill)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {PLENARA_P.map(([x, y, r, o], i) => (
        <circle key={i} className="rm-pdot" cx={x} cy={y} r={r * 1.15} fill="var(--rm-fill)" style={{ ["--d" as string]: `${(i * 0.42).toFixed(2)}s`, ["--o" as string]: String(0.1 + o * 0.12) }} />
      ))}
    </svg>
  );
}
