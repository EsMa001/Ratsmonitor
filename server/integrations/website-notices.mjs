import {committeeOf,germanDates} from './website-text.mjs';
// Notices of a decision without an agenda (decision of the project owner, 24.10.2026): many gazettes and notice pages publish no
// agenda, but notices of what a council decided („Der Ortsgemeinderat Breitenbach hat in seiner Sitzung am 15.05.2025 den
// Aufstellungsbeschluss … gefasst“, Bebauungsplan, Flächennutzungsplan, Satzungen, Veränderungssperre, Vorkaufsrecht).
// Such a notice is a report of THAT meeting: its body and day from the text, its title the matter of the notice (link text or
// file name, otherwise the heading), status decided, the notice as its document. Notices without a decision of a body named
// with its meeting (a Widmungsverfügung „nach dem Beschluss … vom“, an ordinance) are not taken for now.

// „<Gremium> hat in seiner / ihrer / der (öffentlichen) Sitzung am / vom TT.MM.JJJJ“; also „… in öffentlicher Sitzung am“.
const DECIDED=/((?:Der|Die|Das)\s+)?([\p{Lu}][\p{L}.-]*(?:\s+[\p{L}.-]+){0,6}?)\s+(?:hat|haben)\s+(?:(?:in|auf)\s+(?:seiner|ihrer|der|einer)\s+|in\s+)(?:(nicht\s*-?\s*)?öffentliche[rn]?\s+)?Sitzung\s+(?:am|vom)\s+(?:\p{L}+,?\s+(?:den\s+)?)?(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{1,2}\.\s?\p{L}+\s+\d{4})/u;
// The other order of the same sentence: „Der Gemeinderat der Stadt Walldorf hat am 24.02.2026 in öffentlicher Sitzung …“ (Walldorf,
// Sindelfingen 2026). Groups as DECIDED, the day moved behind the verb: 1 article, 2 body, 3 day, 4 nonpublic part.
const DECIDED_AM=/((?:Der|Die|Das)\s+)?([\p{Lu}][\p{L}.-]*(?:\s+[\p{L}.-]+){0,6}?)\s+(?:hat|haben)\s+am\s+(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4})\s+in\s+(?:(nicht\s*-?\s*)?öffentlicher?\s+)?Sitzung/u;
// The teaser form: „Der Rat hat sie laut Anreißer am 15.12.2021 als Satzung beschlossen“, „Der Infrastrukturausschuss hat am 19.09.2024 beschlossen“ (Hüllhorst).
// Groups: 1 article, 2 body, 3 day; the nonpublic part is never named here. Short phrases only, never across a sentence.
const DECIDED_BESCHL=/((?:Der|Die|Das)\s+)?([\p{Lu}][\p{L}.-]*(?:\s+[\p{L}.-]+){0,6}?)\s+(?:hat|haben)\s+[^.]{0,80}?\s+am\s+(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4})\s+[^.]{0,60}?beschlossen/u;
// Not a decision of a council for now: a dedication of a road, an ordinance, a general order.
const NOT_TAKEN=/widmung|entwidmung|umstufung|rechtsverordnung|(?<!\p{L})verordnung|allgemeinverfügung|polizeiverordnung/iu;
// Words of the notice itself, not of its matter.
const FRAME=[
 /^(?:amtliche\s+|öffentliche\s+)?bekanntmachung(?:en)?(?:\s+(?:der|des)\s+(?:og|ortsgemeinde|vg|verbandsgemeinde|stadt|gemeinde|ortsgemeinderat\p{L}*|stadtrat\p{L}*)\s+[\p{L}.-]+(?:-[\p{L}]+)*)?\s*/iu,
 /^(?:gem(?:äß|\.)?\s+)?§+\s*[\d\s,.a-zA-Z]*(?:i\.\s?V\.\s?m\.\s*§+\s*[\d\s,.a-zA-Z]*)*(?:baugb|gemo|go|kv)\b\s*/iu,
 /^vollzug\s+des\s+baug(?:esetzbuche)?s?b?(?:\s*\(baugb\))?\s*/iu,
 /^(?:der\s+|über\s+die\s+)?(?:frühzeitige[rn]?\s+)?beteiligung\s+der\s+öffentlichkeit(?:\s+(?:und\s+der\s+behörden|zur|zum|des|der|am|an\s+der|gem\.?\s+§+\s*[\d\s,.]+(?:abs\.\s*\d+\s*)?baugb))*\s*/iu,
];
const ISO=d=>d?.iso||null;
/** The matter of a notice from its link text or file name: „Öffentliche Bekanntmachung der OG Matzenbach - Vollzug des BauGB - 2. Satzung über die Veränderungssperre - Reuschbacher- u. Bergstraße vom 22.07.2026.pdf“ → „2. Satzung über die Veränderungssperre - Reuschbacher- u. Bergstraße“. */
export function noticeMatter(label){
 let s=String(label||'').replace(/\.pdf$/i,'').replace(/[_+]/g,' ').replace(/\s+/g,' ').trim();
 s=s.replace(/\s+(?:vom|v\.)\s+\d{1,2}\.\d{1,2}\.\d{2,4}\.?\s*$/i,'').replace(/\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s*$/,'');
 const parts=s.split(/\s+[-–]\s+/).map(p=>{let x=p.trim();for(let k=0;k<3;k++)for(const f of FRAME)x=x.replace(f,'').trim();return x.replace(/^[-–:,\s]+|[-–:,\s]+$/g,'');}).filter(p=>p.length>=3&&!/^(?:der\s+)?(?:og|vg|ortsgemeinde|verbandsgemeinde|stadt|gemeinde)\s+[\p{L}.-]+$/iu.test(p));
 return parts.join(' - ');
}
/** The matter from the heading of the text: the lines above the sentence of the decision, without the frame of the notice. */
function headingMatter(lines,at){
 const out=[];
 for(const raw of lines.slice(0,at)){let l=raw.trim();for(let k=0;k<3;k++)for(const f of FRAME)l=l.replace(f,'').trim();l=l.replace(/^[-–:,\s]+|[-–:,\s]+$/g,'');
  if(l.length<3||/^(?:der|des)?\s*(?:ortsgemeinde|verbandsgemeinde|stadt|gemeinde|og|vg)\s+[\p{L}.-]+$/iu.test(l))continue;out.push(l);if(out.join(' ').length>120)break;}
 return out.join(' ').replace(/\s+/g,' ').trim();
}
/**
 * A notice of a decision: {date, committee, title, publicity, sentence} or null. label: link text or file name; lines: the text.
 * Only where a body is named with its meeting and day, and the notice is no dedication, ordinance or general order.
 */
