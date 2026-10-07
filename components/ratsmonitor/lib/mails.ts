import { brandName } from "./brand";
import { sendTestMail } from "./testAuth";

/**
 * E-Mail-Vorlagen. Links stehen hinter Knöpfen und Titeln, im Text ist keine Adresse zu sehen.
 * Im Testmodus landen die Mails im Test-Postfach; `text` ist die reine Textfassung.
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const url = (path: string) => (typeof location === "undefined" ? path : location.origin + path);
const de = (iso: string) => new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

export interface MailItem {
  id: string;
  title: string;
  date: string;
  gemeinde: string;
  note?: string;
}

const P = 'style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#0f172a"';
export const p = (t: string) => `<p ${P}>${t}</p>`;
export const h = (t: string) => `<p style="margin:24px 0 6px;font-size:18px;font-weight:600;color:#0f172a">${t}</p>`;
export const button = (label: string, path: string) =>
  `<p style="margin:20px 0 24px"><a href="${esc(url(path))}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 20px;border-radius:999px">${esc(label)} →</a></p>`;
export const more = (label: string, path: string) => `<p style="margin:8px 0 0"><a href="${esc(url(path))}" style="color:#0d9488;text-decoration:none;font-size:14px">${esc(label)} →</a></p>`;
/** Artikelliste: Titel verlinkt, darunter Ort und Datum (und optional ein Hinweis) */
export const items = (list: MailItem[]) =>
  list
    .map(
      (a) =>
        `<div style="padding:12px 0;border-top:1px solid #e2e8f0"><a href="${esc(url("/beschluss/" + a.id))}" style="color:#0f172a;text-decoration:none;font-size:16px;font-weight:600;line-height:1.4">${esc(a.title)}</a><div style="margin-top:2px;font-size:14px;color:#64748b">${esc(a.gemeinde)} · ${de(a.date)}${a.note ? ` · <span style="color:#0d9488">${esc(a.note)}</span>` : ""}</div></div>`,
    )
    .join("");

