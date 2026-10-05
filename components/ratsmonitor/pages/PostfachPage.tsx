import { useEffect, useState } from "react";
import { PageHead } from "../info/blocks";
import { alertMail, followMail, reminderMail, type MailItem } from "../lib/mails";
import { useSavedArticles } from "../lib/savedArticles";
import { deleteMails, markMailsRead, useTestMails } from "../lib/testAuth";
import { useAccount } from "../state/account";
import { readProfile } from "./ProfilePage";

/** Test-Postfach: E-Mails, die im echten Betrieb verschickt würden (Registrierung, Passwort, Benachrichtigungen) */
export function PostfachPage() {
  const mails = useTestMails();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = useSavedArticles();
  const { saved: savedSearches } = useAccount();
  /* Beispiele der Benachrichtigungen mit echten Daten: neuer Treffer, Fortschritt eines Vorgangs, Sitzungserinnerung */
  const samples = async () => {
    setBusy(true);
    const to = readProfile().email || "Ihre Adresse";
    const today = new Date().toISOString().slice(0, 10);
    const get = async (q: Record<string, string>) => {
      try {
        const r = (await (await fetch("/api/search?" + new URLSearchParams({ q: "", area: "", scope: "only", level: "city", page: "1", ...q }))).json()) as { articles?: MailItem[] };
        return r.articles ?? [];
      } catch {
        return [];
      }
    };
    /* Treffer-Mail zur ersten gespeicherten Suche, sonst zum Beispiel „Radweg“ */
    const sv = savedSearches[0];
    const news = await get(sv ? { q: sv.text || "", area: sv.area || "", scope: sv.scope || "only", label: sv.thema || "", status: sv.status || "", level: sv.level || "city", sort: "desc" } : { q: "Radweg", sort: "desc", to: today });
    if (news.length) alertMail(to, sv ? { id: sv.id, name: sv.name } : { name: "Radweg", text: "Radweg" }, news.slice(0, 2));
    const followed = saved.find((a) => a.follow) ?? saved[0] ?? news[2];
    if (followed) followMail(to, { ...followed, note: "Beschlossen" }, "Beschlossen");
    const soon = await get({ sort: "asc", from: today });
    if (soon.length) {
      const d = soon[0].date;
      const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      reminderMail(to, d === today ? "Heute" : d === tomorrow ? "Morgen" : `Am ${d.slice(8, 10)}.${d.slice(5, 7)}.`, soon.filter((a) => a.date === d).slice(0, 3));
    }
    setBusy(false);
  };
  /* Beim Öffnen der Seite alles als gelesen markieren (Zähler im Kontomenü) */
  useEffect(() => {
    if (mails.some((m) => !m.read)) markMailsRead();
  }, [mails]);
  return (
    <>
      <PageHead icon="mail" label="Konto" name="Test-Postfach" title="Test-Postfach" lead="Hier landen alle E-Mails, die im echten Betrieb verschickt würden. Es wird nichts versendet." />
      <section className="ri-sec ri-sec--tight">
        <button type="button" disabled={busy} onClick={samples} className="mb-6 text-[14px] text-teal-600 hover:underline disabled:opacity-50">
          {busy ? "Wird erstellt …" : "Beispiel-Benachrichtigungen erzeugen →"}
        </button>
        {!mails.length ? (
          <p className="text-slate-500">Noch keine E-Mails. Registrieren Sie ein Testkonto oder nutzen Sie „Passwort vergessen?“.</p>
        ) : (
          <>
            <ul className="m-0 list-none p-0">
              {mails.map((m) => (
                <li key={m.id} className="border-b border-slate-200 last:border-b-0">
                  <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id} className="flex w-full items-baseline gap-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold text-slate-900">{m.subject}</span>
                      <span className="block text-[14px] text-slate-500">an {m.to}</span>
                    </span>
                    <span className="flex-none text-[12px] text-slate-500">{new Date(m.date).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
                  </button>
                  {open === m.id && (m.html ? <div className="pb-6 pt-2" dangerouslySetInnerHTML={{ __html: m.html }} /> : <p className="m-0 whitespace-pre-line pb-4 text-[14px] leading-relaxed text-slate-600">{m.body}</p>)}
                </li>
              ))}
            </ul>
            <button type="button" onClick={deleteMails} className="mt-6 text-[14px] text-teal-600 hover:underline">
              Postfach leeren
            </button>
          </>
        )}
      </section>
    </>
  );
}
