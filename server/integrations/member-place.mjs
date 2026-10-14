// Mitgliedsgemeinde im Gemeindeverband (früher Teil der Kopfmodule der Themenradare): wo ein Vorgang eines Verbands spielt,
// für Listen und Ortsangaben in plenara.X (Atlas, Ausbreitung, Newsradar, Listen hinter den Zahlen).
/* Gemeindeverbände (Samtgemeinde, Verbandsgemeinde, Amt) beraten auch für ihre Mitgliedsgemeinden: Hebesätze und Gebühren
   gelten dann für die Gemeinde, deren Rat berät („Ortsgemeinderat Limbach“) oder die der Titel nennt („Haushaltssatzung der
   Gemeinde Warberg“), nicht für den Verband */
const UNION=/^(Samtgemeinde|Verbandsgemeinde|Amt|Verwaltungsgemeinschaft|Verwaltungsverband|Gemeindeverwaltungsverband) /;
const MEMBER=/\b(?:der|des)\s+(Ortsgemeinde|Gemeinde|Stadt|Flecken|Markt)\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s(?:am|an|im|in|bei|ob|a\.|i\.)\s?[A-ZÄÖÜ]?[\wäöüß.-]+)?)/;
const COUNCIL=/^(?:Ortsgemeinderat|Gemeinderat|Stadtrat|Rat|Gemeindevertretung|Stadtvertretung|Stadtverordnetenversammlung)\s+(?:der\s+|des\s+)?(?:(Ortsgemeinde|Gemeinde|Stadt|Flecken|Markt)\s+)?([A-ZÄÖÜ][\wäöüß.-]+(?:\s(?:am|an|im|in|bei|ob|a\.|i\.)\s?[A-ZÄÖÜ]?[\wäöüß.-]+)?)/;
/* members (optional, aus dem Katalog): Nennt der Titel genau eine Mitgliedsgemeinde als ganzes Wort („Leichenhalle Niederehe“),
   gilt sie, wenn weder Gremium noch „der Gemeinde X“ eine nennen */
const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function where(regionName,title,gremium='',members=null){
 if(!UNION.test(regionName))return {key:'',label:regionName};
 // Gremium einer Mitgliedsgemeinde, das sie beim Namen nennt („Sozialausschuss der Gemeinde Elmenhorst“, „Marktgemeinderat
 // Massing“, „Gemeinderat (Moxa)“, „Stadtrat der Stadt Bad Marienberg“): genau eine Mitgliedsgemeinde als ganzes Wort
 const base=x=>x.replace(/\s*\(.*\)$/,'');
 // Der Verband trägt oft den Namen einer Mitgliedsgemeinde (VG Massing): deren Rat zählt, Ausschüsse des Verbands nicht
 const ownCouncil=/^(?:Markt|Stadt|Orts)?gemeinderat\b|^Stadtrat\b|^Rat der (?:Stadt|Gemeinde)\b|^Gemeindevertretung\b|^Stadtverordneten|^SVV\b|^Stadtvertretung\b/i.test(gremium||'');
 const inGremium=(members||[]).filter(x=>x.name&&(ownCouncil||!regionName.endsWith(' '+x.name)&&!regionName.endsWith(' '+base(x.name)))&&new RegExp(`(^|[^\\wäöüß])${esc(base(x.name))}($|[^\\wäöüß-])`).test(String(gremium||'')));
 if(inGremium.length===1&&!/^(?:Samt|Verbands)gemeinderat|^Amtsausschuss|^Gemeinschaftsversammlung|^Rat der (?:Samt|Verbands)gemeinde|verband|^Werkausschuss der (?:Samt|Verbands)gemeinde/i.test(gremium)){const n=inGremium[0].name;return {key:n,label:`${/^Ortsgemeinderat/.test(gremium)?'Ortsgemeinde':/\bStadt\b|^Stadtrat|^SVV|Stadtverordneten/.test(gremium)?'Stadt':/^Markt/.test(gremium)?'Markt':'Gemeinde'} ${n} (${regionName})`};}
 const g=String(gremium||'').match(COUNCIL);
 if(g&&!/gemeinde$|^(Samt|Verbands)|^Amt/i.test(g[2]))return {key:g[2],label:`${/^Ortsgemeinderat/.test(gremium)?'Ortsgemeinde':g[1]||'Gemeinde'} ${g[2]} (${regionName})`};
 const m=String(title||'').match(MEMBER);
 if(m)return {key:m[2],label:`${m[1]} ${m[2]} (${regionName})`};
 const named=(members||[]).filter(x=>x.name&&new RegExp(`(^|[^\\wäöüß])${esc(x.name)}($|[^\\wäöüß-])`).test(String(title||'')));
 const own=named.length===1&&!regionName.endsWith(' '+named[0].name);
 return own?{key:named[0].name,label:`${/^Ortsgemeinderat/.test(gremium)?'Ortsgemeinde':'Gemeinde'} ${named[0].name} (${regionName})`}:{key:'',label:regionName};
}