function layout(body: string, why: string) {
  return `<div style="font-family:'IBM Plex Sans',Segoe UI,system-ui,sans-serif;max-width:560px;color:#0f172a">
<p style="margin:0 0 24px;font-size:18px;font-weight:600">${esc(brandName())}</p>
${body}
<p style="margin:32px 0 0;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">${why} <a href="${esc(url("/konto/profil"))}" style="color:#64748b">Benachrichtigungen verwalten</a></p>
</div>`;
}
const toText = (html: string) =>
  html
    .replace(/<\/(p|div)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function sendMail(to: string, subject: string, body: string, why: string) {
  const html = layout(body, why);
  sendTestMail(to, subject, toText(html), html);
}

/* ---------- Die einzelnen Mails ---------- */

export const welcomeMail = (to: string, name: string) =>
  sendMail(
    to,
    `Willkommen bei ${brandName()}`,
    p(`Guten Tag ${esc(name)},`) +
      p(`schön, dass Sie dabei sind. Bitte bestätigen Sie kurz Ihre E-Mail-Adresse.`) +
      button("E-Mail-Adresse bestätigen", "/konto/profil") +
      h("So holen Sie das Meiste heraus") +
      p(`<b>Suche speichern:</b> Thema und Ort eingeben, auf das Herz tippen. Neue Beschlüsse kommen dann automatisch zu Ihnen.`) +
      p(`<b>Vorgänge folgen:</b> Bei einem Artikel auf „Folgen“ tippen. Sie hören von uns, sobald es weitergeht.`) +
      p(`<b>Kalender abonnieren:</b> Anstehende Sitzungen erscheinen direkt in Ihrem Kalender.`) +
      button("Erste Suche starten", "/"),
    "Sie erhalten diese E-Mail, weil Sie sich gerade registriert haben.",
  );

export const resetMail = (to: string, name: string, hint: string) =>
  sendMail(
    to,
    "Ihr neues Passwort",
    p(`Guten Tag ${esc(name)},`) +
      p(`Sie haben ein neues Passwort angefordert. Der Link ist 60 Minuten gültig.`) +
      button("Neues Passwort festlegen", "/anmelden") +
      p(`<span style="color:#64748b;font-size:14px">Sie haben das nicht angefordert? Dann ignorieren Sie diese E-Mail, Ihr Passwort bleibt unverändert. ${esc(hint)}</span>`),
    "Sie erhalten diese E-Mail aus Sicherheitsgründen.",
  );

/** Link auf die Suche mit allen gespeicherten Einstellungen (ohne gespeicherte Suche: nur der Suchbegriff) */
const searchLink = (s: { id?: string; text?: string }) => (s.id ? `/?suche=${encodeURIComponent(s.id)}` : `/?q=${encodeURIComponent(s.text ?? "")}`);

export interface DigestPart {
  id: string;
  name: string;
  total: number;
  top: MailItem[];
}
export const digestMail = (to: string, from: string, till: string, parts: DigestPart[], weekday = "Montag") => {
  const sum = parts.reduce((n, s) => n + s.total, 0);
  sendMail(
    to,
    sum ? `${sum} neue Beschlüsse in Ihren Suchen` : "Ihr Wochenbericht: diese Woche ruhig",
    p("Guten Morgen,") +
      p(sum ? `seit ${de(from)} gibt es Neues in Ihren gespeicherten Suchen. Hier das Wichtigste auf einen Blick.` : `seit ${de(from)} gab es keine neuen Beschlüsse zu Ihren Suchen. Wir melden uns, sobald sich etwas tut.`) +
      parts
        .filter((s) => s.total)
        .map((s) => h(`${esc(s.name)} <span style="font-weight:400;color:#64748b">· ${s.total} neu</span>`) + items(s.top) + (s.total > s.top.length ? more(`Alle ${s.total} Treffer ansehen`, searchLink(s)) : ""))
        .join("") +
      button("Zu Ihren Suchen", "/konto/suchen"),
    `Wochenbericht ${de(from)} bis ${de(till)}. Sie erhalten ihn ${weekday === "Täglich" ? "jeden Tag" : `jeden ${weekday}`}, weil Sie ihn aktiviert haben.`,
  );
};

export const alertMail = (to: string, search: { id?: string; name: string; text?: string }, list: MailItem[]) =>
  sendMail(
    to,
    `Neu zu „${search.name}“: ${list[0]?.title ?? ""}`,
    p(`Zu Ihrer Suche <b>${esc(search.name)}</b> ${list.length === 1 ? "gibt es einen neuen Beschluss" : `gibt es ${list.length} neue Beschlüsse`}.`) + items(list) + button("Alle Treffer ansehen", searchLink(search)),
    `Sie erhalten diese E-Mail, weil Sie für „${esc(search.name)}“ Sofort-Benachrichtigungen aktiviert haben.`,
  );

export const followMail = (to: string, a: MailItem, change: string) =>
  sendMail(
    to,
    `${change}: ${a.title}`,
    p(`Ein Vorgang, dem Sie folgen, hat sich weiterentwickelt: <b>${esc(change)}</b>.`) + items([a]) + button("Vorgang ansehen", "/beschluss/" + a.id),
    "Sie erhalten diese E-Mail, weil Sie diesem Vorgang folgen.",
  );

export const reminderMail = (to: string, when: string, list: MailItem[]) =>
  sendMail(
    to,
    `${when}: ${list.length === 1 ? "eine Sitzung" : `${list.length} Sitzungen`} zu Ihren Themen`,
    p(`${esc(when)} wird über diese Themen beraten, die Sie gespeichert haben oder denen Sie folgen:`) + items(list) + button("Zum Kalender", "/konto/kalender"),
    "Sie erhalten diese Erinnerung, weil Sie Sitzungserinnerungen aktiviert haben.",
  );
