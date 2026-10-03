import { openGate, type GateFeature } from "../components/GateDialog";
import { useAccount } from "../state/account";
import { useSavedArticles } from "./savedArticles";
import { useTier, type Tier } from "./tier";

/**
 * Stufe plus aktuelle Nutzung. `allow(feature)` prüft, ob noch ein weiteres Element
 * angelegt werden darf, und öffnet sonst den passenden Hinweis (Registrieren bzw. Upgrade).
 */
export function useEntitlements() {
  const { tier, limits } = useTier();
  const { saved } = useAccount();
  const articles = useSavedArticles();
  const used = {
    bookmarks: articles.length,
    searches: saved.length,
    /* Aktiv = Glocke an einem Artikel oder E-Mail-Schalter an einer gespeicherten Suche */
    notifications: articles.filter((a) => a.follow).length + saved.filter((s) => s.notify?.mail).length,
  };
  const max = { bookmarks: limits.bookmarks, searches: limits.savedSearches, notifications: limits.notifications };

  /** Nächsthöhere Stufe, die die Funktion freischaltet */
  const needs = (feature: GateFeature): Tier => (tier === "guest" ? "basic" : feature === "emails" ? "enterprise" : "pro");

  const allow = (feature: "bookmarks" | "searches" | "notifications"): boolean => {
    if (used[feature] < max[feature]) return true;
    openGate({ feature, needs: needs(feature) });
    return false;
  };

  /** Funktion ohne Mengenbegrenzung (Filter, weitere Trefferseiten) */
  const allowFeature = (feature: "filters" | "results", total?: number): boolean => {
    const ok = feature === "filters" ? limits.filters : !Number.isFinite(limits.maxResults);
    if (ok) return true;
    openGate({ feature, needs: "basic", total });
    return false;
  };

  return { tier, limits, used, max, allow, allowFeature };
}
