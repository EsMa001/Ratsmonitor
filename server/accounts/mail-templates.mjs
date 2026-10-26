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
/** Abbestellen der Zahlungsmails: Link auf /abbestellen (Token im Fragment) und Ein-Klick nach RFC 8058; ohne Token nichts */
function billingOff(token,site){
 if(!token)return {text:'',html:'',headers:undefined};
 const off=`${site}/abbestellen#t=${encodeURIComponent(token)}`;
 return {text:`\nMails zu Zahlungen und zum Ende von Plus abbestellen: ${off}`,
  html:html`<p style="margin:20px 0 0;font-size:13px"><a href="${off}" style="color:#6b7280">Mails zu Zahlungen und zum Ende von Plus abbestellen</a></p>`,
  headers:{'List-Unsubscribe':`<${site}/api/notify/unsubscribe?t=${encodeURIComponent(token)}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
/** „2026-10-26T20:15:00Z“ → „26.10.2026 um 21:15 Uhr“ (deutsche Zeit) */
const deTime=at=>{
 const d=new Date(at);
 if(Number.isNaN(d.getTime()))return '';
 const f=o=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',...o}).format(d);
 return `${f({day:'2-digit',month:'2-digit',year:'numeric'})} um ${f({hour:'2-digit',minute:'2-digit'})} Uhr`;
};

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
  text:`Ihr Testzugang ${tier} bei Plenara endet am ${deDate(until)}. Danach bleibt Ihr Konto bestehen, mit den Rechten des kostenlosen Kontos. Konto: ${site}/konto/profil`,
  html:page('Testzugang',[p(`Ihr Testzugang ${tier} bei Plenara endet am ${deDate(until)}.`),p('Danach bleibt Ihr Konto bestehen, mit den Rechten des kostenlosen Kontos. Sie können es jederzeit löschen.'),button(site+'/konto/profil','Zum Konto')]),
 }),
 /* Bezahlung (server/accounts/billing.mjs, Meldung invoice.paid): erste Zahlung schaltet Plus frei, jede weitere verlängert.
    Abbestellbar wie die Benachrichtigungen (Token mit Bezug 'b', billingOff) */
 plus_paid:({first,amount,until,receipt,test,token},{site})=>{
  const head=first?`Ihre Zahlung über ${amount} ist eingegangen. Plus ist für Ihr Konto freigeschaltet.`:`Ihre Zahlung über ${amount} ist eingegangen. Plus läuft weiter.`;
  const next=until?`Nächste Abrechnung am ${deDate(until)}; Plus verlängert sich monatlich, bis Sie kündigen.`:'';
  const note=test?'Testmodus: Es wurde kein echtes Geld abgebucht.':'';
  const off=billingOff(token,site);
  return {
   subject:first?'Zahlung eingegangen: Plus ist freigeschaltet':'Zahlung eingegangen: Plus verlängert',
   text:[head,next,receipt?`Beleg: ${receipt}`:'',`Abo verwalten (kündigen, Zahlart, Rechnungen): ${site}/konto/profil`,note,off.text].filter(Boolean).join('\n'),
   html:page('Zahlung eingegangen',[p(head),next?p(next):'',receipt?html`<p style="margin:0 0 12px"><a href="${receipt}">Beleg ansehen</a></p>`:'',button(site+'/konto/profil','Zum Konto'),
    p('Kündigen, Zahlart ändern und Rechnungen finden Sie im Konto unter „Abo verwalten“.'),note?p(note):'',off.html]),
   headers:off.headers,
  };
 },
 /* Plus endet in höchstens 3 Tagen und wird nicht verlängert (scripts/accounts/maintenance.mjs): gekündigt, Zahlung offen
    oder eine Freischaltung von Hand mit Ende. Abbestellbar wie plus_paid */
 plus_ending:({until,reason,token},{site})=>{
  const lead=reason==='canceled'?`Sie haben Plus gekündigt. Plus endet am ${deDate(until)}.`
   :reason==='payment'?`Die letzte Zahlung für Plus ist nicht eingegangen. Ohne Zahlung endet Plus am ${deDate(until)}.`
   :`Ihr Zugang zu Plus endet am ${deDate(until)}.`;
  const after='Danach gelten die Rechte des kostenlosen Kontos; Ihr Konto bleibt bestehen.';
  const act=reason==='payment'?'Bitte prüfen Sie Ihre Zahlart im Konto unter „Abo verwalten“.':reason==='canceled'?'Die Kündigung können Sie bis dahin im Konto unter „Abo verwalten“ zurücknehmen.':'Plus können Sie jederzeit buchen.';
  const target=reason==='grant'?site+'/preise':site+'/konto/profil';
  const off=billingOff(token,site);
  return {
   subject:'Ihr Plus endet in wenigen Tagen',
   text:[lead,after,act,target,off.text].filter(Boolean).join('\n'),
   html:page('Plus endet',[p(lead),p(after),p(act),button(target,reason==='grant'?'Stufen ansehen':'Zum Konto'),off.html]),
   headers:off.headers,
  };
 },
 /* Kündigungsbestätigung nach § 312k Abs. 4 BGB (server/accounts/cancel.mjs): Inhalt der Kündigung, Eingang mit Datum und
    Uhrzeit, Vertragsende. Geht an jede angegebene Adresse und ist nicht abbestellbar */
 cancel_received:({receivedAt,kind,reason,when,date,result,endsAt},{site})=>{
  const lines=[`Eingegangen am ${deTime(receivedAt)}`,'Vertrag: Plenara Plus',
   `Art: ${kind==='extraordinary'?'außerordentliche Kündigung':'ordentliche Kündigung'}`,...(kind==='extraordinary'&&reason?[`Grund: ${reason}`]:[]),
   `Gewünschter Zeitpunkt: ${when==='date'&&date?`zum ${deDate(date)}`:'zum nächstmöglichen Zeitpunkt'}`];
  const outcome=result==='canceled'?`Ihr Abo endet am ${deDate(endsAt)}. Bis dahin können Sie Plus nutzen; danach wird nichts mehr abgebucht.`
   :result==='review'?`Ihre außerordentliche Kündigung prüfen wir und melden uns. Unabhängig davon endet Ihr Abo spätestens am ${deDate(endsAt)}; es wird nichts mehr abgebucht.`
   :result==='none'?`Zu dieser E-Mail-Adresse finden wir kein laufendes Plus-Abo. Haben Sie Plus mit einer anderen Adresse gebucht, kündigen Sie bitte mit jener Adresse: ${site}/kuendigen`
   :'Wir bearbeiten Ihre Kündigung und bestätigen Ihnen das Vertragsende in Kürze.';
  const keep='Bitte bewahren Sie diese E-Mail als Nachweis auf.';
  return {
   subject:'Ihre Kündigung bei Plenara ist eingegangen',
   text:['Ihre Kündigung ist bei uns eingegangen.','',...lines,'',outcome,'',keep].join('\n'),
   html:page('Kündigung eingegangen',[p('Ihre Kündigung ist bei uns eingegangen.'),html`<p style="margin:0 0 12px;line-height:1.5">${lines.map((l,i)=>i?html`<br>${l}`:l)}</p>`,p(outcome),p(keep)]),
  };
 },
 inactive:(_d,{site})=>({
  subject:'Ihr Plenara-Konto wird bald gelöscht',
  text:`Ihr Plenara-Konto wurde seit zwei Jahren nicht genutzt. Melden Sie sich in den nächsten 30 Tagen unter ${site}/anmelden an, wenn Sie es behalten möchten; sonst löschen wir es mit allen gespeicherten Daten.`,
  html:page('Konto nicht genutzt',[p('Ihr Plenara-Konto wurde seit zwei Jahren nicht genutzt.'),p('Melden Sie sich in den nächsten 30 Tagen an, wenn Sie es behalten möchten; sonst löschen wir es mit allen gespeicherten Daten.'),button(site+'/anmelden','Anmelden')]),
 }),
 notify:(data,{site})=>notifyMail(data,{site}),
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
/*
 * Benachrichtigung (server/accounts/notify.mjs): Abschnitte je Suche, Vorgang und Kalender. Der Betreff nennt keine Namen der
 * Suchen (die schreibt der Nutzer selbst). Abbestellen: Kopfzeilen nach RFC 8058 (Ein-Klick-POST an die API) und Links
 * auf die Seite /abbestellen, die erst nach einem Klick abbestellt.
 * data: {token, groups:[{kind:'search'|'article'|'calendar', title, link, token, more, items:[{title, place, gremium, date,
 * status, note, link}]}]}
 */
const SUBJECT={search:'zu Ihren Suchen',article:'zu Ihren Vorgängen',calendar:'in Ihren Kalendergebieten'};
const GROUP_HEAD={search:'Neue Treffer der Suche',article:'Neues zum Vorgang',calendar:'Neue Sitzungen'};
const GROUP_OFF={search:'Diese Suche nicht mehr melden',article:'Diesen Vorgang nicht mehr melden',calendar:'Keine Kalender-Mails mehr'};
const DISCLAIMER='Ohne Gewähr. Maßgeblich sind die Originalunterlagen der Kommune.';
const deDate=d=>/^\d{4}-\d{2}-\d{2}/.test(String(d||''))?String(d).slice(0,10).split('-').reverse().join('.'):'';
function notifyMail({token,groups=[]},{site}){
 const count=groups.reduce((n,g)=>n+(g.items?.length||0)+(g.more||0),0);
 const kinds=[...new Set(groups.map(g=>g.kind))];
 const subject=`Plenara: ${count} ${count===1?'Neuigkeit':'Neuigkeiten'} ${kinds.length===1?SUBJECT[kinds[0]]:'aus Ihren Benachrichtigungen'}`;
 /* Token im Fragment wie beim Anmeldelink: erreicht nie ein Server-Protokoll; die Seite schickt es erst nach dem Klick */
 const off=t=>`${site}/abbestellen#t=${encodeURIComponent(t)}`;
 const settings=`${site}/konto/benachrichtigungen`;
 const meta=i=>[i.place,i.gremium,deDate(i.date),i.status].filter(Boolean).join(' · ');
 const text=[
  ...groups.flatMap(g=>[
   `${GROUP_HEAD[g.kind]}${g.title?` „${g.title}“`:''}`,'',
   ...g.items.flatMap(i=>[`• ${i.title}`,`  ${meta(i)}`,...(i.note?[`  ${i.note}`]:[]),`  ${i.link}`,'']),
   ...(g.more?[`… und ${g.more} weitere: ${g.link}`,'']:[]),
   `${GROUP_OFF[g.kind]}: ${off(g.token)}`,'','',
  ]),
  DISCLAIMER,
  `Einstellungen: ${settings}`,
  `Alle Benachrichtigungen abbestellen: ${off(token)}`,
 ].join('\n');
 const small=(href,label)=>html`<p style="margin:8px 0 0;font-size:13px"><a href="${href}" style="color:#6b7280">${label}</a></p>`;
 const body=[
  ...groups.map(g=>html`<h2 style="margin:24px 0 8px;font-size:16px">${GROUP_HEAD[g.kind]}${g.title?html` „<a href="${g.link}" style="color:#0f5e66">${g.title}</a>“`:''}</h2>
${g.items.map(i=>html`<div style="margin:0 0 14px"><a href="${i.link}" style="font-weight:bold;color:#1f2937;text-decoration:none">${i.title}</a><br><span style="font-size:13px;color:#6b7280">${meta(i)}</span>${i.note?html`<br><span style="font-size:13px;color:#0f5e66">${i.note}</span>`:''}</div>`)}
${g.more?html`<p style="margin:0 0 8px"><a href="${g.link}" style="color:#0f5e66">… und ${g.more} weitere</a></p>`:''}${small(off(g.token),GROUP_OFF[g.kind])}`),
  html`<p style="margin:28px 0 0;font-size:12px;color:#6b7280">${DISCLAIMER}<br><a href="${settings}" style="color:#6b7280">Einstellungen</a> · <a href="${off(token)}" style="color:#6b7280">Alle Benachrichtigungen abbestellen</a></p>`,
 ];
 return {subject,text,html:page(subject,body),headers:{'List-Unsubscribe':`<${site}/api/notify/unsubscribe?t=${encodeURIComponent(token)}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
export function render(template,data,{site}){
 const fn=T[template];
 if(!fn)throw new Error('Unbekannte Mailvorlage: '+template);
 return fn(data||{},{site});
}
