/** Gemeinsame Zahlenformate (deutsch) */
export const nf = (v: number) => v.toLocaleString("de-DE");
/** Zahl mit bis zu 2 Nachkommastellen, ab 100 ganzzahlig (Werte aus den Unterlagen, Atlas) */
export const num = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
/** Prozentwert als Text, „–“ ohne Wert */
export const pctText = (v: number | null, digits?: number) => (v === null ? "–" : `${v.toLocaleString("de-DE", digits === undefined ? undefined : { maximumFractionDigits: digits })} %`);
