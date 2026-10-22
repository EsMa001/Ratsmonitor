import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Unterthema auf den plenara.X-Seiten mit Themenleiste: steht in der Adresse (?sub=<Kürzel>), damit sich die Auswahl teilen lässt;
 * useAnalyticsQuery gibt es als Filter sub an die Auswertung weiter. Ändern ersetzt den Adresseintrag (kein neuer Verlaufseintrag).
 */
export function useSubParam(): [string, (id: string) => void] {
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const sub = params.get("sub") ?? "";
  const set = (id: string) => {
    const p = new URLSearchParams(params.toString());
    if (id) p.set("sub", id); else p.delete("sub");
    router.replace(`${path}${p.size ? "?" + p : ""}`, { scroll: false });
  };
  return [sub, set];
}
