import { useEntitlements } from "../lib/entitlements";
import { setArticleFollow, useSavedArticles, type SavedArticle } from "../lib/savedArticles";
import { useToast } from "../state/toast";
import { IconBell } from "./icons";

/** Glocke: per E-Mail benachrichtigen, sobald der Vorgang eine neue Sitzung oder einen neuen Stand bekommt (sofort).
 *  Ein noch nicht gemerkter Vorgang wird dabei gemerkt; die Glocke zählt zur Grenze „Benachrichtigungen“ der Stufe. */
export function FollowButton({ article, size = 20, className = "", label = false }: { article: Omit<SavedArticle, "savedAt">; size?: number; className?: string; /** Beschriftung neben dem Symbol (am Desktop) */ label?: boolean }) {
  const hit = useSavedArticles().find((a) => a.id === article.id);
  const on = !!hit?.follow;
  const { allow, limits } = useEntitlements();
  const toast = useToast();
  const text = on ? "Benachrichtigung zu diesem Vorgang ausschalten" : "Bei Neuigkeiten zu diesem Vorgang per E-Mail benachrichtigen";
  return (
    <button
      type="button"
      aria-pressed={on}
      title={text}
      aria-label={text}
      onClick={(e) => {
        e.stopPropagation();
        /* Ausschalten geht immer; einschalten nur innerhalb der Grenzen (der Server prüft sie noch einmal) */
        if (!on && (!allow("notifications") || (!hit && !allow("bookmarks")))) return;
        void setArticleFollow(article, !on).then((err) => {
          if (err) toast(err);
          else toast(on ? "Benachrichtigung ausgeschaltet." : limits.instant ? "Sie bekommen eine E-Mail, sobald sich an diesem Vorgang etwas tut." : "Sie bekommen eine E-Mail am Morgen nach jeder Neuigkeit zu diesem Vorgang.");
        });
      }}
      className={`${label ? "inline-flex items-center gap-1.5 px-2" : "grid w-9 place-items-center"} h-9 max-sm:h-11 max-sm:min-w-11 flex-none rounded-lg transition-colors ${on ? "text-teal-700" : "text-teal-700 hover:bg-teal-50 hover:text-teal-800"} ${className}`}
    >
      <IconBell size={size} filled={on} />
      {label && <span className="hidden text-[14px] sm:inline">{on ? "Folge ich" : "Folgen"}</span>}
    </button>
  );
}
