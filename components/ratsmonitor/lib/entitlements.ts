import { openGate, type GateFeature } from "../components/GateDialog";
import { useAccount } from "../state/account";
import { useMe } from "./account";
import { useSavedArticles } from "./savedArticles";
import { type Tier } from "./tier";

/**
 * Stufe plus aktuelle Nutzung. `allow(feature)` prüft, ob noch ein weiteres Element
 * angelegt werden darf, und öffnet sonst den passenden Hinweis (Anmelden bzw. Stufe).
 * Solange /api/me nicht beantwortet ist (ready false), öffnet nichts einen Hinweis: die Aktion wartet einfach.
 * Der Server prüft die Grenzen selbst; das hier erspart nur den vergeblichen Versuch.
 */
export function useEntitlements() {
  const me = useMe();
  const { tier, limits, ready } = me;
  const { saved } = useAccount();
  const articles = useSavedArticles();
  /* Nur aktive Einträge zählen (über der Grenze gespeicherte sind inaktiv) */
  const activeSaved = saved.filter((s) => s.active !== false);
  const activeArticles = articles.filter((a) => a.active !== false);
  const used = {
    bookmarks: activeArticles.length,
    searches: activeSaved.length,
    /* Aktiv = Glocke an einem Artikel oder E-Mail-Schalter an einer gespeicherten Suche */
    notifications: activeArticles.filter((a) => a.follow).length + activeSaved.filter((s) => s.notify?.mail).length,
  };
  const max = { bookmarks: limits.bookmarks, searches: limits.savedSearches, notifications: limits.notifications };

  /** Nächsthöhere Stufe, die die Funktion freischaltet */
  const needs = (feature: GateFeature): Tier => (tier === "guest" ? "basic" : feature === "emails" ? "enterprise" : "pro");

  const allow = (feature: "bookmarks" | "searches" | "notifications"): boolean => {
    if (!ready) return false;
    if (used[feature] < max[feature]) return true;
    openGate({ feature, needs: needs(feature) });
    return false;
  };

  /** Funktion ohne Mengenbegrenzung (Filter, weitere Trefferseiten) */
  const allowFeature = (feature: "filters" | "results", total?: number): boolean => {
    const ok = feature === "filters" ? limits.filters : !Number.isFinite(limits.maxResults);
    if (ok) return true;
    if (!ready) return false;
    openGate({ feature, needs: tier === "guest" ? "basic" : "pro", total });
    return false;
  };

  return { tier, limits, ready, signedIn: !!me.user, used, max, allow, allowFeature };
}