export function decisionNotice(label,lines){
 const all=(lines||[]).map(l=>String(l)),flat=all.join(' ').replace(/\s+/g,' ');
 if(NOT_TAKEN.test(String(label||''))||NOT_TAKEN.test(all.slice(0,6).join(' ')))return null;
 const m0=flat.match(DECIDED),am=m0?null:flat.match(DECIDED_AM),bs=m0||am?null:flat.match(DECIDED_BESCHL);if(!m0&&!am&&!bs)return null;
 const m=m0||(am?Object.assign([am[0],am[1],am[2],am[4],am[3]],{index:am.index}):Object.assign([bs[0],bs[1],bs[2],undefined,bs[3]],{index:bs.index}));
 // A bare „Rat“ (teaser form: „Der Rat hat …“) is the council of the place, named as committeeOf names it.
 const committee=committeeOf(m[2])||(/^(?:Der\s+)?Rat$/u.test(m[2])?'Rat der Gemeinde':null);if(!committee)return null;
 const date=ISO(germanDates(m[4])[0]);if(!date)return null;
 // The line the sentence starts in: what stands above it is the heading.
 const head=m[2].split(/\s+/)[0],at=Math.max(0,all.findIndex(l=>l.includes(head)&&/\b(?:hat|haben)\b|Sitzung/.test(l+' ')));
 // The label of a gazette issue names the issue ("Nr. 42 vom 21.10.2026 …"): then the heading of the notice gives the matter.
 const issueLabel=/^(?:nr\.?\s*\d|amtliche[sr]?\s|amtsblatt|amtliches?\s|bekanntmachungsblatt|mitteilungsblatt)|\bPDF\s*\|/i.test(String(label||'').trim());
 const sentenceTitle=flat.slice(m.index,m.index+400).replace(/^.*?(?:beschlossen|gefasst|gefasst\.)\s*/i,'').replace(/[.;:]\s*$/,'').slice(0,120).trim();
 const title=(!issueLabel&&noticeMatter(label))||headingMatter(all,at)||(issueLabel?sentenceTitle:noticeMatter(label));if(!title||title.length<6||/^(?:§|[Ss]atz\s*\d|[Aa]bs\.|[Nn]r\.|\(|\p{Ll})/u.test(title))return null;
 const end=flat.indexOf('.',m.index+m[0].length);
 return {date,committee,title,publicity:m[3]?'nonpublic':'public',sentence:flat.slice(m.index,end>0?Math.min(end+1,m.index+400):m.index+400).trim()};
}
