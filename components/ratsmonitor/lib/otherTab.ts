/** Änderungen aus anderen Tabs desselben Browsers: der Browser meldet sie über das storage-Ereignis (nie im Tab, der
 *  schreibt). key null heißt, der Speicher wurde ganz geleert. Gibt die Abmeldung zurück; auf dem Server ohne Wirkung. */
export function onOtherTab(keys: string[], run: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const on = (e: StorageEvent) => {
    if (e.key === null || keys.includes(e.key)) run();
  };
  window.addEventListener("storage", on);
  return () => window.removeEventListener("storage", on);
}
