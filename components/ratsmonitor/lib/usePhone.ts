import { useEffect, useState } from "react";

/** Handybreite (wie Tailwind max-sm: unter 640 px) */
export function usePhone() {
  /* Startwert wie auf dem Server, damit das erste Rendern im Browser zum ausgelieferten HTML passt; der Effekt setzt den echten Wert. */
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
