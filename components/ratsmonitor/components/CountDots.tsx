/** Drei graue, wandernde Punkte an der Stelle der Trefferzahl, solange die genaue Zahl noch geladen wird */
export function CountDots() {
  return (
    <span className="rm-dots" role="img" aria-label="Trefferzahl wird ermittelt">
      <i /><i /><i />
    </span>
  );
}
