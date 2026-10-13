import { useSavedArticles, type SavedArticle } from "../lib/savedArticles";
import { IconBell } from "./icons";

/** Fester Hinweis, solange es keine E-Mail-Benachrichtigungen gibt (Thema 2): Schalter sichtbar, aber ohne Wirkung */
export const NOTIFY_LATER = "Folgt mit den E-Mail-Benachrichtigungen";

/** Glocke: bei Neuigkeiten zu diesem Vorgang benachrichtigen. In dieser Phase deaktiviert; eine schon vorgemerkte
 *  Benachrichtigung (aus der Übernahme) bleibt sichtbar. */
export function FollowButton({ article, size = 20, className = "", label = false }: { article: Pick<SavedArticle, "id">; size?: number; className?: string; /** Beschriftung neben dem Symbol (am Desktop) */ label?: boolean }) {
  const hit = useSavedArticles().find((a) => a.id === article.id);
  const on = !!hit?.follow;
  const text = `Benachrichtigung zu diesem Vorgang: ${NOTIFY_LATER}`;
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-pressed={on}
      title={text}
      aria-label={text}
      onClick={(e) => e.stopPropagation()}
      className={`${label ? "inline-flex items-center gap-1.5 px-2" : "grid w-9 place-items-center"} h-9 max-sm:h-11 max-sm:min-w-11 flex-none cursor-default rounded-lg text-slate-400 ${className}`}
    >
      <IconBell size={size} filled={on} />
      {label && <span className="hidden text-[14px] sm:inline">{on ? "Vorgemerkt" : "Folgen"}</span>}
    </button>
  );
}
