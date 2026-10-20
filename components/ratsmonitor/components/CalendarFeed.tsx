import { useEffect, useState } from "react";
import { api, shortDate, useMe } from "../lib/account";
import { copyText } from "../lib/clipboard";
import { useToast } from "../state/toast";
import { confirmDialog } from "./ConfirmDialog";

type Feed = { active: boolean; since: string | null; allowed: boolean };

/**
 * Kalender-Abo per Link (GET/POST/DELETE /api/me/calendar-feed). Kalender-Apps schicken kein Cookie, deshalb trägt der
 * Link ein Token. Den Link zeigt der Server nur beim Erzeugen; ein neuer Link macht den alten ungültig.
 * Die Gebiete kommen aus den Kalendereinstellungen des Kontos (calendarAgs).
 */
export function CalendarFeed({ compact = false }: { compact?: boolean }) {
  const me = useMe();
  const toast = useToast();
  const key = me.user ? `${me.user.id}:${me.rev}` : "";
  const [feed, setFeed] = useState<{ key: string; data: Feed | null; error: string }>({ key: "", data: null, error: "" });
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!key) return;
    let live = true;
    api<Feed>("/api/me/calendar-feed").then(
      (d) => live && setFeed({ key, data: d, error: "" }),
      (e: Error) => live && setFeed({ key, data: null, error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const data = feed.key === key ? feed.data : null;
  if (!key || (data && !data.allowed)) return null;

  const create = async () => {
    if (data?.active && !(await confirmDialog({ title: "Neuen Abo-Link erzeugen?", text: "Der bisherige Link hört dann auf zu funktionieren. Kalender-Apps, die ihn nutzen, brauchen den neuen Link.", confirmLabel: "Neuen Link erzeugen" }))) return;
    setBusy(true);
    try {
      const r = await api<{ url: string }>("/api/me/calendar-feed", { method: "POST" });
      setUrl(r.url);
      setFeed({ key, data: { active: true, since: new Date().toISOString(), allowed: true }, error: "" });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    if (!(await confirmDialog({ title: "Kalender-Abo beenden?", text: "Der Link funktioniert danach nicht mehr. Ihre Kalender-App zeigt keine neuen Termine mehr.", confirmLabel: "Abo beenden" }))) return;
    setBusy(true);
    try {
      await api("/api/me/calendar-feed", { method: "DELETE" });
      setUrl("");
      setFeed({ key, data: { active: false, since: null, allowed: true }, error: "" });
      toast("Kalender-Abo beendet.");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const webcal = url.replace(/^https?:\/\//, "webcal://");
  const link = "text-[14px] font-medium text-teal-700 hover:underline disabled:opacity-50";

  return (
    <div className={compact ? "" : "mt-4"}>
      {!data && !feed.error && <p className="m-0 text-[14px] text-slate-500">Abo wird geladen …</p>}
      {feed.error && <p role="alert" className="m-0 text-[14px] text-amber-700">{feed.error}</p>}
      {data && (
        <>
          <p className="m-0 text-[14px] text-slate-500" role="status">
            {data.active ? `Abo aktiv seit ${shortDate(data.since)}.` : "Noch kein Abo eingerichtet."}
          </p>
          {url && (
            <div className="mt-3">
              <label htmlFor="cal-feed-url" className="block text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                Abo-Link
              </label>
              <input id="cal-feed-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="mt-1 h-11 w-full rounded-[10px] border border-slate-200 bg-white px-3 text-[14px] text-slate-900 max-sm:text-[16px]" />
              <p className="m-0 mt-1 text-[12px] text-slate-500">Der Link wird nur jetzt angezeigt. Geben Sie ihn nicht weiter: Wer ihn kennt, sieht die Termine Ihrer Gebiete.</p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                <button type="button" className={link} onClick={() => void copyText(url).then((ok) => toast(ok ? "Abo-Link kopiert." : "Kopieren nicht möglich. Bitte den Link markieren und kopieren."))}>
                  Link kopieren →
                </button>
                <a href={webcal} className={`${link} no-underline`}>
                  In Kalender-App öffnen →
                </a>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" disabled={busy} onClick={() => void create()} className={data.active ? link : "inline-flex h-11 items-center gap-2 rounded-full bg-teal-700 px-5 text-[14px] font-medium text-white hover:opacity-85 disabled:opacity-50"}>
              {data.active ? "Neuen Link erzeugen →" : "Abo-Link erzeugen →"}
            </button>
            {data.active && (
              <button type="button" disabled={busy} onClick={() => void stop()} className="text-[14px] text-amber-700 underline underline-offset-2 disabled:opacity-50">
                Abo beenden
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
