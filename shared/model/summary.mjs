// Zusammenfassung aus dem Modell (Kernsätze, Begriffsbuch Abschnitt 12): Merkmale je Satzkandidat und Auswahl der Kurz- und
// Langfassung aus den Wahrscheinlichkeiten des Satzkopfs (scripts/model/train-summary.mjs). Nur wörtliche Sätze des Dokuments.
export const SUMMARY_FEATURES_VERSION='sumfeat-v1';
/** Fassung der Auswahl (Filter usable, Säuberung tidy); geht in die Lesefassung ein (READ_VERSION) */
export const SUMMARY_PICK_VERSION='pick-v3';
const words=s=>String(s).toLowerCase().match(/[\p{L}\d]+/gu)||[];
const parts=(s,p)=>{const out=[];for(const w of words(s)){if(w.length<3)continue;out.push(p+'w:'+w);const b='<'+w+'>';for(let i=0;i+4<=b.length;i++)out.push(p+b.slice(i,i+4));}return out;};
const bucket=(x,steps)=>steps.findIndex(s=>x<=s);

/** Dünne Merkmale eines Satzes (Namen); cands: alle Kandidaten des Dokuments, title: Titel des Berichts */
export function sentenceFeatures(c,cands,title){
 const ws=words(c.text),tw=new Set(words(title).filter(w=>w.length>=4)),overlap=ws.filter(w=>tw.has(w)).length;
 const f=[...parts(c.text,''),'sec:'+c.sec,'pos:'+Math.min(c.i,12),'rel:'+bucket(c.i/Math.max(1,cands.length),[0.1,0.25,0.5,0.75,1]),
  'len:'+bucket(ws.length,[6,10,15,20,30,45,999]),'tov:'+Math.min(overlap,4),'start:'+ws.slice(0,2).join('_'),'first:'+(ws[0]||''),
  'secpos:'+c.sec+':'+Math.min(cands.filter(x=>x.sec===c.sec&&x.i<c.i).length,4)];
 if(/\d/.test(c.text))f.push('num');if(/€|euro|eur\b/i.test(c.text))f.push('eur');if(/§/.test(c.text))f.push('para');
 if(/[:;]$/.test(c.text.trim())||!/[.!?]["“”)]?$/.test(c.text.trim()))f.push('open');
 if(/\b(beschlie(ß|ss)t|beauftragt|stimmt|empfiehlt|nimmt .* zur kenntnis|wird gebeten)\b/i.test(c.text))f.push('verb:decide');
 return f;
}
/**
 * Kurz- und Langfassung aus den Wahrscheinlichkeiten je Satz. Keine Zusammenfassung, wenn kein Satz die Schwelle tNone für die
 * Kurzfassung erreicht. Kurz: bester Satz, ein zweiter nur bei hoher Wahrscheinlichkeit und zusammen höchstens 40 Wörtern.
 * Lang: Kurzfassung plus Sätze ab tLong, beste zuerst, bis 6 Sätze oder 140 Wörter, in der Reihenfolge des Dokuments.
 * @param {{i:number,text:string}[]} cands @param {{i:number,short:number,long:number}[]} p
 */
export function pickSummary(cands,p,{tNone,tLong}){
 if(!p.length)return null;
 const byShort=[...p].sort((a,b)=>b.short-a.short);if(byShort[0].short<tNone)return null;
 const len=i=>words(cands.find(c=>c.i===i)?.text||'').length;
 const short=[byShort[0].i];
 if(byShort[1]&&byShort[1].short>=0.5&&len(short[0])+len(byShort[1].i)<=40)short.push(byShort[1].i);
 const long=[...short];let n=short.reduce((a,i)=>a+len(i),0);
 for(const x of [...p].sort((a,b)=>b.long-a.long)){if(long.length>=6)break;if(x.long<tLong)break;if(long.includes(x.i))continue;if(n+len(x.i)>140)continue;long.push(x.i);n+=len(x.i);}
 return {short:short.sort((a,b)=>a-b),long:long.sort((a,b)=>a-b)};
}

/* Vorspann vor dem eigentlichen Satz („Beschlussvorschlag: 1.“, „Der Kreistag möge Folgendes beschließen:“) gehört nicht in den Auszug */
const LEAD=[/^(?:Beschlussvorschlag|Beschlussvorlage|Beschlussempfehlung|Beschlusstext|Beschluss)\b[^:.]{0,80}:\s*/i,/^.{0,140}?\bmögen? (?:folgendes|Folgendes|wie folgt) beschließen:\s*/,/^(?:\d{1,2}|[IVX]{1,5}|[A-Za-z])[.)]\s+(?=\p{Lu})/u,/^[–-]\s*/,/^[„"]\s*/];
/* Kopf vor dem Beschlussvorschlag im selben Kandidaten (Titel, „Für den Ausschuss -öffentlich-“, „Referent:“, „Finanzielle Auswirkungen: ---“,
   „Lauf der Vorlage …“): alles bis zur letzten Marke in den ersten 400 Zeichen fällt weg, wenn danach ein Satz bleibt (Stichprobe 23.10.2026) */
const MARK=/(?:\b(?:Beschlussvorschlag|Beschlussantrag|Beschlussempfehlung|Beschlusstext|Beschluss)\s*:|\bmögen? (?:folgendes |Folgendes |wie folgt )?beschließen:)\s*/g;
const HAS_MARK=new RegExp(MARK.source);
/* Für den Kopf zählen auch Abschnittsmarken („18.11.2025 Ausschuss … Sachverhalt: Im Zuge …“), für den Filter der Formfelder nicht */
const HEAD=new RegExp(MARK.source.replace('Beschluss)\\s*:','Beschluss|Sachverhalt|Sachdarstellung|Begründung)\\s*:'),'g');
function dropHead(t){
 let cut=-1;for(const m of t.slice(0,400).matchAll(HEAD))cut=m.index+m[0].length;
 const rest=cut>0?t.slice(cut):t;return rest.replace(/^[\d.)\s]*/,'').length>=30?rest:t;
}
export const tidy=s=>{let t=dropHead(String(s).replace(/[_=*]{3,}|-{3,}/g,' ').replace(/\s+/g,' ').trim()),prev;do{prev=t;for(const re of LEAD)t=t.replace(re,'');}while(t!==prev);return t?t[0].toUpperCase()+t.slice(1):t;};
/* Abkürzungen, an denen die Satztrennung schneidet (die Trennung selbst bleibt, die Lerndaten zeigen auf ihre Kandidaten) */
const CUT_ABBR=/\b(?:Pos|Co|Ziff|Kap|Anl|Tz)\.$/;
const LABEL=/(?:^|\s)\p{Lu}[\p{L}-]+(?: [\p{L}-]+){0,2}\s*:\s/gu;
/**
 * Taugt der Kandidat als Satz der Zusammenfassung? Nein bei: Satz endet mit Doppelpunkt (eine Tabelle oder Antwort folgt),
 * Tabellenrest (drei und mehr Beträge oder überwiegend Zahlen), Formularfeldern ohne Beschlussvorschlag („Sachdarstellung: s.
 * Beschlussvorschlag Finanzielle Auswirkung: …“), Bruchstück einer an einer Abkürzung zerschnittenen Stelle („6.1 der Richtlinien …“
 * nach „Pos.“, „KG aus …“ nach „GmbH & Co.“). Gilt nur für die Auswahl; die Kandidaten und ihre Nummern bleiben.
 */
export function usable(c,prev){
 const t=tidy(c.text);
 if(t.length<30||/:\s*$/.test(t))return false;
 if((t.match(/\d[\d.,]*\s*(?:€|EUR\b|Euro\b)/g)||[]).length>=3)return false;
 if((t.match(/\d/g)||[]).length>t.length*0.25)return false;
 if(!HAS_MARK.test(c.text)&&(c.text.match(LABEL)||[]).length>=2)return false;
 if(CUT_ABBR.test(c.text.trim())||(prev&&CUT_ABBR.test(prev.text.trim())))return false;
 return true;
}
/** Wahrscheinlichkeiten je Satz aus den gespeicherten Gewichten (summary.json) */
export function sentenceProbs(model,cands,title){
 return cands.map(c=>{let z0=model.bias[0],z1=model.bias[1];for(const f of new Set(sentenceFeatures(c,cands,title))){const w=model.weights[f];if(w){z0+=w[0];z1+=w[1];}}return {i:c.i,short:1/(1+Math.exp(-z0)),long:1/(1+Math.exp(-z1))};});
}
/**
 * Zusammenfassung aus dem Modell im Format der Regel-Zusammenfassung (payload.ruleSummary, Suchkarte, Artikelseite): wörtliche Sätze,
 * Lücken zwischen nicht benachbarten Sätzen, Güte = mittlere Wahrscheinlichkeit der gewählten Sätze. null, wenn das Modell keine sieht.
 * @param {{i:number,text:string,sec:string}[]} cands Satzkandidaten (sentences.mjs) @param {any} model summary.json
 */
export function modelSummary(cands,title,model,{at=new Date().toISOString(),source=null}={}){
 const p=sentenceProbs(model,cands,title).map((x,k)=>usable(cands[k],cands[k-1])?x:{...x,short:0,long:0}),o=pickSummary(cands,p,model.thresholds);if(!o)return null;
 const part=(ids,key)=>{const s=ids.map(i=>tidy(cands[i].text)).filter(Boolean);return {sentences:s,gaps:ids.map((i,k)=>k>0&&i-ids[k-1]>1),words:s.join(' ').split(/\s+/).length,
  score:Math.round(100*ids.reduce((a,i)=>a+p[i][key],0)/Math.max(1,ids.length))};};
 const short=part(o.short,'short'),long=part(o.long,'long');
 return {version:4,generatedBy:'Zusammenfassung aus dem Modell',model:model.version,generatedAt:at,...(source?.url?{source:{url:source.url,title:source.title||''}}:{}),
  score:Math.round((short.score+long.score)/2),short,long};
}
