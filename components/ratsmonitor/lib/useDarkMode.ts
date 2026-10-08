import { useEffect, useState } from "react";

const KEY = "rm-dark";
const EVT = "rm-dark-change";

/** Dunkler Modus (Klasse rm-dark auf <html>); gemerkt im Browser */
export function useDarkMode(): [boolean, (v: boolean) => void] {
  const [dark, setDarkState] = useState(false);
  useEffect(() => {
    const read = () => {
      let d = false;
      try { d = localStorage.getItem(KEY) === "1"; } catch { /* ohne Speicher: hell */ }
      document.documentElement.classList.toggle("rm-dark", d);
      setDarkState(d);
    };
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, []);
  const set = (v: boolean) => {
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* egal */ }
    setDarkState(v);
    window.dispatchEvent(new Event(EVT));
  };
  return [dark, set];
}
