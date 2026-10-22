// Vorlagen der Kontomails (requirements/konten-konzept.md, Abschnitt 10). Text plus schlichtes HTML, keine externen
// Bilder, kein Zählpixel, Betreff ohne persönliche Angaben. Eingesetzte Werte werden in html`…` immer maskiert.
const ESC={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>ESC[c]);
class Raw{constructor(text){this.text=text;}}
const raw=text=>new Raw(text);
/** Tagged Template: jeder eingesetzte Wert wird maskiert, außer er ist selbst schon html`…` */
export function html(strings,...values){
 let out=strings[0];
 values.forEach((v,i)=>{out+=(v instanceof Raw?v.text:Array.isArray(v)?v.map(x=>x instanceof Raw?x.text:escapeHtml(x)).join(''):escapeHtml(v))+strings[i+1];});
 return raw(out);
}
const SLOGAN='Besser verstehen, was vor Ort beraten wird.';
const IGNORE='Nicht angefordert? Dann ignorieren Sie diese E-Mail.';
const groupCode=code=>String(code).replace(/^(\d{4})(\d{4})$/,'$1 $2');
function page(title,body){
 return html`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
<p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#0f5e66">Plenara</p>
${body}
<p style="margin:28px 0 0;font-size:12px;color:#6b7280">${SLOGAN}</p>
</div></body></html>`.text;
}
const button=(href,label)=>html`<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#0f5e66;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${label}</a></p>`;
const codeBox=code=>html`<p style="margin:16px 0;font-size:28px;letter-spacing:4px;font-weight:bold">${groupCode(code)}</p>`;
const p=text=>html`<p style="margin:0 0 12px;line-height:1.5">${text}</p>`;

