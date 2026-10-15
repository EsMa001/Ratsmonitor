import { useEffect, useState } from "react";
import { PageHead } from "../info/blocks";
import { api } from "../lib/account";
import { IS_DEV } from "../lib/tier";

type DevMail = { id: string | number; at: string; to: string; subject: string; text: string; html?: string | null };

/** Nur Entwicklung: Postausgang des Dev-Servers (GET /api/dev/mails, MAIL_TRANSPORT=outbox). HTML nur im abgeschotteten Rahmen. */
export function PostfachPage() {
  const [mails, setMails] = useState<{ list: DevMail[]; error: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!IS_DEV) return;
    let live = true;
    api<{ mails?: DevMail[] }>("/api/dev/mails").then(
      (d) => live && setMails({ list: d.mails ?? [], error: "" }),
      (e: Error) => live && setMails({ list: [], error: e.message }),
    );
    return () => {
      live = false;
    };
  }, [tick]);
  if (!IS_DEV) return null;
  return (
    <>
      <PageHead icon="mail" label="Konto" name="Dev-Postfach" title="Dev-Postfach" lead="Nur in der Entwicklung: E-Mails, die der Dev-Server statt eines Versands ablegt (Anmeldung, Codes, Hinweise)." />
      <section className="ri-sec ri-sec--tight">
        <button type="button" onClick={() => setTick((t) => t + 1)} className="mb-6 text-[14px] text-teal-700 hover:underline">
          Neu laden →
        </button>
        {!mails && <p role="status" className="text-slate-500">E-Mails werden geladen …</p>}
        {mails?.error && <p role="alert" className="text-rose-700">{mails.error}</p>}
        {mails && !mails.error && !mails.list.length && <p className="text-slate-500">Noch keine E-Mails. Fordern Sie unter „Anmelden“ einen Link an.</p>}
        {mails && mails.list.length > 0 && (
          <ul className="m-0 list-none p-0">
            {mails.list.map((m) => {
              const id = String(m.id);
              return (
                <li key={id} className="border-b border-slate-200 last:border-b-0">
                  <button type="button" onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id} className="flex w-full items-baseline gap-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-slate-900">{m.subject}</span>
                      <span className="block text-[14px] text-slate-500">an {m.to}</span>
                    </span>
                    <span className="flex-none text-[12px] text-slate-500">{new Date(m.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
                  </button>
                  {open === id &&
                    (m.html ? (
                      /* Ohne allow-scripts und allow-same-origin: das HTML der Mail läuft abgeschottet */
                      <iframe title={`E-Mail: ${m.subject}`} sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={m.html} className="mb-6 h-[560px] w-full rounded-lg border border-slate-200 bg-white" />
                    ) : (
                      <p className="m-0 whitespace-pre-line pb-4 text-[14px] leading-relaxed text-slate-600">{m.text}</p>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