/** Jede Vorlage: (data, {site}) → {subject, text, html} */
const T={
 login:({link,code},{site})=>({
  subject:'Ihr Anmeldelink für Plenara',
  text:`Anmelden bei Plenara:\n${link}\n\nOder diesen Code eingeben: ${groupCode(code)}\n\nAuf einem anderen Gerät? Geben Sie dort den Code ein, statt den Link zu öffnen.\nGeben Sie den Code nur auf ${site} ein und nennen Sie ihn niemandem.\nLink und Code gelten 15 Minuten und nur einmal. Es gilt nur die neueste E-Mail.\n\n${IGNORE}`,
  html:page('Anmelden',[p('Mit diesem Link melden Sie sich bei Plenara an:'),button(link,'Jetzt anmelden'),p('Oder geben Sie diesen Code ein:'),codeBox(code),
   p('Auf einem anderen Gerät? Geben Sie dort den Code ein, statt den Link zu öffnen.'),p(`Geben Sie den Code nur auf ${site} ein und nennen Sie ihn niemandem. Link und Code gelten 15 Minuten und nur einmal. Es gilt nur die neueste E-Mail.`),p(IGNORE)]),
 }),
 signup:({link,code},{site})=>({
  subject:'Ihr Zugang zu Plenara',
  text:`Konto bei Plenara anlegen:\n${link}\n\nOder diesen Code eingeben: ${groupCode(code)}\n\nAuf einem anderen Gerät? Geben Sie dort den Code ein.\nGeben Sie den Code nur auf ${site} ein und nennen Sie ihn niemandem.\nLink und Code gelten 15 Minuten und nur einmal.\n\n${IGNORE}`,
  html:page('Konto anlegen',[p('Mit diesem Link legen Sie Ihr Konto bei Plenara an:'),button(link,'Konto anlegen'),p('Oder geben Sie diesen Code ein:'),codeBox(code),
   p(`Geben Sie den Code nur auf ${site} ein und nennen Sie ihn niemandem. Link und Code gelten 15 Minuten und nur einmal.`),p(IGNORE)]),
 }),
 welcome:({tier,until},{site})=>({
  subject:'Willkommen bei Plenara',
  text:`Ihr Konto bei Plenara ist angelegt.${tier?`\nStufe: ${tier}${until?` bis ${until.slice(0,10)}`:''}.`:''}\nAnmelden: ${site}/anmelden\nKonto, Daten und Löschen: ${site}/konto/profil`,
  html:page('Willkommen',[p('Ihr Konto bei Plenara ist angelegt.'),tier?p(`Stufe: ${tier}${until?` bis ${until.slice(0,10)}`:''}.`):'',button(site+'/konto/profil','Zum Konto'),p('Dort können Sie Ihre Daten ansehen, herunterladen und das Konto löschen.')]),
 }),
 code_locked:(_d,{site})=>({
  subject:'Anmeldung mit Code vorübergehend gesperrt',
  text:`Für Ihr Konto wurde der Anmeldecode zu oft falsch eingegeben. Für 24 Stunden geht die Anmeldung nur über den Link in der E-Mail.\nWaren Sie das nicht? Dann ändern Sie nichts; ohne Zugriff auf Ihr Postfach kann sich niemand anmelden.\n${site}`,
  html:page('Code gesperrt',[p('Für Ihr Konto wurde der Anmeldecode zu oft falsch eingegeben. Für 24 Stunden geht die Anmeldung nur über den Link in der E-Mail.'),p('Waren Sie das nicht? Ohne Zugriff auf Ihr Postfach kann sich niemand anmelden.')]),
 }),
 delete_code:({code})=>({
  subject:'Code zum Löschen Ihres Kontos',
  text:`Code zum Löschen Ihres Plenara-Kontos: ${groupCode(code)}\nEr gilt 15 Minuten. Mit dem Löschen werden alle gespeicherten Suchen, Artikel und Einstellungen entfernt.\n\n${IGNORE}`,
  html:page('Konto löschen',[p('Code zum Löschen Ihres Plenara-Kontos:'),codeBox(code),p('Er gilt 15 Minuten. Mit dem Löschen werden alle gespeicherten Suchen, Artikel und Einstellungen entfernt.'),p(IGNORE)]),
 }),
 deleted:()=>({
  subject:'Ihr Konto wurde gelöscht',
  text:'Ihr Plenara-Konto und alle gespeicherten Daten wurden gelöscht. Diese Adresse speichern wir nicht weiter.',
  html:page('Konto gelöscht',[p('Ihr Plenara-Konto und alle gespeicherten Daten wurden gelöscht. Diese Adresse speichern wir nicht weiter.')]),
 }),
 export_code:({code})=>({
  subject:'Code für Ihre Datenauskunft',
  text:`Code für den Download Ihrer Daten bei Plenara: ${groupCode(code)}\nEr gilt 15 Minuten.\n\n${IGNORE}`,
  html:page('Datenauskunft',[p('Code für den Download Ihrer Daten bei Plenara:'),codeBox(code),p('Er gilt 15 Minuten.'),p(IGNORE)]),
 }),
 exported:(_d,{site})=>({
  subject:'Ihre Daten wurden heruntergeladen',
  text:`Soeben wurden die Daten Ihres Plenara-Kontos heruntergeladen.\nWaren Sie das nicht? Melden Sie sich unter ${site}/konto/profil an und beenden Sie alle Sitzungen.`,
  html:page('Datenauskunft',[p('Soeben wurden die Daten Ihres Plenara-Kontos heruntergeladen.'),p('Waren Sie das nicht? Melden Sie sich an und beenden Sie alle Sitzungen.'),button(site+'/konto/profil','Zum Konto')]),
 }),
 invite:({days},{site})=>({
  subject:'Einladung zur Testphase von Plenara',
  text:`Sie sind zur geschlossenen Testphase von Plenara eingeladen, wie mit Ihnen vereinbart.\nAnmelden: ${site}/anmelden\nSie bekommen dort einen Link oder Code per E-Mail, kein Passwort.\nDie Einladung gilt ${days} Tage. Ihre Adresse haben wir aus unserem Austausch mit Ihnen; Hinweise zum Datenschutz: ${site}/datenschutz`,
  html:page('Einladung',[p('Sie sind zur geschlossenen Testphase von Plenara eingeladen, wie mit Ihnen vereinbart.'),button(site+'/anmelden','Anmelden'),p('Sie bekommen dort einen Link oder Code per E-Mail, kein Passwort.'),p(`Die Einladung gilt ${days} Tage. Ihre Adresse haben wir aus unserem Austausch mit Ihnen.`),html`<p style="margin:0 0 12px"><a href="${site}/datenschutz">Hinweise zum Datenschutz</a></p>`]),
 }),
 tier_ending:({tier,until},{site})=>({
  subject:'Ihr Testzugang endet bald',
  text:`Ihr Testzugang ${tier} bei Plenara endet am ${String(until).slice(0,10)}. Danach bleibt Ihr Konto bestehen, mit den Rechten ohne Stufe. Konto: ${site}/konto/profil`,
  html:page('Testzugang',[p(`Ihr Testzugang ${tier} bei Plenara endet am ${String(until).slice(0,10)}.`),p('Danach bleibt Ihr Konto bestehen, mit den Rechten ohne Stufe. Sie können es jederzeit löschen.'),button(site+'/konto/profil','Zum Konto')]),
 }),
 inactive:(_d,{site})=>({
  subject:'Ihr Plenara-Konto wird bald gelöscht',
  text:`Ihr Plenara-Konto wurde seit zwei Jahren nicht genutzt. Melden Sie sich in den nächsten 30 Tagen unter ${site}/anmelden an, wenn Sie es behalten möchten; sonst löschen wir es mit allen gespeicherten Daten.`,
  html:page('Konto nicht genutzt',[p('Ihr Plenara-Konto wurde seit zwei Jahren nicht genutzt.'),p('Melden Sie sich in den nächsten 30 Tagen an, wenn Sie es behalten möchten; sonst löschen wir es mit allen gespeicherten Daten.'),button(site+'/anmelden','Anmelden')]),
 }),
 operator:({message})=>({
  subject:'Plenara: Hinweis aus dem Kontobetrieb',
  text:String(message||''),
  html:page('Hinweis',[p(String(message||''))]),
 }),
 /* Betriebsüberwachung (server/integrations/operator-notify.mjs): Fehlermail einer systemd-Einheit, tägliche Sammelmail.
    Der Text ist vorformatiert (Protokollzeilen) und wird im HTML als pre gesetzt, maskiert wie alles andere */
 ops:({subject,message})=>({
  subject:'Plenara Betrieb: '+String(subject||'Hinweis'),
  text:String(message||''),
  html:page('Betrieb',[html`<p style="margin:0 0 12px;font-weight:bold">${String(subject||'Hinweis')}</p>`,
   html`<pre style="margin:0;white-space:pre-wrap;font:13px/1.4 Consolas,Menlo,monospace">${String(message||'')}</pre>`]),
 }),
};
export function render(template,data,{site}){
 const fn=T[template];
 if(!fn)throw new Error('Unbekannte Mailvorlage: '+template);
 return fn(data||{},{site});
}
